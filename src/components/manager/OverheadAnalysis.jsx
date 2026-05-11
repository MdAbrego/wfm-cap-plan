import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { useAuth } from '../../context/AuthContext';
import { api }     from '../../api/dataLayer';
import MetricCard  from '../shared/MetricCard';

const ML = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SUB_REGION = {
  CO:'SA1', PE:'SA1', SV:'CA1', GT:'CA2', MX:'MX/Car', BR:'Brazil1',
};

const SR_STYLE = {
  'SA1':     { color:'#3b82f6', dash:[] },
  'CA1':     { color:'#14b8a6', dash:[5,3] },
  'CA2':     { color:'#f59e0b', dash:[2,2] },
  'MX/Car':  { color:'#f87171', dash:[] },
  'Brazil1': { color:'#a855f7', dash:[4,2] },
};

const SORT_OPTIONS = [
  { value:'ohPct', label:'Overhead %' },
  { value:'ohHC',  label:'Overhead HC' },
  { value:'ooo',   label:'OOO %' },
  { value:'io',    label:'IO %' },
];

function ohFlag(v) {
  if (v > 30) return 'red';
  if (v >= 25) return 'amber';
  return 'green';
}

export default function OverheadAnalysis() {
  const { accessToken } = useAuth();
  const [rows,         setRows]         = useState([]);
  const [sortBy,       setSortBy]       = useState('ohPct');
  const [tableSortCol, setTableSortCol] = useState('ohPct');
  const [tableSortDir, setTableSortDir] = useState(-1);
  const [loading,      setLoading]      = useState(true);
  const trendRef  = useRef(); const trendChart = useRef();

  useEffect(() => {
    api.getAllSubmissions(accessToken)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [accessToken]);

  // KPIs
  const avgOhPct  = rows.length ? (rows.reduce((a,r)=>a+(r.ohPct||0),0)/rows.length).toFixed(1) : '—';
  const avgOOO    = rows.length ? (rows.reduce((a,r)=>a+((r.OOOShrinkagePct||0)*100),0)/rows.length).toFixed(1) : '—';
  const avgIO     = rows.length ? (rows.reduce((a,r)=>a+((r.IOShrinkagePct||0)*100),0)/rows.length).toFixed(1) : '—';
  const lobsOver30 = rows.filter(r=>(r.ohPct||0)>30).length;

  // Component breakdown — LATAM averages
  const compBreakdown = (() => {
    if (!rows.length) return [];
    const totalHCR = rows.reduce((a,r)=>a+(r.HCReq||0),0) || 1;
    const oooHC    = rows.reduce((a,r)=>a+(r.HCReq||0)*(r.OOOShrinkagePct||0),0);
    const ioHC     = rows.reduce((a,r)=>a+(r.HCReq||0)*(r.IOShrinkagePct||0),0);
    const schedHC  = rows.reduce((a,r)=>a+(r.HCReq||0)*(r.schedShrinkagePct||0),0);
    const edHC     = rows.reduce((a,r)=>a+(r.HCReq||0)*Math.abs(1-(r.expDelPct||1)),0);
    return [
      { label:'OOO Shrinkage',   pct:(oooHC/totalHCR*100),  hcContrib:oooHC,  color:'bg-blue-400' },
      { label:'IO Shrinkage',    pct:(ioHC/totalHCR*100),   hcContrib:ioHC,   color:'bg-teal-400' },
      { label:'Sched Shrinkage', pct:(schedHC/totalHCR*100),hcContrib:schedHC,color:'bg-amber-400' },
      { label:'Exp Delivery',    pct:(edHC/totalHCR*100),   hcContrib:edHC,   color:'bg-purple-400' },
    ];
  })();
  const compMax = compBreakdown.length ? Math.max(...compBreakdown.map(c=>c.pct), 1) : 1;

  // Top 8 by account (SubClient grouping)
  const byAccount = (() => {
    const map = {};
    for (const r of rows) {
      const key = r.SubClient || r.LOBName || '(unknown)';
      if (!map[key]) map[key] = { name:key, ohPct:0, ohHC:0, ooo:0, io:0, _n:0 };
      map[key].ohPct += r.ohPct || 0;
      map[key].ohHC  += r.ohHC  || 0;
      map[key].ooo   += (r.OOOShrinkagePct||0)*100;
      map[key].io    += (r.IOShrinkagePct||0)*100;
      map[key]._n++;
    }
    return Object.values(map).map(a => ({
      ...a,
      ohPct: a._n ? a.ohPct/a._n : 0,
      ooo:   a._n ? a.ooo/a._n   : 0,
      io:    a._n ? a.io/a._n    : 0,
    }));
  })();

  const top8    = [...byAccount].sort((a,b)=>(b[sortBy]||0)-(a[sortBy]||0)).slice(0,8);
  const top8Max = top8.length ? Math.max(...top8.map(a=>a[sortBy]||0), 1) : 1;

  // Country detail table
  const byCountry = (() => {
    const map = {};
    for (const r of rows) {
      const c = r.country || '—';
      if (!map[c]) map[c] = { country:c, ohPct:0, ohHC:0, ooo:0, io:0, hc:0, hcReq:0, newReq:0, _n:0 };
      map[c].ohPct  += r.ohPct  || 0;
      map[c].ohHC   += r.ohHC   || 0;
      map[c].ooo    += (r.OOOShrinkagePct||0)*100;
      map[c].io     += (r.IOShrinkagePct||0)*100;
      map[c].hc     += r.HC     || 0;
      map[c].hcReq  += r.HCReq  || 0;
      map[c].newReq += r.newReq || 0;
      map[c]._n++;
    }
    return Object.values(map).map(c => ({
      ...c,
      ohPct: c._n ? c.ohPct/c._n : 0,
      ooo:   c._n ? c.ooo/c._n   : 0,
      io:    c._n ? c.io/c._n    : 0,
    }));
  })();

  const tableSortToggle = (col) => {
    if (col === tableSortCol) setTableSortDir(d => -d);
    else { setTableSortCol(col); setTableSortDir(-1); }
  };
  const sortedTable = [...byCountry].sort((a,b)=>(b[tableSortCol]-a[tableSortCol])*tableSortDir);

  // 12-month trend by sub-region
  const byMonthSR = {};
  for (const r of rows) {
    const pk = r.PeriodKey; if (!pk) continue;
    const sr = SUB_REGION[r.country] || r.country || '—';
    if (!byMonthSR[sr]) byMonthSR[sr] = {};
    if (!byMonthSR[sr][pk]) byMonthSR[sr][pk] = { sum:0, cnt:0 };
    byMonthSR[sr][pk].sum += r.ohPct || 0;
    byMonthSR[sr][pk].cnt++;
  }
  const allPks   = [...new Set(rows.map(r=>r.PeriodKey).filter(Boolean))].sort();
  const tLabels  = allPks.map(pk=>{ const[y,m]=pk.split('-'); return `${ML[+m-1]} ${y.slice(2)}`; });

  useEffect(() => {
    if (!trendRef.current || !allPks.length) return;
    trendChart.current?.destroy();
    const datasets = Object.entries(byMonthSR).map(([sr, pkMap]) => {
      const style = SR_STYLE[sr] || { color:'#9ca3af', dash:[] };
      return {
        label: sr,
        data: allPks.map(pk => pkMap[pk] ? pkMap[pk].sum/pkMap[pk].cnt : null),
        borderColor: style.color,
        borderDash: style.dash,
        tension: 0.3,
        fill: false,
        spanGaps: true,
      };
    });
    datasets.push({
      label: '30% threshold',
      data: allPks.map(() => 30),
      borderColor: '#ef4444',
      borderDash: [6,3],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    });
    trendChart.current = new Chart(trendRef.current, {
      type: 'line',
      data: { labels: tLabels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { position:'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { callback: v=>`${v}%` } } },
      },
    });
    return () => trendChart.current?.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allPks)]);

  if (loading) return <div className="flex items-center justify-center p-12 text-gray-400 text-sm">Loading…</div>;

  const thCls = col =>
    `px-3 py-2 text-right font-semibold cursor-pointer select-none whitespace-nowrap hover:text-blue-600 ${
      tableSortCol===col ? 'text-blue-600' : 'text-gray-600'
    }`;
  const sortArrow = col => tableSortCol===col ? (tableSortDir<0 ? ' ↓' : ' ↑') : '';

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">Overhead Analysis</h1>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Sort top accounts by</label>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="LATAM Avg OH %"     value={`${avgOhPct}%`} flag={parseFloat(avgOhPct)>30} />
        <MetricCard label="Avg OOO %"          value={`${avgOOO}%`} />
        <MetricCard label="Avg IO %"           value={`${avgIO}%`} />
        <MetricCard label="LOBs >30% OH"       value={lobsOver30}   flag={lobsOver30>0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {/* Component breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-1">Overhead Component Breakdown</h2>
          <p className="text-xs text-gray-400 mb-3">LATAM averages — % of HC Req</p>
          <div className="flex flex-col gap-4">
            {compBreakdown.map(c => (
              <div key={c.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{c.label}</span>
                  <span className="text-gray-500">{c.pct.toFixed(1)}% &nbsp;·&nbsp; {c.hcContrib.toFixed(0)} HC</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className={`h-3 rounded-full ${c.color}`}
                    style={{ width:`${(c.pct/compMax)*100}%` }} />
                </div>
              </div>
            ))}
            {!compBreakdown.length && <p className="text-xs text-gray-400">No data</p>}
          </div>
        </div>

        {/* Top 8 accounts */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-1">
            Top 8 Accounts — {SORT_OPTIONS.find(o=>o.value===sortBy)?.label}
          </h2>
          <p className="text-xs text-gray-400 mb-3">Red &gt;30% · Amber 25–30% · Green on target</p>
          <div className="flex flex-col gap-2.5">
            {top8.map(a => {
              const val = a[sortBy] || 0;
              const f   = ohFlag(a.ohPct);
              const barColor = f==='red' ? 'bg-red-400' : f==='amber' ? 'bg-amber-400' : 'bg-green-400';
              return (
                <div key={a.name} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-28 truncate flex-shrink-0" title={a.name}>{a.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-2.5 rounded-full ${barColor}`}
                      style={{ width:`${(val/top8Max)*100}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-10 text-right">
                    {sortBy==='ohHC' ? val.toFixed(0) : `${val.toFixed(1)}%`}
                  </span>
                  {f==='red'   && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Flag</span>}
                  {f==='amber' && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Watch</span>}
                </div>
              );
            })}
            {!top8.length && <p className="text-xs text-gray-400">No data</p>}
          </div>
        </div>
      </div>

      {/* 12-month trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">12-Month Overhead Trend by Sub-region</h2>
        <canvas ref={trendRef} role="img" aria-label="Overhead % trend by sub-region" />
      </div>

      {/* Country detail table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-600 px-4 pt-4 pb-2">Overhead Detail by Country</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Country</th>
              <th className={thCls('ohPct')}  onClick={()=>tableSortToggle('ohPct')}>OH %{sortArrow('ohPct')}</th>
              <th className={thCls('ohHC')}   onClick={()=>tableSortToggle('ohHC')}>OH HC{sortArrow('ohHC')}</th>
              <th className={thCls('ooo')}    onClick={()=>tableSortToggle('ooo')}>OOO %{sortArrow('ooo')}</th>
              <th className={thCls('io')}     onClick={()=>tableSortToggle('io')}>IO %{sortArrow('io')}</th>
              <th className={thCls('hc')}     onClick={()=>tableSortToggle('hc')}>Proj HC{sortArrow('hc')}</th>
              <th className={thCls('hcReq')}  onClick={()=>tableSortToggle('hcReq')}>HC Req{sortArrow('hcReq')}</th>
              <th className={thCls('newReq')} onClick={()=>tableSortToggle('newReq')}>New Req{sortArrow('newReq')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedTable.map(c => {
              const f = ohFlag(c.ohPct);
              const rowCls = f==='red' ? 'bg-red-50' : f==='amber' ? 'bg-amber-50' : '';
              return (
                <tr key={c.country} className={`border-b border-gray-100 ${rowCls}`}>
                  <td className="px-3 py-2 font-medium text-gray-700">{c.country}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${f==='red'?'text-red-600':f==='amber'?'text-amber-600':'text-gray-700'}`}>
                    {c.ohPct.toFixed(1)}%
                    {f==='red'   && <span className="ml-1.5 text-xs font-bold px-1 py-0.5 rounded bg-red-100 text-red-700">Flag</span>}
                    {f==='amber' && <span className="ml-1.5 text-xs font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">Watch</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{c.ohHC.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{c.ooo.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-gray-700">{c.io.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-gray-700">{c.hc.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{c.hcReq.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{c.newReq.toFixed(0)}</td>
                </tr>
              );
            })}
            {!sortedTable.length && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
