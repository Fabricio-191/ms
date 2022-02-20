const LANGUAGES = require('./languages.json');
const TIMES = {
	Y:  1000 * 60 * 60 * 24 * 365.25, // 365.2425
	Mo: 1000 * 60 * 60 * 24 * 30,
	W:  1000 * 60 * 60 * 24 * 7,
	D:  1000 * 60 * 60 * 24,
	H:  1000 * 60 * 60,
	M:  1000 * 60,
	S:  1000,
	Ms: 1,
};

function prepareLanguage(language){
	const allNotations = [];

	for(const key in TIMES){
		allNotations.push(...language[key].all);
	}

	language.REGEX = RegExp(`(\\d*\\.?\\d+) {0,3}(${
		allNotations.join('|')
	})(?![${language.dialect || 'a-z'}])`, 'g');

	language.dict = {};
	for(const key in TIMES){
		for(const notation of language[key].all){
			language.dict[notation] = TIMES[key];
		}
	}
}

function checkLanguage(language){
	if(typeof language !== 'object') throw new Error('language must be an object');
	if(language === null) throw new Error('language must not be null');
	if(Array.isArray(language)) throw new Error('language must not be an array');

	const allNotations = [];
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

		allNotations.push(...notations.all);
	}

	for(let i = 0; i < allNotations.length; i++){
		if(allNotations.includes(allNotations[i], i + 1)){
			throw new Error(`notation '${allNotations[i]}' repeated`);
		}
	}
}

/*
const https = require('https');

function importLanguage(lang){
	return new Promise((res, rej) => {
		if(typeof lang !== 'string') rej(new Error('lang must be a string'));
		if(lang === '') rej(new Error('lang must not be empty'));

		https.get(
			`https://raw.githubusercontent.com/Fabricio-191/ms/master/languages/${lang}.json`,
			response => {
				if(response.statusCode !== 200){
					rej(new Error('language does not exist'));
					return;
				}

				const chunks = [];
				response.setEncoding('utf8');
				response.on('data', chunk => chunks.push(chunk));
				response.on('end', () => {
					try{
						const language = JSON.parse(
							Buffer.concat(chunks).toString()
						);
						addLanguage(lang, language);
						res();
					}catch(err){
						rej(err);
					}
				});
				response.on('error', rej);
			}
		);
	});
}
*/

function addLanguage(name, language){
	if(typeof name !== 'string' || name === ''){
		throw new Error('Language name must be a non-empty string.');
	}else if(name in LANGUAGES){
		throw new Error(`language "${name}" already exists`);
	}

	checkLanguage(language);
	prepareLanguage(language);

	LANGUAGES[name] = language;
}

const ALL_LANGUAGES = Object.keys(LANGUAGES);
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

// @ts-ignore
LANGUAGES.checkLanguage = checkLanguage;
// @ts-ignore
LANGUAGES.addLanguage = addLanguage;
module.exports = {
	parseLanguages,
	parseFormatOptions,
	LANGUAGES,
	TIMES,
	NEGATIVE_REGEX: /^\s*-/,
};
