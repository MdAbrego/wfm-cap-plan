import { useState } from 'react';

const COLS = [
  { key: 'group',  label: 'Group' },
  { key: 'projHC', label: 'Proj HC' },
  { key: 'hcReq',  label: 'HC Req' },
  { key: 'newReq', label: 'New Req' },
  { key: 'ouHC',   label: 'Over/Under' },
  { key: 'ouPct',  label: 'O/U%' },
  { key: 'ohHC',   label: 'OH HC' },
  { key: 'ohPct',  label: 'OH%' },
  { key: 'absOS',  label: 'Abs Overstaff' },
];

function Pill({ country, language, channel }) {
  return (
    <span className="inline-flex gap-1 ml-1 align-middle">
      {channel  && <span className="px-1 rounded text-xs bg-gray-100 border border-gray-300 text-gray-600">{channel}</span>}
      {country  && <span className="px-1 rounded text-xs bg-blue-100 text-blue-700">{country}</span>}
      {language && <span className="px-1 rounded text-xs bg-green-100 text-green-700">{language}</span>}
    </span>
  );
}

function fmt(row, key) {
  const v = row[key];
  if (v === undefined || v === null) return '—';
  if (key === 'ouPct' || key === 'ohPct') return `${Number(v).toFixed(1)}%`;
  if (typeof v === 'number') return v.toFixed(0);
  return v;
}

export default function RollupTable({ rows = [] }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const total = rows.find(r => r.isTotal);
  const data  = rows.filter(r => !r.isTotal);

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey], bv = b[sortKey];
    const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function rowCls(row, key) {
    if ((key === 'ouHC' || key === 'ouPct') && (row.ouHC ?? 0) < 0) return 'text-red-600 font-medium';
    if (key === 'ohPct' && (row.ohPct ?? 0) > 30) return 'text-amber-600 font-semibold';
    return '';
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {COLS.map(c => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className="px-3 py-2 text-left font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100"
              >
                {c.label}
                {sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              {COLS.map(c => (
                <td key={c.key} className={`px-3 py-2 ${rowCls(row, c.key)}`}>
                  {c.key === 'group'
                    ? <span>{row.group}<Pill country={row.country} language={row.language} channel={row.channel} /></span>
                    : c.key === 'ohPct' && (row.ohPct ?? 0) > 30
                      ? <span>{fmt(row, c.key)} <span className="text-amber-500">⚑</span></span>
                      : fmt(row, c.key)
                  }
                </td>
              ))}
            </tr>
          ))}
          {total && (
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              {COLS.map(c => (
                <td key={c.key} className={`px-3 py-2 font-semibold text-blue-800 ${rowCls(total, c.key)}`}>
                  {fmt(total, c.key)}
                </td>
              ))}
            </tr>
          )}
          {sorted.length === 0 && (
            <tr><td colSpan={COLS.length} className="px-3 py-8 text-center text-gray-400">No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
