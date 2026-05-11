const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SITE_ID    = 'YOUR_SHAREPOINT_SITE_ID';  // replace after SharePoint setup
const LISTS = {
  submissions: 'WFM_Submissions',
  roster:      'Planner_Roster',
  locks:       'Period_Locks',
};

async function getHeaders(msalInstance) {
  const account = msalInstance.getAllAccounts()[0];
  const { accessToken } = await msalInstance.acquireTokenSilent({
    scopes: ['https://graph.microsoft.com/Sites.ReadWrite.All'],
    account,
  });
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

// Upsert rows — match on LOBName + SiteName + PeriodKey + SubmittedBy
export async function submitPlan(rows, msalInstance) {
  const headers = await getHeaders(msalInstance);
  const base = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.submissions}/items`;
  for (const row of rows) {
    const filter = `fields/LOBName eq '${row.LOBName}' and fields/SiteName eq '${row.SiteName}' and fields/PeriodKey eq '${row.PeriodKey}' and fields/SubmittedBy eq '${row.SubmittedBy}'`;
    const check = await fetch(`${base}?$filter=${encodeURIComponent(filter)}`, { headers });
    const { value } = await check.json();
    if (value.length > 0) {
      await fetch(`${base}/${value[0].id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: row }),
      });
    } else {
      await fetch(base, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields: row }),
      });
    }
  }
}

export async function isPeriodLocked(periodKey, msalInstance) {
  const headers = await getHeaders(msalInstance);
  const base = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.locks}/items`;
  const filter = `fields/PeriodKey eq '${periodKey}' and fields/IsLocked eq true`;
  const res = await fetch(`${base}?$filter=${encodeURIComponent(filter)}`, { headers });
  const { value } = await res.json();
  return value.length > 0;
}

export async function lockPeriod(periodKey, managerEmail, msalInstance) {
  const headers = await getHeaders(msalInstance);
  const base = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.locks}/items`;
  await fetch(base, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fields: {
        PeriodKey: periodKey,
        LockedBy: managerEmail,
        LockedAt: new Date().toISOString(),
        IsLocked: true,
      },
    }),
  });
}

// Returns all submissions — manager view (up to 2000 rows)
export async function getAllSubmissions(msalInstance) {
  const headers = await getHeaders(msalInstance);
  const url = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.submissions}/items?$expand=fields&$top=2000`;
  const res = await fetch(url, { headers });
  const { value } = await res.json();
  return value.map(v => v.fields);
}

// Returns only the planner's own rows, filtered by SubmittedBy
export async function getMySubmissions(email, msalInstance) {
  const headers = await getHeaders(msalInstance);
  const base = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.submissions}/items`;
  const filter = `fields/SubmittedBy eq '${email}'`;
  const res = await fetch(`${base}?$filter=${encodeURIComponent(filter)}&$expand=fields&$top=2000`, { headers });
  const { value } = await res.json();
  return value.map(v => v.fields);
}

// Returns the planner's role + scope from Planner_Roster
export async function getPlannerProfile(email, msalInstance) {
  const headers = await getHeaders(msalInstance);
  const base = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.roster}/items`;
  const filter = `fields/PlannerEmail eq '${email}'`;
  const res = await fetch(`${base}?$filter=${encodeURIComponent(filter)}&$expand=fields`, { headers });
  const { value } = await res.json();
  return value.length > 0 ? value[0].fields : null;
}

// Returns all planner roster entries — for manager submission tracker
export async function getAllPlanners(msalInstance) {
  const headers = await getHeaders(msalInstance);
  const url = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.roster}/items?$expand=fields&$top=500`;
  const res = await fetch(url, { headers });
  const { value } = await res.json();
  return value.map(v => v.fields);
}
