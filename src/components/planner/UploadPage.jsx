import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseExcel } from '../../utils/excelParser';

const PREVIEW_COLS = ['LOBName','SiteName','Month','HC','HCReq','OOOShrinkagePct','IOShrinkagePct'];

export default function UploadPage() {
  const [preview, setPreview] = useState(null);
  const [rows,    setRows]    = useState([]);
  const [error,   setError]   = useState('');
  const inputRef  = useRef();
  const navigate  = useNavigate();

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parseExcel(e.target.result);
        setRows(parsed);
        setPreview(parsed.slice(0, 4));
        setError('');
      } catch {
        setError('Could not parse file. Make sure it is the LATAM_Manual_HC_Data xlsx.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Upload HC Data</h1>
      <p className="text-sm text-gray-500 mb-6">
        Drop your <code className="text-xs bg-gray-100 px-1 rounded">LATAM_Manual_HC_Data</code> xlsx to pre-fill the edit form.
      </p>

      <div
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        <p className="text-3xl mb-3">📄</p>
        <p className="text-gray-500 text-sm">Drag & drop xlsx here, or click to browse</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
               onChange={e => handleFile(e.target.files[0])} />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {preview && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-gray-600 mb-2">Preview — first 4 rows ({rows.length} total)</p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  {PREVIEW_COLS.map(k => (
                    <th key={k} className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 even:bg-gray-50">
                    {PREVIEW_COLS.map(k => (
                      <td key={k} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{String(row[k] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate('/planner/edit', { state: { importedRows: rows } })}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700"
            >
              Import {rows.length} rows → Edit form
            </button>
            <button
              onClick={() => { setPreview(null); setRows([]); }}
              className="px-5 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg font-medium hover:bg-gray-200"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
