import { TIMES, UNIT_KEYS, type Language } from '../languages/core.ts';

type FastParseFunction = (str: string) => number | null;

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function createSwitchBody(language: Language): string {
	let body = '';

	for (const unit of UNIT_KEYS) {
		const multiplier = TIMES[unit];
		const notations = language.units[unit].all;
		for (const notation of notations)
			body += `\n\t\t\t\t\tcase '${escapeString(notation)}':`;

		body += `\n\t\t\t\t\t\tvalue += parsedValue * ${multiplier};`;
		body += '\n\t\t\t\t\t\tbreak;';
	}

	return body;
}

// the user uses this function, to create the fast parse function for a specific language. it will be stored by the user, not us
export function buildFastParse(language: Language): FastParseFunction {
	const regex = new RegExp(language.REGEX.source, 'giu');
	const switchBody = createSwitchBody(language);

	const source = `
		if (typeof str !== 'string' || str === '') return null;

		regex.lastIndex = 0;

		let value = 0;
		let matches_qty = 0;
		let match = regex.exec(str);

		while (match !== null) {
			const parsedValue = parseFloat(match[1]);

			switch (match[2].toLowerCase()) {${switchBody}
				default:
					break;
			}

			matches_qty += 1;
			match = regex.exec(str);
		}

		if (matches_qty === 0) {
			const num = Number(str);
			if (Number.isNaN(num)) return null;

			return num;
		}

		return /^\\s*-/u.test(str) ? -value : value;
	`;

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return Function('regex', 'str', source).bind(null, regex) as FastParseFunction;
}
