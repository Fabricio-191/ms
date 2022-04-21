// @ts-ignore
const { TIMES, LANGUAGES } = require('../');
const LANGS = Object.keys(LANGUAGES);

// #region format args
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

function createFormatArgs(opts = {}){
	const format = [];

	while(format.length === 0){
		for(const key in TIMES){
			if(random(1, 1) < 0.3) format.push(key);
		}
	}

	const length = opts.length || random(8) + 1;

	let num = 0;
	for(let y = 0; y < length && y < format.length; y++){
		num += random(MAXS[format[y]]) * TIMES[format[y]];
	}

	const options = Object.assign({
		language: random(LANGS),
		long: random(true),
		format: format.join(''),
		length,
	}, opts);

	return { num, options };
}
// #endregion

// #region clock args
const separators = ['-', ':'];
const formats = [
	'hhsepmmsepss.sss',
	'hhsepmmsepss',
	'hhsepmm.mmm',
	'hhsepmm',
	'mmsepss.sss',
	'mmsepss',
];

function createClockArgs(){
	let result = 0;
	let format = random(formats)
		.replace(/sep/g, random(separators));

	const n = (max, digits, key, val) => {
		if(!format.includes(key)) return;

		let num = random(max).toString();

		// padStart polyfill
		while(num.length !== digits){
			num = '0' + num;
		}

		format = format.replace(key, num);
		result += parseFloat(num) * val;
	};

	const minutes = format.includes('ss') && !format.includes('hh');

	n(24, 2, 'hh', 3600000);
	n(1000, 3, 'mmm', 60);
	n(1000, 3, 'sss', 1);
	n(60, 2, 'mm', 60000);
	n(60, 2, 'ss', 1000);

	return { args: [format, minutes], result };
}
// #endregion

module.exports = {
	createFormatArgs,
	createClockArgs,
	expect, random,
	LANGUAGES, TIMES,
	initializeBench,
};

const assert = require('assert');
function expect(value, expectedValue){
	if(typeof expectedValue === 'number' && typeof value === 'number'){
		if(Math.abs(expectedValue - value) < 1) return;
	}

	assert.strictEqual(value, expectedValue);
}

function random(thing, fixed = 0){
	if(Array.isArray(thing)){
		return thing[Math.floor(Math.random() * thing.length)]; // random array element
	}
	if(typeof thing === 'object'){
		return random(Object.keys(thing)); // random key of the object
	}
	if(thing === true){
		return Math.random() > 0.5; // true or false
	}
	if(fixed !== 0){
		return parseFloat((Math.random() * thing).toFixed(fixed)); // 0 to thing (float)
	}
	return Math.floor(Math.random() * thing); // 0 to thing-1
}

function initializeBench(){
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