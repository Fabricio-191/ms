import { describe, it } from '@jest/globals';
import { LANGUAGES, parse, format } from '@lib';
import { check } from '../utils.ts';

// ─── Parse ──────────────────────────────────────────────────────────────────

describe('parse (english)', () => {
	it('single unit — short notations', () => {
		check(parse('1h'), 3600000);
		check(parse('1hr'), 3600000);
		check(parse('1hrs'), 3600000);
		check(parse('1m'), 60000);
		check(parse('1min'), 60000);
		check(parse('1mins'), 60000);
		check(parse('1s'), 1000);
		check(parse('1sec'), 1000);
		check(parse('1secs'), 1000);
		check(parse('1ms'), 1);
		check(parse('1d'), 86400000);
		check(parse('1w'), 604800000);
		check(parse('1y'), 31557600000);
	});

	it('single unit — long notations', () => {
		check(parse('1 hour'), 3600000);
		check(parse('1 hours'), 3600000);
		check(parse('1 minute'), 60000);
		check(parse('1 minutes'), 60000);
		check(parse('1 second'), 1000);
		check(parse('1 millisecond'), 1);
		check(parse('1 milliseconds'), 1);
		check(parse('1 day'), 86400000);
		check(parse('1 days'), 86400000);
		check(parse('1 week'), 604800000);
		check(parse('1 weeks'), 604800000);
		check(parse('1 year'), 31557600000);
	});

	it('multi-unit', () => {
		check(parse('1m10s'), 70000);
		check(parse('1m10secs'), 70000);
		check(parse('5s50ms'), 5050);
		check(parse('1h 30m'), 5400000);
		check(parse('2h30m'), 7200000 + 1800000);
		check(parse('1 week 2 days'), 777600000);
		check(parse('2 days 1 hours'), 176400000);
		check(parse('2 hours, 5.5 minutes and .3s'), 7530300);
		check(parse('1h 30m 45s'), 5445000);
		check(parse('1seconds'), 1000); // 0 spaces valid, 'seconds' in dict
	});

	it('decimal and leading-dot numbers', () => {
		check(parse('2.5h'), 9000000);
		check(parse('2.5 hrs'), 9000000);
		check(parse('.5m'), 30000);
		check(parse('1.5 hours'), 5400000);
		check(parse('.25s'), 250);
	});

	it('negative values', () => {
		check(parse('-3 days'), -259200000);
		check(parse('-1h'), -3600000);
		check(parse('-.5m'), -30000);
		check(parse('-.5 mins'), -30000);
		check(parse('-100'), -100);
		check(parse('- 2m 30s'), -150000);
	});

	it('0–3 spaces between number and unit', () => {
		check(parse('1s'), 1000);
		check(parse('1 s'), 1000);
		check(parse('1  s'), 1000);
		check(parse('1   s'), 1000);
		check(parse('1    s'), null);
		check(parse('1\ts'), null);
		check(parse('1\ns'), null);
	});

	it('case insensitive', () => {
		check(parse('1.5H'), 5400000);
		check(parse('1D'), 86400000);
		check(parse('5M'), 300000);
		check(parse('20 mIlLiSeCoNdS'), 20);
		check(parse('1 SECOND'), 1000);
	});

	it('plain numbers (no unit)', () => {
		check(parse('100'), 100);
		check(parse('-100'), -100);
		check(parse('0'), 0);
		check(parse('3.14'), 3.14);
	});

	it('invalid inputs → null', () => {
		check(parse(''), null);
		check(parse('invalid'), null);
		check(parse('abc'), null);
		check(parse('abc123'), null);
		check(parse('1xyz'), null);
		check(parse('1.2.3ms'), null);
		check(parse('.ms'), null);
		check(parse('NaN'), null);
		// @ts-expect-error -- testing invalid input
		check(parse(null), null);
		// @ts-expect-error -- testing invalid input
		check(parse(undefined), null);
	});

	it('edge cases — not null', () => {
		// '--1ms': two minus signs — first consumed as sign, second skipped; matches 1ms → -1
		check(parse('--1ms'), -1);
		// whitespace-only: no unit match → Number fallback → 0
		check(parse('   '), 0);
		check(parse('\t\n'), 0);
		// Infinity: no unit match → Number('Infinity') = Infinity (not NaN)
		check(parse('Infinity'), Infinity);
		// large number string: no unit → Number fallback
		check(parse('100000000000000000000'), 1e20);
	});

	it('language array — picks best match', () => {
		check(parse('1 day', LANGUAGES.en), 86400000);
		check(parse('1 day', LANGUAGES.es), null);
		check(parse('12 seconds', [ LANGUAGES.en, LANGUAGES.es ]), 12000);
		check(parse('-3 minutos', [ LANGUAGES.en, LANGUAGES.es ]), -180000);
		check(parse('2 minutes 15 seconds', Object.values(LANGUAGES)), 135000);
	});
});

// ─── Format ─────────────────────────────────────────────────────────────────

describe('format (english)', () => {
	it('short form', () => {
		check(format(3600000), '1h');
		check(format(7200000), '2h');
		check(format(86400000), '1d');
		check(format(60000), '1m');
		check(format(1000), '1s');
		check(format(1), '1ms');
		check(format(0), '0ms');
	});

	it('long form — singular and plural', () => {
		check(format(3600000, { long: true }), '1 hour');
		check(format(7200000, { long: true }), '2 hours');
		check(format(60000, { long: true }), '1 minute');
		check(format(120000, { long: true }), '2 minutes');
		check(format(1000, { long: true }), '1 second');
		check(format(2000, { long: true }), '2 seconds');
		check(format(1, { long: true }), '1 millisecond');
		check(format(2, { long: true }), '2 milliseconds');
	});

	it('length option', () => {
		const ms = 5445000; // 1h 30m 45s
		check(format(ms, { length: 1 }), '1h');
		check(format(ms, { length: 2 }), '1h 30m');
		check(format(ms, { length: 3 }), '1h 30m 45s');
		check(format(ms), '1h 30m 45s'); // default length is 3
	});

	it('format option (custom unit selection)', () => {
		check(format(5445000, { format: 'MS' }), '90m 45s');
		check(format(5445000, { format: 'HM' }), '1h 30m');
		check(format(86400000 + 3600000, { format: 'DH' }), '1d 1h');
		check(format(4100940000, { format: 'WDHM', length: 2 }), '6w 5d');
		check(format(4100940000, { format: 'WDHM', length: 8 }), '6w 5d 11h 9m');
		check(format(10, { format: 'HS' }), '0s');
	});

	it('negative values', () => {
		check(format(-3600000), '- 1h');
		check(format(-7200000), '- 2h');
		check(format(-3600000, { long: true }), '- 1 hour');
		check(format(-5445000, { length: 3 }), '- 1h 30m 45s');
		check(format(-1, { long: true }), '- 1 millisecond');
	});

	it('zero and sub-unit values', () => {
		check(format(0), '0ms');
		check(format(0, { long: true }), '0 milliseconds');
		check(format(500, { format: 'HMS' }), '0s');
		check(format(0, { format: 'DH' }), '0h');
	});

	it('parse(format(ms)) === ms', () => {
		for (const ms of [ 3600000, 5445000, 777600000, 31557600000 ]) {
			const str = format(ms)!;
			check(parse(str), ms);
		}
	});
});
