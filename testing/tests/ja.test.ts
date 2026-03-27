import { describe, it } from '@jest/globals';
import * as lib from '@lib';
import { check } from '../utils.ts';

const ja = lib.LANGUAGES.ja;

// ─── Parse ──────────────────────────────────────────────────────────────────

describe('parse (日本語)', () => {
	it('unit notations', () => {
		check(lib.parse('2時間', ja), 7200000);
		check(lib.parse('30分', ja), 1800000);
		check(lib.parse('1日', ja), 86400000);
		check(lib.parse('45秒', ja), 45000);
		check(lib.parse('500ミリ秒', ja), 500);
		check(lib.parse('1週間', ja), 604800000);
	});

	it('multi-unit', () => {
		check(lib.parse('2時間30分', ja), 9000000);
		check(lib.parse('1日8時間', ja), 86400000 + 28800000);
		check(lib.parse('2分15秒', ja), 135000);
	});

	it('english notations → null', () => {
		check(lib.parse('1 hour', ja), null);
		check(lib.parse('1h', ja), null);
	});
});

// ─── Format ─────────────────────────────────────────────────────────────────

describe('format (日本語)', () => {
	it('short form (no space before notation)', () => {
		check(lib.format(7200000, { language: ja }), '2時間');
		check(lib.format(1800000, { language: ja }), '30分');
		check(lib.format(86400000, { language: ja }), '1日');
		check(lib.format(1000, { language: ja }), '1秒');
	});

	it('long form (space before notation)', () => {
		check(lib.format(7200000, { language: ja, long: true }), '2 時間');
		check(lib.format(1800000, { language: ja, long: true }), '30 分');
		check(lib.format(1000, { language: ja, long: true }), '1 秒');
	});

	it('multi-unit output', () => {
		const num = lib.parse('16日 8時間 20分', ja)!;
		check(lib.format(num, { language: ja }), '16日 8時間 20分');
	});

	it('parse(format(ms)) === ms', () => {
		for (const ms of [ 7200000, 1800000, 86400000, 5445000 ]) {
			const str = lib.format(ms, { language: ja })!;
			check(lib.parse(str, ja), ms);
		}
	});
});

// ─── Fast variants ───────────────────────────────────────────────────────────

describe('buildFastParse (日本語)', () => {
	it('current (v9 combined)', () => {
		const parseJa = lib.buildFastParse(ja);
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
		const formatJa = lib.buildFastFormat(ja);
		check(formatJa(7200000), '2時間');
		check(formatJa(7200000, true), '2 時間');
		check(formatJa(1800000), '30分');
		check(formatJa(1800000, true), '30 分');
		check(formatJa(-7200000), '- 2時間');
		check(formatJa(-7200000, true), '- 2 時間');
		check(formatJa(0), '0ミリ秒');
	});
});
