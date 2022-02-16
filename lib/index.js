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
const TIMES_KEYS = Object.keys(TIMES);

const negativeRegex = /^\s*-/;
const hhmmssRegex = /(\d+):(?:(\d{2}):)?(\d{2}(?:.\d+)?)/;

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

		// if(matches.length !== 0) break;
	}

	if(matches.length === 0){
		if(!isNaN(str)) return Number(str);

		const match = str.match(hhmmssRegex);
		if(match === null) return null;

		// eslint-disable-next-line no-undefined
		if(match[2] === undefined){
			value =
				parseInt(match[1]) * TIMES.MINUTE +
			  parseFloat(match[3]) * TIMES.SECOND;
		}else{
			value =
			parseInt(match[1]) * TIMES.HOUR +
			parseInt(match[2]) * TIMES.MINUTE +
		  parseFloat(match[3]) * TIMES.SECOND;
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

function ms(value, options){
	if(typeof value === 'string' && value !== ''){
		return parse(value.toLowerCase(), parseLanguages(options));
	}else if(typeof value === 'number' && Number.isFinite(value)){
		return format(value, parseFormatOptions(options));
	}

	return null;
}

module.exports = ms;
module.exports.languages = LANGUAGES;
module.exports.checkLanguage = checkLanguage;
module.exports.addLanguage = function addLanguage(name, language){
	if(typeof name !== 'string' || name === ''){
		throw new Error('Language name must be a non-empty string.');
	}else if(name in LANGUAGES){
		throw new Error(`language "${name}" already exists`);
	}

	checkLanguage(language);
	addRegex(language);

	LANGUAGES[name] = language;
};

function checkLanguage(language){
	if(typeof language !== 'object') throw new Error('language must be an object');
	if(language === null) throw new Error('language must not be null');
	if(Array.isArray(language)) throw new Error('language must not be an array');

	const keys = Object.keys(language); // ['YEAR', 'MONTH', ...]

	const missingKeys = TIMES_KEYS.filter(key => !keys.includes(key));
	if(missingKeys.length){
		throw new Error(`does not have [${missingKeys.join(', ')}] keys`);
	}

	for(const key in TIMES){
		if(!(key in language)) throw new Error(`does not have "${key}" key`);
		if(typeof language[key] !== 'object') throw new Error(`"${key}" must be an object`);

		const notations = language[key];

		if(!('all' in notations)){
			throw new Error(`'${key}' does not have an 'all' property `);
		}else if(!Array.isArray(notations.all)){
			throw new Error(`'${key}', 'all' property is not an array`);
		}else if(!('singular' in notations)){
			throw new Error(`'${key}' does not have singular notation`);
		}else if(!('shortSingular' in notations)){
			throw new Error(`'${key}' does not have short singular notation`);
		}

		for(const k of ['singular', 'shortSingular', 'plural', 'shortPlural']){
			if(k in notations){
				if(!notations.all.includes(notations[k])){
					throw new Error(`${notations[k]} notation is not in notations all in '${key}'`);
				}else if(typeof notations[k] !== 'string'){
					throw new Error(`${k} notation is not a string in '${key}'`);
				}
			}
		}

		const allNotations = [].concat(...Object.values(language).map(x => x.all));

		allNotations.forEach((notation, i) => {
			if(allNotations.includes(notation, i + 1)){
				throw new Error(`notation '${notation}' repeated`);
			}
		});
	}
}