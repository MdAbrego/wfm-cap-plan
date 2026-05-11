export function parseLOBName(lobName) {
  if (!lobName || !lobName.includes(' - ')) {
    return { channel: '000', country: '000', language: '000' };
  }
  const suffix = lobName.split(' - ').pop().trim();
  const tokens = suffix.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) {
    return {
      channel: tokens[tokens.length - 3],
      country: tokens[tokens.length - 2],
      language: tokens[tokens.length - 1],
    };
  }
  return { channel: '000', country: tokens[0] || '000', language: tokens[1] || '000' };
}

export function calcMetrics({ hc, hcr, ooo, io, sched, ed }) {
  const o = ooo / 100, ioR = io / 100, s = sched / 100, edR = ed || 1;
  const newReq   = hcr / (1 - o) / (1 - ioR) * (1 + s) * edR;
  const baseFc   = hcr * (1 - o) * (1 - ioR) / edR / (1 + s);
  const ohHC     = newReq - hcr;
  const ohPct    = hcr > 0 ? (ohHC / hcr) * 100 : 0;
  const ouHC     = hc - hcr;
  const ouPct    = hcr > 0 ? (ouHC / hcr) * 100 : 0;
  const absOS    = Math.max(0, ouHC);
  const staffEff = hcr > 0 ? Math.min((hc / hcr) * 100, 100) : 0;
  return {
    newReq:   +newReq.toFixed(1),
    baseFc:   +baseFc.toFixed(1),
    ohHC:     +ohHC.toFixed(1),
    ohPct:    +ohPct.toFixed(2),
    ouHC:     +ouHC.toFixed(1),
    ouPct:    +ouPct.toFixed(2),
    absOS:    +absOS.toFixed(1),
    staffEff: +staffEff.toFixed(2),
    ohFlag:   ohPct > 30,
  };
}
