type language = 'en' | 'es';
type ParseOptions = {
	/* Language to use in the operation */
	language?: language | 'all';
} | {
	/* Languages to use in the operation */
	languages?: language[] | 'all';
}

interface FormatOptions extends ParseOptions{
	/* Whenether to use weeks or months when formatting */
	useWeeks?: boolean;
	/* Whenether to long notations when formatting */
	long?: boolean;
}

/**
 * Convert time in ms into a human-readable format 
 * @param value The time
 * @param options The options to convert to string
 * @returns The time in human-readable format 
 */
declare function ms(value: number, options?: FormatOptions): string;
/**
 * Parse a string into the time in miliseconds
 * @param value The string to parse
 * @param options The options to parse string
 * @returns The time in miliseconds
 */
declare function ms(value: string, options?: ParseOptions): number;

export = ms;