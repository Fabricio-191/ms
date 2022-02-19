const {
	LANGUAGES, TIMES,
	NEGATIVE_REGEX,
	parseLanguages,
	parseFormatOptions,
} = require('./utils.js');
const others = require('./others.js');

function parse(str, languages){
	const matches = [];
	let value = 0;

	for(const lang of languages){
		const language = LANGUAGES[lang];

		do{
			const match = language.REGEX.exec(str);
			if(match === null || matches.includes(match[0])) continue;
			matches.push(match[0]);

			value += parseFloat(match[1]) * language.dict[match[2]];
		}while(language.REGEX.lastIndex);

		// if(matches.length) break;
	}

	if(matches.length === 0){
		if(isNaN(str)) return null;

		return Number(str);
	}

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

function getNotation(notations, long, singular){
	if(long){
		if(singular) return ' ' + notations.singular;

		return ' ' + (notations.plural || notations.singular);
	}
	if(singular) return notations.shortSingular;

	return notations.shortPlural || notations.shortSingular;
}

function format(miliseconds, options){
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

const START_OF_DATE = parse('1970y 1mo', ['en']);
function ms(value, options){
	if(typeof value === 'string' && value !== ''){
		return parse(value.toLowerCase(), parseLanguages(options));
	}else if(Number.isFinite(value)){
		return format(value, parseFormatOptions(options));
	}else if(value instanceof Date){
		return format(
			value.getTime() + START_OF_DATE,
			parseFormatOptions(options)
		);
	}

	return null;
}

module.exports = ms;
module.exports.TIMES = TIMES;
module.exports.LANGUAGES = LANGUAGES;
Object.assign(module.exports, others);

// https://github.com/vercel/ms/issues
// https://github.com/Fabricio-191/ms
// https://github.com/Fabricio-191/youtube/blob/main/docs/list.md

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
// https://nodejs.org/api/assert.html

// https://github.com/vercel/ms/issues/59
// https://github.com/c0bra/text2num.js/blob/master/lib/text2num.js

// https://github.com/sindresorhus/pretty-ms
// https://github.com/Raul-Tech-Support/simple-duration-converter/blob/main/src/simple-duration.js
// https://github.com/KartikeSingh/ms-prettify

// Add popular languages (chinese/mandarin, hindi, french, arabic, russian, portuguese, turkish, korean)