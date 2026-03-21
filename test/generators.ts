import { strictEqual, ok } from 'node:assert';
import vercelMS from 'ms';
import { TIMES, LANGUAGES, UNITS, parse, format, buildFastParse, buildFastFormat, type Language } from '../lib/cjs/index.cjs';

// #region helpers (exported for inline test logic)

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
		format: string;
		length: number;
	};
}

export interface ClockArgs {
	args: [string, boolean];
	result: number;
}

export interface ParseNumSample {
	input: string;
	language: Language;
	expected: number;
}

export interface ParseNotationSample {
	str: string;
	language: Language;
	result: number;
}

export interface TestFixtures {
	FORMAT_ARGS: FormatArgs[];
	FORMAT_ARGS_VERCEL: FormatArgs[];
	CLOCK_ARGS: ClockArgs[];
	PARSE_NOTATION_SAMPLES: ParseNotationSample[];
}

// #endregion

// #region exported generators

export function generateParseNumSamples(nums: string[]): ParseNumSample[] {
	const samples: ParseNumSample[] = [];
	for (const language of Object.values(LANGUAGES)) {
		for (const unit of Object.keys(TIMES) as Array<keyof typeof TIMES>) {
			for (const notation of language.units[unit].all) {
				for (const num of nums)
					samples.push({ input: num + randomFromArr([ '', ' ' ]) + notation, language, expected: TIMES[unit] * Number(num) });
			}
		}
	}
	return samples;
}

// #endregion

// #region internal creators

const MAXS: Record<keyof typeof TIMES, number> = { Y: 100, Mo: 12, W: 4, D: 7, H: 24, M: 60, S: 60, Ms: 1000 };

function createFormatArgs(opts: Partial<FormatArgs['options']> = {}): FormatArgs {
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
			format: timeKeys.join(''),
			length,
		},
	};
}

function createClockArgs(): ClockArgs {
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

function createBenchFormatSamples(count = 10_000): number[] {
	const maxValue = TIMES.Y * 10;
	return Array.from({ length: count }, () => {
		const isNegative = randomNum(2) === 1;
		const integerPart = randomNum(maxValue);
		const decimalPart = Math.random();
		return (integerPart + decimalPart) * (isNegative ? -1 : 1);
	});
}

function createBenchNotationSamples(unitAliases: readonly string[], count = 10_000, isValid: (input: string) => boolean = () => true): string[] {
	const samples: string[] = [];
	while (samples.length < count) {
		const input = `${randomNum(250) + 1}${randomFromArr(unitAliases)}`;
		if (isValid(input)) samples.push(input);
	}
	return samples;
}

// #endregion

// #region pre-baked datasets

export const TEST_FIXTURES: TestFixtures = {
	FORMAT_ARGS: Array.from({ length: 1000 }, () => createFormatArgs()),
	FORMAT_ARGS_VERCEL: Array.from({ length: 1000 }, () => createFormatArgs({ language: LANGUAGES.en, length: 1 })),
	CLOCK_ARGS: Array.from({ length: 1000 }, () => createClockArgs()),
	PARSE_NOTATION_SAMPLES: (() => {
		const samples: ParseNotationSample[] = [];
		for (const language of Object.values(LANGUAGES)) {
			for (let i = 0; i < 1000; i++) {
				let result = 0, str = '';
				while (str.length === 0) {
					const selectedUnits = (Object.keys(TIMES) as Array<keyof typeof TIMES>)
						.filter(() => randomNum(1, 1) < 0.3);
					for (const unit of selectedUnits) {
						const num = randomBool() ? randomNum(1000) : randomNum(1000, 1);
						result += num * TIMES[unit];
						str += `${num}${randomBool() ? ' ' : ''}${
							randomFromArr(language.units[unit].all)
						}${randomBool() ? ' ' : ''}`;
					}
				}
				samples.push({ str, language, result });
			}
		}
		return samples;
	})(),
};

export const BENCH_PARSE_SAMPLES: string[] = ((): string[] => {
	const fastParseEn = buildFastParse(LANGUAGES.en);
	const unitAliases = UNITS.flatMap(key => LANGUAGES.en.units[key].all);

	const samples = createBenchNotationSamples(unitAliases, 10_000, (input: string): boolean => (
		typeof vercelMS(input) === 'number' &&
		parse(input, LANGUAGES.en) !== null &&
		fastParseEn(input) !== null
	));

	for (const sample of samples) {
		strictEqual(parse(sample, LANGUAGES.en), vercelMS(sample));
		strictEqual(fastParseEn(sample), vercelMS(sample));
	}

	return samples;
})();

export const BENCH_FORMAT_SAMPLES: number[] = ((): number[] => {
	const fastFormatEn = buildFastFormat(LANGUAGES.en);
	const samples = createBenchFormatSamples(10_000);

	for (const value of samples) {
		ok(vercelMS(value));
		ok(format(value, { language: LANGUAGES.en, length: 1 }) !== null);
		ok(format(value, { language: LANGUAGES.en, length: 1, long: true }) !== null);
		ok(fastFormatEn(value) !== null);
		ok(fastFormatEn(value, true) !== null);
	}

	return samples;
})();

export type { Language };

// #endregion
