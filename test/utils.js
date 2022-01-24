const LANGUAGES = require('../lib/languages.json');
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
const LANGS = Object.keys(LANGUAGES);

function createFormatArgs(opts = {}){
	const format = [];

	while(format.length === 0){
		for(const key in FORMAT_TIMES){
			if(random(1, 1) < 0.3) format.push(key);
		}
	}

	const length = opts.length || random(8) + 1;

	let num = 0;
	for(let y = 0; y < length && y < format.length; y++){
		const key = format[y];
		num += random(MAXS[key]) * FORMAT_TIMES[key];
	}

	const options = Object.assign({
		language: random(LANGS),
		long: random(true),
		format: format.join(''),
		length,
	}, opts);

	return [num, options];
}

module.exports = {
	createFormatArgs,
	expect,
	random,
	LANGUAGES,
	TIMES,
	TIMES_KEYS: Object.keys(TIMES),
};

function expect(value){
	return {
		toBe(val){
			if(typeof value === 'function') value = value();
			if(typeof val === 'number' && typeof value === 'number'){
				// decimal comparision may fail some times cause precision loss
				// example: expected 17938716660384.098 to be equal to 17938716660384.1
				if(Math.abs(val - value) < 1) return;
			}
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