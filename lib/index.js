const {
	LANGUAGES,
	addRegex,
	parseLanguages,
	parseFormatOptions,
} = require('./utils.js');

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

function parse(str, languages){
	const matches = [];
	let value = 0;

	for(const lang of languages){
		const language = LANGUAGES[lang];
		if(!('REGEX' in language)) addRegex(language);

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
	}

	if(matches.length === 0) return Number(str) || null;

	return value;
}

function format(miliseconds, options){
	let str = miliseconds < 0 ? '-' : '';
	miliseconds = Math.abs(miliseconds);

	const lang = LANGUAGES[options.language];

	for(const key of options.format){
		if(miliseconds < TIMES[key]) continue;

		const value = Math.floor(miliseconds / TIMES[key]);
		miliseconds -= value * TIMES[key];
		str += value;

		const notations = lang[key];
		if(options.long){
			if(value === 1 || !('plural' in notations)){
				str += ' ' + notations.singular;
			}else{
				str += ' ' + notations.plural;
			}
		}else if(value === 1 || !('shortPlural' in notations)){
			str += notations.shortSingular;
		}else{
			str += notations.shortPlural;
		}

		if(--options.length === 0) break;
		str += ' ';
	}

	if(str === ''){ // number is too small for the specified format
		const notations = lang[
			options.format[options.format.length - 1]
		];

		str += '0';

		if(options.long){
			str += ' ' + (notations.plural || notations.singular);
		}else{
			str += notations.shortSingular;
		}
	}

	return str.trim();
}

function ms(value, options){
	if(typeof value === 'string' && value !== ''){
		return parse(value.toLowerCase(), parseLanguages(options));
	}else if(typeof value === 'number' && Number.isFinite(value)){
		return format(value, parseFormatOptions(options));
	}

	return null;
}

module.exports = ms;