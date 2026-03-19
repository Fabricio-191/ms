const { createTestFixtures, random } = require('./generators.cjs');

/**
 * Shared test suite called from ms.test.mjs (ESM) and ms.test.cjs (CJS).
 * @param {object} lib  - library exports
 * @param {Function} vercelMS - vercel/ms for comparison tests
 * @param {object} jest - { describe, it, expect } from the test runner
 */
module.exports = function runSuite(lib, vercelMS, { describe, it, expect }) {
	const {
		parse,
		format,
		clock,
		LANGUAGES,
		TIMES,
		Language,
		buildFastParse,
		buildFastFormat,
	} = lib;

	// #region utilities
	const { FORMAT_ARGS, FORMAT_ARGS_VERCEL, CLOCK_ARGS } = createTestFixtures(LANGUAGES);

	function check(value, expected) {
		if (typeof expected === 'number' && typeof value === 'number')
			return expect(Math.abs(expected - value)).toBeLessThan(1);
		return expect(value).toBe(expected);
	}
	// #endregion

	describe('languages', () => {
		it('builtins should be Language instances', () => {
			for (const lang of Object.keys(LANGUAGES))
				expect(LANGUAGES[lang] instanceof Language).toBe(true);
		});

		it('can add languages directly with Language', () => {
			LANGUAGES.hindi = new Language('hindi', {
				Y: { all: [ 'साल', 'वर्ष' ], singular: 'साल', shortSingular: 'साल', plural: 'वर्ष', shortPlural: 'वर्ष' },
				Mo: { all: [ 'महीना', 'महीने' ], singular: 'महीना', shortSingular: 'महीना', plural: 'महीने', shortPlural: 'महीने' },
				W: { all: [ 'हफ्ता', 'सप्ताह' ], singular: 'हफ्ता', shortSingular: 'हफ्ता', plural: 'सप्ताह', shortPlural: 'सप्ताह' },
				D: { all: [ 'दिन', 'दिनों' ], singular: 'दिन', shortSingular: 'दिन' },
				H: { all: [ 'घंटा' ], singular: 'घंटा', shortSingular: 'घंटा' },
				M: { all: [ 'मिनट', 'मिनटों' ], singular: 'मिनट', shortSingular: 'मिनट', plural: 'मिनटों', shortPlural: 'मिनटों' },
				S: { all: [ 'सेकंड', 'सेकंड्स' ], singular: 'सेकंड', shortSingular: 'सेकंड' },
				Ms: { all: [ 'मिलिसेकंड', 'मिलिसेकंड्स' ], singular: 'मिलिसेकंड', shortSingular: 'मिलिसेकंड' },
			});

			check(parse('1 दिन', LANGUAGES.hindi), 86400000);
			check(parse('1 दिन 3 घंटा 20 मिनटों', LANGUAGES.hindi), 98400000);
		});
	});

	describe('parse', () => {
		it('README.md examples should work', () => {
			check(parse('2 hours, 5.5 minutes and .3s'), 7530300);
			check(parse('1 week 2 days'), 777600000);
			check(parse('2 days 1 hours'), 176400000);
			check(parse('1d'), 86400000);
			check(parse('10h'), 36000000);
			check(parse('2.5 hrs'), 9000000);
			check(parse('2h'), 7200000);
			check(parse('1y'), 31557600000);
			check(parse('100'), 100);
			check(parse('.5m'), 30000);
			check(parse('-3 days'), -259200000);
			check(parse('-.5 mins'), -30000);
			check(parse('- 2m 30s'), -150000);
			check(parse('0 seconds'), 0);
			check(parse('1m10secs'), 70000);
			check(parse('5s50ms'), 5050);

			check(parse('1 day', LANGUAGES.es), null);
			check(parse('1 dia', LANGUAGES.es), 86400000);

			check(parse('12 seconds', [ LANGUAGES.en, LANGUAGES.es ]), 12000);
			check(parse('-3 minutos', [ LANGUAGES.en, LANGUAGES.es ]), -180000);
			check(parse('2 minutes 15 seconds', Object.values(LANGUAGES)), 135000);
			check(parse('2 minutos 15 segundos', Object.values(LANGUAGES)), 135000);
			check(parse('2.5 horas 30 minutes', Object.values(LANGUAGES)), 10800000);
		});

		it('should be case-insensitive', () => {
			check(parse('1.5H'), 5400000);
			check(parse('20 mIlLiSeCoNdS'), 20);
		});

		it('should preserve plain ms values', () => {
			check(parse('100'), 100);
			check(parse('-100'), -100);
		});

		it('should accept 0–3 spaces between number and unit', () => {
			check(parse('1s'), 1000);
			check(parse('1 s'), 1000);
			check(parse('1  s'), 1000);
			check(parse('1   s'), 1000);
			check(parse('1    s'), null);
			check(parse('1\ts'), null);
			check(parse('1\ns'), null);
		});

		function testNums(nums) {
			for (const lang of Object.keys(LANGUAGES)) {
				for (const key of Object.keys(TIMES)) {
					for (const notation of LANGUAGES[lang].units[key].all) {
						for (const num of nums)
							check(parse(num + random([ '', ' ' ]) + notation, LANGUAGES[lang]), TIMES[key] * num);
					}
				}
			}
		}

		it('should work with integers', () => {
			testNums([ '0', '1', '30', '45' ]);
		});
		it('should work with decimal numbers', () => {
			testNums([ '30.3', '2.1' ]);
		});
		it('should work with negative numbers', () => {
			testNums([ '-100', '-1', '-1.5' ]);
		});
		it('should work with leading-dot decimals', () => {
			testNums([ '.5', '-.5' ]);
		});

		it('should parse all language notations', () => {
			for (const lang of Object.keys(LANGUAGES)) {
				for (let i = 0; i < 1000; i++) {
					let result = 0, str = '';
					while (str.length === 0) {
						const selectedKeys = Object.keys(TIMES).filter(() => random(1, 1) < 0.3);
						for (const key of selectedKeys) {
							const num = random(true) ? random(1000) : random(1000, 1);
							result += num * TIMES[key];
							str += `${num}${random(true) ? ' ' : ''}${random(LANGUAGES[lang].units[key].all)}${random(true) ? ' ' : ''}`;
						}
					}
					check(parse(str, LANGUAGES[lang]), result);
				}
			}
		});

		it('should give the same result as vercel/ms', () => {
			for (const { num, options } of FORMAT_ARGS_VERCEL) {
				const formatted = format(num, options);
				if (vercelMS(formatted) === undefined) continue;
				check(vercelMS(formatted), num);
				check(parse(formatted), num);
			}
		});

		it('24-hour clock notation', () => {
			for (const { args, result } of CLOCK_ARGS)
				check(clock(...args), result);
		});
	});

	describe('format', () => {
		it('README.md examples should work', () => {
			const num = parse('16 days 8 hours 20 mins 40 secs');

			check(format(num), '16d 8h 20m');
			check(format(num, { length: 2 }), '16d 8h');
			check(format(num, { length: 8 }), '16d 8h 20m 40s');
			check(format(num, { long: true }), '16 days 8 hours 20 minutes');
			check(format(num, { long: true, language: LANGUAGES.es }), '16 dias 8 horas 20 minutos');
			check(format(num, { language: LANGUAGES.ja }), '16日 8時間 20分');

			check(format(num, { format: 'HS' }), '392h 1240s');
			check(format(4100940000, { format: 'WDHM', length: 2 }), '6w 5d');
			check(format(4100940000, { format: 'WDHM', length: 8 }), '6w 5d 11h 9m');
			check(format(10, { format: 'HS' }), '0s');
		});

		it('parse(format(n)) should equal n', () => {
			for (const { num, options } of FORMAT_ARGS) {
				const formatted = format(num, options);
				check(parse(formatted, options.language), num);
			}
		});
	});

	describe('fast', () => {
		it('buildFastParse should work with a single language', () => {
			const parseEn = buildFastParse(LANGUAGES.en);
			const parseEs = buildFastParse(LANGUAGES.es);

			check(parseEn('2h'), 7200000);
			check(parseEn('2.5 hrs'), 9000000);
			check(parseEn('2 horas'), null);
			check(parseEs('2 horas'), 7200000);
			check(parseEn('-.5m'), -30000);
		});

		it('buildFastFormat should return only the first unit', () => {
			const formatEn = buildFastFormat(LANGUAGES.en);

			check(formatEn(7200000), '2h');
			check(formatEn(7200000, true), '2 hours');
			check(formatEn(1000, true), '1 second');
			check(formatEn(999), '999ms');
			check(formatEn('invalid'), null);
		});
	});

	describe('others', () => {
		it('should return null for invalid inputs', () => {
			for (const value of [ '', undefined, null, [], {}, NaN, Infinity, -Infinity, 'absda', '☃', '10-.5', '123nothing', '12 minutesabc' ]) {
				check(parse(value), null);
				check(format(value), null);
			}
		});
	});
};
