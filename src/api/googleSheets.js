import { SHEET_ID } from '../authConfig.js';
import { calcMetrics, parseLOBName } from '../utils/lobParser.js';

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

function authHeader(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// Fix 2 — parse JSON error body so messages are readable, not raw JSON strings
async function parseError(res, context) {
  let msg = `HTTP ${res.status}`;
  try {
    const j = await res.json();
    msg = j?.error?.message || j?.error?.status || msg;
  } catch {
    try { msg = await res.text() || msg; } catch { /* keep default */ }
  }
  const err = new Error(`${context}: ${msg}`);
  err.httpStatus = res.status;
  return err;
}

// A→1, B→2 … Z→26, AA→27
function colLetter(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Read tab → array of objects (row 1 = keys). Each object has _row (1-based sheet row).
export async function sheetsRead(tab, token) {
  const res = await fetch(`${BASE}/values/${encodeURIComponent(tab)}`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw await parseError(res, `sheetsRead "${tab}"`);
  const { values = [] } = await res.json();
  if (values.length < 2) return [];
  const headers = values[0];
  return values
    .slice(1)
    .map((row, i) => {
      const obj = { _row: i + 2 };
      headers.forEach((h, j) => { obj[h] = row[j] ?? ''; });
      return obj;
    })
    .filter(r => headers.some(h => r[h] !== ''));
}

// Read just the header row from a tab.
export async function sheetsGetHeaders(tab, token) {
  const res = await fetch(`${BASE}/values/${encodeURIComponent(tab)}!1:1`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw await parseError(res, 'sheetsGetHeaders');
  const { values = [] } = await res.json();
  return values[0] || [];
}

// Append one row to tab.
export async function sheetsAppend(tab, rowArray, token) {
  const res = await fetch(
    `${BASE}/values/${encodeURIComponent(tab)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({ values: [rowArray] }),
    }
  );
  if (!res.ok) throw await parseError(res, `sheetsAppend "${tab}"`);
}

// Update a specific row (rowNum is 1-based sheet row).
export async function sheetsUpdate(tab, rowNum, rowArray, token) {
  const endCol = colLetter(rowArray.length);
  const range  = `${tab}!A${rowNum}:${endCol}${rowNum}`;
  const res = await fetch(
    `${BASE}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify({ values: [rowArray] }),
    }
  );
  if (!res.ok) throw await parseError(res, `sheetsUpdate row ${rowNum}`);
}

// Serialize an object to an array ordered by headers array.
function serialize(obj, headers) {
  return headers.map(h => {
    const v = obj[h];
    if (v === null || v === undefined) return '';
    return v;
  });
}

// Number fields that should be parsed from strings.
const NUM_FIELDS = [
  'HC', 'HCReq', 'AttritionPct', 'OOOShrinkagePct', 'IOShrinkagePct',
  'ExpectedDelivery', 'ScheduleInflux', 'TrainingHC', 'ClassRequestedHC',
  'ClassStartedHC', 'ClassGraduateHC', 'ClientForecastFTE',
];

function enrichRow(r) {
  const parsed = { ...r };
  NUM_FIELDS.forEach(f => { parsed[f] = parseFloat(r[f]) || 0; });
  const ed = parsed.ExpectedDelivery || 1;
  const m = calcMetrics({
    hc:    parsed.HC,
    hcr:   parsed.HCReq,
    ooo:   parsed.OOOShrinkagePct * 100,
    io:    parsed.IOShrinkagePct  * 100,
    sched: parsed.ScheduleInflux  * 100,
    ed,
  });
  const { channel, country, language } = parseLOBName(r.LOBName);
  return { ...parsed, ...m, channel, country, language };
}

// ─── Public API (same signatures used by mockData.js) ─────────────────────

export async function getPlannerProfile(email, token) {
  const rows = await sheetsRead('Planner_Roster', token);
  return rows.find(r => r.PlannerEmail?.toLowerCase() === email?.toLowerCase()) ?? null;
}

export async function getAllPlanners(token) {
  return sheetsRead('Planner_Roster', token);
}

export async function getAllSubmissions(token) {
  const rows = await sheetsRead('WFM_Submissions', token);
  return rows.map(enrichRow);
}

export async function getMySubmissions(email, token) {
  const all = await getAllSubmissions(token);
  return all.filter(r => r.SubmittedBy?.toLowerCase() === email?.toLowerCase());
}

export async function submitPlan(rows, user, token) {
  const existing = await sheetsRead('WFM_Submissions', token);
  const headers  = await sheetsGetHeaders('WFM_Submissions', token);

  for (const row of rows) {
    const enriched = {
      ...row,
      SubmittedBy: user.email,
      SubmittedAt: new Date().toISOString(),
      Status:      'Submitted',
    };
    // Remove internal tracking field before writing
    const { _row: _r, ...clean } = enriched;

    const match = existing.find(e =>
      e.LOBName    === clean.LOBName &&
      e.SiteName   === clean.SiteName &&
      e.PeriodKey  === clean.PeriodKey &&
      e.SubmittedBy?.toLowerCase() === user.email.toLowerCase()
    );

    const values = serialize(clean, headers);
    if (match) {
      await sheetsUpdate('WFM_Submissions', match._row, values, token);
    } else {
      await sheetsAppend('WFM_Submissions', values, token);
    }
  }
}

export async function isPeriodLocked(periodKey, token) {
  const rows = await sheetsRead('Period_Locks', token);
  return rows.some(r => r.PeriodKey === periodKey && r.IsLocked === 'TRUE');
}

export async function lockPeriod(periodKey, lockedBy, token) {
  await sheetsAppend('Period_Locks', [periodKey, lockedBy, new Date().toISOString(), 'TRUE'], token);
}

// Fix 5 — connection probe: reads the Planner_Roster header row only
export async function testSheetsConnection(token) {
  try {
    const url = `${BASE}/values/Planner_Roster!A1:E1`;
    const res = await fetch(url, { headers: authHeader(token) });
    if (!res.ok) {
      const err = await parseError(res, 'testSheetsConnection');
      console.error('Sheets connection test failed:', err.message);
      return { ok: false, error: err.message };
    }
    const data = await res.json();
    console.log('Sheets connection OK. Header row:', data.values?.[0]);
    return { ok: true };
  } catch (e) {
    console.error('Sheets connection test exception:', e);
    return { ok: false, error: e.message };
  }
}
