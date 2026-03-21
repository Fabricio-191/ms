import { strictEqual, ok } from 'node:assert';
import vercelMS from 'ms';
import { TIMES, LANGUAGES, UNITS, parse, format, buildFastParse, buildFastFormat, type Language } from '../lib/esm/index.js';
import type { ValidFormat } from '../src/format/normal.ts';

// #region helpers

export function check(value: unknown, expected: unknown): void {
	if (typeof expected === 'number' && typeof value === 'number')
		ok(Math.abs(expected - value) < 1);
	else
		strictEqual(value, expected);
}

export function randomFromArr<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function randomBool(): boolean {
	return Math.random() > 0.5;
}

export function randomNum(max: number, fixedDecimals = 0): number {
	if (fixedDecimals !== 0) return parseFloat((Math.random() * max).toFixed(fixedDecimals));
	return Math.floor(Math.random() * max);
}

// #endregion

// #region types

export interface FormatArgs {
	num: number;
	options: {
		language: Language;
		long: boolean;
		format: ValidFormat;
		length: number;
	};
}

export interface ClockArgs {
	args: [string, boolean];
	result: number;
}

// #endregion

// #region creators

const MAXS: Record<keyof typeof TIMES, number> = { Y: 100, Mo: 12, W: 4, D: 7, H: 24, M: 60, S: 60, Ms: 1000 };

export function createFormatArgs(opts: Partial<FormatArgs['options']> = {}): FormatArgs {
	const timeKeys: Array<keyof typeof TIMES> = [];
	while (timeKeys.length === 0) {
		for (const key in TIMES)
			if (randomNum(1, 1) < 0.3) timeKeys.push(key as keyof typeof TIMES);
	}

	const length = opts.length ?? (randomNum(8) + 1);
	let num = 0;
	for (let i = 0; i < length && i < timeKeys.length; i++) {
		const k = timeKeys[i];
		if (k === undefined) continue;
		num += randomNum(MAXS[k]) * TIMES[k];
	}

	return {
		num,
		options: {
			language: opts.language ?? randomFromArr(Object.values(LANGUAGES)),
			long: opts.long ?? randomBool(),
			format: timeKeys.join('') as ValidFormat,
			length,
		},
	};
}

export function createClockArgs(): ClockArgs {
	let result = 0;
	const sep = randomFromArr([ '-', ':' ]);
	let fmt = randomFromArr([
		'hhsepmmsepss.sss',
		'hhsepmmsepss',
		'hhsepmm.mmm',
		'hhsepmm',
		'mmsepss.sss',
		'mmsepss',
	] as const).replace(/sep/gu, sep);

	const n = (max: number, digits: number, key: string, val: number): void => {
		if (!fmt.includes(key)) return;
		const num = String(randomNum(max)).padStart(digits, '0');
		fmt = fmt.replace(key, num);
		result += parseFloat(num) * val;
	};

	const minutes = fmt.includes('ss') && !fmt.includes('hh');
	n(24, 2, 'hh', 3600000);
	n(1000, 3, 'mmm', 60);
	n(1000, 3, 'sss', 1);
	n(60, 2, 'mm', 60000);
	n(60, 2, 'ss', 1000);

	return { args: [ fmt, minutes ], result };
}

// #endregion

// #region bench datasets

function createBenchNotationSamples(unitAliases: readonly string[], count = 10_000, isValid: (input: string) => boolean = () => true): string[] {
	const samples: string[] = [];
	while (samples.length < count) {
		const input = `${randomNum(250) + 1}${randomFromArr(unitAliases)}`;
		if (isValid(input)) samples.push(input);
	}
	return samples;
}

// Valid parse samples - mix of units, numbers, and formats
export const BENCH_PARSE_SAMPLES: string[] = ((): string[] => {
	const fastParseEn = buildFastParse(LANGUAGES.en);
	const unitAliases = UNITS.flatMap(key => LANGUAGES.en.units[key].all);

	// Create varied samples: different units, numbers, spacing
	const samples = createBenchNotationSamples(unitAliases, 10_000, (input: string): boolean => (
		typeof vercelMS(input) === 'number' &&
		parse(input, LANGUAGES.en) !== null &&
		fastParseEn(input) !== null
	));

	// Add case variations (uppercase, mixed case)
	for (let i = 0; i < 1000; i++) {
		const baseSample = randomFromArr(samples);
		const upperSample = baseSample.toUpperCase();
		const mixedSample = baseSample.split('').map(c => randomBool() ? c.toUpperCase() : c.toLowerCase()).join('');
		// Only add if vercel/ms also accepts them
		if (vercelMS(upperSample) !== undefined && parse(upperSample, LANGUAGES.en) !== null)
			samples.push(upperSample);
		if (vercelMS(mixedSample) !== undefined && parse(mixedSample, LANGUAGES.en) !== null)
			samples.push(mixedSample);
	}

	// Add spacing variations
	for (let i = 0; i < 500; i++) {
		const baseSample = randomFromArr(samples);
		const variants = [` ${baseSample}`, `${baseSample} `, `  ${baseSample}  `];
		for (const variant of variants) {
			if (vercelMS(variant) !== undefined && parse(variant, LANGUAGES.en) !== null)
				samples.push(variant);
		}
	}

	// Validate all samples final time
	const validSamples: string[] = [];
	for (const sample of samples) {
		const vercelResult = vercelMS(sample);
		const parseResult = parse(sample, LANGUAGES.en);
		const fastParseResult = fastParseEn(sample);
		if (vercelResult === parseResult && parseResult === fastParseResult)
			validSamples.push(sample);
	}

	return validSamples;
})();

// Invalid parse samples - should return null
export const BENCH_PARSE_FAILURES: string[] = [
	// Completely invalid
	'',
	'   ',
	'invalid',
	'abc123',
	'123abc',
	'xyz',
	// Invalid numbers
	'--1ms',
	'1.2.3ms',
	'.ms',
	// Invalid units
	'1xyz',
	'1seconds',  // partial match
	'1s 2x',  // valid + invalid
	// Empty/whitespace
	'   ',
	'\t\n',
	// Edge cases
	'NaN',
	'Infinity',
	'null',
	'undefined',
	// Out of valid range
	'1' + '0'.repeat(20),  // huge number string
];

// Valid format samples - mix of positive, negative, small, large values
export const BENCH_FORMAT_SAMPLES: number[] = ((): number[] => {
	const fastFormatEn = buildFastFormat(LANGUAGES.en);
	const samples: number[] = [];

	// Range of values
	for (let i = 0; i < 2000; i++) {
		// Small values (ms range)
		samples.push(i);
		samples.push(-i);
		// Medium values (seconds to hours)
		samples.push(i * 1000);
		samples.push(i * 60000);
		samples.push(i * 3600000);
		// Large values (days to years)
		samples.push(i * 86400000);
		samples.push(i * 2592000000);
		samples.push(i * 31557600000);
	}

	// Decimal values
	for (let i = 0; i < 1000; i++) {
		samples.push(Math.random() * 1000000);
		samples.push(-Math.random() * 1000000);
	}

	// Edge cases
	samples.push(0, 1, -1, 0.001, -0.001, 999, -999, 1000, -1000);
	samples.push(Number.MAX_SAFE_INTEGER / 1000);  // large but valid
	samples.push(-Number.MAX_SAFE_INTEGER / 1000);

	// Validate all samples
	for (const value of samples) {
		ok(vercelMS(value));
		ok(format(value, { language: LANGUAGES.en, length: 1 }) !== null);
		ok(format(value, { language: LANGUAGES.en, length: 1, long: true }) !== null);
		ok(fastFormatEn(value) !== null);
		ok(fastFormatEn(value, true) !== null);
	}

	return samples;
})();

// Invalid format samples - should return null
export const BENCH_FORMAT_FAILURES: (number | string)[] = [
	// Invalid numbers
	NaN,
	Infinity,
	-Infinity,
	// Non-numbers (will be passed but should handle gracefully)
	'not a number' as unknown as number,
	null as unknown as number,
	undefined as unknown as number,
	// Arrays and objects (invalid)
	[] as unknown as number,
	{} as unknown as number,
];

// #endregion
