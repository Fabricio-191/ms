import { describe, it, expect } from '@jest/globals';
import { strictEqual } from 'node:assert';
import { LANGUAGES, TIMES, buildFormat as buildFastFormat, buildParse } from '@lib';

const parseEn = buildParse(LANGUAGES.en);

const { Y, Mo, W, D, H, M, S, Ms } = TIMES;
const en = LANGUAGES.en;
const es = LANGUAGES.es;
const ja = LANGUAGES.ja;

function check(actual: unknown, expected: unknown): void {
	strictEqual(actual, expected);
}

interface Case {
	ms: number;
	expected: string | null;
}

function runCases(label: string, fn: (ms: number) => string | null, cases: Case[]): void {
	describe(label, () => {
		for (const { ms, expected } of cases)
			it(`${ms} → ${JSON.stringify(expected)}`, () => { check(fn(ms), expected); });
	});
}

// ─── Default options (short, length=1, en, YMoDHMSMs) ────────────────────────

// Default format is 'YMoDHMSMs' — W (weeks) is intentionally excluded
runCases('defaults — each unit at threshold', buildFastFormat(), [
	{ ms: Y, expected: '1y' },
	{ ms: Mo, expected: '1mo' },
	{ ms: D, expected: '1d' },
	{ ms: H, expected: '1h' },
	{ ms: M, expected: '1m' },
	{ ms: S, expected: '1s' },
	{ ms: Ms, expected: '1ms' },
]);

runCases('defaults — W (604800000) falls to days since W not in default format', buildFastFormat(), [
	{ ms: W, expected: '7d' },
	{ ms: 3 * W, expected: '21d' },
]);

runCases('defaults — multi-year / larger values', buildFastFormat(), [
	{ ms: 2 * Y, expected: '2y' },
	{ ms: 10 * Y, expected: '10y' },
	{ ms: 6 * Mo, expected: '6mo' },
	{ ms: 7 * D, expected: '7d' },
	{ ms: 24 * H, expected: '1d' }, // 24h = 1d → picks D
	{ ms: 60 * M, expected: '1h' }, // 60m = 1h → picks H
	{ ms: 60 * S, expected: '1m' }, // 60s = 1m → picks M
	{ ms: 500 * Ms, expected: '500ms' },
]);

runCases('defaults — values just below a threshold (fall to smaller unit)', buildFastFormat(), [
	{ ms: Y - 1, expected: `${Math.trunc((Y - 1) / Mo)}mo` },
	{ ms: Mo - 1, expected: `${Math.trunc((Mo - 1) / D)}d` }, // W not in default format
	{ ms: D - 1, expected: `${Math.trunc((D - 1) / H)}h` },
	{ ms: H - 1, expected: `${Math.trunc((H - 1) / M)}m` },
	{ ms: M - 1, expected: `${Math.trunc((M - 1) / S)}s` },
	{ ms: S - 1, expected: `${Math.trunc(S - 1)}ms` },
]);

runCases('defaults — zero and sub-smallest', buildFastFormat(), [
	{ ms: 0, expected: '0ms' },
]);

// ─── long: true — singular vs plural ─────────────────────────────────────────

runCases('long=true — singular (value=1)', buildFastFormat({ long: true }), [
	{ ms: Y, expected: '1 year' },
	{ ms: Mo, expected: '1 month' },
	{ ms: D, expected: '1 day' },
	{ ms: H, expected: '1 hour' },
	{ ms: M, expected: '1 minute' },
	{ ms: S, expected: '1 second' },
	{ ms: Ms, expected: '1 millisecond' },
]);

runCases('long=true — W falls to days (not in default format)', buildFastFormat({ long: true }), [
	{ ms: W, expected: '7 days' },
	{ ms: 2 * W, expected: '14 days' },
]);

runCases('long=true — plural (value>1)', buildFastFormat({ long: true }), [
	{ ms: 2 * Y, expected: '2 years' },
	{ ms: 3 * Mo, expected: '3 months' },
	{ ms: 5 * D, expected: '5 days' },
	{ ms: 2 * H, expected: '2 hours' },
	{ ms: 30 * M, expected: '30 minutes' },
	{ ms: 45 * S, expected: '45 seconds' },
	{ ms: 500, expected: '500 milliseconds' },
]);

runCases('long=true — zero', buildFastFormat({ long: true }), [
	{ ms: 0, expected: '0 milliseconds' },
]);

// ─── length option ────────────────────────────────────────────────────────────

runCases('length=1 (explicit)', buildFastFormat({ length: 1 }), [
	{ ms: H + 30 * M + 45 * S, expected: '1h' }, // only largest unit
	{ ms: D + 2 * H, expected: '1d' },
	{ ms: Y + 6 * Mo, expected: '1y' },
]);

runCases('length=2', buildFastFormat({ length: 2 }), [
	{ ms: H + 30 * M, expected: '1h 30m' },
	{ ms: 2 * H + 15 * M, expected: '2h 15m' },
	{ ms: D + 12 * H, expected: '1d 12h' },
	{ ms: H + 30 * M + 45 * S, expected: '1h 30m' }, // length cap at 2
	{ ms: Y + 6 * Mo, expected: '1y 6mo' },
	{ ms: 2 * W + 3 * D, expected: '17d' }, // W not in default format → collapses to days
	{ ms: M + 30 * S, expected: '1m 30s' },
	{ ms: 5 * S + 500 * Ms, expected: '5s 500ms' },
	{ ms: 0, expected: '0ms' },
]);

runCases('length=3', buildFastFormat({ length: 3 }), [
	{ ms: H + 30 * M + 45 * S, expected: '1h 30m 45s' },
	{ ms: 2 * H + 15 * M + 10 * S, expected: '2h 15m 10s' },
	{ ms: D + 2 * H + 3 * M, expected: '1d 2h 3m' },
	{ ms: H + 2 * M + 3 * S + 4 * Ms, expected: '1h 2m 3s' }, // length cap at 3
	{ ms: Y + 2 * Mo + 3 * W, expected: '1y 2mo 21d' }, // W not in default format
	{ ms: 0, expected: '0ms' },
]);

runCases('length=8 (full, all units)', buildFastFormat({ length: 8 }), [
	{
		// W not in default format: 3w+4d → 25d
		ms: Y + 2 * Mo + 3 * W + 4 * D + 5 * H + 6 * M + 7 * S + 8 * Ms,
		expected: '1y 2mo 25d 5h 6m 7s 8ms',
	},
	{ ms: H + 30 * M + 45 * S + 500 * Ms, expected: '1h 30m 45s 500ms' },
	{ ms: 0, expected: '0ms' },
]);

// ─── length + long combined ───────────────────────────────────────────────────

runCases('length=2, long=true', buildFastFormat({ length: 2, long: true }), [
	{ ms: H + 30 * M, expected: '1 hour 30 minutes' },
	{ ms: 2 * H + 15 * M, expected: '2 hours 15 minutes' },
	{ ms: D + 12 * H, expected: '1 day 12 hours' },
	{ ms: M + 30 * S, expected: '1 minute 30 seconds' },
	{ ms: 0, expected: '0 milliseconds' },
]);

runCases('length=3, long=true', buildFastFormat({ length: 3, long: true }), [
	{ ms: H + 30 * M + 45 * S, expected: '1 hour 30 minutes 45 seconds' },
	{ ms: D + H + M, expected: '1 day 1 hour 1 minute' },
	{ ms: 0, expected: '0 milliseconds' },
]);

runCases('length=3, long=true — singular throughout', buildFastFormat({ length: 3, long: true }), [
	{ ms: D + H + M, expected: '1 day 1 hour 1 minute' },
	{ ms: W + D + H, expected: '8 days 1 hour' }, // W not in default format → 8 days total
]);

// ─── Weeks with explicit format ───────────────────────────────────────────────

runCases('format="YMoWDHMSMs" (includes W) — W unit works', buildFastFormat({ format: 'YMoWDHMSMs' }), [
	{ ms: W, expected: '1w' },
	{ ms: 3 * W, expected: '3w' },
]);

runCases('format="YMoWDHMSMs", length=2', buildFastFormat({ format: 'YMoWDHMSMs', length: 2 }), [
	{ ms: 2 * W + 3 * D, expected: '2w 3d' },
	{ ms: Y + 6 * Mo, expected: '1y 6mo' },
	{ ms: W + D, expected: '1w 1d' },
]);

runCases('format="YMoWDHMSMs", length=3', buildFastFormat({ format: 'YMoWDHMSMs', length: 3 }), [
	{ ms: Y + 2 * Mo + 3 * W, expected: '1y 2mo 3w' },
	{ ms: Y + 2 * Mo + 3 * W + 4 * D + 5 * H, expected: '1y 2mo 3w' }, // capped at 3
]);

runCases('format="YMoWDHMSMs", length=8, long=true', buildFastFormat({ format: 'YMoWDHMSMs', length: 8, long: true }), [
	{ ms: W, expected: '1 week' },
	{ ms: 2 * W, expected: '2 weeks' },
	{ ms: W + D + H, expected: '1 week 1 day 1 hour' },
]);

// ─── format option ────────────────────────────────────────────────────────────

runCases('format="HMS", length=1', buildFastFormat({ format: 'HMS' }), [
	{ ms: H + 30 * M + 45 * S, expected: '1h' },
	{ ms: D + H, expected: '25h' }, // D worth overflows into H since Y/Mo/W/D excluded
	{ ms: 30 * M, expected: '30m' },
	{ ms: 45 * S, expected: '45s' },
	{ ms: 500 * Ms, expected: '0s' }, // no Ms in format → zero of last unit (S)
	{ ms: 0, expected: '0s' },
]);

runCases('format="HMS", length=2', buildFastFormat({ format: 'HMS', length: 2 }), [
	{ ms: H + 30 * M + 45 * S, expected: '1h 30m' }, // cap at 2
	{ ms: H + 45 * S, expected: '1h 45s' }, // M=0 skipped
	{ ms: 30 * M + 45 * S, expected: '30m 45s' },
	{ ms: 0, expected: '0s' },
]);

runCases('format="HMS", length=3', buildFastFormat({ format: 'HMS', length: 3 }), [
	{ ms: H + 30 * M + 45 * S, expected: '1h 30m 45s' },
	{ ms: 2 * H + 5 * M + 10 * S, expected: '2h 5m 10s' },
	{ ms: D + H, expected: '25h' },
	{ ms: 0, expected: '0s' },
]);

runCases('format="MS", length=2', buildFastFormat({ format: 'MS', length: 2 }), [
	{ ms: 5445000, expected: '90m 45s' }, // 5445000 = 90m45s in MS scope
	{ ms: M + 30 * S, expected: '1m 30s' },
	{ ms: H, expected: '60m' }, // H overflows into M (60 minutes)
	{ ms: 0, expected: '0s' },
]);

runCases('format="DH", length=2', buildFastFormat({ format: 'DH', length: 2 }), [
	{ ms: D + 2 * H, expected: '1d 2h' },
	{ ms: 2 * D, expected: '2d' },
	{ ms: H, expected: '1h' },
	{ ms: M, expected: '0h' }, // M < H → zero of last unit (H)
	{ ms: 0, expected: '0h' },
]);

runCases('format="WDHM", length=2', buildFastFormat({ format: 'WDHM', length: 2 }), [
	{ ms: 4100940000, expected: '6w 5d' },
]);

runCases('format="WDHM", length=8', buildFastFormat({ format: 'WDHM', length: 8 }), [
	{ ms: 4100940000, expected: '6w 5d 11h 9m' }, // capped by available matching units (4)
]);

runCases('format="YMo", length=2', buildFastFormat({ format: 'YMo', length: 2 }), [
	{ ms: Y + 6 * Mo, expected: '1y 6mo' },
	{ ms: 3 * Mo, expected: '3mo' },
	{ ms: D, expected: '0mo' },
]);

runCases('format="S" (single-unit format)', buildFastFormat({ format: 'S' }), [
	{ ms: S, expected: '1s' },
	{ ms: 45 * S, expected: '45s' },
	{ ms: H, expected: '3600s' }, // everything in seconds
	{ ms: 500, expected: '0s' },
	{ ms: 0, expected: '0s' },
]);

runCases('format="Ms" (only milliseconds)', buildFastFormat({ format: 'Ms' }), [
	{ ms: Ms, expected: '1ms' },
	{ ms: 500, expected: '500ms' },
	{ ms: S, expected: '1000ms' },
	{ ms: 0, expected: '0ms' },
]);

// ─── format + long ────────────────────────────────────────────────────────────

runCases('format="HMS", length=3, long=true', buildFastFormat({ format: 'HMS', length: 3, long: true }), [
	{ ms: H + 30 * M + 45 * S, expected: '1 hour 30 minutes 45 seconds' },
	{ ms: 2 * H + M, expected: '2 hours 1 minute' },
	{ ms: 0, expected: '0 seconds' },
]);

runCases('format="DH", length=2, long=true', buildFastFormat({ format: 'DH', length: 2, long: true }), [
	{ ms: D + H, expected: '1 day 1 hour' },
	{ ms: 2 * D, expected: '2 days' },
	{ ms: 2 * H, expected: '2 hours' },
	{ ms: 0, expected: '0 hours' },
]);

// ─── Negative values ──────────────────────────────────────────────────────────

runCases('negative — short, length=1', buildFastFormat(), [
	{ ms: -H, expected: '- 1h' },
	{ ms: -2 * H, expected: '- 2h' },
	{ ms: -D, expected: '- 1d' },
	{ ms: -S, expected: '- 1s' },
	{ ms: -500 * Ms, expected: '- 500ms' },
]);

runCases('negative — long, length=1', buildFastFormat({ long: true }), [
	{ ms: -H, expected: '- 1 hour' },
	{ ms: -2 * H, expected: '- 2 hours' },
	{ ms: -Ms, expected: '- 1 millisecond' },
]);

runCases('negative — multi-unit', buildFastFormat({ length: 3 }), [
	{ ms: -(H + 30 * M + 45 * S), expected: '- 1h 30m 45s' },
	{ ms: -(2 * D + 3 * H), expected: '- 2d 3h' },
]);

runCases('negative — zero stays positive', buildFastFormat(), [
	{ ms: 0, expected: '0ms' },
	{ ms: -0, expected: '0ms' },
]);

// ─── Invalid inputs → null ───────────────────────────────────────────────────

describe('invalid inputs → null', () => {
	const fn = buildFastFormat();
	const invalids: Array<[string, unknown]> = [
		[ 'NaN', NaN ],
		[ 'Infinity', Infinity ],
		[ '-Infinity', -Infinity ],
		[ 'string', '1000' ],
		[ 'null', null ],
		[ 'undefined', undefined ],
		[ 'object', {} ],
		[ 'array', [] ],
		[ 'boolean', true ],
	];
	for (const [ label, value ] of invalids) {
		it(`${label} → null`, () => {
			// @ts-expect-error — testing invalid input
			strictEqual(fn(value), null);
		});
	}
});

// ─── Builder — invalid options throw ─────────────────────────────────────────

describe('buildFastFormat — invalid options throw', () => {
	it('long: non-boolean → throws', () => {
		// @ts-expect-error — testing invalid option
		expect(() => buildFastFormat({ long: 'yes' })).toThrow("'long' should be a boolean");
	});
	it('length: 0 → throws', () => {
		expect(() => buildFastFormat({ length: 0 })).toThrow("'length' should be a number");
	});
	it('length: 9 → throws', () => {
		expect(() => buildFastFormat({ length: 9 })).toThrow("'length' should be a number");
	});
	it('length: -1 → throws', () => {
		expect(() => buildFastFormat({ length: -1 })).toThrow("'length' should be a number");
	});
	it('length: NaN → throws', () => {
		expect(() => buildFastFormat({ length: NaN })).toThrow("'length' should be a number");
	});
	it('length: Infinity → throws', () => {
		expect(() => buildFastFormat({ length: Infinity })).toThrow("'length' should be a number");
	});
	it('language: plain object → throws', () => {
		// @ts-expect-error — testing invalid option
		expect(() => buildFastFormat({ language: {} })).toThrow("'language' should be a Language instance");
	});
	it('language: string → throws', () => {
		// @ts-expect-error — testing invalid option
		expect(() => buildFastFormat({ language: 'en' })).toThrow("'language' should be a Language instance");
	});
	it('format: non-string → throws', () => {
		// @ts-expect-error — testing invalid option
		expect(() => buildFastFormat({ format: 123 })).toThrow("'format' should be a non-empty string");
	});
	it('format: no valid units → throws', () => {
		// @ts-expect-error — testing invalid option
		expect(() => buildFastFormat({ format: 'xyz' })).toThrow('invalid format');
	});
	it('format: empty string → throws', () => {
		// @ts-expect-error — testing invalid option
		expect(() => buildFastFormat({ format: '' })).toThrow('invalid format');
	});
});

// ─── Language option — es ─────────────────────────────────────────────────────

runCases('language=es, short, length=1', buildFastFormat({ language: es }), [
	{ ms: Y, expected: '1año' },
	{ ms: 2 * Y, expected: '2años' },
	{ ms: Mo, expected: '1mes' },
	{ ms: 2 * Mo, expected: '2meses' },
	{ ms: W, expected: '7d' }, // W not in default format → falls to days
	{ ms: D, expected: '1d' },
	{ ms: H, expected: '1h' },
	{ ms: M, expected: '1m' },
	{ ms: S, expected: '1s' },
	{ ms: Ms, expected: '1ms' },
	{ ms: 0, expected: '0ms' },
]);

runCases('language=es, long=true', buildFastFormat({ language: es, long: true }), [
	{ ms: Y, expected: '1 año' },
	{ ms: 2 * Y, expected: '2 años' },
	{ ms: Mo, expected: '1 mes' },
	{ ms: 2 * Mo, expected: '2 meses' },
	{ ms: H, expected: '1 hora' },
	{ ms: 2 * H, expected: '2 horas' },
	{ ms: S, expected: '1 segundo' },
	{ ms: 2 * S, expected: '2 segundos' },
	{ ms: 0, expected: '0 milisegundos' },
]);

runCases('language=es, length=2', buildFastFormat({ language: es, length: 2 }), [
	{ ms: H + 30 * M, expected: '1h 30m' },
	{ ms: D + 12 * H, expected: '1d 12h' },
]);

// ─── Language option — ja ─────────────────────────────────────────────────────

runCases('language=ja, short, length=1', buildFastFormat({ language: ja }), [
	{ ms: Y, expected: '1年' },
	{ ms: 2 * Y, expected: '2年' },
	{ ms: H, expected: '1時間' },
	{ ms: M, expected: '1分' },
	{ ms: S, expected: '1秒' },
	{ ms: Ms, expected: '1ミリ秒' },
	{ ms: 0, expected: '0ミリ秒' },
]);

runCases('language=ja, long=true', buildFastFormat({ language: ja, long: true }), [
	{ ms: Y, expected: '1 年' },
	{ ms: H, expected: '1 時間' },
	{ ms: S, expected: '1 秒' },
	{ ms: 0, expected: '0 ミリ秒' },
]);

runCases('language=ja, length=2', buildFastFormat({ language: ja, length: 2 }), [
	{ ms: H + 30 * M, expected: '1時間 30分' },
	{ ms: D + H, expected: '1日 1時間' },
]);

// ─── Roundtrip: parse(format(ms)) === ms ────────────────────────────────────

describe('roundtrip — parse(format(ms)) === ms (english)', () => {
	const cases: Array<{ ms: number; opts: Parameters<typeof buildFastFormat>[0] }> = [
		{ ms: H, opts: { length: 1 } },
		{ ms: D, opts: { length: 1 } },
		{ ms: H + 30 * M, opts: { length: 2 } },
		{ ms: D + 12 * H, opts: { length: 2 } },
		{ ms: H + 30 * M + 45 * S, opts: { length: 3 } },
		{ ms: W + 2 * D + 3 * H, opts: { length: 3 } },
		{ ms: 2 * M + 30 * S, opts: { length: 2, format: 'MS' } },
		{ ms: H + 30 * M + 45 * S, opts: { length: 3, format: 'HMS' } },
	];

	for (const { ms, opts } of cases) {
		it(`ms=${ms}, opts=${JSON.stringify(opts)}`, () => {
			const str = buildFastFormat(opts)(ms);
			strictEqual(typeof str, 'string');
			strictEqual(parseEn(str!), ms);
		});
	}
});

// ─── Miscellaneous edge cases ─────────────────────────────────────────────────

describe('miscellaneous', () => {
	it('length capped to available units in format (no over-counting)', () => {
		// format='DH' has 2 units — length=8 should behave like length=2
		const fn8 = buildFastFormat({ format: 'DH', length: 8 });
		const fn2 = buildFastFormat({ format: 'DH', length: 2 });
		strictEqual(fn8(D + 2 * H), fn2(D + 2 * H));
	});

	it('large ms — trunc does not produce fractional counts', () => {
		const fn = buildFastFormat({ length: 3 });
		const result = fn(Y + Mo + W);
		strictEqual(typeof result, 'string');
		// should not contain a decimal point
		strictEqual(result!.includes('.'), false);
	});

	it('fractional ms — trunc floors toward zero', () => {
		const fn = buildFastFormat();
		strictEqual(fn(1500), '1s'); // 1500ms → 1s (trunc(1500/1000)=1)
		strictEqual(fn(999), '999ms');
	});

	it('format string is case-sensitive (lowercase → ignored)', () => {
		// 'hms' has no valid tokens — buildFastFormat should throw
		// @ts-expect-error — testing invalid option
		expect(() => buildFastFormat({ format: 'hms' })).toThrow('invalid format');
	});

	it('default language is english', () => {
		const explicit = buildFastFormat({ language: en });
		const implicit = buildFastFormat();
		strictEqual(explicit(H), implicit(H));
	});

	it('long=false is the default', () => {
		const explicit = buildFastFormat({ long: false });
		const implicit = buildFastFormat();
		strictEqual(explicit(2 * H), implicit(2 * H));
	});

	it('length=1 is the default', () => {
		const explicit = buildFastFormat({ length: 1 });
		const implicit = buildFastFormat();
		strictEqual(explicit(H + 30 * M), implicit(H + 30 * M));
	});

	it('negative large multi-unit (W collapses to days in default format)', () => {
		const fn = buildFastFormat({ length: 3 });
		strictEqual(fn(-(Y + 6 * Mo + 3 * W)), '- 1y 6mo 21d');
	});
});
