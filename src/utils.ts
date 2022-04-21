import { readFileSync } from 'fs';

export const LANGUAGES = JSON.parse(
	readFileSync(__dirname + './languages.json').toString()
);

export const TIMES = {
	Y:  1000 * 60 * 60 * 24 * 365.25, // 365.2425
	Mo: 1000 * 60 * 60 * 24 * 30,
	W:  1000 * 60 * 60 * 24 * 7,
	D:  1000 * 60 * 60 * 24,
	H:  1000 * 60 * 60,
	M:  1000 * 60,
	S:  1000,
	Ms: 1,
};

export interface Notations {
	all: string[];
	singular: string;
	shortSingular: string;
	plural?: string;
	shortPlural?: string;
}

export interface LANGUAGE {
	dialect?: string;
	dict?: {
		[key: string]: number;
	};
	REGEX?: RegExp;
	Y: Notations;
	Mo: Notations;
	W: Notations;
	D: Notations;
	H: Notations;
	M: Notations;
	S: Notations;
	Ms: Notations;
}

for(const lang in LANGUAGES) prepareLanguage(LANGUAGES[lang]);
function prepareLanguage(language: LANGUAGE){
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

export function checkLanguage(language: LANGUAGE){
	if(typeof language !== 'object') throw new Error('language must be an object');
	if(language === null) throw new Error('language must not be null');
	if(Array.isArray(language)) throw new Error('language must not be an array');

	const allNotations = [];
	for(const key in TIMES){
		if(!(key in language)) throw new Error(`does not have "${key}" key`);
		if(typeof language[key] !== 'object') throw new Error(`"${key}" must be an object`);

		const Notations = language[key];

		if(!('all' in Notations)){
			throw new Error(`'${key}' does not have an 'all' property `);
		}else if(!Array.isArray(Notations.all)){
			throw new Error(`'${key}', 'all' property is not an array`);
		}else if(!('singular' in Notations)){
			throw new Error(`'${key}' does not have singular notation`);
		}else if(!('shortSingular' in Notations)){
			throw new Error(`'${key}' does not have short singular notation`);
		}

		for(const k of ['singular', 'shortSingular', 'plural', 'shortPlural']){
			if(k in Notations){
				if(!Notations.all.includes(Notations[k])){
					throw new Error(`${Notations[k]} notation is not in Notations all in '${key}'`);
				}else if(typeof Notations[k] !== 'string'){
					throw new Error(`${k} notation is not a string in '${key}'`);
				}
			}
		}

		allNotations.push(...Notations.all);
	}

	for(let i = 0; i < allNotations.length; i++){
		if(allNotations.includes(allNotations[i], i + 1)){
			throw new Error(`notation '${allNotations[i]}' repeated`);
		}
	}
}

export function addLanguage(name: string, language: LANGUAGE){
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
		if(typeof lang !== 'string' || lang === '') rej(new Error('lang must be a non-empty string'));

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