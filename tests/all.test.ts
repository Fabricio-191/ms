/**
 * Comprehensive test for all parse variants across all languages.
 * Generates language-specific samples using each language's notations.
 *
 * NOTE: Some variants use ASCII-only optimizations and cannot parse non-ASCII
 * languages like Japanese. Those variants are only tested against ASCII languages.
 */
import { describe, it } from '@jest/globals';
import { strictEqual, ok } from 'node:assert';
import { TIMES, LANGUAGES, type Language } from '../lib/esm/index.js';
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
import { buildFastParse as buildFastParseV20 } from '../src/parse/variants/single/v20.ts';
import { buildFastParse as buildFastParseV21 } from '../src/parse/variants/single/v21.ts';
import { buildFastParse as buildFastParseV22 } from '../src/parse/variants/single/v22.ts';
import { buildFastParse as buildFastParseV23 } from '../src/parse/variants/single/v23.ts';
import { buildFastParse as buildFastParseV25 } from '../src/parse/variants/single/v25.ts';
import { buildFastParse as buildFastParseV10 } from '../archive/parse/v10.ts';
import { buildFastParse as buildFastParseV11 } from '../archive/parse/v11.ts';
import { buildFastParse as buildFastParseV14 } from '../archive/parse/v14.ts';
import { buildFastParse as buildFastParseV15 } from '../archive/parse/v15.ts';
import { buildFastParse as buildFastParseV16 } from '../archive/parse/v16.ts';
import { buildFastParse as buildFastParseV17 } from '../archive/parse/v17.ts';

type ParseFn = (input: string) => number | null;

interface VariantInfo {
	name: string;
	build(lang: Language): ParseFn;
	supportsAllLanguages: boolean;
}

const VARIANTS: VariantInfo[] = [
	{ name: 'v0', build: buildFastParseV0, supportsAllLanguages: true },
	{ name: 'v1', build: buildFastParseV1, supportsAllLanguages: true },
	{ name: 'v2', build: buildFastParseV2, supportsAllLanguages: true },
	{ name: 'v3', build: buildFastParseV3, supportsAllLanguages: true },
	{ name: 'v4', build: buildFastParseV4, supportsAllLanguages: true },
	{ name: 'v5', build: buildFastParseV5, supportsAllLanguages: true },
	{ name: 'v6', build: buildFastParseV6, supportsAllLanguages: true },
	{ name: 'v7', build: buildFastParseV7, supportsAllLanguages: true },
	{ name: 'v8', build: buildFastParseV8, supportsAllLanguages: true },
	{ name: 'v9', build: buildFastParseV9, supportsAllLanguages: true },
	{ name: 'v10', build: buildFastParseV10, supportsAllLanguages: false },
	{ name: 'v11', build: buildFastParseV11, supportsAllLanguages: false },
	{ name: 'v12', build: buildFastParseV12, supportsAllLanguages: true },
	{ name: 'v13', build: buildFastParseV13, supportsAllLanguages: true },
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
	{ name: 'v25', build: buildFastParseV25, supportsAllLanguages: true },
];

const LANGUAGES_LIST = Object.entries(LANGUAGES);
const UNIT_KEYS = Object.keys(TIMES) as Array<keyof typeof TIMES>;
const MAXS: Record<keyof typeof TIMES, number> = { Y: 50, Mo: 11, W: 3, D: 6, H: 23, M: 59, S: 59, Ms: 999 };

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

// Generate language-specific samples using that language's notations
function generateSamples(lang: Language, count: number): Array<{ input: string; expected: number }> {
	// Use a deterministic seed for reproducibility
	let seed = 12345;
	const random = (): number => {
		seed = Math.abs(Math.imul(seed, 1103515245) + 12345) % 2147483648;
		return seed / 2147483647;
	};

	const samples: Array<{ input: string; expected: number }> = [];

	for (let i = 0; i < count; i++) {
		// Pick a random unit
		const unitIdx = Math.floor(random() * UNIT_KEYS.length);
		const unit = UNIT_KEYS[unitIdx]!;

		// Pick a random notation from this language
		const notations = lang.units[unit].all;
		const notationIdx = Math.floor(random() * notations.length);
		const notation = notations[notationIdx]!;

		// Generate a random number
		const num = randomInt(1, MAXS[unit]);

		// Sometimes add decimal
		const useDecimal = random() < 0.3;
		let numStr = String(num);
		if (useDecimal && num < MAXS[unit]) {
			const decimal = Math.floor(random() * 99) + 1;
			numStr = `${num}.${decimal}`;
		}

		// Sometimes add spaces
		const spaces = random() < 0.2 ? ' '.repeat(randomInt(0, 2)) : '';

		// Sometimes make negative
		const isNeg = random() < 0.15;
		let prefix = '';
		if (isNeg) prefix = random() < 0.5 ? '- ' : '-';

		const input = `${prefix}${numStr}${spaces}${notation}`.trim();
		const expected = (useDecimal ? parseFloat(numStr) : num) * TIMES[unit] * (isNeg ? -1 : 1);

		samples.push({ input, expected });
	}

	return samples;
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
				const samples = generateSamples(lang, 20);

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
