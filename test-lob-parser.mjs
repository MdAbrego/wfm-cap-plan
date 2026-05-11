import { parseLOBName } from './src/utils/lobParser.js';

const tests = [
  'ALLIANZ SE - 000 CO SPA',
  'CASHAPP - CHT CO ENG',
  'P_Avianca Co - IBV CO FRE',
  'CLARO - OBV BR POR',
  'P_ADIDAS - 000 PE SPA',
];

for (const lob of tests) {
  const r = parseLOBName(lob);
  console.log(`"${lob}"`);
  console.log(`  channel=${r.channel}  country=${r.country}  language=${r.language}`);
}
