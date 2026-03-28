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
export { buildFastFormat } from './format/variants/v2.ts';

import { buildFastParse as v18 } from './parse/variants/v18.ts';
import { buildFastParse as v23 } from './parse/variants/v23.ts';
import { buildFastParse as v25 } from './parse/variants/v25.ts';
import { buildFastParse as v29 } from './parse/variants/v29.ts';
import { buildFastParse as v31 } from './parse/variants/v31.ts';
import { buildFastParse as v32 } from './parse/variants/v32.ts';

export const parseVariants = { v18, v23, v25, v29, v31, v32 };

import { buildFastFormat as fv1 } from './format/variants/v1.ts';
import { buildFastFormat as fv2 } from './format/variants/v2.ts';

export const formatVariants = { v1: fv1, v2: fv2 };
