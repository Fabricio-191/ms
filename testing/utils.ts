import { strictEqual, ok } from 'node:assert';
import { TIMES, LANGUAGES, buildParse, type Language } from '@src/index.ts';
import type { ValidFormat } from '@src/format/v16.ts';

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

const parseEn = buildParse(LANGUAGES.en);

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
].map(input => ({ input, expected: parseEn(input), options: { language: LANGUAGES.en, long: false, format: 'S' as const, length: 1 } }));

// #endregion
