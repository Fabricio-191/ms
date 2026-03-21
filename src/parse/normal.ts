import { Language } from '../core/index.ts';
import { LANGUAGES } from '../core/languages.ts';

export function parse(str: string, languages: Language | Language[] = LANGUAGES.en): number | null {
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
		.reduce((acc, res) => res.matches_qty > acc.matches_qty ? res : acc);

	if (matches_qty === 0) {
		if (Number.isNaN(Number(str))) return null;

		// parse as ms
		return Number(str);
	}

	return str.trim().startsWith('-') ? -value : value;
}
