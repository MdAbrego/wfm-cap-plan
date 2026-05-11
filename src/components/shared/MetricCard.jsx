export default function MetricCard({ label, value, flag = false, danger = false, unit = '' }) {
  let cls = 'bg-blue-50 border-blue-200 text-blue-700';
  if (flag)   cls = 'bg-amber-50 border-amber-300 text-amber-700';
  if (danger) cls = 'bg-red-50   border-red-200   text-red-700';

  return (
    <div className={`rounded-lg border p-3 min-w-28 ${cls}`}>
      <p className="text-xs font-medium opacity-70 leading-tight mb-1">{label}</p>
      <p className="text-lg font-bold leading-tight">
        {value ?? '—'}
        {unit && <span className="text-sm font-normal ml-0.5">{unit}</span>}
      </p>
      {flag   && <p className="text-xs font-semibold mt-0.5">⚑ OH &gt;30%</p>}
      {danger && <p className="text-xs font-semibold mt-0.5">▼ Understaffed</p>}
    </div>
  );
}
