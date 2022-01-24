const {
	LANGUAGES,
	parseLanguages,
	parseFormatOptions,
} = require('./utils.js');

for(const language of Object.values(LANGUAGES)){
	const allNotations = [].concat(
		...Object.values(language).map(notations => notations.all)
	).join('|');

	// @ts-ignore
	language.REGEX = RegExp(`(\\d*\\.?\\d+) {0,3}(${allNotations})(?![a-z])`, 'gm');
}

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

// https://github.com/vercel/ms/issues
// https://github.com/Fabricio-191/ms

const negativeRegex = /^\s*-/;
const hhmmssRegex = /(\d+):(?:(\d{2}):)?(\d{2})/;

function parse(str, languages){
	const matches = [];
	let value = 0;

	for(const lang of languages){
		const language = LANGUAGES[lang];

		do{
			const match = language.REGEX.exec(str);

			if(match === null || matches.includes(match[0])) continue;
			matches.push(match[0]);

			for(const key in TIMES){
				if(language[key].all.includes(match[2])){
					value += parseFloat(match[1]) * TIMES[key];
					break;
				}
			}
		}while(language.REGEX.lastIndex);
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/lastIndex

		// if(matches.length !== 0) break; // disables multi language parsing in the same string
	}

	if(matches.length === 0){
		if(!isNaN(str)) return Number(str);

		const match = str.match(hhmmssRegex);
		if(match === null) return null;

		// eslint-disable-next-line no-undefined
		if(match[2] === undefined){
			value =
				match[1] * TIMES.MINUTE +
				match[3] * TIMES.SECOND;
		}else{
			value =
				match[1] * TIMES.HOUR +
				match[2] * TIMES.MINUTE +
				match[3] * TIMES.SECOND;
		}
	}

	return negativeRegex.test(str) ? -value : value;
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
		if(miliseconds < TIMES[key]) continue;

		const value = Math.floor(miliseconds / TIMES[key]);
		miliseconds -= value * TIMES[key];

		str += value + getNotation(lang[key], options.long, value === 1);

		if(--options.length === 0) break;
		str += ' ';
	}

	if(str === ''){ // number is too small for the specified format
		const notations = lang[
			options.format[options.format.length - 1]
		];

		str += '0' + getNotation(notations, options.long, false);
	}

	return str.trimEnd();
}

module.exports = function ms(value, options){
	if(typeof value === 'string' && value !== ''){
		return parse(value.toLowerCase(), parseLanguages(options));
	}else if(typeof value === 'number' && Number.isFinite(value)){
		return format(value, parseFormatOptions(options));
	}

	return null;
};