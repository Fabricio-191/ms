/* eslint-disable no-unused-expressions */
/* eslint-disable default-case */
// @ts-ignore
const { LANGUAGES, TIMES } = require('../../');
const { Suite } = require('benchmark');

function getNotation1(notations, long, singular){
	if(long){
		if(singular) return ' ' + notations.singular;

		return ' ' + (notations.plural || notations.singular);
	}
	if(singular) return notations.shortSingular;

	return notations.shortPlural || notations.shortSingular;
}

function simpleFormat1(miliseconds, long = false, lang = 'en'){
	if(!Number.isFinite(miliseconds)) return null;
	if(miliseconds < 0){
		return '-' + simpleFormat1(-miliseconds, long, lang);
	}
	if(!(lang in LANGUAGES)){
		throw new Error('Language not found');
	}

	for(const key in TIMES){
		if(miliseconds >= TIMES[key]){
			const num = Math.round(miliseconds / TIMES[key]);
			return num + getNotation1(LANGUAGES[lang][key], long, num === 1);
		}
	}
}

function getNotation2(notations, long, singular){
	if(long){
		if(singular) return ' ' + notations.singular;

		return ' ' + (notations.plural || notations.singular);
	}
	if(singular) return notations.shortSingular;

	return notations.shortPlural || notations.shortSingular;
}

function simpleFormat2(miliseconds, long = false, lang = 'en'){
	if(!Number.isFinite(miliseconds)) return null;
	if(miliseconds < 0){
		return '-' + simpleFormat1(-miliseconds, long, lang);
	}
	if(!(lang in LANGUAGES)){
		throw new Error('Language not found');
	}

	/*
	Hardcoding is 33% faster than:
	for(const key in TIMES){
		if(miliseconds >= TIMES[key]){
			const num = Math.round(miliseconds / TIMES[key]);
			return num + getNotation1(LANGUAGES[lang][key], long, num === 1);
		}
	}
	*/
	if(miliseconds >= TIMES.Y){
		const num = Math.round(miliseconds / TIMES.Y);
		return num + getNotation2(LANGUAGES[lang].Y, long, num === 1);
	}
	if(miliseconds >= TIMES.W){
		const num = Math.round(miliseconds / TIMES.W);
		return num + getNotation2(LANGUAGES[lang].W, long, num === 1);
	}
	if(miliseconds >= TIMES.Mo){
		const num = Math.round(miliseconds / TIMES.Mo);
		return num + getNotation2(LANGUAGES[lang].Mo, long, num === 1);
	}
	if(miliseconds >= TIMES.H){
		const num = Math.round(miliseconds / TIMES.H);
		return num + getNotation2(LANGUAGES[lang].H, long, num === 1);
	}
	if(miliseconds >= TIMES.M){
		const num = Math.round(miliseconds / TIMES.M);
		return num + getNotation2(LANGUAGES[lang].H, long, num === 1);
	}
	if(miliseconds >= TIMES.S){
		const num = Math.round(miliseconds / TIMES.S);
		return num + getNotation2(LANGUAGES[lang].S, long, num === 1);
	}
	if(miliseconds >= TIMES.Ms){
		const num = Math.round(miliseconds / TIMES.Ms);
		return num + getNotation2(LANGUAGES[lang].Ms, long, num === 1);
	}
}

function a(miliseconds){
	for(const key in TIMES){
		if(miliseconds >= TIMES[key]) return key;
	}
	return 'Ms';
}

function simpleFormat3(miliseconds, long = false, lang = 'en'){
	if(!Number.isFinite(miliseconds)) return null;
	if(miliseconds < 0){
		return '-' + simpleFormat1(-miliseconds, long, lang);
	}
	if(!(lang in LANGUAGES)){
		throw new Error('Language not found');
	}

	const key = a(miliseconds);
	const num = Math.round(miliseconds / TIMES[key]);
	return num + getNotation1(LANGUAGES[lang][key], long, num === 1);
}
const testBatch = [];

const TIMESV = Object.values(TIMES);
for(let i = 0; i < 50000; i++){
	const num = TIMESV[Math.floor(Math.random() * TIMESV.length)] * Math.round(Math.random() * 10);
	const result = simpleFormat1(num);

	testBatch.push({ num, result });
}

new Suite('')
	.add('1', () => {
		for(const { num } of testBatch){
			simpleFormat1(num);
		}
	})
	.add('3', () => {
		for(const { num } of testBatch){
			simpleFormat2(num);
		}
	})
	.add('2', () => {
		for(const { num } of testBatch){
			simpleFormat3(num);
		}
	})
	.on('start', initialize)
	.run();

function initialize(){
	console.log(this.name);

	this.on('error', event => {
		throw event.target.error;
	});
	this.on('complete', function(){
		const benchs = [];

		for(let i = 0; i < this.length; i++){
			benchs.push({
				name: this[i].name,
				hz: this[i].hz.toFixed(this[i].hz < 100 ? 2 : 0),
				runs: this[i].stats.sample.length,
				tolerance: this[i].stats.rme,
			});
		}

		function getPad(arr, key){
			return arr.reduce((acc, curr) => {
				if(curr[key].length > acc) return curr[key].length;
				return acc;
			}, 0);
		}

		const namePad = getPad(benchs, 'name');
		const hzPad = getPad(benchs, 'hz');

		for(const bench of benchs){
			console.log(
				bench.name.padEnd(namePad, ' ') +
						' x ' + bench.hz.padStart(hzPad, ' ') +
						' ops/sec \xb1' + bench.tolerance.toFixed(2) +
						'% (' + bench.runs + ' runs sampled)'
			);
		}
		console.log();
	});
}