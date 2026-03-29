import { describe, it, expect } from '@jest/globals';
import { createRequire } from 'module';
import * as lib from '@lib';
import { check } from '../utils.ts';

const require = createRequire(import.meta.url);
const cjsLib = require('../../lib/cjs/index.cjs') as typeof lib;

describe('languages', () => {
	it('builtins should be Language instances', () => {
		for (const key of Object.keys(lib.LANGUAGES) as Array<keyof typeof lib.LANGUAGES>)
			expect(lib.LANGUAGES[key] instanceof lib.Language).toBe(true);
	});

	it('can add languages directly with Language', () => {
		const hindi = new lib.Language('hindi', {
			Y: { all: [ 'साल', 'वर्ष' ], singular: 'साल', shortSingular: 'साल', plural: 'वर्ष', shortPlural: 'वर्ष' },
			Mo: { all: [ 'महीना', 'महीने' ], singular: 'महीना', shortSingular: 'महीना', plural: 'महीने', shortPlural: 'महीने' },
			W: { all: [ 'हफ्ता', 'सप्ताह' ], singular: 'हफ्ता', shortSingular: 'हफ्ता', plural: 'सप्ताह', shortPlural: 'सप्ताह' },
			D: { all: [ 'दिन', 'दिनों' ], singular: 'दिन', shortSingular: 'दिन' },
			H: { all: [ 'घंटा' ], singular: 'घंटा', shortSingular: 'घंटा' },
			M: { all: [ 'मिनट', 'मिनटों' ], singular: 'मिनट', shortSingular: 'मिनट', plural: 'मिनटों', shortPlural: 'मिनटों' },
			S: { all: [ 'सेकंड', 'सेकंड्स' ], singular: 'सेकंड', shortSingular: 'सेकंड' },
			Ms: { all: [ 'मिलिसेकंड', 'मिलिसेकंड्स' ], singular: 'मिलिसेकंड', shortSingular: 'मिलिसेकंड' },
		});

		check(lib.parse('1 दिन', hindi), 86400000);
		check(lib.parse('1 दिन 3 घंटा 20 मिनटों', hindi), 98400000);
	});
});

describe('others', () => {
	it('should return null for invalid inputs', () => {
		for (const value of [ '', undefined, null, [], {}, NaN, Infinity, -Infinity, 'absda', '☃', '10-.5', '123nothing', '12 minutesabc' ] as const) {
		// @ts-expect-error -- testing invalid input
			check(lib.parse(value), null);
			// @ts-expect-error -- testing invalid input
			check(lib.format(value), null);
		}
	});
});

describe('CJS build (lib/cjs) — smoke test', () => {
	it('should load and expose the same API', () => {
		expect(cjsLib.parse('2h')).toBe(7200000);
		expect(cjsLib.parse('- 2m 30s')).toBe(-150000);
		expect(cjsLib.format(7200000)).toBe('2h');
		expect(cjsLib.format(7200000, { long: true })).toBe('2 hours');
		expect(cjsLib.buildFastParse(cjsLib.LANGUAGES.en)('2h')).toBe(7200000);
		expect(cjsLib.buildFastFormat({ language: cjsLib.LANGUAGES.en })(7200000)).toBe('2h');
	});
});
