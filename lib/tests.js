// @ts-nocheck
/* eslint-disable no-undef */
/* eslint-env mocha */


if(typeof require !== 'undefined'){
	expect = require('expect.js');
	ms = require('../');
}

// strings

describe('ms(string)', () => {
	it('should not throw an error', () => {
		expect(() => {
			ms('1m');
		}).to.not.throwError();
	});

	it('should preserve ms', () => {
		expect(ms('100')).to.be(100);
	});

	it('should convert from m to ms', () => {
		expect(ms('1m')).to.be(60000);
	});

	it('should convert from h to ms', () => {
		expect(ms('1h')).to.be(3600000);
	});

	it('should convert d to ms', () => {
		expect(ms('2d')).to.be(172800000);
	});

	it('should convert w to ms', () => {
		expect(ms('3w')).to.be(1814400000);
	});

	it('should convert s to ms', () => {
		expect(ms('1s')).to.be(1000);
	});

	it('should convert ms to ms', () => {
		expect(ms('100ms')).to.be(100);
	});

	it('should work with decimals', () => {
		expect(ms('1.5h')).to.be(5400000);
	});

	it('should work with multiple spaces', () => {
		expect(ms('1   s')).to.be(1000);
	});

	it('should return NaN if invalid', () => {
		expect(isNaN(ms('☃'))).to.be(true);
		expect(isNaN(ms('10-.5'))).to.be(true);
	});

	it('should be case-insensitive', () => {
		expect(ms('1.5H')).to.be(5400000);
	});

	it('should work with numbers starting with .', () => {
		expect(ms('.5ms')).to.be(0.5);
	});

	it('should work with negative integers', () => {
		expect(ms('-100ms')).to.be(-100);
	});

	it('should work with negative decimals', () => {
		expect(ms('-1.5h')).to.be(-5400000);
		expect(ms('-10.5h')).to.be(-37800000);
	});

	it('should work with negative decimals starting with "."', () => {
		expect(ms('-.5h')).to.be(-1800000);
	});
});

// long strings

describe('ms(long string)', () => {
	it('should not throw an error', () => {
		expect(() => {
			ms('53 milliseconds');
		}).to.not.throwError();
	});

	it('should convert milliseconds to ms', () => {
		expect(ms('53 milliseconds')).to.be(53);
	});

	it('should convert msecs to ms', () => {
		expect(ms('17 msecs')).to.be(17);
	});

	it('should convert sec to ms', () => {
		expect(ms('1 sec')).to.be(1000);
	});

	it('should convert from min to ms', () => {
		expect(ms('1 min')).to.be(60000);
	});

	it('should convert from hr to ms', () => {
		expect(ms('1 hr')).to.be(3600000);
	});

	it('should convert days to ms', () => {
		expect(ms('2 days')).to.be(172800000);
	});

	it('should work with decimals', () => {
		expect(ms('1.5 hours')).to.be(5400000);
	});

	it('should work with negative integers', () => {
		expect(ms('-100 milliseconds')).to.be(-100);
	});

	it('should work with negative decimals', () => {
		expect(ms('-1.5 hours')).to.be(-5400000);
	});

	it('should work with negative decimals starting with "."', () => {
		expect(ms('-.5 hr')).to.be(-1800000);
	});
});

// numbers

describe('ms(number, { long: true })', () => {
	it('should not throw an error', () => {
		expect(() => {
			ms(500, { long: true });
		}).to.not.throwError();
	});

	it('should support milliseconds', () => {
		expect(ms(500, { long: true })).to.be('500 milliseconds');

		expect(ms(-500, { long: true })).to.be('-500 milliseconds');
	});

	it('should support seconds', () => {
		expect(ms(1000, { long: true })).to.be('1 second');
		expect(ms(1200, { long: true })).to.be('1 second 200 milliseconds');
		expect(ms(10000, { long: true })).to.be('10 seconds');

		expect(ms(-1000, { long: true })).to.be('-1 second');
		expect(ms(-1200, { long: true })).to.be('-1 second 200 milliseconds');
		expect(ms(-10000, { long: true })).to.be('-10 seconds');
	});

	it('should support minutes', () => {
		expect(ms(60 * 1000, { long: true })).to.be('1 minute');
		expect(ms(60 * 1200, { long: true })).to.be('1 minute 12 seconds');
		expect(ms(60 * 10000, { long: true })).to.be('10 minutes');

		expect(ms(-1 * 60 * 1000, { long: true })).to.be('-1 minute');
		expect(ms(-1 * 60 * 1200, { long: true })).to.be('-1 minute 12 seconds');
		expect(ms(-1 * 60 * 10000, { long: true })).to.be('-10 minutes');
	});

	it('should support hours', () => {
		expect(ms(60 * 60 * 1000, { long: true })).to.be('1 hour');
		expect(ms(60 * 60 * 1200, { long: true })).to.be('1 hour 12 minutes');
		expect(ms(60 * 60 * 10000, { long: true })).to.be('10 hours');

		expect(ms(-1 * 60 * 60 * 1000, { long: true })).to.be('-1 hour');
		expect(ms(-1 * 60 * 60 * 1200, { long: true })).to.be('-1 hour 12 minutes');
		expect(ms(-1 * 60 * 60 * 10000, { long: true })).to.be('-10 hours');
	});

	it('should support days', () => {
		expect(ms(24 * 60 * 60 * 1000, { long: true })).to.be('1 day');
		expect(ms(24 * 60 * 60 * 1200, { long: true })).to.be('1 day 4 hours 48 minutes');
		expect(ms(24 * 60 * 60 * 10000, { long: true })).to.be('10 days');

		expect(ms(-1 * 24 * 60 * 60 * 1000, { long: true })).to.be('-1 day');
		expect(ms(-1 * 24 * 60 * 60 * 1200, { long: true })).to.be('-1 day 4 hours 48 minutes');
		expect(ms(-1 * 24 * 60 * 60 * 10000, { long: true })).to.be('-10 days');
	});
});

// numbers

describe('ms(number)', () => {
	it('should not throw an error', () => {
		expect(() => {
			ms(500);
		}).to.not.throwError();
	});

	it('should support milliseconds', () => {
		expect(ms(500)).to.be('500ms');

		expect(ms(-500)).to.be('-500ms');
	});

	it('should support seconds', () => {
		expect(ms(1000)).to.be('1s');
		expect(ms(10000)).to.be('10s');

		expect(ms(-1000)).to.be('-1s');
		expect(ms(-10000)).to.be('-10s');
	});

	it('should support minutes', () => {
		expect(ms(60 * 1000)).to.be('1m');
		expect(ms(60 * 10000)).to.be('10m');

		expect(ms(-1 * 60 * 1000)).to.be('-1m');
		expect(ms(-1 * 60 * 10000)).to.be('-10m');
	});

	it('should support hours', () => {
		expect(ms(60 * 60 * 1000)).to.be('1h');
		expect(ms(60 * 60 * 10000)).to.be('10h');

		expect(ms(-1 * 60 * 60 * 1000)).to.be('-1h');
		expect(ms(-1 * 60 * 60 * 10000)).to.be('-10h');
	});

	it('should support days', () => {
		expect(ms(24 * 60 * 60 * 1000)).to.be('1d');
		expect(ms(24 * 60 * 60 * 10000)).to.be('10d');

		expect(ms(-1 * 24 * 60 * 60 * 1000)).to.be('-1d');
		expect(ms(-1 * 24 * 60 * 60 * 10000)).to.be('-10d');
	});
});

// invalid inputs

describe('ms(invalid inputs)', () => {
	it('should return null, when ms("")', () => {
		expect(ms('')).to.be(null);
	});

	it('should return null, when ms(undefined)', () => {
		// eslint-disable-next-line no-undefined
		expect(ms(undefined)).to.be(null);
	});

	it('should return null, when ms(null)', () => {
		expect(ms(null)).to.be(null);
	});

	it('should return null, when ms([])', () => {
		expect(ms([])).to.be(null);
	});

	it('should return null, when ms({})', () => {
		expect(ms({})).to.be(null);
	});

	it('should return null, when ms(NaN)', () => {
		expect(ms(NaN)).to.be(null);
	});

	it('should return null, when ms(Infinity)', () => {
		expect(ms(Infinity)).to.be(null);
	});

	it('should return null, when ms(-Infinity)', () => {
		expect(ms(-Infinity)).to.be(null);
	});

	it('should return NaN, when ms("absda")', () => {
		expect(isNaN(ms('absda'))).to.be(true);
	});

	it('should return NaN, when ms("123nothing")', () => {
		expect(isNaN(ms('123nothing'))).to.be(true);
	});
});

// multiple inputs

describe('ms(multiple inputs)', () => {
	const opts = {
		languages: ['en', 'es'],
	};

	it('should convert milliseconds,seconds to ms', () => {
		expect(ms('53 milisegundos 2 segundos', {
			languages: ['es'],
		})).to.be(2053);
	});

	it('should convert sec,min to ms', () => {
		expect(ms('1min,10 sec', opts)).to.be(70000);
	});

	it('should convert from min,secs to ms', () => {
		expect(ms('1 min 30 secs', opts)).to.be(90000);
	});

	it('should convert from hr,min to ms', () => {
		expect(ms('5.5 minutes, 1 hr', opts)).to.be(3930000);
	});

	it('should convert days,mins,hours to ms', () => {
		expect(ms('2 dias 5.5 min, 1 hr', opts)).to.be(176730000);
	});

	it('should work with decimals', () => {
		expect(ms('1.5 hours', opts)).to.be(5400000);
	});

	it('all', () => {
		expect(ms('5.5 minutes, 2 dias asdw 30 secs rqw-.5 horas', opts))
			.to.be(171360000);
	});
});

// languages
describe('ms languages', () => {
	// these rules may change when adding more languages
	let languages;

	it('should be a valid json', () => {
		expect(() => {
			languages = JSON.parse(
				require('fs').readFileSync('./lib/languages.json')
			);
		}).to.not.throwError();
	});

	const KEYS = [
		'YEAR', 'MONTH', 'WEEK', 'DAY',
		'HOUR', 'MINUTE', 'SECOND', 'MS',
	];
	it('all languages should have all keys', () => {
		expect((() => {
			// eslint-disable-next-line guard-for-in
			for(const lang in languages){
				const keys = Object.keys(languages[lang]);

				if(keys.length !== KEYS.length) return lang;

				if(keys.some(key => !KEYS.includes(key))){
					return lang;
				}
			}

			return null;
		})()).to.be(null);
	});

	it('languages keys should be sorted', () => {
		expect((() => {
			// eslint-disable-next-line guard-for-in
			for(const lang in languages){
				const keys = Object.keys(languages[lang]);

				let i = 0;
				for(const key of keys){
					if(key !== KEYS[i]) return lang;
					i++;
				}
			}

			return null;
		})()).to.be(null);
	});

	it('notations should be sorted', () => {
		expect((() => {
			// eslint-disable-next-line guard-for-in
			for(const lang in languages){
				const language = languages[lang];

				for(const key of Object.keys(language)){
					const notations = language[key];
					// The first should be the longest in plural
					// The second should be the longest but singular

					if(
						JSON.stringify(notations) !==
						JSON.stringify(notations.sort((a, b) => b.length - a.length))
					) return `${lang}:${key}`;

					// the latest should be the shortest (without singular or plural)
				}
			}

			return null;
		})()).to.be(null);
	});
});