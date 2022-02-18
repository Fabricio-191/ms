const LANGUAGES = require('../lib/languages.json');
const LANGS = Object.keys(LANGUAGES);
const TIMES = {
	Y:  1000 * 60 * 60 * 24 * 365.25, // .2425
	Mo: 1000 * 60 * 60 * 24 * 30, // .4167
	W:  1000 * 60 * 60 * 24 * 7,
	D:  1000 * 60 * 60 * 24,
	H:  1000 * 60 * 60,
	M:  1000 * 60,
	S:  1000,
	Ms: 1,
};
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

module.exports = {
	createFormatArgs,
	createClockArgs,
	expect, random,
	LANGUAGES, TIMES,
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

		const num = random(max)
			.toString()
			.padStart(digits, '0');

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