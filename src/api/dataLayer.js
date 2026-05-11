import { USE_MOCK } from '../authConfig.js';
import * as sheetsApi from './googleSheets.js';
import * as mockApi   from '../mock/mockData.js';

// All components import from here only — never directly from googleSheets or mockData.
export const api = USE_MOCK ? mockApi : sheetsApi;
