/* eslint-disable no-useless-concat */
const {
	LANGUAGES, TIMES,
	NEGATIVE_REGEX,
} = require('./utils.js');

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
	// generating dictionary
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
exports.clock = parseClock;
exports.checkLanguage = checkLanguage;
exports.addLanguage = function addLanguage(name, language){
	if(typeof name !== 'string' || name === ''){
		throw new Error('Language name must be a non-empty string.');
	}else if(name in LANGUAGES){
		throw new Error(`language "${name}" already exists`);
	}

	checkLanguage(language);
	prepareLanguage(language);

	LANGUAGES[name] = language;
};

const REGEX1 = /(\d+):(?:(\d{2}):)?(\d{2}(?:\.\d+)?)( PM)?/;
const REGEX2 = /(\d+)-(?:(\d{2})-)?(\d{2}(?:\.\d+)?)( PM)?/;
function parseClock(str, minutes = false){
	const match = str.match(REGEX1) || str.match(REGEX2);
	if(match === null) return;
	let value = 0;

	if(match[2]){
		value +=
			parseInt(match[1]) * TIMES.H +
			parseInt(match[2]) * TIMES.M +
			parseFloat(match[3]) * TIMES.S;
	}else if(minutes){
		value += parseInt(match[1]) * TIMES.M;
		value += parseFloat(match[3]) * TIMES.S;
	}else{
		value += parseInt(match[1]) * TIMES.H;
		value += parseFloat(match[3]) * TIMES.M;
	}

	if(match[4]) value += TIMES.H * 12;

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

// https://docs.oracle.com/cd/E41183_01/DR/Time_Formats.html
// https://www.gnu.org/software/pspp/manual/html_node/Time-and-Date-Formats.html
// https://en.wikipedia.org/wiki/ISO_8601
// https://en.wikipedia.org/wiki/24-hour_clock
