import { describe, it } from '@jest/globals';
import * as lib from '../lib/esm/index.js';
import vercelMS from 'ms';
import { createFormatArgs, createClockArgs, randomFromArr, randomBool, randomNum, check } from './generators.ts';

const FORMAT_ARGS_VERCEL = Array.from({ length: 1000 }, () => createFormatArgs({ language: lib.LANGUAGES.en, length: 1 }));

const CLOCK_ARGS = Array.from({ length: 1000 }, () => createClockArgs());

function generateParseNumSamples(nums: string[]): Array<{ input: string; language: lib.Language; expected: number }> {
	const samples = [];
	for (const language of Object.values(lib.LANGUAGES)) {
		for (const unit of Object.keys(lib.TIMES) as Array<keyof typeof lib.TIMES>) {
			for (const notation of language.units[unit].all) {
				for (const num of nums) {
					samples.push({
						input: num + randomFromArr([ '', ' ' ]) + notation,
						language,
						expected: lib.TIMES[unit] * Number(num),
					});
				}
			}
		}
	}
	return samples;
}

const PARSE_NUM_INTEGERS = generateParseNumSamples([ '0', '1', '30', '45' ]);
const PARSE_NUM_DECIMALS = generateParseNumSamples([ '30.3', '2.1' ]);
const PARSE_NUM_NEGATIVES = generateParseNumSamples([ '-100', '-1', '-1.5' ]);
const PARSE_NUM_LEADING_DOT = generateParseNumSamples([ '.5', '-.5' ]);

const PARSE_NOTATION_SAMPLES = ((): Array<{ str: string; language: lib.Language; result: number }> => {
	const samples = [];
	for (const language of Object.values(lib.LANGUAGES)) {
		for (let i = 0; i < 1000; i++) {
			let result = 0, str = '';
			while (str.length === 0) {
				const selectedUnits = (Object.keys(lib.TIMES) as Array<keyof typeof lib.TIMES>)
					.filter(() => randomNum(1, 1) < 0.3);
				for (const unit of selectedUnits) {
					const num = randomBool() ? randomNum(1000) : randomNum(1000, 1);
					result += num * lib.TIMES[unit];
					str += `${num}${randomBool() ? ' ' : ''}${
						randomFromArr(language.units[unit].all)
					}${randomBool() ? ' ' : ''}`;
				}
			}
			samples.push({ str, language, result });
		}
	}
	return samples;
})();

describe('parse', () => {
	it('README.md examples should work', () => {
		check(lib.parse('2 hours, 5.5 minutes and .3s'), 7530300);
		check(lib.parse('1 week 2 days'), 777600000);
		check(lib.parse('2 days 1 hours'), 176400000);
		check(lib.parse('1d'), 86400000);
		check(lib.parse('10h'), 36000000);
		check(lib.parse('2.5 hrs'), 9000000);
		check(lib.parse('2h'), 7200000);
		check(lib.parse('1y'), 31557600000);
		check(lib.parse('100'), 100);
		check(lib.parse('.5m'), 30000);
		check(lib.parse('-3 days'), -259200000);
		check(lib.parse('-.5 mins'), -30000);
		check(lib.parse('- 2m 30s'), -150000);
		check(lib.parse('0 seconds'), 0);
		check(lib.parse('1m10secs'), 70000);
		check(lib.parse('5s50ms'), 5050);

		check(lib.parse('1 day', lib.LANGUAGES.es), null);
		check(lib.parse('1 dia', lib.LANGUAGES.es), 86400000);

		check(lib.parse('12 seconds', [ lib.LANGUAGES.en, lib.LANGUAGES.es ]), 12000);
		check(lib.parse('-3 minutos', [ lib.LANGUAGES.en, lib.LANGUAGES.es ]), -180000);
		check(lib.parse('2 minutes 15 seconds', Object.values(lib.LANGUAGES)), 135000);
		check(lib.parse('2 minutos 15 segundos', Object.values(lib.LANGUAGES)), 135000);
	});

	it('should be case-insensitive', () => {
		check(lib.parse('1.5H'), 5400000);
		check(lib.parse('20 mIlLiSeCoNdS'), 20);
	});

	it('should preserve plain ms values', () => {
		check(lib.parse('100'), 100);
		check(lib.parse('-100'), -100);
	});

	it('should accept 0–3 spaces between number and unit', () => {
		check(lib.parse('1s'), 1000);
		check(lib.parse('1 s'), 1000);
		check(lib.parse('1  s'), 1000);
		check(lib.parse('1   s'), 1000);
		check(lib.parse('1    s'), null);
		check(lib.parse('1\ts'), null);
		check(lib.parse('1\ns'), null);
	});

	it('should work with integers', () => {
		for (const { input, language, expected } of PARSE_NUM_INTEGERS)
			check(lib.parse(input, language), expected);
	});
	it('should work with decimal numbers', () => {
		for (const { input, language, expected } of PARSE_NUM_DECIMALS)
			check(lib.parse(input, language), expected);
	});
	it('should work with negative numbers', () => {
		for (const { input, language, expected } of PARSE_NUM_NEGATIVES)
			check(lib.parse(input, language), expected);
	});
	it('should work with leading-dot decimals', () => {
		for (const { input, language, expected } of PARSE_NUM_LEADING_DOT)
			check(lib.parse(input, language), expected);
	});

	it('should parse all language notations', () => {
		for (const { str, language, result } of PARSE_NOTATION_SAMPLES)
			check(lib.parse(str, language), result);
	});

	it('should give the same result as vercel/ms', () => {
		for (const { num, options } of FORMAT_ARGS_VERCEL) {
			const formatted = lib.format(num, options);
			if (formatted === null) continue;

			const vercelResult = vercelMS(formatted);
			if (typeof vercelResult !== 'number') continue;

			check(vercelResult, num);
			check(lib.parse(formatted), num);
		}
	});

	it('24-hour clock notation', () => {
		for (const { args, result } of CLOCK_ARGS)
			check(lib.clock(...args), result);
	});
});

function testFastParse(name: string, builder: (lang: lib.Language) => (str: string) => number | null): void {
	describe(name, () => {
		const parseEn = builder(lib.LANGUAGES.en);
		const parseEs = builder(lib.LANGUAGES.es);
		const parseJa = builder(lib.LANGUAGES.ja);

		it('basic cases', () => {
			check(parseEn('2h'), 7200000);
			check(parseEn('2.5 hrs'), 9000000);
			check(parseEn('2 horas'), null);
			check(parseEs('2 horas'), 7200000);
			check(parseEn('-.5m'), -30000);
			check(parseEn('100'), 100);
			check(parseEn('-100'), -100);
			check(parseEn(''), null);
			// Japanese
			check(parseJa('2時間'), 7200000);
			check(parseJa('30分'), 1800000);
		});

		it('should work with integers', () => {
			for (const { input, language, expected } of PARSE_NUM_INTEGERS)
				check(builder(language)(input), expected);
		});

		it('should work with decimal numbers', () => {
			for (const { input, language, expected } of PARSE_NUM_DECIMALS)
				check(builder(language)(input), expected);
		});

		it('should work with negative numbers', () => {
			for (const { input, language, expected } of PARSE_NUM_NEGATIVES)
				check(builder(language)(input), expected);
		});

		it('should work with leading-dot decimals', () => {
			for (const { input, language, expected } of PARSE_NUM_LEADING_DOT)
				check(builder(language)(input), expected);
		});

		it('should give the same result as parse()', () => {
			for (const { str, language, result } of PARSE_NOTATION_SAMPLES)
				check(builder(language)(str), result);
		});

		it('should accept 0–3 spaces between number and unit', () => {
			check(parseEn('1s'), 1000);
			check(parseEn('1 s'), 1000);
			check(parseEn('1  s'), 1000);
			check(parseEn('1   s'), 1000);
			check(parseEn('1    s'), null);
		});

		it('should be case-insensitive', () => {
			check(parseEn('1.5H'), 5400000);
			check(parseEn('20 mIlLiSeCoNdS'), 20);
		});
	});
}

testFastParse('buildFastParse current (v9 combined)', lib.buildFastParse);
testFastParse('buildFastParse v0 (trie toLowerCase)', lib.buildFastParseV0);
testFastParse('buildFastParse v1 (regex)', lib.buildFastParseV1);
testFastParse('buildFastParse v2 (isLetter)', lib.buildFastParseV2);
testFastParse('buildFastParse v3 (charCode)', lib.buildFastParseV3);
testFastParse('buildFastParse v4 (length)', lib.buildFastParseV4);
testFastParse('buildFastParse v5 (string switch)', lib.buildFastParseV5);
testFastParse('buildFastParse v6 (inline check)', lib.buildFastParseV6);
testFastParse('buildFastParse v7 (bitwise)', lib.buildFastParseV7);
testFastParse('buildFastParse v8 (case-insensitive)', lib.buildFastParseV8);
