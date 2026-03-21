import { describe, it, expect } from '@jest/globals';
import * as lib from '../lib/esm/index.js';
import { check } from './generators.ts';

describe('languages', () => {
	it('builtins should be Language instances', () => {
		for (const key of Object.keys(lib.LANGUAGES))
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
