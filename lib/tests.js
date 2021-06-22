// @ts-nocheck
/* eslint-env mocha */
const constantsPath = '../lib/constants.js';
const KEYS = [
	'YEAR', 'MONTH', 'WEEK', 'DAY',
	'HOUR', 'MINUTE', 'SECOND', 'MS',
];

const ms = require('../');

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

	it('should work with negative numbers', () => {
		expect(ms('-100ms')).toBe(-100);
		expect(ms('-100 milliseconds')).toBe(-100);
		expect(ms('-1.5h')).toBe(-5400000);
		expect(ms('-10.5h')).toBe(-37800000);
		expect(ms('-1.5 hours')).toBe(-5400000);
		expect(ms('1.5 hours')).toBe(5400000);
	});

	it('should work with numbers starting with .', () => {
		expect(ms('.5ms')).toBe(0.5);
		expect(ms('-.5h')).toBe(-1800000);
		expect(ms('-.5 hr')).toBe(-1800000);
	});

	it('should work with only 3 or less spaces', () => {
		expect(ms('1s')).toBe(1000);
		expect(ms('1 s')).toBe(1000);
		expect(ms('1  s')).toBe(1000);
		expect(ms('1   s')).toBe(1000);
		expect(ms('1    s')).toBe(null);
		expect(ms('1\ts')).toBe(null);
		expect(ms('1\ns')).toBe(null);
	});

	const langs = ['en', 'es'];

	it('should work', () => {
		expect(ms('53 milisegundos 2 segundos', 'es')).toBe(2053);
		expect(ms('1min,10 sec', langs)).toBe(70000);
		expect(ms('1 min 30 secs', langs)).toBe(90000);
		expect(ms('5.5 minutes, 1 hr', langs)).toBe(3930000);
		expect(ms('2 dias 5.5 min, 1 hr', langs)).toBe(176730000);
		expect(ms('1.5 hours', langs)).toBe(5400000);
		expect(ms('5.5 minutes, 2 dias asdw 30 secs rqw-.5 horas', langs)).toBe(171360000);
	});

	it('undesirable expected behavior (to fix)', () => {
		expect(ms('2,1 secs')).toBe(1000);
		expect(ms('300,000 ms')).toBe(0);
		expect(ms('3,000,000')).toBe(null);
		expect(ms('3.000.000')).toBe(null);
		expect(ms('3.000.000,6')).toBe(null);
		expect(ms('-1hr 1hr')).toBe(0);
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
		const num = 86400000;

		expect(ms(num)).toBe('1d');
		expect(ms(num * 10)).toBe('10d');
		expect(ms(-num)).toBe('-1d');
		expect(ms(-num * 10)).toBe('-10d');

		expect(ms(num, { long: true })).toBe('1 day');
		expect(ms(num * 1.2, { long: true })).toBe('1 day 4 hours 48 minutes');
		expect(ms(num * 10, { long: true })).toBe('10 days');

		expect(ms(-num, { long: true })).toBe('-1 day');
		expect(ms(-num * 1.2, { long: true })).toBe('-1 day 4 hours 48 minutes');
		expect(ms(-num * 10, { long: true })).toBe('-10 days');
	});

	it('formats', () => {
		expect(ms(1244122144, { format: 'WDHM' })).toBe('2w 9h 35m');
		expect(ms(1244122144, { format: 'DHM' })).toBe('14d 9h 35m');
		expect(ms(1244122144, { format: 'WDHM', long: true })).toBe('2 weeks 9 hours 35 minutes');
		expect(ms(1244122144, { format: 'WDHM', long: true, length: 1 })).toBe('2 weeks');
		expect(ms(1244122312344, { long: true, length: 8 })).toBe(
			'39 years 5 months 2 days 15 hours 1 minute 52 seconds 344 milliseconds'
		);
	});
});

describe('others', () => {
	// these rules may change when adding more languages
	delete require.cache[require.resolve(constantsPath)];
	const { LANGUAGES } = require(constantsPath);

	it('languages should have all keys', () => {
		for(const lang of Object.keys(LANGUAGES)){
			const keys = Object.keys(LANGUAGES[lang]);
			if(
				keys.length !== KEYS.length ||
				keys.some(key => !KEYS.includes(key))
			){
				throw new Error(`language '${lang}' does not have all keys`);
			}
		}
	});

	it('languages keys should be sorted', () => {
		for(const lang of Object.keys(LANGUAGES)){
			Object.keys(LANGUAGES[lang]).forEach((key, index) => {
				if(key !== KEYS[index]){
					throw new Error(`language '${lang}' does not have all keys sorted`);
				}
			});
		}
	});

	it('notations of all languages should be sorted', () => {
		for(const lang of Object.keys(LANGUAGES)){
			const language = LANGUAGES[lang];

			for(const key of Object.keys(language)){
				if(!notationsAreSorted(language[key])){
					throw new Error(`Some notations in '${lang}', in key '${key}' are not sorted`);
				}
			}
		}
	});

	it('notations should not repeat in the same language', () => {
		for(const lang of Object.keys(LANGUAGES)){
			const language = LANGUAGES[lang];

			const allNotations = Object.values(language)
				.reduce((acc, notations) => [...acc, ...notations], []);

			allNotations.forEach((notation, index) => {
				if(allNotations.includes(notation, index + 1)){
					throw new Error(`notation '${notation}' repeated in '${lang}'`);
				}
			});
		}
	});

	it('should return null, if input is invalid', () => {
		const values = [
			// eslint-disable-next-line no-undefined
			'', undefined, null, [], {},
			NaN, Infinity, -Infinity,
			'absda', '☃', '10-.5', '123nothing', '12 minutesabc',
		];

		for(const value of values){
			expect(ms(value)).toBe(null);
		}
	});
});

function expect(value){
	return {
		toBe(val){
			if(typeof value === 'function') value = value();
			if(val !== value) throw new Error(`expected ${value} to be equal to ${val}`);
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
			}catch(e){
				return;
			}

			throw Error('expected fn to throw an exception');
		},
	};
}

function notationsAreSorted(notations){
	const sorted = notations.sort((a, b) => b.length - a.length);

	return JSON.stringify(notations) === JSON.stringify(sorted);
}