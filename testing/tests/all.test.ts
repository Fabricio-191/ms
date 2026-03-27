/**
 * Comprehensive test for all parse variants across all languages.
 * Generates language-specific samples using each language's notations.
 *
 * NOTE: Some variants use ASCII-only optimizations and cannot parse non-ASCII
 * languages like Japanese. Those variants are only tested against ASCII languages.
 */
import { describe, it } from '@jest/globals';
import { strictEqual, ok } from 'node:assert';
import { LANGUAGES, type Language } from '@lib';
import { createArgs } from '../utils.ts';
import { buildFastParse as buildFastParseV11 } from '@archive/parse/v11.ts';
import { buildFastParse as buildFastParseV14 } from '@archive/parse/v14.ts';
import { buildFastParse as buildFastParseV15 } from '@archive/parse/v15.ts';
import { buildFastParse as buildFastParseV16 } from '@archive/parse/v16.ts';
import { buildFastParse as buildFastParseV17 } from '@archive/parse/v17.ts';
import { buildFastParse as buildFastParseV18 } from '@src/parse/variants/v18.ts';
import { buildFastParse as buildFastParseV19 } from '@src/parse/variants/v19.ts';
import { buildFastParse as buildFastParseV20 } from '@src/parse/variants/v20.ts';
import { buildFastParse as buildFastParseV21 } from '@src/parse/variants/v21.ts';
import { buildFastParse as buildFastParseV22 } from '@src/parse/variants/v22.ts';
import { buildFastParse as buildFastParseV23 } from '@src/parse/variants/v23.ts';
import { buildFastParse as buildFastParseV24 } from '@src/parse/variants/v24.ts';
import { buildFastParse as buildFastParseV25 } from '@src/parse/variants/v25.ts';

type ParseFn = (input: string) => number | null;

interface VariantInfo {
	name: string;
	build(lang: Language): ParseFn;
	supportsAllLanguages: boolean;
}

const VARIANTS: VariantInfo[] = [
	{ name: 'v11', build: buildFastParseV11, supportsAllLanguages: false },
	{ name: 'v14', build: buildFastParseV14, supportsAllLanguages: false },
	{ name: 'v15', build: buildFastParseV15, supportsAllLanguages: false },
	{ name: 'v16', build: buildFastParseV16, supportsAllLanguages: false },
	{ name: 'v17', build: buildFastParseV17, supportsAllLanguages: false },
	{ name: 'v18', build: buildFastParseV18, supportsAllLanguages: true },
	{ name: 'v19', build: buildFastParseV19, supportsAllLanguages: true },
	{ name: 'v20', build: buildFastParseV20, supportsAllLanguages: true },
	{ name: 'v21', build: buildFastParseV21, supportsAllLanguages: true },
	{ name: 'v22', build: buildFastParseV22, supportsAllLanguages: true },
	{ name: 'v23', build: buildFastParseV23, supportsAllLanguages: true },
	{ name: 'v24', build: buildFastParseV24, supportsAllLanguages: true },
	{ name: 'v25', build: buildFastParseV25, supportsAllLanguages: true },
];

const LANGUAGES_LIST = Object.entries(LANGUAGES);

function checkEqual(actual: unknown, expected: unknown): void {
	if (typeof expected === 'number' && typeof actual === 'number') {
		ok(
			actual === expected || Math.abs(expected - actual) < 1,
			`Expected ~${expected}, got ${actual}`,
		);
	}
	else {
		strictEqual(actual, expected);
	}
}

const NON_ASCII_LANGUAGES = new Set([ 'ja' ]);

describe('Parse variants - All Languages', () => {
	for (const [ langKey, lang ] of LANGUAGES_LIST) {
		describe(`Language: ${langKey}`, () => {
			for (const variant of VARIANTS) {
				if (!variant.supportsAllLanguages && NON_ASCII_LANGUAGES.has(langKey))
					continue;

				const { name } = variant;
				const parse = variant.build(lang);
				const samples = Array.from({ length: 20 }, () => createArgs(true, false, lang));

				describe(name, () => {
					for (let i = 0; i < samples.length; i++) {
						const { input, expected } = samples[i]!;
						it(`sample ${i + 1}: "${input}"`, () => {
							const result = parse(input);
							checkEqual(result, expected);
						});
					}
				});
			}
		});
	}
});
