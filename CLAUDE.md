# WFM Capacity Plan App — Project Spec

> This file is the single source of truth for Claude Code.
> Read it fully before writing any code.
> Reference conversation: https://claude.ai/chat (WFM Cap Plan session with Manfredd Abrego, May 2026)

---

## 1. What this app is

A web application that replaces a manual Excel + ECP workflow for LATAM Workforce Management capacity planning at Concentrix. Planners across LATAM enter their monthly HC projections directly into this app. The app validates, computes all derived metrics, and writes to SharePoint. Managers get a live consolidated rollup dashboard fed from the same SharePoint list, which also feeds DOMO.

**Owner:** Manfredd Abrego — Manager, Service Delivery, LATAM (Guatemala, WAH)
**Scope:** LATAM region — Sub-regions: South America 1, Central America 1 & 2, Mexico & Caribbean, Brazil 1
**Pilot:** Start with 2–3 countries, ~10 planners. Scale to 75+ users.

---

## 2. Tech stack

- **Frontend:** React + Vite (no Next.js — keep it simple)
- **Auth:** MSAL.js (Microsoft SSO — Concentrix M365 accounts)
- **Backend/DB:** SharePoint Lists via Microsoft Graph API REST
- **Hosting:** Azure Static Web Apps (free tier, M365 org)
- **Notifications:** Power Automate (free with M365) — trigger on SharePoint list item add
- **No Node.js server required** — all API calls go directly from browser to Graph API

> ⚠️ The developer has no admin rights. Do NOT require any global npm installs.
> Use `npx` for everything. Use `npm create vite@latest` to scaffold.
> All dependencies must install into the local project `node_modules` only.

---

## 3. SharePoint lists (the database)

### List 1: `WFM_Submissions`
One row per LOB + Site + Month combination. This is the core data table.

| Column | Type | Notes |
|---|---|---|
| SubClient | Text | From LOB Table |
| LOBName | Text | Full LOB name e.g. `ALLIANZ SE - 000 CO SPA` |
| SiteName | Text | From Site Table |
| Month | Date | First day of month e.g. 2026-04-01 |
| ActualProjected | Text | "Actual" or "Projected" |
| ClientForecastFTE | Number | |
| HC | Number | Projected headcount |
| HCReq | Number | Required headcount |
| AttritionPct | Number | As decimal e.g. 0.031 |
| OOOShrinkagePct | Number | As decimal |
| IOShrinkagePct | Number | As decimal |
| ExpectedDelivery | Number | Usually 1 |
| ScheduleInflux | Number | As decimal |
| TrainingHC | Number | |
| ClassRequestedHC | Number | |
| ClassStartedHC | Number | |
| ClassGraduateHC | Number | |
| SubmittedBy | Text | User email from MSAL |
| SubmittedAt | DateTime | Auto-timestamp |
| PeriodKey | Text | e.g. "2026-04" — used for lock checks |
| Status | Text | "Draft" or "Submitted" |

### List 2: `Planner_Roster`
| Column | Type | Notes |
|---|---|---|
| PlannerEmail | Text | M365 email |
| PlannerName | Text | |
| Role | Text | "Planner" or "Manager" or "Exec" |
| AllowedCountries | Text | Comma-separated country codes e.g. "CO,SV" |
| AllowedSubClients | Text | Comma-separated |

### List 3: `Period_Locks`
| Column | Type | Notes |
|---|---|---|
| PeriodKey | Text | e.g. "2026-04" |
| LockedBy | Text | Manager email |
| LockedAt | DateTime | |
| IsLocked | Boolean | |

---

## 4. Reference data (from Excel file tabs)

**File:** `LATAM_Manual_HC_Data_04-19-2026.xlsx`

### LOB name parse rule
LOB names follow the format: `CLIENT_NAME - CHANNEL COUNTRY LANGUAGE`
The last 3 space-separated tokens after the final ` - ` are:
- Position -3: **Channel code** (IBV, OBV, BAO, CHT, EMA, MSG, SMA, OFF, 000)
- Position -2: **Country code** (BR, CO, GT, MX, NI, PE, PT, SV, TR, US)
- Position -1: **Language code** (SPA, POR, ENG, FRE, 000)

Example: `ALLIANZ SE - 000 CO SPA` → Channel=000, Country=CO, Language=SPA
Example: `CASHAPP - CHT CO ENG` → Channel=CHT, Country=CO, Language=ENG
Example: `P_Avianca Co - IBV CO FRE` → Channel=IBV, Country=CO, Language=FRE

### Channel codes (from Image 2)
CHA=Channel, BAO=Back office, CHT=Chat, EMA=Email, IBV=Inbound,
MSG=Messaging, OFF=Offline, 000=Two or more, OBV=Outbound, SMA=Social Media

### Country codes (ISO 2-letter, from Image 3)
BR=Brazil, CO=Colombia, GT=Guatemala, MX=Mexico, NI=Nicaragua,
PE=Peru, PT=Portugal, SV=El Salvador, TR=Türkiye, US=United States

### Language codes (from Image 4)
SPA=Spanish, POR=Portuguese, ENG=English, FRE=French, 000=Not specified

---

## 5. Metric formulas (all server-side — planners never compute these)

```
Base Forecast     = HC_Req × (1 − OOO%) × (1 − IO%) / Exp_Del / (1 + Sched%)
New Req           = HC_Req / (1 − OOO%) / (1 − IO%) × (1 + Sched%) × Exp_Del
Overhead HC       = New_Req − HC_Req
Overhead %        = Overhead_HC / HC_Req × 100
Over/Under (agg)  = HC − HC_Req
Over/Under %      = (HC − HC_Req) / HC_Req × 100
Absolute Overstaff = max(0, HC − HC_Req)   ← only positive deltas, per Concentrix methodology
Staffing Efficiency = min(HC / HC_Req, 1) × 100
```

**Overhead flag rule:** Any LOB with Overhead % > 30% must be flagged amber for manager review.
This is per Concentrix WFM guidelines (Overhead_2.pptx, slide 4).

**Absolute Overstaff definition (slide 5):** Sum of only the *positive* over/under values per LOB.
Understaffed LOBs (negative delta) are excluded from the absolute total.

---

## 6. App pages and components

### Page 1: Planner — Upload (`/planner/upload`)
- Drop zone for `LATAM_Manual_HC_Data_04-19-2026.xlsx` format
- Parses `Weekly Data Template` sheet (20 columns)
- Preview table of first 4 rows before import
- On confirm: populates edit form with parsed data
- Column mapping: SubClient, LOBName, SITE Name, Month, HC, HC Req, OOO%, IO%, ExpDel, ScheduleInflux, Training fields

### Page 2: Planner — Edit by Month (`/planner/edit`)
- Month chip strip at top — green = saved, amber = in progress, gray = empty
- Clicking a month chip loads that month's data into the form
- Form fields (inputs):
  - Sub Client (locked dropdown — from planner's scope)
  - LOB Name (locked dropdown — from planner's scope)
  - Site (locked dropdown)
  - Actual / Projected (select)
  - Client Forecast FTE (number)
  - HC (number, required)
  - HC Required (number, required)
  - Attrition % (number)
  - OOO Shrinkage % (number)
  - IO Shrinkage % (number)
  - Expected Delivery (number, default 1)
  - Schedule Influx % (number)
  - Training HC, Class Requested, Class Started, Class Graduate (numbers)
- Computed metrics (read-only cards, update live on input change):
  - Base Forecast
  - New Req (w/ overhead)
  - Overhead HC
  - Overhead % — amber card if > 30%
  - Over/Under (aggregate)
  - Over/Under %
  - Absolute Overstaff
  - Staffing Efficiency
- Save month button — advances to next month automatically
- Copy to future months button — bulk-copies current values to selected future months
- "Review dashboard" link

### Page 3: Planner — My Dashboard (`/planner/dashboard`)
- Site filter tabs: All sites / individual sites
- KPI cards row (4 cards): Avg projected HC, Avg overhead %, Absolute overstaff, Months overhead >30%
- Line chart: Projected HC vs HC Required vs New Req (w/ overhead) — 12 months
- Overhead % bar chart — monthly, amber bars when >30%, dashed threshold line
- Metric detail table — all months × all metrics, grouped sections:
  - Headcount (Projected HC, HC Req, New Req)
  - Overhead (Overhead HC, Overhead %)
  - Over/Under staffing (aggregate, %, absolute)
  - Shrinkage & efficiency (OOO%, IO%, Base Forecast, Staffing Efficiency)
- Legend: red=understaffed, amber=overhead>30%, green=on target
- "Submit plan" button

### Page 4: Planner — Submit (`/planner/submit`)
Pre-submission checklist (auto-validated):
- [ ] 12 months of data entered for all LOBs
- [ ] HC and HC Required filled for every month
- ⚠ Flag if any months have understaffing > 5%
- [ ] Shrinkage values within range (OOO < 15%, IO < 20%)
- [ ] Training pipeline entered
Submission summary card: Planner name, scope (country, sites, LOBs), period
On submit: POST to SharePoint `WFM_Submissions` list (upsert by LOB+Site+Month+SubmittedBy)
Toast: "Submitted — your data is now live in the manager dashboard"
Planners can resubmit until manager locks the period.

### Page 5: Manager — LATAM Consolidated (`/manager`)
**Requires Role = Manager in Planner_Roster**

Views bar (matches DOMO exactly):
`Geo | Region | Sub region | Country | Campus | Site | Rollup client | Sub client | LOB | LOB language | Channel | Totals`

Filter dropdowns (6, from reference tabs):
1. Rollup Client (from Client Table tab — cascades to Sub Client)
2. Sub Client (cascades from Rollup Client)
3. Site / Country (from Site Table tab — COUNTRY_NAME column)
4. Country / LOB (parsed from LOB name — country code token)
5. LOB Language (parsed from LOB name — language code token)
6. Channel (parsed from LOB name — channel code token)
Clear all button.

KPI cards row: Total projected HC, Avg overhead %, LATAM over/under, Pending submissions

Planner submission tracker (left card):
- Row per planner: name, country, progress bar, badge (Submitted/Partial/Pending), timestamp

Overhead % by sub-region bar chart (right card)

Period lock info banner: shows if open or locked, flags LOBs >30%

Rollup table — sortable by any column:
`Group | Proj HC | HC Req | New Req | Over/Under | O/U% | OH HC | OH% | Abs Overstaff`
LATAM total row at bottom.

12-month trend line chart: Projected HC vs HC Req vs New Req

### Page 6: Manager — Overhead Analysis (`/manager/overhead`)
Sort-by dropdown: Overhead %, Overhead HC, OOO%, IO%

KPI cards: LATAM avg overhead %, Avg OOO%, Avg IO%, LOBs >30% threshold

Overhead component breakdown card (left):
- IO shrinkage — bar + % + HC contribution
- OOO shrinkage — bar + % + HC
- Schedule influx — bar + % + HC
- Expected delivery — bar + % + HC

Top 8 accounts by overhead% ranked list (right):
- Red bar if >30%, amber if >25%, green otherwise
- "Flag" badge on >30% accounts

Overhead % trend — 12 months by sub-region (5 lines with 30% threshold):
SA1=blue, CA1=teal, CA2=amber, MX/Car=coral, Brazil=purple

Overhead detail table by country — sortable:
`Country | Sub-region | Base HC req | OOO% | OOO HC | IO% | IO HC | Sched% | Sched HC | Total OH HC | OH% | New Req`

---

## 7. RBAC rules

| Role | Permissions |
|---|---|
| Planner | Read/write own rows only (filtered by SubmittedBy = their email AND Country in AllowedCountries) |
| Manager | Read all rows, write Period_Locks, cannot edit planner submissions |
| Exec | Read-only on consolidated view |

Role is determined by checking `Planner_Roster` list on login.
If email not found in roster → show "Access denied, contact your manager" screen.

---

## 8. LOB name utility function

```javascript
// utils/lobParser.js
export function parseLOBName(lobName) {
  if (!lobName || !lobName.includes(' - ')) {
    return { channel: '000', country: '000', language: '000' };
  }
  const suffix = lobName.split(' - ').pop().trim();
  const tokens = suffix.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) {
    return {
      channel: tokens[tokens.length - 3],
      country: tokens[tokens.length - 2],
      language: tokens[tokens.length - 1],
    };
  }
  return { channel: '000', country: tokens[0] || '000', language: tokens[1] || '000' };
}

export function calcMetrics({ hc, hcr, ooo, io, sched, ed }) {
  const o = ooo / 100, ioR = io / 100, s = sched / 100, edR = ed || 1;
  const newReq   = hcr / (1 - o) / (1 - ioR) * (1 + s) * edR;
  const baseFc   = hcr * (1 - o) * (1 - ioR) / edR / (1 + s);
  const ohHC     = newReq - hcr;
  const ohPct    = hcr > 0 ? (ohHC / hcr) * 100 : 0;
  const ouHC     = hc - hcr;
  const ouPct    = hcr > 0 ? (ouHC / hcr) * 100 : 0;
  const absOS    = Math.max(0, ouHC);
  const staffEff = hcr > 0 ? Math.min((hc / hcr) * 100, 100) : 0;
  return {
    newReq:   +newReq.toFixed(1),
    baseFc:   +baseFc.toFixed(1),
    ohHC:     +ohHC.toFixed(1),
    ohPct:    +ohPct.toFixed(2),
    ouHC:     +ouHC.toFixed(1),
    ouPct:    +ouPct.toFixed(2),
    absOS:    +absOS.toFixed(1),
    staffEff: +staffEff.toFixed(2),
    ohFlag:   ohPct > 30,
  };
}
```

---

## 9. SharePoint Graph API calls

```javascript
// api/sharepoint.js
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SITE_ID    = 'YOUR_SHAREPOINT_SITE_ID';  // replace after setup
const LISTS = {
  submissions: 'WFM_Submissions',
  roster:      'Planner_Roster',
  locks:       'Period_Locks',
};

// Get access token from MSAL (injected at runtime)
async function getHeaders(msalInstance) {
  const account = msalInstance.getAllAccounts()[0];
  const { accessToken } = await msalInstance.acquireTokenSilent({
    scopes: ['https://graph.microsoft.com/Sites.ReadWrite.All'],
    account,
  });
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

// Upsert submission rows (one per LOB/Site/Month)
export async function submitPlan(rows, msalInstance) {
  const headers = await getHeaders(msalInstance);
  const base = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.submissions}/items`;
  for (const row of rows) {
    // Check if row exists (match on LOBName + SiteName + Month + SubmittedBy)
    const filter = `fields/LOBName eq '${row.LOBName}' and fields/SiteName eq '${row.SiteName}' and fields/PeriodKey eq '${row.PeriodKey}' and fields/SubmittedBy eq '${row.SubmittedBy}'`;
    const check = await fetch(`${base}?$filter=${encodeURIComponent(filter)}`, { headers });
    const { value } = await check.json();
    if (value.length > 0) {
      await fetch(`${base}/${value[0].id}`, { method: 'PATCH', headers, body: JSON.stringify({ fields: row }) });
    } else {
      await fetch(base, { method: 'POST', headers, body: JSON.stringify({ fields: row }) });
    }
  }
}

// Check period lock before allowing submit
export async function isPeriodLocked(periodKey, msalInstance) {
  const headers = await getHeaders(msalInstance);
  const base = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.locks}/items`;
  const filter = `fields/PeriodKey eq '${periodKey}' and fields/IsLocked eq true`;
  const res = await fetch(`${base}?$filter=${encodeURIComponent(filter)}`, { headers });
  const { value } = await res.json();
  return value.length > 0;
}

// Get all submissions for manager view
export async function getAllSubmissions(msalInstance) {
  const headers = await getHeaders(msalInstance);
  const base = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.submissions}/items?$expand=fields&$top=2000`;
  const res = await fetch(base, { headers });
  const { value } = await res.json();
  return value.map(v => v.fields);
}

// Get planner role and scope
export async function getPlannerProfile(email, msalInstance) {
  const headers = await getHeaders(msalInstance);
  const base = `${GRAPH_BASE}/sites/${SITE_ID}/lists/${LISTS.roster}/items`;
  const filter = `fields/PlannerEmail eq '${email}'`;
  const res = await fetch(`${base}?$filter=${encodeURIComponent(filter)}&$expand=fields`, { headers });
  const { value } = await res.json();
  return value.length > 0 ? value[0].fields : null;
}
```

---

## 10. Design system

Use Tailwind CSS with this color intent:
- Info / primary action: blue (`bg-blue-50`, `text-blue-700`, `border-blue-200`)
- Success / on target: green (`bg-green-50`, `text-green-700`)
- Warning / overhead flag: amber (`bg-amber-50`, `text-amber-700`)
- Danger / understaffed: red (`bg-red-50`, `text-red-700`)
- Neutral / structure: gray (`bg-gray-50`, `text-gray-500`)

**Overhead >30% rule:** Card background turns amber. Show flag icon. Appears in: computed metrics, dashboard table cells, manager overhead chart, overhead detail table.

**Understaffed rule:** Over/under cells turn red when HC < HC Req.

**Data pills for parsed LOB tokens:**
- Country pill: blue background, e.g. `CO`
- Language pill: green background, e.g. `SPA`
- Channel pill: gray outline, e.g. `IBV`

Charts: Use Chart.js 4.4.x. Always include `role="img"` and `aria-label` on canvas elements.

---

## 11. Project structure

```
wfm-cap-plan/
├── CLAUDE.md              ← this file
├── index.html
├── vite.config.js
├── package.json
├── src/
│   ├── main.jsx
│   ├── App.jsx            ← routing + MSAL provider
│   ├── api/
│   │   └── sharepoint.js  ← all Graph API calls (section 9 above)
│   ├── mock/
│   │   ├── mockData.js    ← in-memory data for dev mode
│   │   └── mockAuth.js    ← mock user + USE_MOCK flag
│   ├── utils/
│   │   ├── lobParser.js   ← parseLOBName + calcMetrics (section 8 above)
│   │   └── excelParser.js ← reads LATAM_Manual_HC_Data xlsx format
│   ├── components/
│   │   ├── planner/
│   │   │   ├── UploadPage.jsx
│   │   │   ├── EditByMonth.jsx
│   │   │   ├── MyDashboard.jsx
│   │   │   └── SubmitPage.jsx
│   │   ├── manager/
│   │   │   ├── ConsolidatedView.jsx
│   │   │   └── OverheadAnalysis.jsx
│   │   └── shared/
│   │       ├── MetricCard.jsx
│   │       ├── MonthChip.jsx
│   │       ├── ViewsBar.jsx
│   │       ├── FilterBar.jsx
│   │       └── RollupTable.jsx
│   └── styles/
│       └── index.css
├── public/
└── reference/
    └── LATAM_Manual_HC_Data_04-19-2026.xlsx
```

---

## 12. Build order for Claude Code

Build in this order. Do not skip ahead.

1. `npm create vite@latest . -- --template react` — scaffold in current folder
2. Install: `npm install @azure/msal-browser @azure/msal-react xlsx chart.js react-router-dom`
3. Build `src/utils/lobParser.js` and test with known LOB names from section 4
4. Build `src/api/sharepoint.js` — Graph API wrapper (section 9)
5. Build MSAL auth flow in `App.jsx` — login with Concentrix M365 account, role check
6. Build planner `EditByMonth.jsx` — form + live computed metrics
7. Build planner `MyDashboard.jsx` — 12-month table + charts
8. Build planner `SubmitPage.jsx` — checklist + SharePoint POST
9. Build manager `ConsolidatedView.jsx` — views bar + filter dropdowns + rollup table
10. Build manager `OverheadAnalysis.jsx` — component breakdown + ranking + trend

---

## 13. Node.js constraint

The developer cannot install Node.js globally (no admin rights).
**Use the Node.js version already bundled with VS Code or nvm-windows portable install.**
All scripts must use `npx` — never assume global installs.
If Node.js is not available, scaffold using the VS Code terminal with:
```
winget install OpenJS.NodeJS.LTS --scope user
```
This installs without admin rights via Windows Package Manager.
