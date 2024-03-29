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

module.exports = {
	parseLanguages,
	parseFormatOptions,
	LANGUAGES,
	TIMES: {
		Y:  1000 * 60 * 60 * 24 * 365.25, // 365.2425
		Mo: 1000 * 60 * 60 * 24 * 30,
		W:  1000 * 60 * 60 * 24 * 7,
		D:  1000 * 60 * 60 * 24,
		H:  1000 * 60 * 60,
		M:  1000 * 60,
		S:  1000,
		Ms: 1,
	},
	NEGATIVE_REGEX: /^\s*-/,
};
