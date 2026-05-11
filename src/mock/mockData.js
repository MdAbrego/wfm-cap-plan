import { calcMetrics, parseLOBName } from '../utils/lobParser.js';

// ─── Period list: Apr 2026 – Mar 2027 ────────────────────────────────────────
const PERIODS = [
  '2026-04','2026-05','2026-06','2026-07','2026-08','2026-09',
  '2026-10','2026-11','2026-12','2027-01','2027-02','2027-03',
];

const NOW = new Date('2026-05-08T12:00:00Z');
function daysAgo(d) { return new Date(NOW - d * 86400000).toISOString(); }

// ─── Planner roster ───────────────────────────────────────────────────────────
export const MOCK_PLANNERS = [
  { PlannerEmail:'ana.morales@concentrix.com',     PlannerName:'Ana Morales',     Role:'Planner', AllowedCountries:'CO', AllowedSubClients:'ALL' },
  { PlannerEmail:'paula.herrera@concentrix.com',   PlannerName:'Paula Herrera',   Role:'Planner', AllowedCountries:'PE', AllowedSubClients:'ALL' },
  { PlannerEmail:'tomas.reyes@concentrix.com',     PlannerName:'Tomás Reyes',     Role:'Planner', AllowedCountries:'SV', AllowedSubClients:'ALL' },
  { PlannerEmail:'andres.mora@concentrix.com',     PlannerName:'Andrés Mora',     Role:'Planner', AllowedCountries:'GT', AllowedSubClients:'ALL' },
  { PlannerEmail:'carlos.urena@concentrix.com',    PlannerName:'Carlos Ureña',    Role:'Planner', AllowedCountries:'CO', AllowedSubClients:'ALL' },
  { PlannerEmail:'diana.pinto@concentrix.com',     PlannerName:'Diana Pinto',     Role:'Planner', AllowedCountries:'SV', AllowedSubClients:'ALL' },
  { PlannerEmail:'jorge.salinas@concentrix.com',   PlannerName:'Jorge Salinas',   Role:'Planner', AllowedCountries:'GT', AllowedSubClients:'ALL' },
  { PlannerEmail:'valeria.castro@concentrix.com',  PlannerName:'Valeria Castro',  Role:'Planner', AllowedCountries:'MX', AllowedSubClients:'ALL' },
  { PlannerEmail:'maria.gonzalez@concentrix.com',  PlannerName:'María González',  Role:'Planner', AllowedCountries:'MX', AllowedSubClients:'ALL' },
  { PlannerEmail:'sofia.vargas@concentrix.com',    PlannerName:'Sofía Vargas',    Role:'Planner', AllowedCountries:'BR', AllowedSubClients:'ALL' },
  { PlannerEmail:'luiz.fernandes@concentrix.com',  PlannerName:'Luiz Fernandes',  Role:'Planner', AllowedCountries:'BR', AllowedSubClients:'ALL' },
  { PlannerEmail:'ricardo.lima@concentrix.com',    PlannerName:'Ricardo Lima',    Role:'Planner', AllowedCountries:'BR', AllowedSubClients:'ALL' },
  { PlannerEmail:'manfredd.abrego@concentrix.com', PlannerName:'Manfredd Abrego', Role:'Manager', AllowedCountries:'ALL', AllowedSubClients:'ALL' },
];

// ─── LOB definitions ──────────────────────────────────────────────────────────
// flagged:true → OOO/IO deliberately high to produce OH% > 30%
const LOB_DEFS = [
  // Colombia — Ana Morales (submitted today)
  { lob:'ALLIANZ SE - 000 CO SPA',        site:'Bogotá',       sub:'Allianz',       planner:'ana.morales@concentrix.com',    baseHC:180, ooo:5.2, io:11.4, sched:0.6, ts: daysAgo(0) },
  { lob:'BANCOLOMBIA - IBV CO SPA',        site:'Bogotá',       sub:'Bancolombia',   planner:'ana.morales@concentrix.com',    baseHC:820, ooo:6.0, io:10.8, sched:0.6, ts: daysAgo(0) },
  { lob:'CASHAPP - CHT CO ENG',            site:'Medellín',     sub:'CashApp',       planner:'ana.morales@concentrix.com',    baseHC:95,  ooo:5.5, io:11.0, sched:0.6, ts: daysAgo(0) },
  // Colombia — Carlos Ureña (submitted 2 days ago)
  { lob:'P_Avianca Co - IBV CO SPA',       site:'Bogotá',       sub:'Avianca',       planner:'carlos.urena@concentrix.com',   baseHC:340, ooo:6.8, io:12.2, sched:0.6, ts: daysAgo(2) },
  { lob:'MERCADO LIBRE - BAO CO SPA',      site:'Medellín',     sub:'Mercado Libre', planner:'carlos.urena@concentrix.com',   baseHC:260, ooo:5.0, io:10.5, sched:0.6, ts: daysAgo(2) },
  // Brazil — Sofía Vargas (pending — no submissions)
  { lob:'ZE DELIVERY - EMA BR POR',        site:'São Paulo',    sub:'Ze Delivery',   planner:'sofia.vargas@concentrix.com',   baseHC:110, ooo:5.8, io:11.8, sched:0.6, ts:null, pending:true },
  // Brazil — Luiz Fernandes (pending)
  { lob:'CIELO - IBV BR POR',              site:'São Paulo',    sub:'Cielo',         planner:'luiz.fernandes@concentrix.com', baseHC:450, ooo:8.0, io:18.0, sched:1.5, ts:null, pending:true, flagged:true },
  { lob:'MADEIRAMADEIRA - CHT BR POR',     site:'Curitiba',     sub:'MadeiraMadeira',planner:'luiz.fernandes@concentrix.com', baseHC:85,  ooo:5.2, io:11.2, sched:0.6, ts:null, pending:true },
  // Brazil — Ricardo Lima (pending)
  { lob:'SANTANDER - IBV BR POR',          site:'São Paulo',    sub:'Santander',     planner:'ricardo.lima@concentrix.com',   baseHC:670, ooo:6.5, io:12.0, sched:0.6, ts:null, pending:true },
  { lob:'Quinto Andar - BAO BR POR',       site:'São Paulo',    sub:'Quinto Andar',  planner:'ricardo.lima@concentrix.com',   baseHC:130, ooo:5.0, io:10.8, sched:0.6, ts:null, pending:true },
  // Mexico — María González (submitted today)
  { lob:'ALIEXPRESS - CHT MX SPA',         site:'CDMX',         sub:'Aliexpress',    planner:'maria.gonzalez@concentrix.com', baseHC:145, ooo:6.2, io:11.5, sched:0.6, ts: daysAgo(0) },
  { lob:'EDENRED - IBV MX SPA',            site:'Monterrey',    sub:'Edenred',       planner:'maria.gonzalez@concentrix.com', baseHC:60,  ooo:5.8, io:10.9, sched:0.6, ts: daysAgo(0) },
  // Mexico — Valeria Castro (pending)
  { lob:'STORI - IBV MX SPA',              site:'CDMX',         sub:'Stori',         planner:'valeria.castro@concentrix.com', baseHC:75,  ooo:7.0, io:19.0, sched:1.5, ts:null, pending:true, flagged:true },
  // Guatemala — Andrés Mora (submitted 2 days ago)
  { lob:'ACEROS DE GUATEMALA - BAO GT SPA',site:'Guatemala City',sub:'Aceros GT',    planner:'andres.mora@concentrix.com',    baseHC:45,  ooo:5.5, io:11.0, sched:0.6, ts: daysAgo(2) },
  // Guatemala — Jorge Salinas (submitted 3 days ago)
  { lob:'P_CBC SAC GT - 000 GT SPA',       site:'Guatemala City',sub:'CBC SAC',      planner:'jorge.salinas@concentrix.com',  baseHC:280, ooo:6.0, io:11.8, sched:0.6, ts: daysAgo(3) },
  // El Salvador — Tomás Reyes (submitted yesterday)
  { lob:'CASHAPP - IBV SV ENG',            site:'San Salvador', sub:'CashApp',       planner:'tomas.reyes@concentrix.com',    baseHC:120, ooo:4.8, io:10.2, sched:0.6, ts: daysAgo(1) },
  { lob:'JETBLUE AIRWAYS - IBV SV ENG',    site:'San Salvador', sub:'JetBlue',       planner:'tomas.reyes@concentrix.com',    baseHC:65,  ooo:5.2, io:10.8, sched:0.6, ts: daysAgo(1) },
  // El Salvador — Diana Pinto (partial: first 6 months only)
  { lob:'CLARO - IBV SV SPA',              site:'San Salvador', sub:'Claro',         planner:'diana.pinto@concentrix.com',    baseHC:380, ooo:5.5, io:11.5, sched:0.6, ts: daysAgo(1), partial:true },
  // Peru — Paula Herrera (submitted yesterday)
  { lob:'P_ADIDAS - 000 PE SPA',           site:'Lima',         sub:'Adidas',        planner:'paula.herrera@concentrix.com',  baseHC:55,  ooo:5.8, io:11.2, sched:0.6, ts: daysAgo(1) },
  { lob:'P_RAPPI - 000 PE SPA',            site:'Lima',         sub:'Rappi',         planner:'paula.herrera@concentrix.com',  baseHC:90,  ooo:6.0, io:11.5, sched:0.6, ts: daysAgo(1) },
  { lob:'Full Claro Black - 000 PE SPA',   site:'Lima',         sub:'Claro Black',   planner:'paula.herrera@concentrix.com',  baseHC:320, ooo:7.2, io:12.5, sched:0.6, ts: daysAgo(1) },
];

// ─── Generate monthly rows ─────────────────────────────────────────────────────
function vary(base, pct = 0.05) {
  return Math.round(base * (1 + (Math.random() * 2 - 1) * pct));
}

function buildRows(def, periodIndex) {
  const { lob, site, sub, planner, baseHC, ooo, io, sched, ts, pending, partial, flagged } = def;
  if (pending) return [];                          // pending planners have no rows
  if (partial && periodIndex >= 6) return [];      // Diana: only first 6 months

  const pk       = PERIODS[periodIndex];
  const monthDate = `${pk}-01`;
  const hcReq    = vary(baseHC, 0.04);
  const hc       = vary(baseHC * 1.02, 0.05);      // slightly over-staffed on average

  return [{
    SubClient:         sub,
    LOBName:           lob,
    SiteName:          site,
    Month:             monthDate,
    ActualProjected:   periodIndex < 2 ? 'Actual' : 'Projected',
    ClientForecastFTE: vary(baseHC, 0.03),
    HC:                hc,
    HCReq:             hcReq,
    AttritionPct:      0.031,
    OOOShrinkagePct:   ooo / 100,
    IOShrinkagePct:    io  / 100,
    ExpectedDelivery:  1,
    ScheduleInflux:    sched / 100,
    TrainingHC:        Math.round(hcReq * 0.08),
    ClassRequestedHC:  Math.round(hcReq * 0.06),
    ClassStartedHC:    Math.round(hcReq * 0.05),
    ClassGraduateHC:   Math.round(hcReq * 0.04),
    SubmittedBy:       planner,
    SubmittedAt:       ts,
    PeriodKey:         pk,
    Status:            'Submitted',
  }];
}

// Build all submission rows
const RAW_SUBMISSIONS = [];
for (const def of LOB_DEFS) {
  for (let i = 0; i < PERIODS.length; i++) {
    RAW_SUBMISSIONS.push(...buildRows(def, i));
  }
}

// Enrich with computed metrics + parsed LOB tokens
const SUBMISSIONS = RAW_SUBMISSIONS.map(r => {
  const m = calcMetrics({
    hc:    r.HC,
    hcr:   r.HCReq,
    ooo:   r.OOOShrinkagePct * 100,
    io:    r.IOShrinkagePct  * 100,
    sched: r.ScheduleInflux  * 100,
    ed:    r.ExpectedDelivery,
  });
  const { channel, country, language } = parseLOBName(r.LOBName);
  return { ...r, ...m, channel, country, language };
});

// In-memory mutable store (copied so submitPlan mutations are isolated per session)
let _store = [...SUBMISSIONS];
const _locks = {};

// ─── Mock API (same signatures as googleSheets.js) ────────────────────────────

export async function getPlannerProfile(email) {
  await delay(80);
  return MOCK_PLANNERS.find(p => p.PlannerEmail?.toLowerCase() === email?.toLowerCase()) ?? null;
}

export async function getAllPlanners() {
  await delay(50);
  return [...MOCK_PLANNERS];
}

export async function getAllSubmissions() {
  await delay(120);
  return [..._store];
}

export async function getMySubmissions(email) {
  await delay(100);
  return _store.filter(r => r.SubmittedBy?.toLowerCase() === email?.toLowerCase());
}

export async function submitPlan(rows, user) {
  await delay(150);
  for (const row of rows) {
    const enriched = { ...row, SubmittedBy: user.email, SubmittedAt: new Date().toISOString(), Status: 'Submitted' };
    const m = calcMetrics({
      hc:    enriched.HC    || 0,
      hcr:   enriched.HCReq || 0,
      ooo:   (enriched.OOOShrinkagePct || 0) * 100,
      io:    (enriched.IOShrinkagePct  || 0) * 100,
      sched: (enriched.ScheduleInflux  || 0) * 100,
      ed:    enriched.ExpectedDelivery || 1,
    });
    const { channel, country, language } = parseLOBName(enriched.LOBName);
    const full = { ...enriched, ...m, channel, country, language };

    const idx = _store.findIndex(r =>
      r.LOBName   === full.LOBName &&
      r.SiteName  === full.SiteName &&
      r.PeriodKey === full.PeriodKey &&
      r.SubmittedBy?.toLowerCase() === user.email.toLowerCase()
    );
    if (idx >= 0) _store[idx] = full;
    else _store.push(full);
  }
}

export async function isPeriodLocked(periodKey) {
  await delay(40);
  return !!_locks[periodKey];
}

export async function lockPeriod(periodKey, lockedBy) {
  await delay(60);
  _locks[periodKey] = { lockedBy, lockedAt: new Date().toISOString() };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
