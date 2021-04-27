const LANGUAGES = require('./languages.json');
const ALL_LANGUAGES = Object.keys(LANGUAGES);
const TIMES = {
	YEAR: 31557600000,
	MONTH: 2629800000,
	WEEK: 604800000,
	DAY: 86400000,
	HOUR: 3600000,
	MINUTE: 60000,
	SECOND: 1000,
	MS: 1,
};
const TIMES_KEYS = Object.keys(TIMES);
const numberREGEX = '([+-]?[\\d]*[.]?[\\d]+)';

function parse(str, options){
	str = str.toLowerCase();
	let value = 0;

	const matches = new Set();

	for(const lang of options.languages){
		const language = LANGUAGES[lang];
		if(!language.REGEX) language.REGEX = createRegex(language);
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/lastIndex

		do{
			const match = language.REGEX.exec(str);

			if(match === null || matches.has(match[0])) continue;
			matches.add(match[0]);

			for(const key of TIMES_KEYS){
				if(language[key].includes(match[2])){
					value += parseFloat(match[1]) * TIMES[key];
					break;
				}
			}
		}while(language.REGEX.lastIndex);
	}

	if(!Array.from(matches).length){
		return Number(str) || null;
	}

	return value;
}

function format(miliseconds, options){
	let str = miliseconds < 0 ? '-' : '';
	miliseconds = Math.abs(miliseconds);

	if(options.languages.length > 1) throw new Error('There can only be one language when formatting');
	const language = LANGUAGES[options.languages[0]];

	const keys = [
		'YEAR', options.useWeeks ? 'WEEK' : 'MONTH',
		'DAY', 'HOUR', 'MINUTE', 'SECOND', 'MS',
	];

	for(const key of keys){
		if(options.length === 0) break;
		if(miliseconds < TIMES[key]) continue;

		const value = Math.floor(miliseconds / TIMES[key]);
		miliseconds -= value * TIMES[key];
		str += value;

		const notations = language[key];
		if(options.long){
			str += ' ';
			if(value === 1){
				str += notations[1];
			}else{
				str += notations[0];
			}
		}else{
			str += notations[notations.length -1];
		}

		options.length--;
		str += ' ';
	}

	return str.trim();
}

module.exports = function(value, options){
	const type = typeof value;

	options = parseOptions(options);

	if(type === 'string' && value !== ''){
		return parse(value, options);
	}else if(type === 'number' && Number.isFinite(value)){
		return format(value, options);
	}

	return null;
};

function createRegex(language){
	const allNotations = Object.values(language)
		.reduce((acc, notations) => [...acc, ...notations], [])
		.join('|');

	return RegExp(`${numberREGEX}\\s*(${allNotations})(?![a-z])`, 'gim');
}

function parseOptions(options = {}){
	if(typeof options !== 'object') throw new Error('Options should be an object');

	if(options.language === 'all' || options.languages === 'all'){
		options.languages = ALL_LANGUAGES;
		delete options.language;
	}

	if(options.language){
		if(options.languages){
			throw new Error("You cannot specify a 'language' and 'languages' at the same time 😕");
		}

		options.languages = [options.language];
		delete options.language;
	}

	if(options.quantity){
		// eslint-disable-next-line no-console
		console.trace("DeprecationWarning: 'quantity' is deprecated, use 'length'");
		options.length = options.quantity;

		delete options.quantity;
	}

	options = Object.assign({
		languages: ['en'],
		useWeeks: false,
		long: false,
		length: 3,
	}, options);

	if(typeof options.useWeeks !== 'boolean'){
		throw Error("'useWeeks' should be a boolean");
	}else if(typeof options.long !== 'boolean'){
		throw Error("'long' should be a boolean");
	}else if(!Array.isArray(options.languages)){
		throw Error("'languages' should be an array");
	}else if(typeof options.length !== 'number' || options.length <= 0){
		throw Error("'length' must be a number greater than zero");
	}

	for(const lang of options.languages){
		if(!LANGUAGES[lang]) throw Error(`Invalid language '${lang}'`);
	}

	return options;
}

/*
function createRegex(language){
	const short = [], long = [];

	for(const notations of Object.values(language)){
		for(const notation of notations){
			if(notation.length >= 3){
				long.push(notation);
			}else{
				short.push(notation);
			}
		}
	}

	const notationsREGEX = `(?:${
		long.sort((a, b) => b.length - a.length).join('|')
	})|(?:(?:${
		short.sort((a, b) => b.length - a.length).join('|')
	})(?![a-z]))`;

	return RegExp(`${numberREGEX}\\s*(${notationsREGEX})`, 'gim');

	/*
	(
		[+-]?[\d]*[.]?[\d]+
	)\s*(
		(?:
			milliseconds|millisecond|minutes|seconds|months|
			minute|second|years|month|weeks|hours|msecs|msegs|
			year|week|days|hour|mins|secs|segs|msec|mseg|yrs|
			mth|day|hrs|min|sec|seg
		)|(?:
			(?:yr|mo|hr|ms|y|w|d|h|m|s)(?![a-z])
		)
	)
	/
}
*/