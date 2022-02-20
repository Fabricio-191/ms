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

for(const lang in LANGUAGES) prepareLanguage(LANGUAGES[lang]);
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

// @ts-ignore
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

// @ts-ignore
LANGUAGES.checkLanguage = checkLanguage;
// @ts-ignore
LANGUAGES.addLanguage = addLanguage;
module.exports = { LANGUAGES, TIMES };