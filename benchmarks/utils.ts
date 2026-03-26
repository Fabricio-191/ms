import { strictEqual, ok } from 'node:assert';
import { TIMES, LANGUAGES, parse, type Language } from '../lib/esm/index.js';
import type { ValidFormat } from '../src/format/normal.ts';

// #region helpers

export function check(value: unknown, expected: unknown): void {
	if (typeof expected === 'number' && typeof value === 'number')
		ok(value === expected || Math.abs(expected - value) < 1);
	else
		strictEqual(value, expected);
}

function randomFrom<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function chance(p: number): boolean {
	return Math.random() < p;
}

// #endregion

// #region dataset generators

const ALL_LANGUAGES = Object.values(LANGUAGES);
const UNIT_KEYS = Object.keys(TIMES) as Array<keyof typeof TIMES>;
const MAXS: Record<keyof typeof TIMES, number> = { Y: 50, Mo: 11, W: 3, D: 6, H: 23, M: 59, S: 59, Ms: 999 } as const;

function randomNum(valid: boolean, max: number): { numStr: string; numVal: number } {
	if (!valid) {
		const numStr = randomFrom([
			String(randomInt(1, max)),
			`${randomInt(1, max)}.${randomInt(1, 99)}`,
			`.${randomInt(1, 99)}`,
			`${randomInt(1, max)}.${randomInt(1, 99)}.${randomInt(1, 99)}`,
			`--${randomInt(1, max)}`,
			'NaN',
			'',
		]);
		return { numStr, numVal: NaN };
	}
	const type = randomInt(0, 4);
	if (type === 1) { // with decimal
		const numStr = `${randomInt(1, max)}.${randomInt(1, 99)}`;
		return { numStr, numVal: parseFloat(numStr) };
	}
	if (type === 2) { // with leading dot
		const numStr = `.${randomInt(1, 99)}`;
		return { numStr, numVal: parseFloat(numStr) };
	}
	const numVal = randomInt(1, max);
	return { numStr: String(numVal), numVal };
}

const VERCEL_UNIT_KEYS = UNIT_KEYS.filter(k => k !== 'Mo');

export interface FormatArgs<Valid extends boolean = true> {
	expected: Valid extends true ? number : null;
	input: string;
	options: { language: Language; long: boolean; format: ValidFormat; length: number };
}

export function createArgs(valid: true, forVercel?: boolean, lang?: Language): FormatArgs;
export function createArgs(valid: false, forVercel?: boolean, lang?: Language): FormatArgs<false>;
export function createArgs(valid: boolean, forVercel = false, lang?: Language): FormatArgs<boolean> {
	const language = forVercel ? LANGUAGES.en : (lang ?? randomFrom(ALL_LANGUAGES));
	const keys = forVercel ? VERCEL_UNIT_KEYS : UNIT_KEYS;
	const length = forVercel ? 1 : randomInt(1, keys.length);
	const selectedUnits = [ ...keys ]
		.sort(() => Math.random() - 0.5)
		.slice(0, length)
		.sort((a, b) => TIMES[b] - TIMES[a]);

	let input = '';
	let expected = 0;
	for (const key of selectedUnits) {
		if (valid) {
			const { numStr, numVal } = randomNum(true, MAXS[key]);
			expected += numVal * TIMES[key];
			input += `${numStr}${randomFrom(language.units[key].all)} `;
		}
		else {
			const { numStr: badNum } = randomNum(false, MAXS[key]);
			const validNotation = randomFrom(language.units[key].all);
			const badUnit = randomFrom([ 'xyz', 'abc', 'foo', String(randomInt(1, 9)), '', validNotation ]);
			input += randomFrom([
				`${badNum} `,
				`${badNum}${badUnit} `,
				`${badUnit}${badNum} `,
				`${badUnit} `,
				`${badNum}${badNum}${badUnit} `,
			]);
		}
	}

	return {
		expected: valid ? expected : null,
		input: input.trimEnd(),
		options: {
			language,
			long: chance(0.5),
			format: selectedUnits.join('') as ValidFormat,
			length,
		},
	};
}

export const INVALID_INPUTS = [
	'',
	'   ',
	'invalid',
	'abc123',
	'123abc',
	'xyz',
	'--1ms',
	'1.2.3ms',
	'.ms',
	'1xyz',
	'1seconds',
	'1s 2x',
	'\t\n',
	'NaN',
	'null',
	'undefined',
	`1${'0'.repeat(20)}`,
].map(input => ({ input, expected: parse(input, LANGUAGES.en), options: { language: LANGUAGES.en, long: false, format: 'S' as const, length: 1 } }));

// #endregion

/*

export function generateParseSample(multi = false, language?: Language): ParseSample {
	if (!multi) {
		// Single-unit: random language, random unit, varied number formats
		const lang = language ?? randomFrom(Object.values(LANGUAGES));
		const unit = randomFrom(UNIT_KEYS);
		const notation = randomFrom(lang.units[unit].all);

		// Build number string: integer, decimal, or leading-dot
		const { numStr, numVal } = randomNumPart();

		// 0–3 spaces between number and unit
		const spaces = ' '.repeat(randomInt(0, 3));

		// occasionally negative
		const negative = chance(0.15);
		const negPrefix = chance(0.5) ? '- ' : '-';
		const prefix = negative ? negPrefix : '';
		const input = `${prefix}${numStr}${spaces}${notation}`;
		const expected = TIMES[unit] * numVal * (negative ? -1 : 1);

		return { input, expected, language: lang };
	}

	// Multi-unit: integers only, 2–8 units sorted largest to smallest
	const lang = language ?? LANGUAGES.en;
	const count = randomInt(2, 8);
	const selectedUnits = [ ...UNIT_KEYS ]
		.sort(() => Math.random() - 0.5)
		.slice(0, count)
		.sort((a, b) => TIMES[b] - TIMES[a]);

	let expected = 0;
	const parts: string[] = [];

	for (const unit of selectedUnits) {
		const notation = randomFrom(lang.units[unit].all);
		const num = randomInt(1, 59);
		const spaces = ' '.repeat(randomInt(0, 1));
		parts.push(`${num}${spaces}${notation}`);
		expected += TIMES[unit] * num;
	}

	const negative = chance(0.2);
	const negPrefix = chance(0.5) ? '- ' : '-';
	const prefix = negative ? negPrefix : '';

	return {
		input: `${prefix}${parts.join(' ')}`,
		expected: negative ? -expected : expected,
		language: lang,
	};
}

export function generateParseSampleForVercel(): ParseSample {
	const { num, options } = createArgs(true, true);
	const input = format(num, options) ?? '';
	return { input, expected: num, language: LANGUAGES.en };
}

export function generateFormatSample(): FormatSample {
	const formatStr = randomFrom(VALID_FORMATS);
	const formatUnits = (formatStr.match(FORMATS_REGEX) ?? []) as Unit[];

	const language = randomFrom(Object.values(LANGUAGES));
	const long = chance(0.5);
	// length cannot exceed number of units available in the format
	const maxLen = Math.min(formatUnits.length, 8);
	const length = randomInt(1, maxLen);

	// Build ms from exactly `length` units so parse(format(ms)) === ms
	let ms = 0;
	for (let i = 0; i < length; i++) {
		const unit = formatUnits[i]!;
		ms += randomInt(1, MAXS[unit]) * TIMES[unit];
	}

	const string = format(ms, { language, long, format: formatStr, length }) ?? '';

	return { ms, string, language, long, length, format: formatStr };
}
*/
