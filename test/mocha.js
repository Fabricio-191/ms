/* eslint-env mocha */

// @ts-ignore
const ms = require('../');
const vercelMS = require('ms');
const {
	createFormatArgs,
	createClockArgs,
	expect, random,
	LANGUAGES, TIMES,
} = require('./utils.js');

describe('languages', () => {
	for(const lang in LANGUAGES){
		it(lang, () => ms.checkLanguage(LANGUAGES[lang]));
	}
});

describe('parse', () => {
	it('README.md examples should work', () => {
		expect(ms('2 hours, 5.5 minutes and .3s'), 7530300);
		expect(ms('1 week 2 days'), 777600000);
		expect(ms('2 days 1 hours'), 176400000);
		expect(ms('1d'), 86400000);
		expect(ms('10h'), 36000000);
		expect(ms('2.5 hrs'), 9000000);
		expect(ms('2h'), 7200000);
		expect(ms('1y'), 31557600000);
		expect(ms('100'), 100);
		expect(ms('.5m'), 30000);
		expect(ms('-3 days'), -259200000);
		expect(ms('-.5 mins'), -30000);
		expect(ms('- 2m 30s'), -150000);
		expect(ms('0 seconds'), 0);
		expect(ms('1m10secs'), 70000);
		expect(ms('5s50ms'), 5050);

		expect(ms('1 day', 'es'), null);
		expect(ms('1 dia', 'es'), 86400000);

		expect(ms('12 seconds', ['en', 'es']), 12000);
		expect(ms('-3 minutos', ['en', 'es']), -180000);
		expect(ms('2 minutes 15 seconds', 'all'), 135000);
		expect(ms('2 minutos 15 segundos', 'all'), 135000);
		expect(ms('2.5 horas 30 minutes', 'all'), 10800000);
	});

	it('should be case-insensitive', () => {
		expect(ms('1.5H'), 5400000);
		expect(ms('20 mIlLiSeCoNdS'), 20);
	});

	it('should preserve ms', () => {
		expect(ms('100'), 100);
		expect(ms('-100'), -100);
	});

	it('should work with only 3 or less spaces', () => {
		expect(ms('1s'), 1000);
		expect(ms('1 s'), 1000);
		expect(ms('1  s'), 1000);
		expect(ms('1   s'), 1000);
		expect(ms('1    s'), null);
		expect(ms('1\ts'), null);
		expect(ms('1\ns'), null);
	});

	function testNums(numsToTest){
		for(const lang in LANGUAGES){
			for(const key in TIMES){
				for(const notation of LANGUAGES[lang][key].all){
					for(const num of numsToTest){
						expect(
							ms(num + random(['', ' ']) + notation, lang),
							TIMES[key] * num
						);
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

	function createString(lang){
		let str = '', result = 0;

		while(str.length === 0){
			for(const key in TIMES){
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

				expect(ms(str, lang), result);
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

			expect(vercelMS(formatted), num);
			expect(ms(formatted), num);
		}
	});

	it('24-hour time notation', () => {
		for(let i = 0; i < 1000; i++){
			const { args, result } = createClockArgs();

			expect(ms.clock(...args), result);
		}
	});
});

describe('format', () => {
	it('README.md examples should work', () => {
		const num = ms('16 days 8 hours 20 mins 40 secs');

		expect(ms(num), '16d 8h 20m');
		expect(ms(num, { length: 2 }), '16d 8h');
		expect(ms(num, { length: 8 }), '16d 8h 20m 40s');
		expect(ms(num, { long: true }), '16 days 8 hours 20 minutes');
		expect(ms(num, { long: true, language: 'es' }), '16 dias 8 horas 20 minutos');
		expect(ms(num, { language: 'ja' }), '16日 8時間 20分');

		expect(ms(num, { format: 'HS' }), '392h 1240s');
		expect(ms(4100940000, { format: 'WDHM', length: 2 }), '6w 5d');
		expect(ms(4100940000, { format: 'WDHM', length: 8 }), '6w 5d 11h 9m');
		expect(ms(10, { format: 'HS' }), '0s');
	});

	it('should work', () => {
		for(let i = 0; i < 1000; i++){
			const { num, options } = createFormatArgs();
			const formatted = ms(num, options);

			expect(ms(formatted, options.language), num);
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
			expect(ms(value), null);
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

		expect(ms('2 hours, 5.5 minutes and .3s'), 7530300);
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

		expect(ms, all.default);
		expect(languages, all.languages);
		expect(addLanguage, all.addLanguage);
		expect(checkLanguage, all.checkLanguage);
		expect(ms('2 hours, 5.5 minutes and .3s'), 7530300);
		for(const lang in languages) checkLanguage(languages[lang]);`;

		execute('module', MJScode, [ '--experimental-specifier-resolution=node' ]);
	});
	*/
});