import { TIMES, type Unit, type Language } from '../languages/core.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

const UNIT_KEYS = Object.keys(TIMES) as Unit[];

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function createBranches(language: Language): string {
	let branches = '';

	for (const unit of UNIT_KEYS) {
		const unitValue = TIMES[unit];
		const longSingular = escapeString(language.getNotation(unit, true, true));
		const longPlural = escapeString(language.getNotation(unit, true, false));
		const shortSingular = escapeString(language.getNotation(unit, false, true));
		const shortPlural = escapeString(language.getNotation(unit, false, false));

		// Skip ternary when singular === plural (e.g. English short 'y'/'y' → just 'y')
		const longResult = longSingular === longPlural ?
			`'${longSingular}'` :
			`(value === 1 ? '${longSingular}' : '${longPlural}')`;

		const shortResult = shortSingular === shortPlural ?
			`'${shortSingular}'` :
			`(value === 1 ? '${shortSingular}' : '${shortPlural}')`;

		branches += `
			if (remaining >= ${unitValue} && (value = Math.floor(remaining / ${unitValue})) !== 0) {
				if (long)
					return negativePrefix + value + ${longResult};

				return negativePrefix + value + ${shortResult};
			}
		`;
	}

	const smallestUnit = UNIT_KEYS.at(-1)!;
	const zeroLong = escapeString(language.getNotation(smallestUnit, true, false));
	const zeroShort = escapeString(language.getNotation(smallestUnit, false, false));

	branches += `
			if (long) return '0${zeroLong}';
			return '0${zeroShort}';
		`;

	return branches;
}

/**
 * Builds a hardcoded format function for the given language.
 * All notation strings are inlined as literals — no runtime lookups.
 *
 * The caller is responsible for storing the returned function.
 * @example
 * const formatMs = buildFastFormat(LANGUAGES.en);
 * formatMs(7200000);        // '2h'
 * formatMs(7200000, true);  // '2 hours'
 */
export function buildFastFormat(language: Language): FastFormatFunction {
	const branches = createBranches(language);

	const source = `
		if (typeof miliseconds !== 'number' || !Number.isFinite(miliseconds)) return null;

		const negativePrefix = miliseconds < 0 ? '- ' : '';
		const remaining = Math.abs(miliseconds);
		let value = 0;
		${branches}
	`;

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return Function('miliseconds', 'long = false', source) as FastFormatFunction;
}
