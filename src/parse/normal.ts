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

	const { value, matches_qty } = languages.map(lang => langParse(str, lang))
		.reduce((acc, res) => res.matches_qty > acc.matches_qty ? res : acc);

	if (matches_qty === 0) {
		const n = Number(str);
		return Number.isNaN(n) ? null : n;
	}

	return str.trim().startsWith('-') ? -value : value;
}

function langParse(str: string, lang: Language): { value: number; matches_qty: number } {
	let final_value = 0;
	let matches_qty = 0;

	const matches = str.matchAll(lang.REGEX);

	for (const match of matches) {
		const { value, unit } = match.groups as { value: string; unit: string };

		final_value += parseFloat(value) * lang.dict[unit.toLowerCase()]!;
		matches_qty += 1;
	}

	return {
		matches_qty,
		value: final_value,
	};
}
