import { describe, it, expect } from '@jest/globals';
import { createRequire } from 'module';
import * as esmLib from '../lib/esm/index.js';
import vercelMS from 'ms';
import { TEST_FIXTURES, generateParseNumSamples } from './generators.ts';

const require = createRequire(import.meta.url);
const cjsLib = require('../lib/cjs/index.cjs') as typeof esmLib;

describe('ESM build (lib/esm)', () => {
	runSuite(esmLib);
});

describe('CJS build (lib/cjs)', () => {
	runSuite(cjsLib);
});

function runSuite(lib: typeof esmLib): void {
	const { FORMAT_ARGS, FORMAT_ARGS_VERCEL, CLOCK_ARGS, PARSE_NOTATION_SAMPLES } = TEST_FIXTURES;

	function check(value: unknown, expected: unknown): void {
		if (typeof expected === 'number' && typeof value === 'number') {
			expect(Math.abs(expected - value)).toBeLessThan(1);
			return;
		}
		expect(value).toBe(expected);
	}

	describe('languages', () => {
		it('can add languages directly with Language', () => {
			const hindi = new lib.Language('hindi', {
				Y: { all: [ 'साल', 'वर्ष' ], singular: 'साल', shortSingular: 'साल', plural: 'वर्ष', shortPlural: 'वर्ष' },
				Mo: { all: [ 'महीना', 'महीने' ], singular: 'महीना', shortSingular: 'महीना', plural: 'महीने', shortPlural: 'महीने' },
				W: { all: [ 'हफ्ता', 'सप्ताह' ], singular: 'हफ्ता', shortSingular: 'हफ्ता', plural: 'सप्ताह', shortPlural: 'सप्ताह' },
				D: { all: [ 'दिन', 'दिनों' ], singular: 'दिन', shortSingular: 'दिन' },
				H: { all: [ 'घंटा' ], singular: 'घंटा', shortSingular: 'घंटा' },
				M: { all: [ 'मिनट', 'मिनटों' ], singular: 'मिनट', shortSingular: 'मिनट', plural: 'मिनटों', shortPlural: 'मिनटों' },
				S: { all: [ 'सेकंड', 'सेकंड्स' ], singular: 'सेकंड', shortSingular: 'सेकंड' },
				Ms: { all: [ 'मिलिसेकंड', 'मिलिसेकंड्स' ], singular: 'मिलिसेकंड', shortSingular: 'मिलिसेकंड' },
			});

			check(lib.parse('1 दिन', hindi), 86400000);
			check(lib.parse('1 दिन 3 घंटा 20 मिनटों', hindi), 98400000);
		});
	});

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
			for (const { input, language, expected } of generateParseNumSamples([ '0', '1', '30', '45' ]))
				check(lib.parse(input, language), expected);
		});
		it('should work with decimal numbers', () => {
			for (const { input, language, expected } of generateParseNumSamples([ '30.3', '2.1' ]))
				check(lib.parse(input, language), expected);
		});
		it('should work with negative numbers', () => {
			for (const { input, language, expected } of generateParseNumSamples([ '-100', '-1', '-1.5' ]))
				check(lib.parse(input, language), expected);
		});
		it('should work with leading-dot decimals', () => {
			for (const { input, language, expected } of generateParseNumSamples([ '.5', '-.5' ]))
				check(lib.parse(input, language), expected);
		});

		it('should parse all language notations', () => {
			for (const { str, language, result } of PARSE_NOTATION_SAMPLES)
				check(lib.parse(str, language), result);
		});

		it('should give the same result as vercel/ms', () => {
			for (const { num, options } of FORMAT_ARGS_VERCEL) {
				const formatted = lib.format(num, {
					language: options.language,
					long: options.long,
					format: options.format,
					length: options.length,
				});
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

	describe('format', () => {
		it('README.md examples should work', () => {
			const num = lib.parse('16 days 8 hours 20 mins 40 secs');
			if (num === null) throw new Error('parse returned null');

			check(lib.format(num), '16d 8h 20m');
			check(lib.format(num, { length: 2 }), '16d 8h');
			check(lib.format(num, { length: 8 }), '16d 8h 20m 40s');
			check(lib.format(num, { long: true }), '16 days 8 hours 20 minutes');
			check(lib.format(num, { long: true, language: lib.LANGUAGES.es }), '16 dias 8 horas 20 minutos');
			check(lib.format(num, { language: lib.LANGUAGES.ja }), '16日 8時間 20分');

			check(lib.format(num, { format: 'HS' }), '392h 1240s');
			check(lib.format(4100940000, { format: 'WDHM', length: 2 }), '6w 5d');
			check(lib.format(4100940000, { format: 'WDHM', length: 8 }), '6w 5d 11h 9m');
			check(lib.format(10, { format: 'HS' }), '0s');
		});

		it('parse(format(n)) should equal n', () => {
			for (const { num, options } of FORMAT_ARGS) {
				const formatted = lib.format(num, { language: options.language, long: options.long, format: options.format, length: options.length });
				if (formatted === null) continue;
				check(lib.parse(formatted, options.language), num);
			}
		});
	});

	describe('fast', () => {
		it('buildFastParse should work with a single language', () => {
			const parseEn = lib.buildFastParse(lib.LANGUAGES.en);
			const parseEs = lib.buildFastParse(lib.LANGUAGES.es);

			check(parseEn('2h'), 7200000);
			check(parseEn('2.5 hrs'), 9000000);
			check(parseEn('2 horas'), null);
			check(parseEs('2 horas'), 7200000);
			check(parseEn('-.5m'), -30000);
		});

		it('buildFastFormat should return only the first unit', () => {
			const formatEn = lib.buildFastFormat(lib.LANGUAGES.en);

			check(formatEn(7200000), '2h');
			check(formatEn(7200000, true), '2 hours');
			check(formatEn(1000, true), '1 second');
			check(formatEn(999), '999ms');
			// @ts-expect-error -- testing invalid input
			check(formatEn('invalid'), null);
		});
	});

	describe('others', () => {
		it('should return null for invalid inputs', () => {
			for (const value of [ '', undefined, null, [], {}, NaN, Infinity, -Infinity, 'absda', '☃', '10-.5', '123nothing', '12 minutesabc' ] as const) {
				check(lib.parse(value as string), null);
				check(lib.format(value as number), null);
			}
		});
	});
}
