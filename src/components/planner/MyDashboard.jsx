import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'chart.js/auto';
import { useAuth } from '../../context/AuthContext';
import { api }     from '../../api/dataLayer';
import MetricCard  from '../shared/MetricCard';

const ML = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SECTIONS = [
  { title:'HEADCOUNT',              cols:['HC','HCReq','newReq'],         labels:['Proj HC','HC Req','New Req'] },
  { title:'OVERHEAD',               cols:['ohHC','ohPct'],                labels:['Overhead HC','Overhead %'],        fmtPct:['ohPct'] },
  { title:'OVER/UNDER',             cols:['ouHC','ouPct','absOS'],         labels:['O/U HC','O/U %','Abs Overstaff'],  fmtPct:['ouPct'], red:['ouHC','ouPct'] },
  { title:'SHRINKAGE & EFFICIENCY', cols:['OOOShrinkagePct','IOShrinkagePct','baseFc','staffEff'], labels:['OOO%','IO%','Base Forecast','Staffing Eff.'], fmtDecPct:['OOOShrinkagePct','IOShrinkagePct'], fmtPct:['staffEff'] },
];

function pctFmt(v, isDecimal = false) {
  if (v === null || v === undefined) return '—';
  return `${(isDecimal ? v * 100 : v).toFixed(1)}%`;
}

export default function MyDashboard() {
  const { user, accessToken } = useAuth();
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteTab, setSiteTab] = useState('All');
  const lineRef    = useRef(); const lineChart = useRef();
  const barRef     = useRef(); const barChart  = useRef();

  useEffect(() => {
    if (!user) return;
    api.getMySubmissions(user.email, accessToken)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [user, accessToken]);

  const sites    = ['All', ...new Set(rows.map(r => r.SiteName).filter(Boolean))];
  const filtered = siteTab === 'All' ? rows : rows.filter(r => r.SiteName === siteTab);

  // Aggregate by period for charts
  const byMonth = {};
  for (const r of filtered) {
    const pk = r.PeriodKey; if (!pk) continue;
    if (!byMonth[pk]) byMonth[pk] = { hc:0, hcr:0, newReq:0, ohPcts:[], count:0 };
    byMonth[pk].hc     += r.HC    || 0;
    byMonth[pk].hcr    += r.HCReq || 0;
    byMonth[pk].newReq += r.newReq || 0;
    byMonth[pk].ohPcts.push(r.ohPct || 0);
  }
  const pks         = Object.keys(byMonth).sort();
  const labels      = pks.map(pk => { const [y,m] = pk.split('-'); return `${ML[+m-1]} ${y}`; });
  const hcData      = pks.map(pk => byMonth[pk].hc);
  const hcrData     = pks.map(pk => byMonth[pk].hcr);
  const newReqData  = pks.map(pk => byMonth[pk].newReq);
  const ohPctData   = pks.map(pk => { const a = byMonth[pk].ohPcts; return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0; });

  // KPIs
  const avgHC      = hcData.length ? Math.round(hcData.reduce((a,b)=>a+b,0)/hcData.length) : '—';
  const avgOhPct   = ohPctData.length ? (ohPctData.reduce((a,b)=>a+b,0)/ohPctData.length).toFixed(1) : '—';
  const absOS      = filtered.reduce((a,r) => a+(r.absOS||0), 0).toFixed(0);
  const months30   = ohPctData.filter(v=>v>30).length;

  useEffect(() => {
    if (!lineRef.current || !pks.length) return;
    lineChart.current?.destroy();
    lineChart.current = new Chart(lineRef.current, {
      type: 'line',
      data: { labels, datasets: [
        { label:'Proj HC',  data:hcData,     borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.07)', tension:0.3, fill:true },
        { label:'HC Req',   data:hcrData,    borderColor:'#22c55e', borderDash:[5,3], tension:0.3, fill:false },
        { label:'New Req',  data:newReqData, borderColor:'#f59e0b', borderDash:[2,2], tension:0.3, fill:false },
      ]},
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:false } } },
    });
    return () => lineChart.current?.destroy();
  }, [JSON.stringify(labels)]);

  useEffect(() => {
    if (!barRef.current || !pks.length) return;
    barChart.current?.destroy();
    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: { labels, datasets: [
        { label:'Overhead %', data:ohPctData, backgroundColor: ohPctData.map(v => v>30?'#f59e0b':'#93c5fd') },
      ]},
      options:{
        responsive:true,
        plugins:{ legend:{ display:false },
          annotation:{ annotations:{ threshold:{ type:'line', yMin:30, yMax:30, borderColor:'#ef4444', borderDash:[6,3], borderWidth:2, label:{ content:'30%', enabled:true, position:'end' } } } } },
        scales:{ y:{ beginAtZero:true, ticks:{ callback: v=>`${v}%` } } },
      },
    });
    return () => barChart.current?.destroy();
  }, [JSON.stringify(ohPctData)]);

  if (loading) return <div className="flex items-center justify-center p-12 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">My Dashboard</h1>
        <Link to="/planner/submit"
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700">
          Looks good — submit plan →
        </Link>
      </div>

      {/* Site tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {sites.map(s => (
          <button key={s} onClick={() => setSiteTab(s)} type="button"
            className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
              siteTab === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Avg Proj HC"      value={avgHC} />
        <MetricCard label="Avg Overhead %"   value={`${avgOhPct}%`} flag={parseFloat(avgOhPct)>30} />
        <MetricCard label="Abs Overstaff"    value={absOS} />
        <MetricCard label="Months OH >30%"   value={months30} flag={months30>0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-600 mb-3">Proj HC vs HC Req vs New Req — 12 months</p>
          <canvas ref={lineRef} role="img" aria-label="12-month headcount trend" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-600 mb-1">Overhead % by Month</p>
          <p className="text-xs text-amber-600 mb-2">Amber bars = OH &gt;30% · Red dashed = 30% threshold</p>
          <canvas ref={barRef} role="img" aria-label="Overhead % by month" />
        </div>
      </div>

      {/* Metric detail table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50">Metric</th>
              {pks.map(pk => { const [y,m]=pk.split('-'); return (
                <th key={pk} className="px-3 py-2 text-center font-semibold text-gray-600 whitespace-nowrap">
                  {ML[+m-1]} {y.slice(2)}
                </th>
              ); })}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(sec => (
              <>
                <tr key={sec.title} className="bg-gray-100">
                  <td colSpan={pks.length+1} className="px-3 py-1 text-xs font-bold text-gray-500 tracking-wider">{sec.title}</td>
                </tr>
                {sec.cols.map((col, ci) => {
                  const agg = {};
                  filtered.forEach(r => {
                    const pk = r.PeriodKey; if (!pk) return;
                    if (!agg[pk]) agg[pk] = { sum:0, cnt:0 };
                    agg[pk].sum += (r[col] ?? 0);
                    agg[pk].cnt++;
                  });
                  return (
                    <tr key={col} className="border-b border-gray-100 even:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-600 sticky left-0 bg-inherit whitespace-nowrap">{sec.labels[ci]}</td>
                      {pks.map(pk => {
                        const val = agg[pk]?.sum ?? null;
                        const isDecPct = sec.fmtDecPct?.includes(col);
                        const isPct    = sec.fmtPct?.includes(col);
                        const isRed    = sec.red?.includes(col) && (val ?? 0) < 0;
                        const isAmber  = col === 'ohPct' && (val ?? 0) > 30;
                        const display  = isDecPct ? pctFmt(val, true) : isPct ? pctFmt(val) : val?.toFixed(0) ?? '—';
                        return (
                          <td key={pk} className={`px-3 py-2 text-center ${isRed?'text-red-600 font-medium':''} ${isAmber?'text-amber-600 font-semibold bg-amber-50':''}`}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-200 inline-block"/>Understaffed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-200 inline-block"/>OH &gt;30%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-200 inline-block"/>On target</span>
      </div>
    </div>
  );
}
