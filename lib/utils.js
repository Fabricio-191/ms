const LANGUAGES = require('./languages.json');

/*
Notes:

const LANGUAGES = {
	en: { // 'en' would be the language
		YEAR: { // 'YEAR' is a key of notations of 'year' in the language
			all: [ // these are all the diferents ways of saying year in the language (sorted from longest to short)
				'years',
				'year',
				'yrs',
				'yr',
				'y',
			],
			// these are the common ways for saying 'year' in the language
			plural: 'years', // (if this does not exists, the singular will be used)
			singular: 'year',
			singularShort: 'y',
		},
		// Languages keys (YEAR, MONTH, WEEK, DAY, HOUR, MINUTE, SECOND, MS) must be sorted
		MONTH: ...
	}
}
*/

// #region formats
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
const FORMATS_REGEX = RegExp(
	Object.keys(FORMATS)
		.sort((a, b) => b.length - a.length)
		.join('|'), 'g'
);

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
			throw Error(`repeated key '${key}' in format '${str}'`);
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
	}

	options.format = parseFormat(options.format);

	return options;
}
// #endregion

function addRegex(language){
	const allNotations = [].concat(
		...Object.values(language)
			.map(notations => notations.all)
	).join('|');

	language.REGEX = RegExp(`([+-]?[\\d]*[.]?[\\d]+) {0,3}(${allNotations})(?![a-z])`, 'gim');
}

const ALL_LANGUAGES = Object.keys(LANGUAGES);
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

module.exports = {
	addRegex,
	parseLanguages,
	parseFormatOptions,
	LANGUAGES,
};