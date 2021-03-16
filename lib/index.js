const LANGUAGES = require('./languages.json');
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
const KEYS = Object.keys(TIMES);

function parseOptions(options = {}){
	if(typeof options !== 'object') throw Error('Options should be an object');

	if(options.language){
		if(options.languages){
			throw new Error("You cannot specify a 'language' and 'languages' at the same time 😕");
		}

		options.languages = [options.language];
		delete options.language;
	}

	options = Object.assign({
		languages: ['en'],
		useWeeks: false,
		long: false,
		quantity: 3,
	}, options);

	if(typeof options.useWeeks !== 'boolean'){
		throw Error("'useWeeks' should be a boolean");
	}else if(typeof options.long !== 'boolean'){
		throw Error("'long' should be a boolean");
	}else if(!Array.isArray(options.languages)){
		throw Error("'languages' should be an array");
	}

	for(const lang of options.languages){
		if(!LANGUAGES[lang]) throw Error(`Invalid language '${lang}'`);
	}

	return options;
}

function createRegex(language){
	const allNotations = Object.values(language)
		.reduce((acc, notations) => [...acc, ...notations], [])
		.sort((a, b) => b.length - a.length)
		.join('|');

	return RegExp(`([+-]?[\\d]*[.]?[\\d]+)\\s*(${allNotations})(?![a-z])`, 'gim');
}

module.exports = function(value, options){
	const type = typeof value;

	options = parseOptions(options);

	if(type === 'string' && value !== ''){
		return parse(value, options);
	}else if(type === 'number' && Number.isFinite(value)){
		return format(value, options);
	}
	throw new Error('The value should be a non-empty string or a number.');
};

function parse(str, options){
	str = str.toLowerCase();
	let value = 0;

	const matches = {};

	for(const lang of options.languages){
		const language = LANGUAGES[lang];
		if(!language.REGEX) language.REGEX = createRegex(language);

		for(const match of str.matchAll(language.REGEX)){
			match.lang = language;
			matches[match[0]] = match;
		}
	}

	for(const { 1: num, 2: type, lang } of Object.values(matches)){
		for(const key of KEYS){
			if(lang[key].includes(type)){
				value += parseFloat(num) * TIMES[key];
				break;
			}
		}
	}

	if(value === 0) return Number(str);

	return value;
}

function format(miliseconds, options){
	let str = miliseconds < 0 ? '-' : '';
	miliseconds = Math.abs(miliseconds);

	if(options.languages.length > 1) throw new Error('There can only be one language when formatting');
	const language = LANGUAGES[options.languages[0]];

	const keys = [
		'YEAR', options.useWeeks ? 'WEEK' : 'MONTH',
		'DAY', 'HOUR', 'MINUTE', 'SECOND', 'MS',
	];

	for(const key of keys){
		if(options.quantity === 0) break;
		if(miliseconds < TIMES[key]) continue;

		const value = Math.floor(miliseconds / TIMES[key]);
		miliseconds -= value * TIMES[key];
		str += value;

		const notations = language[key];
		if(options.long){
			str += ' ';
			if(value === 1){
				str += notations[1];
			}else{
				str += notations[0];
			}
		}else{
			str += notations[notations.length -1];
		}

		options.quantity--;
		str += ' ';
	}

	return str.trim();
}