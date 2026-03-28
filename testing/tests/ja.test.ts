import { describe, it } from '@jest/globals';
import { ok, strictEqual } from 'node:assert';
import { LANGUAGES, TIMES, parse, format, parseVariants, buildFastParse, buildFastFormat } from '@lib';
import { check } from '../utils.ts';

const { Y, Mo, W, D, H, M, S, Ms } = TIMES;
const ja = LANGUAGES.ja;

// ─── Variant runner ───────────────────────────────────────────────────────────

interface Case {
	input: string;
	expected: number | null;
}

function runVariants(cases: Case[]): void {
	for (const [ name, build ] of Object.entries(parseVariants)) {
		const fn = build(ja);
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

describe('parse (日本語)', () => {
	it('unit notations', () => {
		check(parse('2時間', ja), 7200000);
		check(parse('30分', ja), 1800000);
		check(parse('1日', ja), 86400000);
		check(parse('45秒', ja), 45000);
		check(parse('500ミリ秒', ja), 500);
		check(parse('1週間', ja), 604800000);
	});

	it('multi-unit', () => {
		check(parse('2時間30分', ja), 9000000);
		check(parse('1日8時間', ja), 86400000 + 28800000);
		check(parse('2分15秒', ja), 135000);
	});

	it('english notations → null', () => {
		check(parse('1 hour', ja), null);
		check(parse('1h', ja), null);
	});
});

// ─── Edge cases específicos del japonés ──────────────────────────────────────

describe('日本語 — 月 vs 月間 vs ヶ月 (全部 → 同じ月の値)', () => {
	it('月, 月間, ヶ月 → 2592000000ms', () => {
		check(parse('1月', ja), Mo);
		check(parse('1月間', ja), Mo);
		check(parse('1ヶ月', ja), Mo);
		check(parse('2月', ja), Mo * 2);
		check(parse('2ヶ月', ja), Mo * 2);
	});
});

describe('日本語 — 時 vs 時間 (全部 → 同じ時間の値)', () => {
	it('時, 時間 → 3600000ms', () => {
		check(parse('1時', ja), 3600000);
		check(parse('1時間', ja), 3600000);
		check(parse('2時間', ja), 7200000);
	});

	it('時/時間 + 数字 → 数字はASCIIなので境界チェックを通過', () => {
		// Japanese BOUND table has no ASCII chars → any digit after a unit is a valid boundary
		check(parse('1時30分', ja), 3600000 + 1800000);
		check(parse('1時間30分', ja), 3600000 + 1800000);
	});
});

describe('日本語 — 週 vs 週間 (全部 → 同じ週の値)', () => {
	it('週, 週間 → 604800000ms', () => {
		check(parse('1週', ja), 604800000);
		check(parse('1週間', ja), 604800000);
		check(parse('2週間', ja), 604800000 * 2);
	});
});

describe('日本語 — 日 vs 日々 (全部 → 同じ日の値)', () => {
	it('日, 日々 → 86400000ms', () => {
		check(parse('1日', ja), 86400000);
		check(parse('1日々', ja), 86400000);
	});
});

describe('日本語 — 複合ユニット', () => {
	it('複数のユニットを組み合わせ', () => {
		check(parse('1月2日', ja), Mo + 2 * 86400000);
		check(parse('1週間2日', ja), 604800000 + 2 * 86400000);
		check(parse('1時間30分', ja), 5400000);
		check(parse('1時30分30秒', ja), 3600000 + 1800000 + 30000);
		check(parse('1日10時間', ja), 86400000 + 36000000);
	});

	it('かな読み (とし, じかん, ぶん, びょう)', () => {
		check(parse('1とし', ja), 31557600000);
		check(parse('1じかん', ja), 3600000);
		check(parse('1ぶん', ja), 60000);
		check(parse('1びょう', ja), 1000);
	});

	it('ミリ秒バリアント', () => {
		check(parse('1ミリ秒', ja), 1);
		check(parse('1ミリセコンド', ja), 1);
		check(parse('1ミリセカンド', ja), 1);
		check(parse('500ミリびょう', ja), 500);
	});
});

// ─── format() ────────────────────────────────────────────────────────────────

describe('format (日本語)', () => {
	it('short form (no space before notation)', () => {
		check(format(7200000, { language: ja }), '2時間');
		check(format(1800000, { language: ja }), '30分');
		check(format(86400000, { language: ja }), '1日');
		check(format(1000, { language: ja }), '1秒');
	});

	it('long form (space before notation)', () => {
		check(format(7200000, { language: ja, long: true }), '2 時間');
		check(format(1800000, { language: ja, long: true }), '30 分');
		check(format(1000, { language: ja, long: true }), '1 秒');
	});

	it('multi-unit output', () => {
		const num = parse('16日 8時間 20分', ja)!;
		check(format(num, { language: ja }), '16日 8時間 20分');
	});

	it('parse(format(ms)) === ms', () => {
		for (const ms of [ 7200000, 1800000, 86400000, 5445000 ]) {
			const str = format(ms, { language: ja })!;
			check(parse(str, ja), ms);
		}
	});
});

// ─── Fast variants ───────────────────────────────────────────────────────────

describe('buildFastParse (日本語)', () => {
	it('current (v9 combined)', () => {
		const parseJa = buildFastParse(ja);
		check(parseJa('2時間'), 7200000);
		check(parseJa('30分'), 1800000);
		check(parseJa('2時間30分'), 9000000);
		check(parseJa('45秒'), 45000);
		check(parseJa('2h'), null);
		check(parseJa(''), null);
	});
});

describe('buildFastFormat (日本語)', () => {
	it('current', () => {
		const formatJa = buildFastFormat(ja);
		check(formatJa(7200000), '2時間');
		check(formatJa(7200000, true), '2 時間');
		check(formatJa(1800000), '30分');
		check(formatJa(1800000, true), '30 分');
		check(formatJa(-7200000), '- 2時間');
		check(formatJa(-7200000, true), '- 2 時間');
		check(formatJa(0), '0ミリ秒');
	});
});

// ─── Fast parse variants — all notations ────────────────────────────────────
// Japanese notations are all non-ASCII (Unicode). The BOUND table for Japanese
// contains only non-ASCII chars, so any ASCII char is always a valid boundary.
// Non-ASCII chars after a notation immediately fire the multiplier (c >= 128).

const ALL_NOTATIONS: Case[] = [
	// Years
	{ input: '1とし', expected: Y },
	{ input: '1年', expected: Y },
	{ input: '3年', expected: 3 * Y },
	// Months — 月 alone is valid; 月間/ヶ月/etc. all map to same value
	{ input: '1箇月かげつ', expected: Mo },
	{ input: '1げっかん', expected: Mo },
	{ input: '1月間', expected: Mo },
	{ input: '1ヶ月', expected: Mo },
	{ input: '1つき', expected: Mo },
	{ input: '1月', expected: Mo },
	{ input: '6ヶ月', expected: 6 * Mo },
	// Weeks
	{ input: '1ウィーク', expected: W },
	{ input: '1しゅう', expected: W },
	{ input: '1週間', expected: W },
	{ input: '1週', expected: W },
	{ input: '2週間', expected: 2 * W },
	// Days
	{ input: '1日々', expected: D },
	{ input: '1ひ', expected: D },
	{ input: '1日', expected: D },
	{ input: '7日', expected: 7 * D },
	// Hours
	{ input: '1じかん', expected: H },
	{ input: '1じ', expected: H },
	{ input: '1時間', expected: H },
	{ input: '1時', expected: H },
	{ input: '24時間', expected: 24 * H },
	// Minutes
	{ input: '1ぶん', expected: M },
	{ input: '1分', expected: M },
	{ input: '30分', expected: 30 * M },
	// Seconds
	{ input: '1びょう', expected: S },
	{ input: '1秒', expected: S },
	{ input: '45秒', expected: 45 * S },
	// Milliseconds
	{ input: '1ミリセコンド', expected: Ms },
	{ input: '1ミリセカンド', expected: Ms },
	{ input: '1ミリびょう', expected: Ms },
	{ input: '1ミリ秒', expected: Ms },
	{ input: '500ミリ秒', expected: 500 * Ms },
	// Spaces (0–3 allowed)
	{ input: '1 時間', expected: H },
	{ input: '1  分', expected: M },
	{ input: '1   秒', expected: S },
	{ input: '2   分', expected: 2 * M },
	// Decimals
	{ input: '2.5時間', expected: 2.5 * H },
	{ input: '.5分', expected: 0.5 * M },
	{ input: '1.5 時間', expected: 1.5 * H },
	{ input: '0.001ミリ秒', expected: 0.001 * Ms },
	{ input: '2.5日', expected: 2.5 * D },
	{ input: '.5年', expected: 0.5 * Y },
	// Negative
	{ input: '-1時間', expected: -H },
	{ input: '-.5分', expected: -0.5 * M },
	{ input: '-100ミリ秒', expected: -100 * Ms },
	{ input: '-2.5時間', expected: -2.5 * H },
	{ input: '- 1秒', expected: -S },
];

describe('日本語 — all notations (all variants)', () => {
	runVariants(ALL_NOTATIONS);
});

// ─── Fast parse variants — multi-unit ────────────────────────────────────────

const MULTI_UNIT: Case[] = [
	// Two units
	{ input: '1時間30分', expected: H + 30 * M },
	{ input: '2時間30分', expected: 2 * H + 30 * M },
	{ input: '1分30秒', expected: M + 30 * S },
	{ input: '5秒500ミリ秒', expected: 5 * S + 500 * Ms },
	{ input: '1日8時間', expected: D + 8 * H },
	{ input: '1年6ヶ月', expected: Y + 6 * Mo },
	{ input: '2週間3日', expected: 2 * W + 3 * D },
	// Three units
	{ input: '1時間2分3秒', expected: H + 2 * M + 3 * S },
	{ input: '1日2時間3分', expected: D + 2 * H + 3 * M },
	{ input: '1時30分30秒', expected: H + 30 * M + 30 * S },
	// Four units
	{ input: '1時間2分3秒4ミリ秒', expected: H + 2 * M + 3 * S + 4 * Ms },
	{ input: '1日 8時間 30分', expected: D + 8 * H + 30 * M },
	// Five+ units
	{ input: '1週間2日3時間4分5秒', expected: W + 2 * D + 3 * H + 4 * M + 5 * S },
	{ input: '1とし 2ヶ月 3週間 4日', expected: Y + 2 * Mo + 3 * W + 4 * D },
	{ input: '5時間30分15秒500ミリ秒', expected: 5 * H + 30 * M + 15 * S + 500 * Ms },
	// Decimal multi-unit
	{ input: '2.5時間 15分', expected: 2.5 * H + 15 * M },
	{ input: '.5時間 .5分', expected: 0.5 * H + 0.5 * M },
	// Negative multi-unit
	{ input: '-1時間30分', expected: -(H + 30 * M) },
	{ input: '-2時間30分', expected: -(2 * H + 30 * M) },
	{ input: '- 1時間2分3秒', expected: -(H + 2 * M + 3 * S) },
	// First unit valid, second unknown → first accumulates
	{ input: '1時間xyz', expected: H },
];

describe('日本語 — multi-unit (all variants)', () => {
	runVariants(MULTI_UNIT);
});

// ─── Fast parse variants — invalid inputs ────────────────────────────────────
// Japanese BOUND has only non-ASCII chars. There is no "boundary invalid" case
// equivalent to English/Spanish since non-ASCII always fires the multiplier check.
// Invalid cases focus on: ASCII-only notations, bad numbers, structural errors.

const INVALID: Case[] = [
	{ input: '', expected: null },
	// ASCII-only notations → null (not in Japanese dict)
	{ input: '1h', expected: null },
	{ input: '1s', expected: null },
	{ input: '1m', expected: null },
	{ input: '1d', expected: null },
	{ input: '1 hour', expected: null },
	{ input: '1 second', expected: null },
	{ input: '1xyz', expected: null },
	// Bad number format
	{ input: '.時間', expected: null }, // dot with no digit before unit
	{ input: '1.2.3分', expected: null }, // double decimal
	{ input: '1    分', expected: null }, // 4 spaces (max is 3)
	{ input: '1\t時間', expected: null }, // tab
	{ input: '1\n秒', expected: null }, // newline
	{ input: 'NaN', expected: null },
	{ input: 'abc', expected: null },
	// ミリ alone is not a valid notation (needs 秒/びょう/etc suffix)
	{ input: '1ミリ', expected: null },
	// Partial notations (valid start, invalid end)
	{ input: '1ミリセ', expected: null }, // prefix of ミリセコンド/ミリセカンド
];

describe('日本語 — invalid inputs (all variants)', () => {
	runVariants(INVALID);
});
