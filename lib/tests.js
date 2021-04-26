// @ts-nocheck
/* eslint-env mocha */
const KEYS = [
	'YEAR', 'MONTH', 'WEEK', 'DAY',
	'HOUR', 'MINUTE', 'SECOND', 'MS',
];

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

	it('languages should have all keys', () => {
		for(const lang of Object.keys(languages)){
			const keys = Object.keys(languages[lang]);

			if(
				keys.length !== KEYS.length ||
				keys.some(key => !KEYS.includes(key))
			){
				throw new Error(`language '${lang}' does not have all keys`);
			}
		}
	});

	it('languages keys should be sorted', () => {
		for(const lang of Object.keys(languages)){
			Object.keys(languages[lang]).forEach((key, index) => {
				if(key !== KEYS[index]){
					throw new Error(`language '${lang}' does not have all keys sorted`);
				}
			});
		}
	});

	// Notations:
	// The first should be the longest in plural
	// The second should be the longest but singular
	// the latest should be the shortest (without singular or plural)

	it('notations of all languages should be sorted', () => {
		for(const lang of Object.keys(languages)){
			const language = languages[lang];

			for(const key of Object.keys(language)){
				const notations = language[key];

				if(
					!objectCompare(notations, notations.sort((a, b) => b.length - a.length))
				) throw new Error(`Some notations in '${lang}', in key '${key}' are not sorted`);
			}
		}
	});

	it('notations should not repeat in the same language', () => {
		for(const lang of Object.keys(languages)){
			const language = languages[lang];

			const allNotations = Object.values(language)
				.reduce((acc, notations) => [...acc, ...notations], []);

			allNotations.forEach((notation, index) => {
				if(allNotations.includes(notation, index + 1)){
					throw new Error(`notation '${notation}' repeated in '${lang}'`);
				}
			});
		}
	});
});

describe('inputs', () => {
	it('should not throw an error', () => {
		expect(() => {
			ms('');
			ms();
			ms(null);
			ms('1m');
			ms('53 milliseconds');
			ms(500);
			ms(500, { long: true });
			ms(500, { long: true, useWeeks: true });
			ms(500, { long: false, useWeeks: true });
			ms(500, { long: true, useWeeks: true, length: 50 });
		}).toNotThrowError();
	});

	it('should return null, if input is invalid', () => {
		expect(ms('')).toBe(null);
		expect(ms()).toBe(null);
		expect(ms(null)).toBe(null);
		expect(ms([])).toBe(null);
		expect(ms({})).toBe(null);
		expect(ms(NaN)).toBe(null);
		expect(ms(Infinity)).toBe(null);
		expect(ms(-Infinity)).toBe(null);
		expect(ms('absda')).toBe(null);
		expect(ms('☃')).toBe(null);
		expect(ms('10-.5')).toBe(null);
		expect(ms('123nothing')).toBe(null);
		expect(ms('12 minutesabc')).toBe(null);
	});
});

describe('format', () => {
	it('seconds', () => {
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

	it('minutes', () => {
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

	it('hours', () => {
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

	it('days', () => {
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

	it("should support the 'useWeeks' option", () => {
		const num = 2629800000;

		expect(ms(num)).toBe('1mo');
		expect(ms(num, { long: true })).toBe('1 month');

		expect(ms(num, { useWeeks: true })).toBe('4w 2d 10h');
		expect(ms(num, { useWeeks: true, long: true })).toBe('4 weeks 2 days 10 hours');
	});

	it("should support the 'length' option", () => {
		const num = 2629800000;
		expect(() => ms(num, { length: 0 })).toThrowError();

		expect(ms(num, { length: 5 })).toBe('1mo');

		expect(ms(num, { useWeeks: true, length: 2 })).toBe('4w 2d');
		expect(ms(num, { useWeeks: true, long: true, length: 4 })).toBe('4 weeks 2 days 10 hours 30 minutes');
	});
});

describe('parse', () => {
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
		expect(ms('0s')).toBe(0);
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
		expect(ms('1	\ts')).toBe(1000);
		expect(ms('1\n\ns')).toBe(1000);
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
		expect(ms('5.5 minutes, 2 dias asdw 30 secs rqw-.5 horas', opts)).toBe(171360000);
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
			let threwError = true;
			try{
				value();
				threwError = false;
			}catch(e){}

			if(!threwError) throw Error('expected fn to throw an exception');
		},
	};
}

function objectCompare(obj1, obj2){
	return JSON.stringify(obj1) === JSON.stringify(obj2);
}