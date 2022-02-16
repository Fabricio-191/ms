const LANGUAGES = require('./languages.json');
const ALL_LANGUAGES = Object.keys(LANGUAGES);

function parseLanguages(languages = ['en']){
	if(typeof languages === 'string'){
		languages = languages === 'all' ? ALL_LANGUAGES : [languages];
	}else if(!Array.isArray(languages)){
		throw Error("'languages' should be an array or a string");
	}

	for(const lang of languages){
		if(typeof lang !== 'string') throw Error('All languages should be strings');
		if(!(lang in LANGUAGES)) throw Error(`Invalid language '${lang}'`);
	}

	return languages;
}

const FORMATS_REGEX = /Mo|Ms|Y|W|D|H|M|S/g;
const VALID_FORMAT = /^Y?(?:Mo)?W?D?H?M?S?(?:Ms)?$/;

function parseFormatOptions(options = {}){
	if(typeof options !== 'object') throw Error('Options should be an object');

	options = Object.assign({
		language: 'en',
		long: false,
		format: 'YMoDHMSMs',
		length: 3,
	}, options);

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

module.exports = {
	parseLanguages,
	parseFormatOptions,
	LANGUAGES,
	TIMES: {
		Y:  1000 * 60 * 60 * 24 * 365.25, // 365.2425
		Mo: 1000 * 60 * 60 * 24 * 30, // 30.4167
		W:  1000 * 60 * 60 * 24 * 7,
		D:  1000 * 60 * 60 * 24,
		H:  1000 * 60 * 60,
		M:  1000 * 60,
		S:  1000,
		Ms: 1,
	},
	NEGATIVE_REGEX: /^\s*-/,
};

/*
const regex = /(\d*\.?\d+) {0,3}([a-zA-Z])/g;
function parse(str, languages){
	const matches = [];
	let value = 0;

	do{
		matches.push(regex.exec(str));
	}while(regex.lastIndex);
	matches.pop();

	for(const lang of languages){
		const language = LANGUAGES[lang];

		for(const match of matches){
			if(match[2] in language) value +=
				parseFloat(match[1]) *
				  language[match[2]];
		}

		if(value !== 0) break;
	}

	if(value === 0){
		if(isNaN(str)) return null;

		return Number(str);
	}

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

function parse(str, languages){
	let value = 0;

	for(const lang of languages){
		const language = LANGUAGES[lang];

		do{
			const match = language.REGEX.exec(str);
			if(match === null) break;

			if(match[2][0] in language.firstLetter){
				value += parseFloat(match[1]) * TIMES[match[2][0]];
			}else for(const key in TIMES){
				if(language[key].all.includes(match[2])){
					value += parseFloat(match[1]) * TIMES[key];
					break;
				}
			}
		}while(language.REGEX.lastIndex);

		if(value !== 0) break;
	}

	if(value === 0){
		if(isNaN(str)) return null;

		return Number(str);
	}else if(NEGATIVE_REGEX.test(str)){
		return -value;
	}

	return value;
}
*/