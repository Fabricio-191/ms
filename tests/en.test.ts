import { describe, it } from '@jest/globals';
import {
	LANGUAGES, parse, format, buildFastParse, buildFastFormat,
	type Language,
} from '../lib/esm/index.js';
import { buildFastParse as buildFastParseV0 } from '../src/parse/variants/single/v0.ts';
import { buildFastParse as buildFastParseV1 } from '../src/parse/variants/single/v1.ts';
import { buildFastParse as buildFastParseV2 } from '../src/parse/variants/single/v2.ts';
import { buildFastParse as buildFastParseV3 } from '../src/parse/variants/single/v3.ts';
import { buildFastParse as buildFastParseV4 } from '../src/parse/variants/single/v4.ts';
import { buildFastParse as buildFastParseV5 } from '../src/parse/variants/single/v5.ts';
import { buildFastParse as buildFastParseV6 } from '../src/parse/variants/single/v6.ts';
import { buildFastParse as buildFastParseV7 } from '../src/parse/variants/single/v7.ts';
import { buildFastParse as buildFastParseV8 } from '../src/parse/variants/single/v8.ts';
import { buildFastParse as buildFastParseV9 } from '../src/parse/variants/single/v9.ts';
import { buildFastParse as buildFastParseV12 } from '../src/parse/variants/single/v12.ts';
import { buildFastParse as buildFastParseV13 } from '../src/parse/variants/single/v13.ts';
import { buildFastParse as buildFastParseV18 } from '../src/parse/variants/single/v18.ts';
import { buildFastParse as buildFastParseV19 } from '../src/parse/variants/single/v19.ts';
import { buildFastParse as buildFastParseV10 } from '../archive/parse/v10.ts';
import { buildFastParse as buildFastParseV11 } from '../archive/parse/v11.ts';
import { buildFastParse as buildFastParseV14 } from '../archive/parse/v14.ts';
import { buildFastParse as buildFastParseV15 } from '../archive/parse/v15.ts';
import { buildFastParse as buildFastParseV16 } from '../archive/parse/v16.ts';
import { buildFastParse as buildFastParseV17 } from '../archive/parse/v17.ts';
import { buildFastFormat as buildFastFormatV1 } from '../src/format/variants/v1.ts';
import { buildFastFormat as buildFastFormatV2 } from '../src/format/variants/v2.ts';
import { check } from '../benchmarks/utils.ts';

const EN_CONSISTENCY_INPUTS = [
	'2h',
	'2hr',
	'2hrs',
	'2 hours',
	'2.5h',
	'.5h',
	'1m',
	'1min',
	'1mins',
	'1 minute',
	'1 minutes',
	'1s',
	'1sec',
	'1secs',
	'1 second',
	'1ms',
	'1 millisecond',
	'1 milliseconds',
	'1d',
	'1 day',
	'1 days',
	'1w',
	'1 week',
	'1 weeks',
	'1y',
	'1 year',
	'-1h',
	'-.5m',
	'- 3s',
	'-100',
	'1m10s',
	'2h 30m',
	'1h 30m 45s',
	'1 week 2 days',
	'- 2h 30m',
	'1 s',
	'1  s',
	'1   s',
	'1.5H',
	'20 MILLISECONDS',
	'5 Min',
	'100',
	'-100',
	'0',
	'',
	'   ',
	'\t\n',
	'invalid',
	'abc123',
	'1xyz',
	'1seconds',
	'1    s',
	'--1ms',
	'NaN',
	'Infinity',
	'1.2.3ms',
	'.ms',
	'100000000000000000000',
];

function testFastParse(
	name: string,
	builder: (lang: Language) => (str: string) => number | null,
): void {
	describe(name, () => {
		it('matches parse()', () => {
			const parseEn = builder(LANGUAGES.en);
			for (const input of EN_CONSISTENCY_INPUTS)
				check(parseEn(input), parse(input, LANGUAGES.en));
		});
	});
}

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

// ─── buildFastParse variants ─────────────────────────────────────────────────

describe('buildFastParse (english)', () => {
	testFastParse('current (fast.ts)', buildFastParse);
	testFastParse('v0 — trie toLowerCase', buildFastParseV0);
	testFastParse('v1 — regex', buildFastParseV1);
	testFastParse('v2 — isLetter', buildFastParseV2);
	testFastParse('v3 — charCode', buildFastParseV3);
	testFastParse('v4 — length', buildFastParseV4);
	testFastParse('v5 — string switch', buildFastParseV5);
	testFastParse('v6 — inline check', buildFastParseV6);
	testFastParse('v7 — bitwise', buildFastParseV7);
	testFastParse('v8 — case-insensitive', buildFastParseV8);
	testFastParse('v9 — combined', buildFastParseV9);
	testFastParse('v10 — | 0x20', buildFastParseV10);
	testFastParse('v11 — 4 opts', buildFastParseV11);
	testFastParse('v12 — early-exit first-char', buildFastParseV12);
	testFastParse('v13 — early-exit pre-scan', buildFastParseV13);
	testFastParse('v14 — all opts', buildFastParseV14);
	testFastParse('v15 — manual decimal', buildFastParseV15);
	testFastParse('v16 — boundary table', buildFastParseV16);
	testFastParse('v17 — decimal + boundary', buildFastParseV17);
	testFastParse('v18 — single-pass', buildFastParseV18);
	testFastParse('v19 — unroll', buildFastParseV19);
});

// ─── buildFastFormat variants ────────────────────────────────────────────────

describe('buildFastFormat (english)', () => {
	const formatEn = buildFastFormat(LANGUAGES.en);

	it('basic output', () => {
		check(formatEn(7200000), '2h');
		check(formatEn(3600000), '1h');
		check(formatEn(60000), '1m');
		check(formatEn(1000), '1s');
		check(formatEn(999), '999ms');
		check(formatEn(0), '0ms');
	});

	it('long form — singular and plural', () => {
		check(formatEn(3600000, true), '1 hour');
		check(formatEn(7200000, true), '2 hours');
		check(formatEn(1000, true), '1 second');
		check(formatEn(2000, true), '2 seconds');
		check(formatEn(1, true), '1 millisecond');
		check(formatEn(2, true), '2 milliseconds');
		check(formatEn(0, true), '0 milliseconds');
	});

	it('negative values', () => {
		check(formatEn(-7200000), '- 2h');
		check(formatEn(-7200000, true), '- 2 hours');
		check(formatEn(-1000), '- 1s');
		check(formatEn(-1000, true), '- 1 second');
		check(formatEn(-999), '- 999ms');
		check(formatEn(-1, true), '- 1 millisecond');
	});

	it('uses Math.floor (truncation)', () => {
		check(formatEn(5400000), '1h'); // 1.5h → 1h
		check(formatEn(59999), '59s'); // just under 1 minute
		check(formatEn(599), '599ms');
	});

	it('invalid input → null', () => {
		// @ts-expect-error -- testing invalid input
		check(formatEn('invalid'), null);
	});

	it('buildFastFormatV1', () => {
		const v1 = buildFastFormatV1(LANGUAGES.en);
		check(v1(7200000), '2h');
		check(v1(7200000, true), '2 hours');
		check(v1(-3600000), '- 1h');
		check(v1(0), '0ms');
	});

	it('buildFastFormatV2', () => {
		const v2 = buildFastFormatV2(LANGUAGES.en);
		check(v2(7200000), '2h');
		check(v2(7200000, true), '2 hours');
		check(v2(-3600000), '- 1h');
		check(v2(0), '0ms');
	});
});
