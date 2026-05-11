import { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api }     from '../../api/dataLayer';
import { calcMetrics, parseLOBName } from '../../utils/lobParser';
import MonthChip  from '../shared/MonthChip';
import MetricCard from '../shared/MetricCard';

// Apr 2026 → Mar 2027
const START_YEAR  = 2026;
const START_MONTH = 3; // 0-indexed: April
const MONTHS_12   = Array.from({ length: 12 }, (_, i) => {
  const total = START_MONTH + i;
  return { year: START_YEAR + Math.floor(total / 12), month: total % 12 };
});
function periodKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }
function monthDate(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}-01`; }

const EMPTY = {
  SubClient:'', LOBName:'', SiteName:'', ActualProjected:'Projected',
  ClientForecastFTE:'', HC:'', HCReq:'', AttritionPct:'',
  OOOShrinkagePct:'', IOShrinkagePct:'', ExpectedDelivery:'1',
  ScheduleInflux:'', TrainingHC:'', ClassRequestedHC:'',
  ClassStartedHC:'', ClassGraduateHC:'',
};

function LOBPills({ name }) {
  if (!name) return null;
  const { channel, country, language } = parseLOBName(name);
  return (
    <span className="inline-flex gap-1 ml-2">
      <span className="px-1 rounded text-xs bg-gray-100 border border-gray-300 text-gray-600">{channel}</span>
      <span className="px-1 rounded text-xs bg-blue-100 text-blue-700">{country}</span>
      <span className="px-1 rounded text-xs bg-green-100 text-green-700">{language}</span>
    </span>
  );
}

function Field({ label, fieldKey, form, setForm, type = 'number', suffix = '' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-gray-500 font-medium">
        {label}{suffix && <span className="text-gray-400 ml-1">{suffix}</span>}
      </label>
      <input
        type={type}
        value={form[fieldKey]}
        onChange={e => setForm(p => ({ ...p, [fieldKey]: e.target.value }))}
        className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
  );
}

export default function EditByMonth() {
  const { user, accessToken } = useAuth();
  const location = useLocation();

  const [activeIdx,  setActiveIdx]  = useState(0);
  const [saved,      setSaved]      = useState({});     // pk → row
  const [form,       setForm]       = useState({ ...EMPTY });
  const [copying,    setCopying]    = useState(false);  // copy-mode
  const [selected,   setSelected]   = useState(new Set());
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState(null);
  const [isLocked,   setIsLocked]   = useState(false);
  const [lobOptions, setLobOptions] = useState([]);
  const [siteOptions,setSiteOptions]= useState([]);

  // Load existing submissions
  useEffect(() => {
    if (!user) return;
    api.getMySubmissions(user.email, accessToken).then(rows => {
      const byPk = {};
      rows.forEach(r => { byPk[r.PeriodKey] = r; });
      setSaved(byPk);
      // Populate LOB / site autocomplete options
      setLobOptions([...new Set(rows.map(r => r.LOBName).filter(Boolean))]);
      setSiteOptions([...new Set(rows.map(r => r.SiteName).filter(Boolean))]);
    });
  }, [user, accessToken]);

  // Handle imported rows from UploadPage
  useEffect(() => {
    if (!location.state?.importedRows?.length) return;
    const byPk = {};
    location.state.importedRows.forEach(r => {
      if (r.PeriodKey) byPk[r.PeriodKey] = r;
    });
    setSaved(prev => ({ ...prev, ...byPk }));
  }, [location.state]);

  // Check period lock when active month changes
  useEffect(() => {
    const pk = periodKey(MONTHS_12[activeIdx].year, MONTHS_12[activeIdx].month);
    api.isPeriodLocked(pk, accessToken).then(setIsLocked);
  }, [activeIdx, accessToken]);

  // Load form from saved data when month changes
  useEffect(() => {
    const { year, month } = MONTHS_12[activeIdx];
    const pk  = periodKey(year, month);
    const row = saved[pk];
    if (row) {
      setForm({
        SubClient:         row.SubClient         ?? '',
        LOBName:           row.LOBName           ?? '',
        SiteName:          row.SiteName          ?? '',
        ActualProjected:   row.ActualProjected   ?? 'Projected',
        ClientForecastFTE: row.ClientForecastFTE ?? '',
        HC:                row.HC                ?? '',
        HCReq:             row.HCReq             ?? '',
        AttritionPct:      row.AttritionPct != null ? (row.AttritionPct * 100).toFixed(2) : '',
        OOOShrinkagePct:   row.OOOShrinkagePct != null ? (row.OOOShrinkagePct * 100).toFixed(2) : '',
        IOShrinkagePct:    row.IOShrinkagePct  != null ? (row.IOShrinkagePct  * 100).toFixed(2) : '',
        ExpectedDelivery:  row.ExpectedDelivery  ?? '1',
        ScheduleInflux:    row.ScheduleInflux != null  ? (row.ScheduleInflux * 100).toFixed(2) : '',
        TrainingHC:        row.TrainingHC        ?? '',
        ClassRequestedHC:  row.ClassRequestedHC  ?? '',
        ClassStartedHC:    row.ClassStartedHC    ?? '',
        ClassGraduateHC:   row.ClassGraduateHC   ?? '',
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [activeIdx, saved]);

  // Live computed metrics
  const metrics = useMemo(() => {
    const hcr  = parseFloat(form.HCReq)            || 0;
    if (!hcr) return null;
    return calcMetrics({
      hc:    parseFloat(form.HC)               || 0,
      hcr,
      ooo:   parseFloat(form.OOOShrinkagePct)  || 0,
      io:    parseFloat(form.IOShrinkagePct)   || 0,
      sched: parseFloat(form.ScheduleInflux)   || 0,
      ed:    parseFloat(form.ExpectedDelivery) || 1,
    });
  }, [form]);

  function chipState(idx) {
    const { year, month } = MONTHS_12[idx];
    const pk = periodKey(year, month);
    if (!saved[pk]) return 'empty';
    return saved[pk].Status === 'Submitted' ? 'saved' : 'inprogress';
  }

  function buildRow(idx) {
    const { year, month } = MONTHS_12[idx];
    const pk = periodKey(year, month);
    return {
      SubClient:         form.SubClient,
      LOBName:           form.LOBName,
      SiteName:          form.SiteName,
      Month:             monthDate(year, month),
      ActualProjected:   form.ActualProjected,
      ClientForecastFTE: parseFloat(form.ClientForecastFTE) || 0,
      HC:                parseFloat(form.HC)               || 0,
      HCReq:             parseFloat(form.HCReq)            || 0,
      AttritionPct:      (parseFloat(form.AttritionPct)    || 0) / 100,
      OOOShrinkagePct:   (parseFloat(form.OOOShrinkagePct) || 0) / 100,
      IOShrinkagePct:    (parseFloat(form.IOShrinkagePct)  || 0) / 100,
      ExpectedDelivery:  parseFloat(form.ExpectedDelivery) || 1,
      ScheduleInflux:    (parseFloat(form.ScheduleInflux)  || 0) / 100,
      TrainingHC:        parseFloat(form.TrainingHC)       || 0,
      ClassRequestedHC:  parseFloat(form.ClassRequestedHC) || 0,
      ClassStartedHC:    parseFloat(form.ClassStartedHC)   || 0,
      ClassGraduateHC:   parseFloat(form.ClassGraduateHC)  || 0,
      PeriodKey:         pk,
      Status:            'Draft',
    };
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const row = { ...buildRow(activeIdx), Status: 'Draft' };
      await api.submitPlan([row], user, accessToken);
      const pk = periodKey(MONTHS_12[activeIdx].year, MONTHS_12[activeIdx].month);
      setSaved(prev => ({ ...prev, [pk]: { ...row, Status: 'Draft' } }));
      showToast('Saved ✓');
      if (activeIdx < 11) setActiveIdx(i => i + 1);
    } catch (e) {
      showToast('Save failed — check connection', true);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyApply() {
    if (!user || !selected.size) return;
    setSaving(true);
    try {
      const rows = [...selected].map(idx => buildRow(idx));
      await api.submitPlan(rows, user, accessToken);
      const updates = {};
      rows.forEach(r => { updates[r.PeriodKey] = { ...r }; });
      setSaved(prev => ({ ...prev, ...updates }));
      showToast(`Copied to ${selected.size} month(s) ✓`);
    } catch {
      showToast('Copy failed', true);
    } finally {
      setSaving(false);
      setCopying(false);
      setSelected(new Set());
    }
  }

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }

  function toggleSelect(idx) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Edit by Month</h1>
        <Link to="/planner/dashboard" className="text-sm text-blue-600 hover:underline">
          Preview dashboard →
        </Link>
      </div>

      {/* Month chips */}
      <div className="flex flex-wrap gap-2 mb-2">
        {MONTHS_12.map((m, i) => (
          <MonthChip
            key={i}
            monthIndex={m.month}
            year={m.year}
            state={chipState(i)}
            active={!copying && i === activeIdx}
            selecting={copying}
            selected={selected.has(i)}
            onClick={() => copying ? toggleSelect(i) : setActiveIdx(i)}
          />
        ))}
      </div>

      {/* Copy mode toolbar */}
      {copying ? (
        <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-700">Click target months, then apply.</span>
          <span className="text-blue-500">{selected.size} selected</span>
          <button onClick={handleCopyApply} disabled={!selected.size || saving}
            className="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded font-medium text-xs hover:bg-blue-700 disabled:opacity-50">
            Apply copy
          </button>
          <button onClick={() => { setCopying(false); setSelected(new Set()); }}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">
            Cancel
          </button>
        </div>
      ) : (
        <div className="mb-4" />
      )}

      {isLocked && (
        <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          This period is locked by a manager — read-only.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* LOB details */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">LOB Details</h2>
          <Field label="Sub Client" fieldKey="SubClient" form={form} setForm={setForm} type="text" />
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500 font-medium">
              LOB Name <LOBPills name={form.LOBName} />
            </label>
            <input list="lob-list" type="text" value={form.LOBName}
              onChange={e => setForm(p => ({ ...p, LOBName: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <datalist id="lob-list">
              {lobOptions.map(o => <option key={o} value={o} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500 font-medium">Site</label>
            <input list="site-list" type="text" value={form.SiteName}
              onChange={e => setForm(p => ({ ...p, SiteName: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <datalist id="site-list">
              {siteOptions.map(o => <option key={o} value={o} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500 font-medium">Actual / Projected</label>
            <select value={form.ActualProjected}
              onChange={e => setForm(p => ({ ...p, ActualProjected: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option>Projected</option><option>Actual</option>
            </select>
          </div>
          <Field label="Client Forecast FTE" fieldKey="ClientForecastFTE" form={form} setForm={setForm} />
        </div>

        {/* HC + Shrinkage */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">Headcount & Shrinkage</h2>
          <Field label="Projected HC"    fieldKey="HC"              form={form} setForm={setForm} />
          <Field label="HC Required"     fieldKey="HCReq"           form={form} setForm={setForm} />
          <Field label="Attrition"       fieldKey="AttritionPct"    form={form} setForm={setForm} suffix="%" />
          <Field label="OOO Shrinkage"   fieldKey="OOOShrinkagePct" form={form} setForm={setForm} suffix="%" />
          <Field label="IO Shrinkage"    fieldKey="IOShrinkagePct"  form={form} setForm={setForm} suffix="%" />
          <Field label="Expected Delivery" fieldKey="ExpectedDelivery" form={form} setForm={setForm} />
          <Field label="Schedule Influx" fieldKey="ScheduleInflux"  form={form} setForm={setForm} suffix="%" />
        </div>

        {/* Training */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">Training Pipeline</h2>
          <Field label="Training HC"       fieldKey="TrainingHC"       form={form} setForm={setForm} />
          <Field label="Class Requested"   fieldKey="ClassRequestedHC" form={form} setForm={setForm} />
          <Field label="Class Started"     fieldKey="ClassStartedHC"   form={form} setForm={setForm} />
          <Field label="Class Graduate"    fieldKey="ClassGraduateHC"  form={form} setForm={setForm} />
        </div>

        {/* Live metrics */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b pb-2 mb-3">Live Computed Metrics</h2>
          {!metrics ? (
            <p className="text-xs text-gray-400">Enter HC Required to see metrics.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <MetricCard label="Base Forecast"    value={metrics.baseFc} />
              <MetricCard label="New Req (w/ OH)"  value={metrics.newReq} />
              <MetricCard label="Overhead HC"      value={metrics.ohHC} />
              <MetricCard label="Overhead %"       value={`${metrics.ohPct.toFixed(1)}%`} flag={metrics.ohFlag} />
              <MetricCard label="Over/Under"       value={metrics.ouHC}  danger={metrics.ouHC < 0} />
              <MetricCard label="O/U %"            value={`${metrics.ouPct.toFixed(1)}%`} danger={metrics.ouHC < 0} />
              <MetricCard label="Abs Overstaff"    value={metrics.absOS} />
              <MetricCard label="Staffing Eff."    value={`${metrics.staffEff.toFixed(1)}%`} />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isLocked && !copying && (
        <div className="mt-5 flex gap-3 flex-wrap">
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save month'}
          </button>
          <button onClick={() => setCopying(true)}
            className="px-5 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg font-medium hover:bg-gray-200">
            Copy to future months
          </button>
          <Link to="/planner/submit"
            className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700">
            Submit plan →
          </Link>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm text-white shadow-lg ${toast.isError ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
