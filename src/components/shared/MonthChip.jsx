const ML = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// state: 'saved' | 'inprogress' | 'empty'
export default function MonthChip({ monthIndex, year, state = 'empty', active = false, selecting = false, selected = false, onClick }) {
  const label = `${ML[monthIndex]} ${String(year).slice(2)}`;
  const base  = 'px-3 py-1 rounded-full text-xs font-medium cursor-pointer border transition-all select-none';

  let style = 'bg-gray-100 border-gray-300 text-gray-500';
  if (state === 'saved')      style = 'bg-green-100 border-green-300 text-green-700';
  if (state === 'inprogress') style = 'bg-amber-100 border-amber-300 text-amber-700';
  if (selecting && selected)  style = 'bg-blue-600 border-blue-600 text-white';
  if (selecting && !selected && state === 'empty') style = 'bg-gray-100 border-dashed border-blue-400 text-blue-500';

  const ring = active && !selecting ? 'ring-2 ring-offset-1 ring-blue-500' : '';

  return (
    <button className={`${base} ${style} ${ring}`} onClick={onClick} type="button">
      {label}
    </button>
  );
}
