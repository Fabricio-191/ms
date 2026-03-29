/**
 * Fast parse module — exposes v25 as the current best implementation.
 *
 * Single language:  `buildFastParse(language)(str)`
 * Multi language:   `buildFastParseMulti(languages)(str)`
 */
import { buildFastParse as buildFastParseV25 } from './variants/v25.ts';
import type { ParseFunction } from '@src/core/types.ts';
import type { Language } from '../core/index.ts';

export { buildFastParseV25 };

export function buildFastParse(language: Language): ParseFunction {
	return buildFastParseV25(language);
}

export function buildFastParseMulti(languages: Language[]): ParseFunction {
	if (languages.length === 0)
		throw new Error('`languages` must contain at least one Language instance');
	if (languages.length === 1)
		return buildFastParseV25(languages[0]!);

	const parsers = languages.map(lang => buildFastParseV25(lang));

	return (str: string) => {
		if (typeof str !== 'string' || str === '') return null;

		for (const parser of parsers) {
			const result = parser(str);
			if (result !== null) return result;
		}

		const n = Number(str);
		return Number.isNaN(n) ? null : n;
	};
}
