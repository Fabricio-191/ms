/* eslint-disable no-invalid-this */
// @ts-nocheck
/* eslint-env mocha */

const ms = require('../');
const _ms = require('ms');
const {
	createFormatArgs,
	expect,
	random,
	LANGUAGES,
	TIMES,
	TIMES_KEYS,
} = require('./utils.js');

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

			for(const key of keys){
				if(key === 'REGEX') continue;
				const notations = language[key];

				if(!('all' in notations)){
					throw new Error(`'${key}' does not have an 'all' property `);
				}else if(!Array.isArray(notations.all)){
					throw new Error(`'${key}', 'all' property is not an array`);
				}else if(!('singular' in notations)){
					throw new Error(`'${key}' does not have singular notation`);
				}else if(!('shortSingular' in notations)){
					throw new Error(`'${key}' does not have short singular notation`);
				}

				for(const k of ['singular', 'shortSingular', 'plural', 'shortPlural']){
					if(k in notations && !notations.all.includes(notations[k])){
						throw new Error(`${notations[k]} notation is not in notations all in '${key}'`);
					}
				}

				const allNotations = [].concat(...Object.values(language).map(x => x.all));

				allNotations.forEach((notation, i) => {
					if(allNotations.includes(notation, i + 1)){
						throw new Error(`notation '${notation}' repeated`);
					}
				});
			}
		});
	}
});

describe('parse', () => {
	it('should be case-insensitive', () => {
		expect(ms('1.5H')).toBe(5400000);
		expect(ms('20 mIlLiSeCoNdS')).toBe(20);
	});

	it('should preserve ms', () => {
		expect(ms('100')).toBe(100);
		expect(ms('-100')).toBe(-100);
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
						expect(
							ms(num + random(['', ' ']) + notation)
						).toBe(TIMES[key] * num);
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

	it('should work with mm:ss and hh:mm:ss', () => {
		for(let i = 0; i < 500; i++){
			const minutes = random(300);
			const seconds = random(60);

			expect(ms(
				minutes.toString().padStart(random(2) + 1, '0') +':' +
				seconds.toString().padStart(2, '0')
			)).toBe(minutes * TIMES.MINUTE + seconds * TIMES.SECOND);
		}

		for(let i = 0; i < 500; i++){
			const hours = random(300);
			const minutes = random(60);
			const seconds = random(60);

			expect(
				ms(
					hours + ':' +
					minutes.toString().padStart(2, '0') + ':' +
					seconds.toString().padStart(2, '0')
				)
			).toBe(hours * TIMES.HOUR + minutes * TIMES.MINUTE + seconds * TIMES.SECOND);
		}
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
		expect(ms('.5m')).toBe(30000);
		expect(ms('-3 days')).toBe(-259200000);
		expect(ms('-.5 mins')).toBe(-30000);
		expect(ms('- 2m 30s')).toBe(-150000);
		expect(ms('0 seconds')).toBe(0);
		expect(ms('1m10secs')).toBe(70000);
		expect(ms('5s50ms')).toBe(5050);

		expect(ms('1 day', 'es')).toBe(null);
		expect(ms('1 dia', 'es')).toBe(86400000);

		expect(ms('12 seconds', ['en', 'es'])).toBe(12000);
		expect(ms('-3 minutos', ['en', 'es'])).toBe(-180000);
		expect(ms('2 minutes 15 seconds', 'all')).toBe(135000);
		expect(ms('2 minutos 15 segundos', 'all')).toBe(135000);
		expect(ms('2.5 horas 30 minutes', 'all')).toBe(10800000);
	});

	it('should work using notations from each language', function(){
		// this is slow because the amount of Math.random() calls
		this.slow(200);
		for(const lang in LANGUAGES){
			for(let i = 0; i < 1000; i++){
				let str = '', result = 0;

				while(str.length === 0){
					for(const key of TIMES_KEYS){
						if(random(1, 1) > 0.3) continue;

						const num = random(true) ? random(1000) : random(1000, 1);

						result += num * TIMES[key];
						str += num.toString() + random(['', ' ']) + random(LANGUAGES[lang][key].all) + random(['', ' ']);
					}
				}

				expect(ms(str)).toBe(result);
			}
		}
	});

	it('should give the same result as vercel/ms', () => {
		for(let i = 0; i < 1000; i++){
			const [num, opts] = createFormatArgs({
				language: 'en',
				length: 1,
			});
			const formatted = ms(num, opts);
			// eslint-disable-next-line no-undefined
			if(_ms(formatted) === undefined){ i--; continue; }

			expect(_ms(formatted)).toBe(num);
			expect(ms(formatted)).toBe(num);
		}
	});
});

describe('format', () => {
	it('README.md examples should work', () => {
		const num = 1412440000;

		expect(ms(num)).toBe('16d 8h 20m');
		expect(ms(num, { length: 2 })).toBe('16d 8h');
		expect(ms(num, { length: 5 })).toBe('16d 8h 20m 40s');
		expect(ms(num, { long: true })).toBe('16 days 8 hours 20 minutes');
		expect(ms(num, { long: true, language: 'es' })).toBe('16 dias 8 horas 20 minutos');
		expect(ms(num, { format: 'HS' })).toBe('392h 1240s');
		expect(ms(4100940000, { format: 'WDHM', length: 2 })).toBe('6w 5d');
		expect(ms(4100940000, { format: 'WDHM', length: 8 })).toBe('6w 5d 11h 9m');
		expect(ms(10, { format: 'HS' })).toBe('0s');
		expect(ms(1412440000, { language: 'ja' })).toBe('16日 8時間 20分');
		expect(ms(1412440000, { long: true, language: 'ja' })).toBe('16 日 8 時間 20 分');
	});

	it('should work', () => {
		for(let i = 0; i < 1000; i++){
			const [num, opts] = createFormatArgs();
			const formatted = ms(num, opts);

			expect(ms(formatted)).toBe(num);
			// if formatted is correct, and parsing is working well, after parsing should be the same number
		}
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