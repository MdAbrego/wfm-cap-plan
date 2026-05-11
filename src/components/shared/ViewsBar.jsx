const VIEWS = ['Geo','Region','Sub region','Country','Campus','Site','Rollup client','Sub client','LOB','LOB language','Channel','Totals'];

export default function ViewsBar({ active = 'Country', onSelect }) {
  return (
    <nav className="flex flex-wrap gap-1 pb-3 mb-4 border-b border-gray-200">
      {VIEWS.map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onSelect?.(v)}
          className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
            active === v
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {v}
        </button>
      ))}
    </nav>
  );
}
