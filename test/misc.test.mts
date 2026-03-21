import { describe, it, expect } from '@jest/globals';
import { createRequire } from 'module';
import * as lib from '../lib/esm/index.js';
import { check } from './generators.ts';

const require = createRequire(import.meta.url);
const cjsLib = require('../lib/cjs/index.cjs') as typeof lib;

describe('others', () => {
	it('should return null for invalid inputs', () => {
		for (const value of [ '', undefined, null, [], {}, NaN, Infinity, -Infinity, 'absda', '☃', '10-.5', '123nothing', '12 minutesabc' ] as const) {
			check(lib.parse(value as string), null);
			check(lib.format(value as number), null);
		}
	});
});

describe('CJS build (lib/cjs) — smoke test', () => {
	it('should load and expose the same API', () => {
		expect(cjsLib.parse('2h')).toBe(7200000);
		expect(cjsLib.parse('- 2m 30s')).toBe(-150000);
		expect(cjsLib.format(7200000)).toBe('2h');
		expect(cjsLib.format(7200000, { long: true })).toBe('2 hours');
		expect(cjsLib.clock('02:30')).toBe(9000000);
		expect(cjsLib.buildFastParse(cjsLib.LANGUAGES.en)('2h')).toBe(7200000);
		expect(cjsLib.buildFastFormat(cjsLib.LANGUAGES.en)(7200000)).toBe('2h');
	});
});
