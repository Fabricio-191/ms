/* eslint-disable no-invalid-this */
/* eslint-env mocha */

// @ts-ignore
const ms = require('../');
const vercelMS = require('ms');
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
		it(lang, () => ms.checkLanguage(LANGUAGES[lang]));
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
							ms(num + random(['', ' ']) + notation, lang)
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

	function create(withHours = false){
		const minutes = random(withHours ? 60 : 300);
		const seconds = random(60);

		let result = minutes * TIMES.MINUTE + seconds * TIMES.SECOND;
		let str =
			minutes.toString() + ':' +
			seconds.toString().padStart(2, '0');

		if(withHours){
			const hours = random(300);

			str = hours + ':' + str.padStart(5, '0');

			result += hours * TIMES.HOUR;
		}

		return { str, result };
	}

	it('should work with mm:ss and hh:mm:ss', () => {
		for(let i = 0; i < 500; i++){ // mm:ss
			const { str, result } = create();

			expect(ms(str)).toBe(result);
		}

		for(let i = 0; i < 500; i++){ // hh:mm:ss
			const { str, result } = create(true);

			expect(ms(str)).toBe(result);
		}

		for(let i = 0; i < 100; i++){ // hh:mm:ss.sss  and  mm:ss.sss
			const { str, result } = create(random(true));
			const float = '.' + random(100).toString().padStart(random(4) + 1, '0');

			expect(ms(str + float)).toBe(
				result + parseFloat(float) * 1000
			);
		}
	});

	it('README.md examples should work', () => {
		expect(ms('2 hours, 5.5 minutes and .3s')).toBe(7530300);
		expect(ms('1 week 2 days')).toBe(777600000);
		expect(ms('2 days 1 hours')).toBe(176400000);
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

		expect(ms('2:09:00')).toBe(7740000);
		expect(ms('2:09:00.233')).toBe(7740233);
		expect(ms('3:10')).toBe(190000);
		expect(ms('3:10.7')).toBe(190700);

		expect(ms('1 day', 'es')).toBe(null);
		expect(ms('1 dia', 'es')).toBe(86400000);

		expect(ms('12 seconds', ['en', 'es'])).toBe(12000);
		expect(ms('-3 minutos', ['en', 'es'])).toBe(-180000);
		expect(ms('2 minutes 15 seconds', 'all')).toBe(135000);
		expect(ms('2 minutos 15 segundos', 'all')).toBe(135000);
		expect(ms('2.5 horas 30 minutes', 'all')).toBe(10800000);
	});

	function createString(lang){
		let str = '', result = 0;

		while(str.length === 0){
			for(const key of TIMES_KEYS){
				if(random(1, 1) > 0.3) continue;

				const num = random(true) ? random(1000) : random(1000, 1);

				result += num * TIMES[key];
				const a = random(true), b = random(true);

				str += num.toString();
				if(a) str += ' ';
				str += random(LANGUAGES[lang][key].all);
				if(b) str += ' ';
			}
		}

		return { str, result };
	}

	it('should work using notations from each language', function(){
		// this is slow because the amount of Math.random() calls
		this.slow(200);
		for(const lang in LANGUAGES){
			for(let i = 0; i < 1000; i++){
				const { str, result } = createString(lang);

				expect(ms(str, lang)).toBe(result);
			}
		}
	});

	it('should give the same result as vercel/ms', () => {
		let i = 0;
		for(; i < 1000; i++){
			const { num, options } = createFormatArgs({
				language: 'en',
				length: 1,
			});
			const formatted = ms(num, options);
			// eslint-disable-next-line no-undefined
			if(vercelMS(formatted) === undefined) continue;

			expect(vercelMS(formatted)).toBe(num);
			expect(ms(formatted)).toBe(num);
		}
	});
});

describe('format', () => {
	it('README.md examples should work', () => {
		const num = ms('16 days 8 hours 20 mins 40 secs');

		expect(ms(num)).toBe('16d 8h 20m');
		expect(ms(num, { length: 2 })).toBe('16d 8h');
		expect(ms(num, { length: 8 })).toBe('16d 8h 20m 40s');
		expect(ms(num, { long: true })).toBe('16 days 8 hours 20 minutes');
		expect(ms(num, { long: true, language: 'es' })).toBe('16 dias 8 horas 20 minutos');
		expect(ms(num, { language: 'ja' })).toBe('16日 8時間 20分');

		expect(ms(num, { format: 'HS' })).toBe('392h 1240s');
		expect(ms(4100940000, { format: 'WDHM', length: 2 })).toBe('6w 5d');
		expect(ms(4100940000, { format: 'WDHM', length: 8 })).toBe('6w 5d 11h 9m');
		expect(ms(10, { format: 'HS' })).toBe('0s');
	});

	it('should work', () => {
		for(let i = 0; i < 1000; i++){
			const { num, options } = createFormatArgs();
			const formatted = ms(num, options);

			expect(ms(formatted, options.language)).toBe(num);
			// if after parsing the formatted string is the same number, then format is working
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

	/*
	const { execSync } = require('child_process');

	const execute = (type, code, args = []) => {
		try{
			execSync(`node --input-type=${type} ${args.join(' ')} --eval "${
				code // makes the code a one-liner
					.split('\n')
					.filter(Boolean)
					.map(x => x.trim())
					.join(';')
			}"`, { stdio: 'inherit' });
		}catch(e){
			throw new Error(e.stderr.toString());
		}
	};

	it('should work as CJS module', function(){
		this.slow(250);

		const CJScode = `
		const { expect } = require('./test/utils.js');
		const ms = require('./');

		expect(ms('2 hours, 5.5 minutes and .3s')).toBe(7530300);
		for(const lang in ms.languages){
			ms.checkLanguage(ms.languages[lang]);
		}`;

		execute('commonjs', CJScode);
	});


	it('should work as MJS module', function(){
		this.slow(250);

		const MJScode = `
		import { expect } from './test/utils.js';

		import * as all from './';
		import ms, { languages, addLanguage, checkLanguage } from './';
		console.log(ms, { addLanguage, checkLanguage }, all)

		expect(ms).toBe(all.default);
		expect(languages).toBe(all.languages);
		expect(addLanguage).toBe(all.addLanguage);
		expect(checkLanguage).toBe(all.checkLanguage);
		expect(ms('2 hours, 5.5 minutes and .3s')).toBe(7530300);
		for(const lang in languages) checkLanguage(languages[lang]);`;

		execute('module', MJScode, [ '--experimental-specifier-resolution=node' ]);
	});
	*/
});