export {
	Language,
	Notations,
	TIMES,
	UNITS,
	type LanguageData,
	type NotationsData,
	type Unit,
} from './core/index.ts';
export { LANGUAGES, type LanguageKey } from './core/languages.ts';

export type { ParseFunction, ParseWithCountFunction } from './core/types.ts';

export { parse } from './parse/normal.ts';
export { buildFastParse } from './parse/variants/v25.ts';

export { format } from './format/normal.ts';
export { buildFastFormat, type FastFormatFn } from './format/variants/v16.ts';

import { buildFastParse as v25 } from './parse/variants/v25.ts';
import { buildFastParse as v42 } from './parse/variants/v42.ts';
export const parseVariants = { v25, v42 };
