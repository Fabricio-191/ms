/**
 * Fast parse module — exposes v18 as the current best implementation.
 *
 * Single language:  `buildFastParse(language)(str)`
 * Multi language:   `buildFastParseMulti(languages)(str)`
 */
import { buildFastParse as buildFastParseV18, type FastParseFunction, type FastParseWithCount } from './variants/single/v18.ts';
import type { Language } from '../core/index.ts';

export { buildFastParseV18, type FastParseWithCount };

export function buildFastParse(language: Language, withMatchCount: true): FastParseWithCount;
export function buildFastParse(language: Language, withMatchCount?: false): FastParseFunction;
export function buildFastParse(language: Language, withMatchCount = false): FastParseFunction | FastParseWithCount {
	return withMatchCount ? buildFastParseV18(language, true) : buildFastParseV18(language);
}

export function buildFastParseMulti(languages: Language[]): FastParseFunction {
	if (languages.length === 0)
		throw new Error('`languages` must contain at least one Language instance');
	if (languages.length === 1)
		return buildFastParseV18(languages[0]!);

	const parsers = languages.map(lang => buildFastParseV18(lang, true));

	return (str: string) => {
		if (typeof str !== 'string' || str === '') return null;

		let bestResult: number | null = null;
		let bestCount = 0;

		for (const parser of parsers) {
			const [ result, count ] = parser(str);
			if (count > bestCount) {
				bestResult = result;
				bestCount = count;
			}
		}

		if (bestCount === 0) {
			const n = Number(str);
			return Number.isNaN(n) ? null : n;
		}

		return bestResult;
	};
}
