/* eslint-disable no-invalid-this */
/* eslint-disable no-unused-vars */
// @ts-nocheck
/* eslint-env mocha */

const ms = require('../');
const { LANGUAGES } = require('../lib/utils.js');
const TIMES = {
	YEAR: 31557600000,
	MONTH: 2629800000,
	WEEK: 604800000,
	DAY: 86400000,
	HOUR: 3600000,
	MINUTE: 60000,
	SECOND: 1000,
	MS: 1,
};
const TIMES_KEYS = Object.keys(TIMES);

if(typeof global.it !== 'function'){
	// To avoid errors while running this file using "node tests.js"
	eval('function describe(){}'); // eslint-disable-line
}

describe('languages', () => {
	for(const lang in LANGUAGES){
		it(lang, () => {
			const language = LANGUAGES[lang];
			const keys = Object.keys(language); // ['YEAR', 'MONTH', ...]

			const missingKeys = TIMES_KEYS.filter(key => !keys.includes(key));
			if(missingKeys.length){
				throw new Error(`does not have [${missingKeys.join(', ')}] keys`);
			}

			keys.forEach((key, index) => {
				if(key !== TIMES_KEYS[index]){
					throw new Error('does not have keys sorted');
				}
				const notations = language[key];
				// { all: ['year', 'yr', 'y'], ...}

				if(!Array.isArray(notations.all)){
					throw new Error(`'${key}' does not have a all of notations`);
				}else if(!('singular' in notations)){
					throw new Error(`'${key}' does not have singular notation`);
				}else if(!('shortSingular' in notations)){
					throw new Error(`'${key}' does not have short notation`);
				}

				for(const k of ['singular', 'shortSingular', 'plural', 'shortPlural']){
					if(k in notations && !notations.all.includes(notations[k])){
						throw new Error(`${notations[k]} notation is not in notations all in '${key}'`);
					}
				}

				const sortedNotations = Array.from(notations.all).sort((a, b) => b.length - a.length);

				if(JSON.stringify(sortedNotations) !== JSON.stringify(notations.all)){
					throw new Error(`Some notations in key '${key}' are not sorted`);
				}

				const allNotations = [].concat(...Object.values(language).map(x => x.all));

				allNotations.forEach((notation, i) => {
					if(allNotations.includes(notation, i + 1)){
						throw new Error(`notation '${notation}' repeated`);
					}
				});
			});
		});
	}
});

const testBatch = generateTestBatch();

describe('parse', () => {
	it('should be case-insensitive', () => {
		expect(ms('1.5H')).toBe(5400000);
		expect(ms('20 mIlLiSeCoNdS')).toBe(20);
	});

	it('should preserve ms', () => {
		expect(ms('100')).toBe(100);
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

	function testNums(numsToTest){
		for(const lang in LANGUAGES){
			for(const key of TIMES_KEYS){
				for(const notation of LANGUAGES[lang][key].all){
					for(const num of numsToTest){
						expect(ms(num + ' '.repeat(Math.floor(Math.random() * 4)) + notation)).toBe(TIMES[key] * num);
					}
				}
			}
		}
	}

	it('should work with normal numbers', () => {
		testNums(['0', '1', '30', '45']);
	});

	it('should work with numbers with decimals', () => {
		testNums(['30.3', '2.1']);
	});

	it('should work with negative numbers', () => {
		testNums(['-100', '-1', '-1.5']);
	});

	it('should work with numbers starting with .', () => {
		testNums(['.5', '-.5']);
	});

	it('README.md examples should work', () => {
		expect(ms('2 days 1 hour')).toBe(176400000);
		expect(ms('1 week 2 day')).toBe(777600000);
		expect(ms('1d')).toBe(86400000);
		expect(ms('10h')).toBe(36000000);
		expect(ms('2.5 hrs')).toBe(9000000);
		expect(ms('2h')).toBe(7200000);
		expect(ms('1y')).toBe(31557600000);
		expect(ms('100')).toBe(100);
		expect(ms('-3 days')).toBe(-259200000);
		expect(ms('.5m')).toBe(30000);
		expect(ms('-.5 mins')).toBe(-30000);
		expect(ms('0 seconds')).toBe(0);
		expect(ms('1m10secs')).toBe(70000);
		expect(ms('5s50ms')).toBe(5050);
		expect(ms('1 dia', 'es')).toBe(86400000);
		expect(ms('12 seconds', ['en', 'es'])).toBe(12000);
		expect(ms('-3 minutos', ['en', 'es'])).toBe(-180000);
		expect(ms('2 minutes 15 seconds', 'all')).toBe(135000);
		expect(ms('2 minutos 15 segundos', 'all')).toBe(135000);
		expect(ms('2.5 horas 30 minutes', 'all')).toBe(10800000);
		expect(ms('5.5 minute, 2 days asdw 30s rqw -.5hour')).toBe(171360000);
	});

	it('should work with random generated strings\n\tusing notations from each language', function(){
		this.slow(200);
		for(const lang in LANGUAGES){
			for(let i = 0; i < 1000; i++){
				const keys = [];
				const nums = [];
				let result = 0;

				while(keys.length === 0){
					for(const key of TIMES_KEYS){
						if(Math.random() > 0.3) continue;
						keys.push(key);

						const num = Math.random() < 0.5 ?
							Math.floor(Math.random() * 1000) :
							parseFloat((Math.random() * 1000).toFixed(1));

						result += num * TIMES[key];
						nums.push(num);
					}
				}

				const str = keys.map((key, index) =>
					nums[index].toString() + (Math.random() > 0.5 ? '' : ' ') + random(LANGUAGES[lang][key].all)
				).join('');

				expect(ms(str)).toBe(result);
			}
		}
	});

	it('undesirable expected behavior (to fix)', () => {
		expect(ms('2,1 secs')).toBe(1000);
		expect(ms('300,000 ms')).toBe(0);
		expect(ms('3,000,000')).toBe(null);
		expect(ms('3.000.000')).toBe(null);
		expect(ms('3.000.000,6')).toBe(null);
		expect(ms('-1hr 1hr')).toBe(0);
	});

	it('should work with the test-batch', () => {
		for(const { num, opts, formatted } of testBatch){
			expect(ms(formatted, 'all')).toBe(num);
		}
	});
});

describe('format', () => {
	it('should work with the test-batch', () => {
		for(const { num, opts, formatted } of testBatch){
			expect(ms(num, opts)).toBe(formatted);
		}
	});

	it('README.md examples should work', () => {
		const num = 1412440000;

		expect(ms(num)).toBe('16d 8h 20m');
		expect(ms(num, { length: 2 })).toBe('16d 8h');
		expect(ms(num, { length: 5 })).toBe('16d 8h 20m 40s');
		expect(ms(num, { long: true })).toBe('16 days 8 hours 20 minutes');
		expect(ms(num, { long: true, language: 'es' })).toBe('16 dias 8 horas 20 minutos');
		expect(ms(num)).toBe('16d 8h 20m');
		expect(ms(num, { format: 'HS' })).toBe('392h 1240s');
		expect(ms(4100940000, { format: 'WDHM', length: 2 })).toBe('6w 5d');
		expect(ms(4100940000, { format: 'WDHM', length: 8 })).toBe('6w 5d 11h 9m');
	});
});

describe('others', () => {
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

function random(arr){
	return arr[Math.floor(Math.random() * arr.length)];
}

function generateTestBatch(){
	const LANGS = Object.keys(LANGUAGES);
	const FORMAT_TIMES = {
		Y: 31557600000,
		Mo: 2629800000,
		W: 604800000,
		D: 86400000,
		H: 3600000,
		M: 60000,
		S: 1000,
		Ms: 1,
	};
	const FORMAT_KEYS = Object.keys(FORMAT_TIMES);
	const MAXS = {
		Y: 100,
		Mo: 12,
		W: 4,
		D: 7,
		H: 24,
		M: 60,
		S: 60,
		Ms: 1000,
	};

	const batch = [];

	for(let i = 0; i < 1000; i++){
		const format = [];
		while(format.length === 0){
			for(const key of FORMAT_KEYS){
				if(Math.random() < 0.3) format.push(key);
			}
		}

		const opts = {
			language: random(LANGS),
			long: Math.random() > 0.5,
			format: format.join(''),
			length: Math.floor(Math.random() * 8) + 1,
		};

		let num = 0;

		for(let y = 0; y < opts.length && y < format.length; y++){
			const key = format[y];
			num += FORMAT_TIMES[format[y]] * Math.floor(Math.random() * MAXS[key]);
		}

		batch.push({
			num,
			opts,
			formatted: ms(num, opts),
		});
	}

	return batch;
}