import { LANGUAGES, TIMES, type Notations } from './utils';

function getNotation(notations: Notations, long: boolean, singular: boolean){
	if(long){
		if(singular) return ' ' + notations.singular;

		return ' ' + (notations.plural || notations.singular);
	}
	if(singular) return notations.shortSingular;

	return notations.shortPlural || notations.shortSingular;
}

export default function format(miliseconds: number, options: RawOptions): string | null {
	if(!Number.isFinite(miliseconds)) return null;
	const parsedOptions = parseFormatOptions(options);

	let str = '';
	if(miliseconds < 0){
		str += '- ';
		miliseconds = -miliseconds;
	}

	const lang = LANGUAGES[parsedOptions.language];

	for(const key of parsedOptions.format){
		const value = Math.floor(miliseconds / TIMES[key]);
		if(value === 0) continue;

		miliseconds -= value * TIMES[key];

		str += value + getNotation(lang[key], parsedOptions.long, value === 1) + ' ';

		if(--parsedOptions.length === 0) break;
	}

	if(str === '') return '0' + getNotation(
		lang[parsedOptions.format[parsedOptions.format.length - 1] as string],
		parsedOptions.long, false
	);

	if(str[str.length - 1] === ' '){
		return str.slice(0, -1);
	}
	// console.log(new Intl.ListFormat('es').format(['a', 'b', 'c']));

	return str;
}

function simpleFormat(miliseconds: number, long = false, lang = 'en'): string | null {
	if(!Number.isFinite(miliseconds)) return null;
	if(miliseconds < 0){
		return '-' + simpleFormat(-miliseconds, long, lang);
	}
	if(!(lang in LANGUAGES)){
		throw new Error('Language not found');
	}

	for(const key in TIMES){
		const num = Math.round(miliseconds / TIMES[key]);
		if(num !== 0){
			return num + getNotation(LANGUAGES[lang][key], long, num === 1);
		}
	}

	return null;
}

export const simple = simpleFormat;

const FORMATS_REGEX = /Mo|Ms|Y|W|D|H|M|S/g;
const VALID_FORMAT = /^Y?(?:Mo)?W?D?H?M?S?(?:Ms)?$/;

interface RawOptions {
	long?: boolean;
	length?: number;
	language?: string;
	format?: string;
}

interface Options {
	long: boolean;
	length: number;
	language: string;
	format: string[];
}

const DEFAULT_FORMAT_OPTS: Required<RawOptions> = {
	language: 'en',
	long: false,
	format: 'YMoDHMSMs',
	length: 3,
};

function parseFormatOptions(options: RawOptions = {}){
	if(typeof options !== 'object') throw Error('Options should be an object');

	const parsedOptions: {
		[key in keyof Options]: key extends keyof RawOptions ?
			Exclude<RawOptions[key], undefined> | Options[key] :
			never;
	} = Object.assign({}, DEFAULT_FORMAT_OPTS, options);

	if(typeof parsedOptions.long !== 'boolean'){
		throw Error("'long' should be a boolean");
	}else if(typeof parsedOptions.length !== 'number' || parsedOptions.length < 1 || parsedOptions.length > 8){
		throw Error("'length' should be a number between 1 and 8");
	}else if(typeof parsedOptions.language !== 'string'){
		throw Error("'language' should be a string");
	}else if(!LANGUAGES[parsedOptions.language]){
		throw Error(`invalid language '${parsedOptions.language}'`);
	}else if(typeof parsedOptions.format !== 'string' || parsedOptions.format === ''){
		throw Error("'format' should be a non-empty string");
	}else if(!VALID_FORMAT.test(parsedOptions.format)){
		throw Error('invalid format');
	}

	parsedOptions.format = parsedOptions.format.match(FORMATS_REGEX) as string[];

	return parsedOptions as Options;
}