import { Language, TIMES, type Unit } from '../../src/core/index.ts';
import { LANGUAGES } from '../../src/core/languages.ts';
import { getUnitNotation } from '../utils/language.ts';

export function format(miliseconds: number, options: Options = {}): string | null {
	if (typeof miliseconds !== 'number' || !Number.isFinite(miliseconds)) return null;
	const parsedOptions = parseFormatOptions(options);

	let remaining = Math.abs(miliseconds);
	let str = miliseconds < 0 ? '- ' : '';

	const lang = parsedOptions.language;

	for (const unit of parsedOptions.format) {
		const value = Math.floor(remaining / TIMES[unit]);
		if (value === 0) continue;

		remaining -= value * TIMES[unit];

		str += `${value}${getUnitNotation(lang, unit, parsedOptions.long, value === 1)} `;

		parsedOptions.length -= 1;
		if (parsedOptions.length === 0) break;
	}

	if (str === '' || str === '- ') // if the input is 0 or if it's too small to be represented in the specified format, return '0' with the smallest unit in the format
		return `0${getUnitNotation(lang, parsedOptions.format.at(-1)!, parsedOptions.long, false)}`;

	return str.trimEnd();
}

const FORMATS_REGEX = /Mo|Ms|Y|W|D|H|M|S/gu;
const VALID_FORMAT = /^Y?(?:Mo)?W?D?H?M?S?(?:Ms)?$/u;
export type ValidFormat = Exclude<`${'Y' | ''}${'Mo' | ''}${'W' | ''}${'D' | ''}${'H' | ''}${'M' | ''}${'S' | ''}${'Ms' | ''}`, ''>;

interface Options {
	long?: boolean;
	length?: number;
	language?: Language;
	format?: ValidFormat;
}

interface ParsedOptions {
	long: boolean;
	length: number;
	language: Language;
	format: Unit[];
}

const DEFAULT_FORMAT_OPTS: Required<Options> = {
	language: LANGUAGES.en,
	long: false,
	format: 'YMoDHMSMs',
	length: 3,
};

function parseFormatOptions(options: Options = {}): ParsedOptions {
	const parsedOptions = { ...DEFAULT_FORMAT_OPTS, ...options };

	if (typeof parsedOptions.long !== 'boolean')
		throw Error('\'long\' should be a boolean');

	else if (typeof parsedOptions.length !== 'number' || !Number.isFinite(parsedOptions.length) || parsedOptions.length < 1 || parsedOptions.length > 8)
		throw Error('\'length\' should be a number between 1 and 8');

	else if (typeof parsedOptions.format !== 'string')
		throw Error('\'format\' should be a non-empty string');

	else if (!VALID_FORMAT.test(parsedOptions.format))
		throw Error('invalid format');

	else if (!(parsedOptions.language instanceof Language))
		throw Error('\'language\' should be a Language instance');

	const formatKeys = parsedOptions.format.match(FORMATS_REGEX) as Unit[];
	const language = parsedOptions.language;

	return {
		format: formatKeys,
		language,
		length: parsedOptions.length,
		long: parsedOptions.long,
	};
}
