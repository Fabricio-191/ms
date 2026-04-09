/**
 * Format v3 - Fully inlined constants + separate functions
 *
 * Strategy: Pre-compute all threshold constants at module load time
 * and inline them as numeric literals in the generated code.
 * Eliminates `TIMES` object lookup at runtime.
 *
 * Separate functions for short/long format.
 *
 * Result: Similar to v1 for short format, slightly better for long format.
 * V8's JIT already inlines constant object property access well.
 */
import { getUnitNotation } from '../utils/language.ts';
import { TIMES, type Language } from '../../src/core/index.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

// Pre-computed constants for thresholds (avoids Object.keys at runtime)
const YEAR_MS = TIMES.Y; // 31557600000
const MONTH_MS = TIMES.Mo; // 2592000000
const WEEK_MS = TIMES.W; // 604800000
const DAY_MS = TIMES.D; // 86400000
const HOUR_MS = TIMES.H; // 3600000
const MINUTE_MS = TIMES.M; // 60000
const SECOND_MS = TIMES.S; // 1000

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function createInlinedShortFunction(language: Language): (ms: number) => string | null {
	const ySingular = escapeString(getUnitNotation(language, 'Y', false, true));
	const yPlural = escapeString(getUnitNotation(language, 'Y', false, false));
	const moSingular = escapeString(getUnitNotation(language, 'Mo', false, true));
	const moPlural = escapeString(getUnitNotation(language, 'Mo', false, false));
	const wSingular = escapeString(getUnitNotation(language, 'W', false, true));
	const wPlural = escapeString(getUnitNotation(language, 'W', false, false));
	const dSingular = escapeString(getUnitNotation(language, 'D', false, true));
	const dPlural = escapeString(getUnitNotation(language, 'D', false, false));
	const hSingular = escapeString(getUnitNotation(language, 'H', false, true));
	const hPlural = escapeString(getUnitNotation(language, 'H', false, false));
	const mSingular = escapeString(getUnitNotation(language, 'M', false, true));
	const mPlural = escapeString(getUnitNotation(language, 'M', false, false));
	const sSingular = escapeString(getUnitNotation(language, 'S', false, true));
	const sPlural = escapeString(getUnitNotation(language, 'S', false, false));
	const msSingular = escapeString(getUnitNotation(language, 'Ms', false, true));
	const msPlural = escapeString(getUnitNotation(language, 'Ms', false, false));

	const source = `
		if (typeof miliseconds !== 'number' || !Number.isFinite(miliseconds)) return null;
		var abs = Math.abs(miliseconds);
		var neg = miliseconds < 0 ? '- ' : '';
		var v;
		if (abs >= ${YEAR_MS}) { v = Math.floor(abs / ${YEAR_MS}); return neg + v + (v === 1 ? '${ySingular}' : '${yPlural}'); }
		if (abs >= ${MONTH_MS}) { v = Math.floor(abs / ${MONTH_MS}); return neg + v + (v === 1 ? '${moSingular}' : '${moPlural}'); }
		if (abs >= ${WEEK_MS}) { v = Math.floor(abs / ${WEEK_MS}); return neg + v + (v === 1 ? '${wSingular}' : '${wPlural}'); }
		if (abs >= ${DAY_MS}) { v = Math.floor(abs / ${DAY_MS}); return neg + v + (v === 1 ? '${dSingular}' : '${dPlural}'); }
		if (abs >= ${HOUR_MS}) { v = Math.floor(abs / ${HOUR_MS}); return neg + v + (v === 1 ? '${hSingular}' : '${hPlural}'); }
		if (abs >= ${MINUTE_MS}) { v = Math.floor(abs / ${MINUTE_MS}); return neg + v + (v === 1 ? '${mSingular}' : '${mPlural}'); }
		if (abs >= ${SECOND_MS}) { v = Math.floor(abs / ${SECOND_MS}); return neg + v + (v === 1 ? '${sSingular}' : '${sPlural}'); }
		return neg + abs + (abs === 1 ? '${msSingular}' : '${msPlural}');
	`;

	return Function('miliseconds', source) as (ms: number) => string | null;
}

function createInlinedLongFunction(language: Language): (ms: number) => string | null {
	const ySingular = escapeString(getUnitNotation(language, 'Y', true, true));
	const yPlural = escapeString(getUnitNotation(language, 'Y', true, false));
	const moSingular = escapeString(getUnitNotation(language, 'Mo', true, true));
	const moPlural = escapeString(getUnitNotation(language, 'Mo', true, false));
	const wSingular = escapeString(getUnitNotation(language, 'W', true, true));
	const wPlural = escapeString(getUnitNotation(language, 'W', true, false));
	const dSingular = escapeString(getUnitNotation(language, 'D', true, true));
	const dPlural = escapeString(getUnitNotation(language, 'D', true, false));
	const hSingular = escapeString(getUnitNotation(language, 'H', true, true));
	const hPlural = escapeString(getUnitNotation(language, 'H', true, false));
	const mSingular = escapeString(getUnitNotation(language, 'M', true, true));
	const mPlural = escapeString(getUnitNotation(language, 'M', true, false));
	const sSingular = escapeString(getUnitNotation(language, 'S', true, true));
	const sPlural = escapeString(getUnitNotation(language, 'S', true, false));
	const msSingular = escapeString(getUnitNotation(language, 'Ms', true, true));
	const msPlural = escapeString(getUnitNotation(language, 'Ms', true, false));

	const source = `
		if (typeof miliseconds !== 'number' || !Number.isFinite(miliseconds)) return null;
		var abs = Math.abs(miliseconds);
		var neg = miliseconds < 0 ? '- ' : '';
		var v;
		if (abs >= ${YEAR_MS}) { v = Math.floor(abs / ${YEAR_MS}); return neg + v + (v === 1 ? '${ySingular}' : '${yPlural}'); }
		if (abs >= ${MONTH_MS}) { v = Math.floor(abs / ${MONTH_MS}); return neg + v + (v === 1 ? '${moSingular}' : '${moPlural}'); }
		if (abs >= ${WEEK_MS}) { v = Math.floor(abs / ${WEEK_MS}); return neg + v + (v === 1 ? '${wSingular}' : '${wPlural}'); }
		if (abs >= ${DAY_MS}) { v = Math.floor(abs / ${DAY_MS}); return neg + v + (v === 1 ? '${dSingular}' : '${dPlural}'); }
		if (abs >= ${HOUR_MS}) { v = Math.floor(abs / ${HOUR_MS}); return neg + v + (v === 1 ? '${hSingular}' : '${hPlural}'); }
		if (abs >= ${MINUTE_MS}) { v = Math.floor(abs / ${MINUTE_MS}); return neg + v + (v === 1 ? '${mSingular}' : '${mPlural}'); }
		if (abs >= ${SECOND_MS}) { v = Math.floor(abs / ${SECOND_MS}); return neg + v + (v === 1 ? '${sSingular}' : '${sPlural}'); }
		return neg + abs + (abs === 1 ? '${msSingular}' : '${msPlural}');
	`;

	return Function('miliseconds', source) as (ms: number) => string | null;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	const formatShort = createInlinedShortFunction(language);
	const formatLong = createInlinedLongFunction(language);

	return (miliseconds: number, long = false): string | null => long ? formatLong(miliseconds) : formatShort(miliseconds);
}
