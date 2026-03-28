import { describe, it } from '@jest/globals';
import { ok, strictEqual } from 'node:assert';
import { LANGUAGES, TIMES, parse, format, parseVariants } from '@lib';
import { check } from '../utils.ts';

const { Y, Mo, W, D, H, M, S, Ms } = TIMES;
const en = LANGUAGES.en;

// ─── Variant runner ───────────────────────────────────────────────────────────

interface Case {
	input: string;
	expected: number | null;
}

function runVariants(cases: Case[]): void {
	for (const [ name, build ] of Object.entries(parseVariants)) {
		const fn = build(en);
		describe(name, () => {
			for (const { input, expected } of cases) {
				it(`"${input}" → ${expected ?? 'null'}`, () => {
					const actual = fn(input);
					if (typeof expected === 'number' && typeof actual === 'number')
						ok(actual === expected || Math.abs(expected - actual) < 1, `Expected ~${expected}, got ${actual}`);
					else
						strictEqual(actual, expected);
				});
			}
		});
	}
}

// ─── parse() ─────────────────────────────────────────────────────────────────

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
		check(parse('1seconds'), 1000);
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
		check(parse('--1ms'), -1);
		check(parse('   '), 0);
		check(parse('\t\n'), 0);
		check(parse('Infinity'), Infinity);
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

// ─── format() ────────────────────────────────────────────────────────────────

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
		check(format(ms), '1h 30m 45s');
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

// ─── Fast parse variants — all notations ────────────────────────────────────

const ALL_NOTATIONS: Case[] = [
	// Years
	{ input: '1years', expected: Y },
	{ input: '1year', expected: Y },
	{ input: '1yrs', expected: Y },
	{ input: '1yr', expected: Y },
	{ input: '1y', expected: Y },
	{ input: '3y', expected: 3 * Y },
	// Months
	{ input: '1months', expected: Mo },
	{ input: '1month', expected: Mo },
	{ input: '1mth', expected: Mo },
	{ input: '1mo', expected: Mo },
	{ input: '6mo', expected: 6 * Mo },
	// Weeks
	{ input: '1weeks', expected: W },
	{ input: '1week', expected: W },
	{ input: '1w', expected: W },
	{ input: '2w', expected: 2 * W },
	// Days
	{ input: '1days', expected: D },
	{ input: '1day', expected: D },
	{ input: '1d', expected: D },
	{ input: '7d', expected: 7 * D },
	// Hours
	{ input: '1hours', expected: H },
	{ input: '1hour', expected: H },
	{ input: '1hrs', expected: H },
	{ input: '1hr', expected: H },
	{ input: '1h', expected: H },
	{ input: '24h', expected: 24 * H },
	// Minutes
	{ input: '1minutes', expected: M },
	{ input: '1minute', expected: M },
	{ input: '1mins', expected: M },
	{ input: '1min', expected: M },
	{ input: '1m', expected: M },
	{ input: '30m', expected: 30 * M },
	// Seconds
	{ input: '1seconds', expected: S },
	{ input: '1second', expected: S },
	{ input: '1secs', expected: S },
	{ input: '1sec', expected: S },
	{ input: '1s', expected: S },
	{ input: '45s', expected: 45 * S },
	// Milliseconds
	{ input: '1milliseconds', expected: Ms },
	{ input: '1millisecond', expected: Ms },
	{ input: '1mseconds', expected: Ms },
	{ input: '1msecond', expected: Ms },
	{ input: '1msecs', expected: Ms },
	{ input: '1msec', expected: Ms },
	{ input: '1ms', expected: Ms },
	{ input: '500ms', expected: 500 * Ms },
	// Case insensitive
	{ input: '1H', expected: H },
	{ input: '1MIN', expected: M },
	{ input: '1SEC', expected: S },
	{ input: '1MILLISECONDS', expected: Ms },
	{ input: '1HoUr', expected: H },
	{ input: '1mIlLiSeCoNdS', expected: Ms },
	{ input: '1YRS', expected: Y },
	{ input: '1MTH', expected: Mo },
	// Spaces (0–3)
	{ input: '1 h', expected: H },
	{ input: '1  s', expected: S },
	{ input: '1   ms', expected: Ms },
	// Decimals
	{ input: '2.5h', expected: 2.5 * H },
	{ input: '.5m', expected: 0.5 * M },
	{ input: '.25s', expected: 0.25 * S },
	{ input: '1.5 hours', expected: 1.5 * H },
	{ input: '0.001ms', expected: 0.001 * Ms },
	{ input: '1.5 days', expected: 1.5 * D },
	{ input: '2.5 weeks', expected: 2.5 * W },
	{ input: '.5year', expected: 0.5 * Y },
	// Negative
	{ input: '-1h', expected: -H },
	{ input: '-.5m', expected: -0.5 * M },
	{ input: '-100ms', expected: -100 * Ms },
	{ input: '-2.5 hours', expected: -2.5 * H },
	{ input: '- 1s', expected: -S },
];

describe('english — all notations (all variants)', () => {
	runVariants(ALL_NOTATIONS);
});

// ─── Fast parse variants — m / ms / mo / mth disambiguation ─────────────────

const M_DISAMBIGUATION: Case[] = [
	// m → minute
	{ input: '1m', expected: M },
	{ input: '10m', expected: 10 * M },
	{ input: '1M', expected: M },
	// ms → millisecond
	{ input: '1ms', expected: Ms },
	{ input: '100ms', expected: 100 * Ms },
	{ input: '1MS', expected: Ms },
	// mo / mth / month / months → month
	{ input: '1mo', expected: Mo },
	{ input: '1mth', expected: Mo },
	{ input: '1month', expected: Mo },
	{ input: '1months', expected: Mo },
	{ input: '2mth', expected: 2 * Mo },
	{ input: '1MO', expected: Mo },
	{ input: '1MTH', expected: Mo },
	// m followed by notation char → null (not a valid longer notation)
	{ input: '1mh', expected: null },
	{ input: '1mm', expected: null },
	{ input: '1md', expected: null },
	{ input: '1mw', expected: null },
	{ input: '1my', expected: null },
	// ms followed by notation char → null
	{ input: '1mss', expected: null },
	{ input: '1msm', expected: null },
	{ input: '1msh', expected: null },
	{ input: '1msd', expected: null },
	// Decimal forms
	{ input: '1.5m', expected: 1.5 * M },
	{ input: '0.5ms', expected: 0.5 * Ms },
	{ input: '2.5mo', expected: 2.5 * Mo },
];

describe('english — m / ms / mo / mth disambiguation (all variants)', () => {
	runVariants(M_DISAMBIGUATION);
});

// ─── Fast parse variants — multi-unit ────────────────────────────────────────

const MULTI_UNIT: Case[] = [
	// Two units
	{ input: '1h 30m', expected: H + 30 * M },
	{ input: '2h30m', expected: 2 * H + 30 * M },
	{ input: '1m30s', expected: M + 30 * S },
	{ input: '5s500ms', expected: 5 * S + 500 * Ms },
	{ input: '1d12h', expected: D + 12 * H },
	{ input: '1y 6mo', expected: Y + 6 * Mo },
	{ input: '2w3d', expected: 2 * W + 3 * D },
	// Three units
	{ input: '1h 2m 3s', expected: H + 2 * M + 3 * S },
	{ input: '1h30m45s', expected: H + 30 * M + 45 * S },
	{ input: '2h15m10s', expected: 2 * H + 15 * M + 10 * S },
	{ input: '1d2h3m', expected: D + 2 * H + 3 * M },
	// Four units
	{ input: '1h 2m 3s 4ms', expected: H + 2 * M + 3 * S + 4 * Ms },
	{ input: '1 day 12 hours 30 minutes', expected: D + 12 * H + 30 * M },
	// Five+ units
	{ input: '1 week 2 days 3 hours 4 minutes 5 seconds', expected: W + 2 * D + 3 * H + 4 * M + 5 * S },
	{ input: '1y 2mo 3w 4d 5h 6m 7s 8ms', expected: Y + 2 * Mo + 3 * W + 4 * D + 5 * H + 6 * M + 7 * S + 8 * Ms },
	// Decimal multi-unit
	{ input: '2.5h 15m', expected: 2.5 * H + 15 * M },
	{ input: '.5h .5m', expected: 0.5 * H + 0.5 * M },
	{ input: '1.5d 12h', expected: 1.5 * D + 12 * H },
	// Negative multi-unit
	{ input: '-1h 30m', expected: -(H + 30 * M) },
	{ input: '-2h30m', expected: -(2 * H + 30 * M) },
	{ input: '- 1h 2m 3s', expected: -(H + 2 * M + 3 * S) },
	{ input: '-2.5h 15m', expected: -(2.5 * H + 15 * M) },
	// Mixed short/long notations
	{ input: '1 year 6 months', expected: Y + 6 * Mo },
	{ input: '1 hour, 30 minutes', expected: H + 30 * M },
	{ input: '2 hours and 5 minutes', expected: 2 * H + 5 * M },
	// First unit valid, second unknown → first accumulates
	{ input: '1h 2xyz', expected: H },
];

describe('english — multi-unit (all variants)', () => {
	runVariants(MULTI_UNIT);
});

// ─── Fast parse variants — boundary cases ────────────────────────────────────
// A valid notation immediately followed by a char that IS in the notation
// alphabet (BOUND table) must NOT match — it could be a longer unknown token.

const BOUNDARY: Case[] = [
	// Single-char notations + another notation char → null
	{ input: '1ss', expected: null }, // s + s
	{ input: '1sh', expected: null }, // s + h
	{ input: '1sm', expected: null }, // s + m
	{ input: '1sd', expected: null }, // s + d
	{ input: '1sw', expected: null }, // s + w
	{ input: '1sy', expected: null }, // s + y
	{ input: '1hs', expected: null }, // h + s
	{ input: '1hm', expected: null }, // h + m
	{ input: '1hd', expected: null }, // h + d
	{ input: '1hh', expected: null }, // h + h
	{ input: '1hw', expected: null }, // h + w
	{ input: '1dm', expected: null }, // d + m
	{ input: '1ds', expected: null }, // d + s
	{ input: '1dh', expected: null }, // d + h
	{ input: '1dw', expected: null }, // d + w
	{ input: '1wm', expected: null }, // w + m
	{ input: '1ws', expected: null }, // w + s
	{ input: '1wh', expected: null }, // w + h
	{ input: '1wd', expected: null }, // w + d
	{ input: '1ys', expected: null }, // y + s
	{ input: '1yh', expected: null }, // y + h
	{ input: '1ym', expected: null }, // y + m
	{ input: '1mm', expected: null }, // m + m
	{ input: '1mh', expected: null }, // m + h
	{ input: '1ms', expected: Ms }, // ms IS a valid notation
	// Valid 2-char notations followed by notation char → null
	{ input: '1mss', expected: null }, // ms + s
	{ input: '1msm', expected: null }, // ms + m
	{ input: '1mse', expected: null }, // ms + e (e is in BOUND from 'msec' etc.)
	{ input: '1hrm', expected: null }, // hr + m
	{ input: '1hrs', expected: H }, // hrs IS valid
	{ input: '1hrss', expected: null }, // hrs + s
	{ input: '1hrsh', expected: null }, // hrs + h
	// Valid 3-char+ notations followed by notation char → null
	{ input: '1secm', expected: null }, // sec + m
	{ input: '1secs', expected: S }, // secs IS valid
	{ input: '1secss', expected: null }, // secs + s
	{ input: '1secsm', expected: null }, // secs + m
	{ input: '1minm', expected: null }, // min + m
	{ input: '1mins', expected: M }, // mins IS valid
	{ input: '1minss', expected: null }, // mins + s
	{ input: '1minsh', expected: null }, // mins + h
	{ input: '1mths', expected: null }, // mth + s (s is in BOUND)
	{ input: '1mthm', expected: null }, // mth + m
	{ input: '1moh', expected: null }, // mo + h
	{ input: '1mom', expected: null }, // mo + m
	{ input: '1yrm', expected: null }, // yr + m
	{ input: '1yrs', expected: Y }, // yrs IS valid
	{ input: '1yrss', expected: null }, // yrs + s
	{ input: '1weekm', expected: null }, // week + m
	{ input: '1weeks', expected: W }, // weeks IS valid
	{ input: '1weekss', expected: null }, // weeks + s
	{ input: '1monthm', expected: null }, // month + m
	{ input: '1months', expected: Mo }, // months IS valid
	{ input: '1monthss', expected: null }, // months + s
	{ input: '1secondm', expected: null }, // second + m
	{ input: '1seconds', expected: S }, // seconds IS valid
	{ input: '1secondss', expected: null }, // seconds + s
	{ input: '1minutem', expected: null }, // minute + m
	{ input: '1minutes', expected: M }, // minutes IS valid
	{ input: '1hourm', expected: null }, // hour + m
	{ input: '1hours', expected: H }, // hours IS valid
	{ input: '1yearm', expected: null }, // year + m
	{ input: '1years', expected: Y }, // years IS valid
	{ input: '1msecm', expected: null }, // msec + m
	{ input: '1msecs', expected: Ms }, // msecs IS valid
	{ input: '1msecss', expected: null }, // msecs + s
	// Notation + digit → valid (digits NOT in BOUND)
	{ input: '1s2m', expected: S + 2 * M },
	{ input: '1h3s', expected: H + 3 * S },
];

describe('english — boundary: notation + notation-char (all variants)', () => {
	runVariants(BOUNDARY);
});

// ─── Fast parse variants — invalid inputs ────────────────────────────────────

const INVALID: Case[] = [
	{ input: '', expected: null },
	{ input: '1xyz', expected: null },
	{ input: '1xh', expected: null },
	{ input: '1ah', expected: null },
	{ input: '1qm', expected: null },
	{ input: '.ms', expected: null }, // dot with no digit before unit
	{ input: '1.2.3ms', expected: null }, // double decimal
	{ input: '1    s', expected: null }, // 4 spaces (max is 3)
	{ input: '1\ts', expected: null }, // tab not allowed
	{ input: '1\ns', expected: null }, // newline not allowed
	{ input: 'abc', expected: null },
	{ input: 'NaN', expected: null },
	{ input: '1secon', expected: null }, // truncated "second"
	{ input: '1minut', expected: null }, // truncated "minute"
	{ input: '1hou', expected: null }, // truncated "hour"
	{ input: '1wee', expected: null }, // truncated "week"
	{ input: '1yea', expected: null }, // truncated "year"
	{ input: '1mont', expected: null }, // truncated "month"
	{ input: '1millisec', expected: null }, // too short for any ms notation
	{ input: '1mseco', expected: null }, // partial "msecond"
];

describe('english — invalid inputs (all variants)', () => {
	runVariants(INVALID);
});
