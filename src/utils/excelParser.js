import * as XLSX from 'xlsx';

// Column name → internal field mapping for the LATAM_Manual_HC_Data xlsx
const COL_MAP = {
  'Sub Client':       'SubClient',
  'LOB Name':         'LOBName',
  'SITE Name':        'SiteName',
  'Month':            'Month',
  'HC':               'HC',
  'HC Req':           'HCReq',
  'OOO%':             'OOOShrinkagePct',
  'IO%':              'IOShrinkagePct',
  'ExpDel':           'ExpectedDelivery',
  'ScheduleInflux':   'ScheduleInflux',
  'Training HC':      'TrainingHC',
  'Class Requested':  'ClassRequestedHC',
  'Class Started':    'ClassStartedHC',
  'Class Graduate':   'ClassGraduateHC',
};

// Parse the xlsx file buffer, return array of row objects.
export function parseExcel(arrayBuffer) {
  const wb    = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets['Weekly Data Template'] ?? wb.Sheets[wb.SheetNames[0]];
  const raw   = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return raw.map(row => {
    const out = {};
    for (const [src, dst] of Object.entries(COL_MAP)) {
      out[dst] = row[src] ?? '';
    }
    // Convert pct fields from whole-number % to decimal
    for (const f of ['OOOShrinkagePct', 'IOShrinkagePct', 'ScheduleInflux']) {
      const v = parseFloat(out[f]);
      if (!isNaN(v) && v > 1) out[f] = v / 100;  // e.g. 5.2 → 0.052
    }
    // Normalise Month to ISO date string
    if (out.Month) {
      const d = new Date(out.Month);
      if (!isNaN(d)) out.Month = d.toISOString().slice(0, 10);
    }
    return out;
  }).filter(r => r.LOBName);
}
