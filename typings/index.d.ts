declare module '@fabricio-191/ms' {
	// type FORMATS_KEY = 'Y' | 'Mo' | 'W' | 'D' | 'H' | 'M' | 'S' | 'Ms';

	// type Permute<T> = T extends [infer U, ...infer V] ? `${U | ''}${Permute<V>}` : '';
	// type FORMAT = Permute<[ 'Y', 'Mo', 'W', 'D', 'H', 'M', 'S', 'Ms' ]>;

	type FORMAT = Exclude<`${'Y'|''}${'Mo'|''}${'W'|''}${'D'|''}${'H'|''}${'M'|''}${'S'|''}${'Ms'|''}`, ''>;
	type KEY = 'Y' | 'Mo' | 'W' | 'D' | 'H' | 'M' | 'S' | 'Ms';

	// eslint-disable-next-line @typescript-eslint/ban-types
	type langs = 'en' | 'es' | 'ja' | (string & {});

	type TIMES = {
		[key in KEY]: number;
	}
	
	interface notations {
		all: string[];
		singular: string;
		shortSingular: string;
		plural?: string;
		shortPlural?: string;
	}

	type dictionary = {
		[key: string]: number;
	}

	interface LANGUAGE {
		dict?: dictionary;
		REGEX?: RegExp;
		Y: notations;
		Mo: notations;
		W: notations;
		D: notations;
		H: notations;
		M: notations;
		S: notations;
		Ms: notations;
	}

	type LANGUAGES = {
		[key in langs]: LANGUAGE;
	}

	interface FormatOptions {
		/** Language to use in the operation */
		language?: language;
		/** Whenether to use weeks or months when formatting */
		format?: FORMAT;
		/** Whenether to long notations when formatting */
		long?: boolean;
		/** Max notations that the result can have */
		length?: 1 | 2 | 3 | 4 | 5 | 7 | 8;
	}

	/**
	 * Convert time in miliseconds into a human-readable format
	 * @param time The time to format
	 * @param options The options to convert to string
	 * @returns The time in human-readable format
	 */
	function ms(time: number, options?: FormatOptions): string;
	/**
	 * Parse a string into the time in miliseconds
	 * @param string The string to parse
	 * @param languages The languages to use to try to parse in the string
	 * @returns The time in miliseconds
	 */
	function ms(string: string, languages?: langs | langs[] | 'all'): number | null;

	export default ms;
	export function addLanguage(name: stringz, data: LANGUAGE): void;
	export function checkLanguage(data: LANGUAGE): void;
	export function clock(str: string, minutes: boolean): number | null;
	export const LANGUAGES: LANGUAGES;
	export const TIMES: TIMES;
}