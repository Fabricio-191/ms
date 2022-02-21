const { LANGUAGES, TIMES } = require('./utils.js');

function getNotation(notations, long, singular){
	if(long){
		if(singular) return ' ' + notations.singular;

		return ' ' + (notations.plural || notations.singular);
	}
	if(singular) return notations.shortSingular;

	return notations.shortPlural || notations.shortSingular;
}

function format(miliseconds, options){
	if(!Number.isFinite(miliseconds)) return null;
	options = parseFormatOptions(options);

	let str = '';
	if(miliseconds < 0){
		str += '- ';
		miliseconds = -miliseconds;
	}

	const lang = LANGUAGES[options.language];

	for(const key of options.format){
		const value = Math.floor(miliseconds / TIMES[key]);
		if(value === 0) continue;

		miliseconds -= value * TIMES[key];

		str += value + getNotation(lang[key], options.long, value === 1) + ' ';

		if(--options.length === 0) break;
	}

	if(str === '') return '0' + getNotation(
		lang[options.format[options.format.length - 1]],
		options.long, false
	);

	if(str[str.length - 1] === ' '){
		return str.slice(0, -1);
	}
	return str;
}

function simpleFormat(miliseconds, long = false, lang = 'en'){
	if(!Number.isFinite(miliseconds)) return null;
	if(miliseconds < 0){
		return '-' + simpleFormat(-miliseconds, long, lang);
	}
	if(!(lang in LANGUAGES)){
		throw new Error('Language not found');
	}

	for(const key in TIMES){
		if(miliseconds >= TIMES[key]){
			const num = Math.round(miliseconds / TIMES[key]);
			return num + getNotation(LANGUAGES[lang][key], long, num === 1);
		}
	}
}

module.exports = format;
module.exports.simple = simpleFormat;

const FORMATS_REGEX = /Mo|Ms|Y|W|D|H|M|S/g;
const VALID_FORMAT = /^Y?(?:Mo)?W?D?H?M?S?(?:Ms)?$/;
const DEFAULT_FORMAT_OPTS = {
	language: 'en',
	long: false,
	format: 'YMoDHMSMs',
	length: 3,
};

function parseFormatOptions(options = {}){
	if(typeof options !== 'object') throw Error('Options should be an object');

	options = Object.assign({}, DEFAULT_FORMAT_OPTS, options);

	if(typeof options.long !== 'boolean'){
		throw Error("'long' should be a boolean");
	}else if(typeof options.length !== 'number' || options.length < 1 || options.length > 8){
		throw Error("'length' should be a number between 1 and 8");
	}else if(typeof options.language !== 'string'){
		throw Error("'language' should be a string");
	}else if(!LANGUAGES[options.language]){
		throw Error(`invalid language '${options.language}'`);
	}else if(typeof options.format !== 'string' || options.format === ''){
		throw Error("'format' should be a non-empty string");
	}else if(!VALID_FORMAT.test(options.format)){
		throw Error('invalid format');
	}

	options.format = options.format.match(FORMATS_REGEX);

	return options;
}