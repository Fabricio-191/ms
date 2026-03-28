/**
 * Random-sample smoke tests for all fast parse variants × all languages.
 *
 * This file auto-discovers every entry in LANGUAGES and every entry in
 * parseVariants, so adding a new language or a new variant automatically
 * gets coverage here without any manual edits.
 *
 * For exhaustive, deterministic cases per language see:
 *   - testing/tests/en.test.ts
 *   - testing/tests/es.test.ts
 *   - testing/tests/ja.test.ts
 */
import { describe, it } from '@jest/globals';
import { ok, strictEqual } from 'node:assert';
import { LANGUAGES, parseVariants, type Language } from '@lib';
import { createArgs } from '../utils.ts';

interface VariantDef {
	name: string;
	build(lang: Language): (input: string) => number | null;
}

const VARIANTS: VariantDef[] = Object.entries(parseVariants).map(([ name, build ]) => ({ name, build }));
const LANGUAGES_LIST = Object.entries(LANGUAGES);

function check(actual: unknown, expected: unknown): void {
	if (typeof expected === 'number' && typeof actual === 'number')
		ok(actual === expected || Math.abs(expected - actual) < 1, `Expected ~${expected}, got ${actual}`);
	else
		strictEqual(actual, expected);
}

function runRandomSamples(lang: Language, count: number): void {
	for (const variant of VARIANTS) {
		const parse = variant.build(lang);
		const samples = Array.from({ length: count }, () => createArgs(true, false, lang));
		describe(variant.name, () => {
			for (let i = 0; i < samples.length; i++) {
				const { input, expected } = samples[i]!;
				it(`sample ${i + 1}: "${input}"`, () => {
					check(parse(input), expected);
				});
			}
		});
	}
}

// ─── Random samples — all languages × all variants ───────────────────────────

describe('Parse variants — Random samples', () => {
	for (const [ langKey, lang ] of LANGUAGES_LIST) {
		describe(`Language: ${langKey}`, () => {
			runRandomSamples(lang, 20);
		});
	}
});
