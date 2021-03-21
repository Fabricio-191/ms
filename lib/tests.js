// @ts-nocheck
/* eslint-env mocha */

const ms = require('../');

describe('languages', () => {
	// these rules may change when adding more languages
	let languages;

	it('languages.json should be a valid json', () => {
		expect(() => {
			languages = JSON.parse(
				require('fs').readFileSync('./lib/languages.json')
			);
		}).toNotThrowError();
	});

	const KEYS = [
		'YEAR', 'MONTH', 'WEEK', 'DAY',
		'HOUR', 'MINUTE', 'SECOND', 'MS',
	];
	it('languages should have all keys', () => {
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
		})()).toBe(null);
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
		})()).toBe(null);
	});

	it('notations of all languages should be sorted', () => {
		let val = null;

		// eslint-disable-next-line guard-for-in
		for(const lang of Object.keys(languages)){
			const language = languages[lang];

			for(const key of Object.keys(language)){
				const notations = language[key];
				// The first should be the longest in plural
				// The second should be the longest but singular
				// the latest should be the shortest (without singular or plural)

				const actualNotations = JSON.stringify(notations);
				const sortedNotations = JSON.stringify(
					notations.sort((a, b) => b.length - a.length)
				);

				if(
					actualNotations !== sortedNotations
				) val = `${lang}:${key}`;
			}
		}

		expect(val).toBe(null);
	});
});

describe('invalid inputs', () => {
	it('should not throw an error', () => {
		expect(() => {
			ms('');
			ms();
			ms(null);
		}).toNotThrowError();
	});

	it('should return null, when input is not a string or a finite number', () => {
		expect(ms('')).toBe(null);
		expect(ms()).toBe(null);
		expect(ms(null)).toBe(null);
		expect(ms([])).toBe(null);
		expect(ms({})).toBe(null);
		expect(ms(NaN)).toBe(null);
		expect(ms(Infinity)).toBe(null);
		expect(ms(-Infinity)).toBe(null);
	});

	it('should return NaN, if input is invalid', () => {
		expect(ms('absda')).toBeNaN();
		expect(ms('☃')).toBeNaN();
		expect(ms('10-.5')).toBeNaN();
		expect(ms('123nothing')).toBeNaN();
		expect(ms('12 minutesabc')).toBeNaN();
	});
});

describe('format', () => {
	it('should not throw an error', () => {
		expect(() => {
			ms(500);
			ms(500, { long: true });
			ms(500, { long: true, useWeeks: true });
			ms(500, { long: false, useWeeks: true });
			ms(500, { long: true, useWeeks: true, quantity: 50 });
		}).toNotThrowError();
	});

	it('should support milliseconds', () => {
		expect(ms(500, { long: true })).toBe('500 milliseconds');
		expect(ms(-500, { long: true })).toBe('-500 milliseconds');
		expect(ms(500)).toBe('500ms');
		expect(ms(-500)).toBe('-500ms');
	});

	it('should support seconds', () => {
		expect(ms(1000, { long: true })).toBe('1 second');
		expect(ms(1200, { long: true })).toBe('1 second 200 milliseconds');
		expect(ms(10000, { long: true })).toBe('10 seconds');

		expect(ms(-1000, { long: true })).toBe('-1 second');
		expect(ms(-1200, { long: true })).toBe('-1 second 200 milliseconds');
		expect(ms(-10000, { long: true })).toBe('-10 seconds');

		expect(ms(1000)).toBe('1s');
		expect(ms(10000)).toBe('10s');

		expect(ms(-1000)).toBe('-1s');
		expect(ms(-10000)).toBe('-10s');
	});

	it('should support minutes', () => {
		expect(ms(60 * 1000, { long: true })).toBe('1 minute');
		expect(ms(60 * 1200, { long: true })).toBe('1 minute 12 seconds');
		expect(ms(60 * 10000, { long: true })).toBe('10 minutes');

		expect(ms(-1 * 60 * 1000, { long: true })).toBe('-1 minute');
		expect(ms(-1 * 60 * 1200, { long: true })).toBe('-1 minute 12 seconds');
		expect(ms(-1 * 60 * 10000, { long: true })).toBe('-10 minutes');

		expect(ms(60 * 1000)).toBe('1m');
		expect(ms(60 * 10000)).toBe('10m');

		expect(ms(-1 * 60 * 1000)).toBe('-1m');
		expect(ms(-1 * 60 * 10000)).toBe('-10m');
	});

	it('should support hours', () => {
		expect(ms(60 * 60 * 1000, { long: true })).toBe('1 hour');
		expect(ms(60 * 60 * 1200, { long: true })).toBe('1 hour 12 minutes');
		expect(ms(60 * 60 * 10000, { long: true })).toBe('10 hours');

		expect(ms(-1 * 60 * 60 * 1000, { long: true })).toBe('-1 hour');
		expect(ms(-1 * 60 * 60 * 1200, { long: true })).toBe('-1 hour 12 minutes');
		expect(ms(-1 * 60 * 60 * 10000, { long: true })).toBe('-10 hours');

		expect(ms(60 * 60 * 1000)).toBe('1h');
		expect(ms(60 * 60 * 10000)).toBe('10h');

		expect(ms(-1 * 60 * 60 * 1000)).toBe('-1h');
		expect(ms(-1 * 60 * 60 * 10000)).toBe('-10h');
	});

	it('should support days', () => {
		expect(ms(24 * 60 * 60 * 1000, { long: true })).toBe('1 day');
		expect(ms(24 * 60 * 60 * 1200, { long: true })).toBe('1 day 4 hours 48 minutes');
		expect(ms(24 * 60 * 60 * 10000, { long: true })).toBe('10 days');

		expect(ms(-1 * 24 * 60 * 60 * 1000, { long: true })).toBe('-1 day');
		expect(ms(-1 * 24 * 60 * 60 * 1200, { long: true })).toBe('-1 day 4 hours 48 minutes');
		expect(ms(-1 * 24 * 60 * 60 * 10000, { long: true })).toBe('-10 days');

		expect(ms(24 * 60 * 60 * 1000)).toBe('1d');
		expect(ms(24 * 60 * 60 * 10000)).toBe('10d');

		expect(ms(-1 * 24 * 60 * 60 * 1000)).toBe('-1d');
		expect(ms(-1 * 24 * 60 * 60 * 10000)).toBe('-10d');
	});
});

describe('parse', () => {
	it('should not throw an error', () => {
		expect(() => {
			ms('1m');
		}).toNotThrowError();

		expect(() => {
			ms('53 milliseconds');
		}).toNotThrowError();
	});

	it('should be case-insensitive', () => {
		expect(ms('1.5H')).toBe(5400000);
		expect(ms('20 mIlLiSeCoNdS')).toBe(20);
	});

	it('should preserve ms', () => {
		expect(ms('100')).toBe(100);
		expect(ms('17 msecs')).toBe(17);
		expect(ms('53 milliseconds')).toBe(53);
		expect(ms('100ms')).toBe(100);
	});

	it('should convert secs to ms', () => {
		expect(ms('1s')).toBe(1000);
		expect(ms('1 sec')).toBe(1000);
	});

	it('should convert from mins to ms', () => {
		expect(ms('1m')).toBe(60000);
		expect(ms('1 min')).toBe(60000);
	});

	it('should convert from hours to ms', () => {
		expect(ms('1h')).toBe(3600000);
		expect(ms('1 hr')).toBe(3600000);
	});

	it('should convert days to ms', () => {
		expect(ms('2d')).toBe(172800000);
		expect(ms('2 days')).toBe(172800000);
	});

	it('should convert weeks to ms', () => {
		expect(ms('3w')).toBe(1814400000);
		expect(ms('3 weeks')).toBe(1814400000);
	});

	it('should work with decimals', () => {
		expect(ms('1.5h')).toBe(5400000);
	});

	it('should work with multiple spaces', () => {
		expect(ms('1   s')).toBe(1000);
	});

	it('should work with numbers starting with .', () => {
		expect(ms('.5ms')).toBe(0.5);
	});

	it('should work with negative integers', () => {
		expect(ms('-100ms')).toBe(-100);
		expect(ms('-100 milliseconds')).toBe(-100);
	});

	it('should work with negative decimals', () => {
		expect(ms('-1.5h')).toBe(-5400000);
		expect(ms('-10.5h')).toBe(-37800000);
		expect(ms('-1.5 hours')).toBe(-5400000);
		expect(ms('1.5 hours')).toBe(5400000);
	});

	it('should work with negative decimals starting with "."', () => {
		expect(ms('-.5h')).toBe(-1800000);
		expect(ms('-.5 hr')).toBe(-1800000);
	});

	const opts = {
		languages: ['en', 'es'],
	};

	it('should convert milliseconds,seconds to ms', () => {
		expect(ms('53 milisegundos 2 segundos', {
			languages: ['es'],
		})).toBe(2053);
	});

	it('should convert sec,min to ms', () => {
		expect(ms('1min,10 sec', opts)).toBe(70000);
	});

	it('should convert from min,secs to ms', () => {
		expect(ms('1 min 30 secs', opts)).toBe(90000);
	});

	it('should convert from hr,min to ms', () => {
		expect(ms('5.5 minutes, 1 hr', opts)).toBe(3930000);
	});

	it('should convert days,mins,hours to ms', () => {
		expect(ms('2 dias 5.5 min, 1 hr', opts)).toBe(176730000);
	});

	it('should work with decimals', () => {
		expect(ms('1.5 hours', opts)).toBe(5400000);
	});

	it('all', () => {
		expect(ms('5.5 minutes, 2 dias asdw 30 secs rqw-.5 horas', opts))
			.toBe(171360000);
	});
});

function expect(value){
	return {
		toBe(val){
			if(typeof value === 'function') value = value();
			if(val !== value) throw new Error(`expected ${value} to be equal to ${val}`);
		},
		toBeNaN(){
			if(typeof value === 'function') value = value();
			if(!isNaN(value)) throw new Error(`expected ${value} to be NaN`);
		},
		toNotThrowError(){
			try{
				value();
			}catch(e){
				throw Error('expected fn not to throw an exception');
			}
		},
		toThrowError(){
			try{
				value();
				throw Error('expected fn to throw an exception');
			}catch(e){}
		},
	};
}