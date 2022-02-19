// Same tests as mocha.js but without dependencies
// @ts-ignore
const ms = require('../');
const {
	createFormatArgs,
	createClockArgs,
	expect, random,
	LANGUAGES, TIMES,
} = require('./utils.js');

for(const lang in LANGUAGES){
	ms.checkLanguage(LANGUAGES[lang]);
}

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
expect(ms('1.5H'), 5400000);
expect(ms('20 mIlLiSeCoNdS'), 20);
expect(ms('100'), 100);
expect(ms('-100'), -100);
expect(ms('1s'), 1000);
expect(ms('1 s'), 1000);
expect(ms('1  s'), 1000);
expect(ms('1   s'), 1000);
expect(ms('1    s'), null);
expect(ms('1\ts'), null);
expect(ms('1\ns'), null);

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

testNums(['0', '1', '30', '45']);
testNums(['30.3', '2.1']);
testNums(['-100', '-1', '-1.5']);
testNums(['.5', '-.5']);

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

for(const lang in LANGUAGES){
	for(let i = 0; i < 1000; i++){
		const { str, result } = createString(lang);

		expect(ms(str, lang), result);
	}
}

for(let i = 0; i < 1000; i++){
	const { args, result } = createClockArgs();

	expect(ms.clock(...args), result);
}

const numa = ms('16 days 8 hours 20 mins 40 secs');

expect(ms(numa), '16d 8h 20m');
expect(ms(numa, { length: 2 }), '16d 8h');
expect(ms(numa, { length: 8 }), '16d 8h 20m 40s');
expect(ms(numa, { long: true }), '16 days 8 hours 20 minutes');
expect(ms(numa, { long: true, language: 'es' }), '16 dias 8 horas 20 minutos');
expect(ms(numa, { language: 'ja' }), '16日 8時間 20分');
expect(ms(numa, { format: 'HS' }), '392h 1240s');
expect(ms(4100940000, { format: 'WDHM', length: 2 }), '6w 5d');
expect(ms(4100940000, { format: 'WDHM', length: 8 }), '6w 5d 11h 9m');
expect(ms(10, { format: 'HS' }), '0s');

for(let i = 0; i < 1000; i++){
	const { num, options } = createFormatArgs();
	const formatted = ms(num, options);

	expect(ms(formatted, options.language), num);
	// if after parsing the formatted string is the same number, then format is working
}

const values = [
	// eslint-disable-next-line no-undefined
	'', undefined, null, [], {},
	NaN, Infinity, -Infinity,
	'absda', '☃', '10-.5', '123nothing', '12 minutesabc',
];

for(const value of values){
	expect(ms(value), null);
}