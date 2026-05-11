import { useEffect, useState } from 'react';
import { Link }    from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api }     from '../../api/dataLayer';

const START_YEAR = 2026; const START_MONTH = 3;
const PERIODS    = Array.from({ length:12 }, (_, i) => {
  const t = START_MONTH + i;
  const y = START_YEAR + Math.floor(t/12);
  const m = String((t%12)+1).padStart(2,'0');
  return `${y}-${m}`;
});
const ML = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function Check({ pass, label, warn = false }) {
  const icon = pass === null ? '○' : pass ? '✓' : (warn ? '⚠' : '✗');
  const cls  = pass === null ? 'text-gray-400'
              : pass ? 'text-green-600'
              : warn ? 'text-amber-600'
              : 'text-red-600';
  return (
    <li className={`flex items-start gap-2 text-sm ${cls}`}>
      <span className="font-bold mt-0.5 w-4 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </li>
  );
}

export default function SubmitPage() {
  const { user, accessToken } = useAuth();
  const [rows,       setRows]       = useState([]);
  const [locked,     setLocked]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [toast,      setToast]      = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!user) return;
    api.getMySubmissions(user.email, accessToken).then(setRows).finally(() => setLoading(false));
    api.isPeriodLocked(PERIODS[0], accessToken).then(setLocked);
  }, [user, accessToken]);

  const byPk = Object.fromEntries(rows.map(r => [r.PeriodKey, r]));

  // Checklist
  const has12Months = PERIODS.every(pk => byPk[pk]);
  const hcFilled    = PERIODS.every(pk => byPk[pk]?.HC && byPk[pk]?.HCReq);
  const understaffed = PERIODS.filter(pk => {
    const r = byPk[pk];
    return r && r.HC && r.HCReq && (r.HC - r.HCReq) / r.HCReq < -0.05;
  });
  const shrinkageOk = PERIODS.every(pk => {
    const r = byPk[pk]; if (!r) return true;
    return (r.OOOShrinkagePct || 0) < 0.15 && (r.IOShrinkagePct || 0) < 0.20;
  });
  const trainingOk = PERIODS.some(pk => byPk[pk]?.TrainingHC > 0);

  const hasFlags  = understaffed.length > 0;
  const canSubmit = has12Months && hcFilled && shrinkageOk && !locked;

  const lobs  = [...new Set(rows.map(r => r.LOBName).filter(Boolean))];
  const sites = [...new Set(rows.map(r => r.SiteName).filter(Boolean))];

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const toSubmit = rows.map(r => ({ ...r, Status: 'Submitted', SubmittedAt: new Date().toISOString() }));
      await api.submitPlan(toSubmit, user, accessToken);
      setDone(true);
    } catch {
      setToast({ msg: 'Submission failed — check your connection', isError: true });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center p-12 text-gray-400 text-sm">Loading…</div>;

  if (done) return (
    <div className="max-w-lg mx-auto p-12 text-center">
      <div className="text-6xl mb-4">✓</div>
      <h1 className="text-2xl font-bold text-green-700 mb-2">Submitted</h1>
      <p className="text-gray-500 text-sm mb-6">Your data is now live in the manager dashboard.</p>
      <Link to="/planner/dashboard"
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        View my dashboard
      </Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-800">Submit Plan</h1>
        <Link to="/planner/edit" className="text-sm text-blue-600 hover:underline">← Back to edit</Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">All checks must pass before submitting.</p>

      {locked && (
        <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          This period is locked by a manager.
        </div>
      )}
      {hasFlags && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          ⚠ Warning: {understaffed.length} month(s) are understaffed &gt;5%:{' '}
          {understaffed.map(pk => { const [y,m]=pk.split('-'); return `${ML[+m-1]} ${y.slice(2)}`; }).join(', ')}.
          You can still submit — manager will see the flags.
        </div>
      )}

      {/* Checklist */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Pre-submission checklist</h2>
        <ul className="flex flex-col gap-2.5">
          <Check pass={has12Months} label="12 months of data entered for all LOBs" />
          <Check pass={hcFilled}    label="HC and HC Required filled for every month" />
          <Check pass={understaffed.length === 0} warn
            label={understaffed.length
              ? `${understaffed.length} month(s) understaffed >5%`
              : 'No months with understaffing >5%'} />
          <Check pass={shrinkageOk} label="Shrinkage within range (OOO <15%, IO <20%)" />
          <Check pass={trainingOk} warn={!trainingOk} label="Training pipeline entered (at least one month)" />
        </ul>
      </div>

      {/* Summary card */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Submission summary</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Planner</dt>
          <dd className="text-gray-800 font-medium">{user?.name || user?.email}</dd>
          <dt className="text-gray-500">Sites</dt>
          <dd className="text-gray-800 font-medium">{sites.join(', ') || '—'}</dd>
          <dt className="text-gray-500">LOBs</dt>
          <dd className="text-gray-800 font-medium">{lobs.length} LOB(s)</dd>
          <dt className="text-gray-500">Period</dt>
          <dd className="text-gray-800 font-medium">Apr 2026 – Mar 2027</dd>
          <dt className="text-gray-500">Rows</dt>
          <dd className="text-gray-800 font-medium">{rows.length}</dd>
        </dl>
      </div>

      <button onClick={handleSubmit} disabled={!canSubmit || submitting}
        className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {submitting ? 'Submitting…' : 'Confirm & submit'}
      </button>
      <p className="text-xs text-gray-400 mt-2 text-center">You can resubmit until the manager locks the period.</p>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm text-white shadow-lg ${toast.isError?'bg-red-600':'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
