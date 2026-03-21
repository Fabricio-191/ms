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

describe('fast format', () => {
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
