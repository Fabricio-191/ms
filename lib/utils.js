const LANGUAGES = require('./languages.json');

const ALL_LANGUAGES = Object.keys(LANGUAGES);
function parseLanguages(languages = ALL_LANGUAGES){
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

const FORMATS = {
	Y: 'YEAR',
	Mo: 'MONTH',
	W: 'WEEK',
	D: 'DAY',
	H: 'HOUR',
	M: 'MINUTE',
	S: 'SECOND',
	Ms: 'MS',
};
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
	}else if(typeof options.format !== 'string'){
		throw Error("'format' should be a string");
	}else if(!VALID_FORMAT.test(options.format)){
		throw Error('invalid format');
	}

	options.format = options.format
		.match(FORMATS_REGEX)
		.map(key => FORMATS[key]);

	return options;
}

module.exports = {
	parseLanguages,
	parseFormatOptions,
	LANGUAGES,
};