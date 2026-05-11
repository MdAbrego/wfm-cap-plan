export default function FilterBar({ filters = {}, options = {}, onChange, onClear }) {
  const sel = (field, label, opts = []) => (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-gray-400 font-medium">{label}</label>
      <select
        value={filters[field] || ''}
        onChange={e => onChange?.(field, e.target.value)}
        className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-28"
      >
        <option value="">All</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <span className="text-xs font-semibold text-gray-400 self-end pb-1.5">Filter</span>
      {sel('rollupClient', 'Rollup Client', options.rollupClients)}
      {sel('subClient',    'Sub Client',    options.subClients)}
      {sel('site',         'Site',          options.sites)}
      {sel('country',      'Country',       options.countries)}
      {sel('language',     'LOB Language',  options.languages)}
      {sel('channel',      'Channel',       options.channels)}
      <button
        type="button"
        onClick={onClear}
        className="self-end pb-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium ml-auto"
      >
        Clear all
      </button>
    </div>
  );
}
