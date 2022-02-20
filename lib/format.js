const {
	LANGUAGES, TIMES,
	parseFormatOptions,
} = require('./utils.js');

function getNotation(notations, long, singular){
	if(long){
		if(singular) return ' ' + notations.singular;

		return ' ' + (notations.plural || notations.singular);
	}
	if(singular) return notations.shortSingular;

	return notations.shortPlural || notations.shortSingular;
}

module.exports = function format(miliseconds, options){
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
};

module.exports.simple = function simpleFormat(miliseconds, long = false, lang = 'en'){
	if(miliseconds < 0){
		return '-' + simpleFormat(-miliseconds, long, lang);
	}
	if(!Number.isFinite(miliseconds)) return null;
	if(!(lang in LANGUAGES)){
		throw new Error('Language not found');
	}

	for(const key in TIMES){
		if(miliseconds >= TIMES[key]){
			const num = Math.round(miliseconds / TIMES[key]);
			return num + getNotation(LANGUAGES[lang][key], long, num === 1);
		}
	}
};