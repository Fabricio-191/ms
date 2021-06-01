const {
	LANGUAGES, ALL_LANGUAGES, TIMES, TIMES_KEYS,
	FORMATS, FORMATS_REGEX, DEFAULT_PARSE_OPTIONS,
} = require('./constants');

function parse(str, languages){
	const matches = [];
	let value = 0;

	for(const lang of languages){
		const language = LANGUAGES[lang];
		if(!language.REGEX) language.REGEX = createRegex(language);

		do{
			const match = language.REGEX.exec(str);

			if(match === null || matches.includes(match[0])) continue;
			matches.push(match[0]);

			for(const key of TIMES_KEYS){
				if(language[key].includes(match[2])){
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
		if(options.length === 0) break;
		if(miliseconds < TIMES[key]) continue;

		const value = Math.floor(miliseconds / TIMES[key]);
		str += value;
		miliseconds %= TIMES[key];

		const notations = lang[key]; // [longestPlural, longestSingular, ..., shortest]
		if(options.long){
			str += ' ' + notations[value === 1 ? 1 : 0];
		}else{
			str += notations[notations.length - 1];
		}

		options.length--;
		str += ' ';
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

// #region utils
function createRegex(language){
	const allNotations = [].concat(...Object.values(language)).join('|');

	return RegExp(`([+-]?[\\d]*[.]?[\\d]+) {0,3}(${allNotations})(?![a-z])`, 'gim');
}

function parseLanguages(languages = ALL_LANGUAGES){
	if(typeof languages === 'string'){
		languages = languages === 'all' ? ALL_LANGUAGES : [languages];
	}
	if(!Array.isArray(languages)){
		throw Error("'languages' should be an array or a string");
	}
	for(const lang of languages){
		if(typeof lang !== 'string') throw Error('All languages should be strings');
		if(!LANGUAGES[lang]) throw Error(`Invalid language '${lang}'`);
	}

	return languages;
}

function parseFormat(str){
	if(typeof str !== 'string'){
		throw Error("'format' should be a string");
	}
	const matches = str.match(FORMATS_REGEX);

	if(!matches) throw Error('invalid format');

	return matches.map((key, i) => {
		if(!FORMATS[key]){
			throw Error(`'${key}' is not a valid format key`);
		}else if(matches.indexOf(matches[i], i + 1) !== -1){ // repeated
			throw Error(`repeated key '${key}'`);
		}

		/*
		const indexes = matches.map(k => FORMATS_KEYS.indexOf(k));

		for(let j = 0; j < indexes.length - 1; j++){
			for(let k = j + 1; k < indexes.length; k++){
				if(indexes[j] < indexes[k]) continue;
				throw Error(
					`'${matches[j]}' (${FORMATS[matches[j]].toLowerCase()}) ` +
					'is lower than ' +
					`'${matches[k]}' (${FORMATS[matches[k]].toLowerCase()}) ` +
					`in format '${str}'`
				);
			}
		}
		*/

		return FORMATS[key];
	});
}

function parseFormatOptions(options = {}){
	if(typeof options !== 'object') throw Error('Options should be an object');

	options = Object.assign({}, DEFAULT_PARSE_OPTIONS, options);

	if(typeof options.long !== 'boolean'){
		throw Error("'long' should be a boolean");
	}else if(typeof options.length !== 'number' || options.length < 1 || options.length > 8){
		throw Error("'length' should be a number between 1 and 8");
	}else if(typeof options.language !== 'string'){
		throw Error("'language' should be a string");
	}else if(!LANGUAGES[options.language]){
		throw Error(`invalid language '${options.language}'`);
	}

	options.format = parseFormat(options.format);

	return options;
}
// #endregion
