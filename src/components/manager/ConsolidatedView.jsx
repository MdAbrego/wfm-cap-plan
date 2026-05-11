import { useEffect, useRef, useState } from 'react';
import { Link }      from 'react-router-dom';
import Chart         from 'chart.js/auto';
import { useAuth }   from '../../context/AuthContext';
import { api }       from '../../api/dataLayer';
import ViewsBar      from '../shared/ViewsBar';
import FilterBar     from '../shared/FilterBar';
import RollupTable   from '../shared/RollupTable';
import MetricCard    from '../shared/MetricCard';

const ML = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SUB_REGION = {
  CO:'SA1', PE:'SA1', SV:'CA1', GT:'CA2', MX:'MX/Car', BR:'Brazil1',
};

const VIEW_GROUP = {
  'Geo':           () => 'LATAM',
  'Region':        () => 'LATAM',
  'Sub region':    r  => SUB_REGION[r.country] || r.country || '—',
  'Country':       r  => r.country || '—',
  'Campus':        r  => r.SiteName || '—',
  'Site':          r  => r.SiteName || '—',
  'Rollup client': r  => r.SubClient || '—',
  'Sub client':    r  => r.SubClient || '—',
  'LOB':           r  => r.LOBName || '—',
  'LOB language':  r  => r.language || '—',
  'Channel':       r  => r.channel  || '—',
  'Totals':        () => 'LATAM Total',
};

function rollup(rows, groupFn) {
  const map = {};
  for (const r of rows) {
    const key = groupFn(r) || '(unknown)';
    if (!map[key]) map[key] = { group:key, projHC:0, hcReq:0, newReq:0, ohHC:0, ohPcts:[], ouHC:0, absOS:0,
                                country: r.country, language: r.language, channel: r.channel };
    map[key].projHC += r.HC     || 0;
    map[key].hcReq  += r.HCReq  || 0;
    map[key].newReq += r.newReq || 0;
    map[key].ohHC   += r.ohHC   || 0;
    map[key].ohPcts.push(r.ohPct || 0);
    map[key].ouHC   += r.ouHC   || 0;
    map[key].absOS  += r.absOS  || 0;
  }
  return Object.values(map).map(g => ({
    ...g,
    ohPct: g.ohPcts.length ? g.ohPcts.reduce((a,b)=>a+b,0)/g.ohPcts.length : 0,
    ouPct: g.hcReq  ? (g.ouHC / g.hcReq) * 100 : 0,
  }));
}

const EMPTY_FILTERS = { rollupClient:'', subClient:'', site:'', country:'', language:'', channel:'' };

export default function ConsolidatedView() {
  const { accessToken } = useAuth();
  const [rows,     setRows]     = useState([]);
  const [planners, setPlanners] = useState([]);
  const [view,     setView]     = useState('Country');
  const [filters,  setFilters]  = useState(EMPTY_FILTERS);
  const [isLocked, setIsLocked] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const trendRef   = useRef(); const trendChart = useRef();

  useEffect(() => {
    Promise.all([
      api.getAllSubmissions(accessToken),
      api.getAllPlanners(accessToken),
      api.isPeriodLocked('2026-05', accessToken),
    ]).then(([subs, planrs, locked]) => {
      setRows(subs); setPlanners(planrs); setIsLocked(locked);
    }).finally(() => setLoading(false));
  }, [accessToken]);

  const opts = {
    rollupClients: [...new Set(rows.map(r=>r.SubClient).filter(Boolean))],
    subClients:    [...new Set(rows.map(r=>r.SubClient).filter(Boolean))],
    sites:         [...new Set(rows.map(r=>r.SiteName).filter(Boolean))],
    countries:     [...new Set(rows.map(r=>r.country).filter(Boolean))],
    languages:     [...new Set(rows.map(r=>r.language).filter(Boolean))],
    channels:      [...new Set(rows.map(r=>r.channel).filter(Boolean))],
  };

  const filtered = rows.filter(r => {
    if (filters.rollupClient && r.SubClient  !== filters.rollupClient) return false;
    if (filters.subClient    && r.SubClient  !== filters.subClient)    return false;
    if (filters.site         && r.SiteName   !== filters.site)         return false;
    if (filters.country      && r.country    !== filters.country)      return false;
    if (filters.language     && r.language   !== filters.language)     return false;
    if (filters.channel      && r.channel    !== filters.channel)      return false;
    return true;
  });

  const tableRows = rollup(filtered, VIEW_GROUP[view] ?? (r => r.country));
  const total = {
    group:'LATAM Total', isTotal:true,
    projHC: tableRows.reduce((a,r)=>a+r.projHC,0),
    hcReq:  tableRows.reduce((a,r)=>a+r.hcReq, 0),
    newReq: tableRows.reduce((a,r)=>a+r.newReq, 0),
    ohHC:   tableRows.reduce((a,r)=>a+r.ohHC,  0),
    ohPct:  tableRows.length ? tableRows.reduce((a,r)=>a+r.ohPct,0)/tableRows.length : 0,
    ouHC:   tableRows.reduce((a,r)=>a+r.ouHC,  0),
    absOS:  tableRows.reduce((a,r)=>a+r.absOS,  0),
  };
  total.ouPct = total.hcReq ? (total.ouHC/total.hcReq)*100 : 0;

  // KPIs
  const totalHC  = filtered.reduce((a,r)=>a+(r.HC||0),0);
  const avgOhPct = filtered.length ? (filtered.reduce((a,r)=>a+(r.ohPct||0),0)/filtered.length).toFixed(1) : '—';
  const latamOU  = filtered.reduce((a,r)=>a+(r.ouHC||0),0).toFixed(0);
  const pending  = planners.filter(p => {
    const pr = rows.filter(r => r.SubmittedBy === p.PlannerEmail);
    return !pr.length || pr.some(r => r.Status !== 'Submitted');
  }).length;

  // Planner tracker
  function plannerStatus(p) {
    const pr = rows.filter(r => r.SubmittedBy === p.PlannerEmail);
    if (!pr.length) return { badge:'Pending', pct:0, ts:null };
    const sub = pr.filter(r => r.Status === 'Submitted').length;
    const pct = Math.round((sub/pr.length)*100);
    const ts  = pr.find(r=>r.SubmittedAt)?.SubmittedAt;
    if (pct === 100) return { badge:'Submitted', pct, ts };
    if (pct > 0)     return { badge:'Partial',   pct, ts:null };
    return               { badge:'Pending',   pct:0, ts:null };
  }
  function fmtTs(ts) {
    if (!ts) return null;
    const d = new Date(ts), now = new Date('2026-05-08T12:00:00Z');
    const diff = Math.round((now - d) / 86400000);
    if (diff === 0) return `Today ${d.toTimeString().slice(0,5)}`;
    if (diff === 1) return 'Yesterday';
    return `${diff} days ago`;
  }

  // Sub-region overhead bar (static, from rollup)
  const srRollup = rollup(filtered, r => SUB_REGION[r.country] || r.country || '—');

  // 12-month trend
  const byMonth = {};
  for (const r of filtered) {
    const pk = r.PeriodKey; if (!pk) continue;
    if (!byMonth[pk]) byMonth[pk] = { hc:0, hcr:0, nr:0 };
    byMonth[pk].hc  += r.HC    ||0;
    byMonth[pk].hcr += r.HCReq ||0;
    byMonth[pk].nr  += r.newReq||0;
  }
  const pks   = Object.keys(byMonth).sort();
  const tLabels = pks.map(pk=>{ const[y,m]=pk.split('-'); return `${ML[+m-1]} ${y.slice(2)}`; });

  useEffect(() => {
    if (!trendRef.current || !pks.length) return;
    trendChart.current?.destroy();
    trendChart.current = new Chart(trendRef.current, {
      type:'line',
      data:{ labels:tLabels, datasets:[
        { label:'Proj HC', data:pks.map(pk=>byMonth[pk].hc),  borderColor:'#3b82f6', tension:0.3, fill:false },
        { label:'HC Req',  data:pks.map(pk=>byMonth[pk].hcr), borderColor:'#6b7280', borderDash:[4,2], tension:0.3, fill:false },
        { label:'New Req', data:pks.map(pk=>byMonth[pk].nr),  borderColor:'#f59e0b', tension:0.3, fill:false },
      ]},
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } },
    });
    return () => trendChart.current?.destroy();
  }, [JSON.stringify(tLabels)]);

  if (loading) return <div className="flex items-center justify-center p-12 text-gray-400 text-sm">Loading…</div>;

  const flaggedLOBs = filtered.filter(r => r.ohPct > 30);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-3">LATAM Consolidated</h1>

      {/* Period lock banner */}
      <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm border flex items-center gap-3 ${
        isLocked ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-200 text-green-700'
      }`}>
        <span>{isLocked ? '🔒 Period is locked.' : '🟢 Period is open for submissions.'}</span>
        {flaggedLOBs.length > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded text-xs font-medium">
            ⚑ {flaggedLOBs.length} LOB(s) &gt;30% overhead
            <Link to="/manager/overhead" className="underline">Review flags →</Link>
          </span>
        )}
      </div>

      {/* Views bar */}
      <ViewsBar active={view} onSelect={setView} />

      {/* Filter bar */}
      <FilterBar
        filters={filters} options={opts}
        onChange={(f, v) => setFilters(p => ({ ...p, [f]: v }))}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Proj HC"       value={totalHC.toFixed(0)} />
        <MetricCard label="Avg Overhead %"      value={`${avgOhPct}%`} flag={parseFloat(avgOhPct)>30} />
        <MetricCard label="LATAM Over/Under"    value={latamOU} danger={parseFloat(latamOU)<0} />
        <MetricCard label="Pending Submissions" value={pending} flag={pending>0} />
      </div>

      {/* Two-col: tracker + sub-region bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {/* Planner tracker */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Planner Submissions</h2>
          <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto">
            {planners.filter(p=>p.Role!=='Manager').map(p => {
              const st = plannerStatus(p);
              return (
                <div key={p.PlannerEmail} className="flex items-center gap-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{p.PlannerName}</p>
                    <p className="text-xs text-gray-400">{p.AllowedCountries}</p>
                  </div>
                  <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-2 rounded-full transition-all ${
                      st.badge==='Submitted'?'bg-green-500':st.badge==='Partial'?'bg-amber-400':'bg-gray-300'
                    }`} style={{ width:`${st.pct}%` }} />
                  </div>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${
                    st.badge==='Submitted'?'bg-green-100 text-green-700':st.badge==='Partial'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'
                  }`}>{st.badge}</span>
                  {st.ts && <span className="text-xs text-gray-400 whitespace-nowrap">{fmtTs(st.ts)}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Overhead by sub-region */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Overhead % by Sub-region</h2>
          <div className="flex flex-col gap-3">
            {srRollup.map(sr => (
              <div key={sr.group} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-20 flex-shrink-0">{sr.group}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className={`h-3 rounded-full ${sr.ohPct>30?'bg-amber-400':'bg-blue-400'}`}
                    style={{ width:`${Math.min(sr.ohPct,80)}%` }} />
                </div>
                <span className={`text-xs font-medium w-10 text-right ${sr.ohPct>30?'text-amber-600':'text-gray-600'}`}>
                  {sr.ohPct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rollup table */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-2">Rollup by {view}</h2>
        <RollupTable rows={[...tableRows, total]} />
      </div>

      {/* 12-month trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">12-Month Trend</h2>
        <canvas ref={trendRef} role="img" aria-label="LATAM 12-month headcount trend" />
      </div>
    </div>
  );
}
