/* eslint-disable no-useless-concat */
/* eslint-disable no-undefined */
const {
	LANGUAGES, TIMES,
	NEGATIVE_REGEX,
} = require('./utils.js');

for(const lang in LANGUAGES) prepareLanguage(LANGUAGES[lang]);
function prepareLanguage(language){
	const allNotations = Object.values(language)
		.flatMap(notations => notations.all)
		.join('|');

	language.REGEX = RegExp(`(\\d*\\.?\\d+) {0,3}(${allNotations})(?![a-z])`, 'g');
}

function checkLanguage(language){
	if(typeof language !== 'object') throw new Error('language must be an object');
	if(language === null) throw new Error('language must not be null');
	if(Array.isArray(language)) throw new Error('language must not be an array');

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

		const allNotations = Object.values(language).flatMap(x => x.all);

		allNotations.forEach((notation, i) => {
			if(allNotations.includes(notation, i + 1)){
				throw new Error(`notation '${notation}' repeated`);
			}
		});
	}
}

exports.parse24Hours = parse24Hours;
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

const REGEX = RegExp(
	'T?' + '(\\d\\d)' +
	'(?:' +
		'(?<sep>\\.|,|-|:| |)' +
		'(\\d\\d(?:\\.\\d+)?)' +
	')?' +
	'(?:' +
		'\\k<sep>' +
		'(\\d\\d(?:\\.\\d+)?)' +
	')?' +
	'( PM)?', 'i'

);

function parse24Hours(str, minutes = false){
	const match = str.match(REGEX);
	if(match === null) return;
	let value = 0;

	if(minutes && !match[4]){
		if(match[1]) value += parseInt(match[1]) * TIMES.M;
		if(match[3]) value += parseFloat(match[3]) * TIMES.S;
	}else{
		if(match[1]) value += parseInt(match[1]) * TIMES.H;
		if(match[3]) value += parseInt(match[3]) * TIMES.M;
		if(match[4]) value += parseFloat(match[4]) * TIMES.S;
	}

	if(match[5]) value += TIMES.H * 12;

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

// https://docs.oracle.com/cd/E41183_01/DR/Time_Formats.html
// https://www.gnu.org/software/pspp/manual/html_node/Time-and-Date-Formats.html
// https://en.wikipedia.org/wiki/ISO_8601
// https://en.wikipedia.org/wiki/24-hour_clock