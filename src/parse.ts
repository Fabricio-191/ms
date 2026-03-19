import { Language } from './languages/core.ts';
import { LANGUAGES } from './languages/languages.ts';

export const NEGATIVE_REGEX = /^\s*-/u;

export function parse(str: string, languages: Language | Language[] = LANGUAGES['en']!): number | null {
	if (typeof str !== 'string' || str === '') return null;
	// eslint-disable-next-line no-param-reassign
	if (languages instanceof Language) languages = [ languages ];
	if (
		!Array.isArray(languages) ||
		languages.length === 0 ||
		languages.some(language => !(language instanceof Language))
	)
		throw Error('`languages` should be a Language or Language[] (with at least one Language instance)');

	const { value, matches_qty } = languages.map(lang => lang.parse(str))
		.reduce((acc, res) => {
			if (res.matches_qty > acc.matches_qty) return res;
			return acc;
		}, { value: 0, matches_qty: 0 });

	if (matches_qty === 0) {
		if (Number.isNaN(Number(str))) return null;

		// parse as ms
		return Number(str);
	}

	return NEGATIVE_REGEX.test(str) ? -value : value;
}
