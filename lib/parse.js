const {
	LANGUAGES, TIMES,
} = require('./utils.js');
const NEGATIVE_REGEX = /^\s*-/;

function parse(str, languages){
	if(typeof str !== 'string' || str === '') return null;
	languages = parseLanguages(languages);

	const matches = [];
	let value = 0;

	for(const lang of languages){
		const language = LANGUAGES[lang];

		do{
			const match = language.REGEX.exec(str);
			if(match === null || matches.includes(match[0])) continue;
			matches.push(match[0]);

			value += parseFloat(match[1]) * language.dict[match[2]];
		}while(language.REGEX.lastIndex);

		// if(matches.length) break;
	}

	if(matches.length === 0){
		// @ts-ignore
		if(isNaN(str)) return null;

		return Number(str);
	}

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

const REGEX1 = /(\d+):(?:(\d{2}):)?(\d{2}(?:\.\d+)?)( PM)?/;
const REGEX2 = /(\d+)-(?:(\d{2})-)?(\d{2}(?:\.\d+)?)( PM)?/;
function parseClock(str, minutes = false){
	const match = str.match(REGEX1) || str.match(REGEX2);
	if(match === null) return;
	let value = 0;

	if(match[2]){
		value += parseInt(match[1]) * TIMES.H +
				 parseInt(match[2]) * TIMES.M +
			   parseFloat(match[3]) * TIMES.S;
	}else if(minutes){
		value += parseInt(match[1]) * TIMES.M +
			   parseFloat(match[3]) * TIMES.S;
	}else{
		value += parseInt(match[1]) * TIMES.H +
			   parseFloat(match[3]) * TIMES.M;
	}

	if(match[4]) value += TIMES.H * 12;

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

module.exports = parse;
module.exports.clock = parseClock;

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