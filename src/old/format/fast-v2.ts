/**
 * Format v2 - Separate generated functions for short/long
 * 
 * Strategy: Generate separate functions for short and long format,
 * eliminating the runtime `long` parameter check inside the hot path.
 * 
 * Two generated functions: `formatShort` and `formatLong`
 * Wrapper returns `long ? formatLong(ms) : formatShort(ms)`
 * 
 * Result: Marginal improvement for short, slight regression for long.
 * V8 JIT optimizes the `long` branch well enough that separate functions
 * don't provide significant benefit.
 */
import { TIMES, type Unit, type Language } from '../../core/index.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

const UNITS = Object.keys(TIMES) as Unit[];

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function createShortBranches(language: Language): string {
	let branches = '';

	for (const unit of UNITS) {
		const unitValue = TIMES[unit];
		const singular = escapeString(language.getNotation(unit, false, true));
		const plural = escapeString(language.getNotation(unit, false, false));

		const result = singular === plural ? `'${singular}'` : `(value === 1 ? '${singular}' : '${plural}')`;

		branches += `
			if (remaining >= ${unitValue} && (value = Math.floor(remaining / ${unitValue})) !== 0) {
				return negativePrefix + value + ${result};
			}
		`;
	}

	const smallestUnit = UNITS.at(-1)!;
	const zeroNotation = escapeString(language.getNotation(smallestUnit, false, false));

	branches += `
			return '0${zeroNotation}';
		`;

	return branches;
}

function createLongBranches(language: Language): string {
	let branches = '';

	for (const unit of UNITS) {
		const unitValue = TIMES[unit];
		const singular = escapeString(language.getNotation(unit, true, true));
		const plural = escapeString(language.getNotation(unit, true, false));

		const result = singular === plural ? `'${singular}'` : `(value === 1 ? '${singular}' : '${plural}')`;

		branches += `
			if (remaining >= ${unitValue} && (value = Math.floor(remaining / ${unitValue})) !== 0) {
				return negativePrefix + value + ${result};
			}
		`;
	}

	const smallestUnit = UNITS.at(-1)!;
	const zeroNotation = escapeString(language.getNotation(smallestUnit, true, false));

	branches += `
			return '0${zeroNotation}';
		`;

	return branches;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	const shortBranches = createShortBranches(language);
	const longBranches = createLongBranches(language);

	const shortSource = `
		if (typeof miliseconds !== 'number' || !Number.isFinite(miliseconds)) return null;
		const remaining = Math.abs(miliseconds);
		const negativePrefix = miliseconds < 0 ? '- ' : '';
		let value = 0;
		${shortBranches}
	`;

	const longSource = `
		if (typeof miliseconds !== 'number' || !Number.isFinite(miliseconds)) return null;
		const remaining = Math.abs(miliseconds);
		const negativePrefix = miliseconds < 0 ? '- ' : '';
		let value = 0;
		${longBranches}
	`;

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	const formatShort = Function('miliseconds', shortSource) as (ms: number) => string | null;
	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	const formatLong = Function('miliseconds', longSource) as (ms: number) => string | null;

	return (miliseconds: number, long = false): string | null => {
		return long ? formatLong(miliseconds) : formatShort(miliseconds);
	};
}