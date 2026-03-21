import { describe, it } from '@jest/globals';
import * as lib from '../lib/esm/index.js';
import { createFormatArgs, check } from './generators.ts';

const FORMAT_ARGS = Array.from({ length: 1000 }, () => createFormatArgs());

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
			const formatted = lib.format(num, options);
			if (formatted === null) continue;
			check(lib.parse(formatted, options.language), num);
		}
	});
});

describe('buildFastFormat', () => {
	const formatEn = lib.buildFastFormat(lib.LANGUAGES.en);
	const formatEs = lib.buildFastFormat(lib.LANGUAGES.es);
	const formatJa = lib.buildFastFormat(lib.LANGUAGES.ja);

	it('should return only the first unit', () => {
		check(formatEn(7200000), '2h');
		check(formatEn(7200000, true), '2 hours');
		check(formatEn(1000, true), '1 second');
		check(formatEn(999), '999ms');
		// @ts-expect-error -- testing invalid input
		check(formatEn('invalid'), null);
	});

	it('should handle negative values', () => {
		check(formatEn(-7200000), '- 2h');
		check(formatEn(-7200000, true), '- 2 hours');
		check(formatEn(-1000), '- 1s');
		check(formatEn(-1000, true), '- 1 second');
		check(formatEn(-999), '- 999ms');
	});

	it('should handle zero and small values', () => {
		check(formatEn(0), '0ms');
		check(formatEn(0, true), '0 milliseconds');
		check(formatEn(1), '1ms');
		check(formatEn(1, true), '1 millisecond');
		check(formatEn(-1), '- 1ms');
		check(formatEn(-1, true), '- 1 millisecond');
	});

	it('should use Math.floor (truncation)', () => {
		// 1.5 hours = 5400000ms -> floors to 1h
		check(formatEn(5400000), '1h');
		// 59999ms floors to 59 seconds
		check(formatEn(59999), '59s');
		// 599ms floors to 599ms (less than 1 second)
		check(formatEn(599), '599ms');
	});

	it('should work with different languages', () => {
		check(formatEs(7200000), '2h');
		check(formatEs(7200000, true), '2 horas');
		check(formatEs(1000, true), '1 segundo');
		// Japanese: short form has no space, long form has space before notation
		check(formatJa(7200000), '2時間');
		check(formatJa(7200000, true), '2 時間');
	});
});
