/**
 * Format v5 — Single merged function (no wrapper)
 *
 * Merges the short and long paths into one generated function with a `long` parameter,
 * replacing the two-function + wrapper pattern of v2–v4.
 *
 * In v2–v4, `buildFastFormat` returns an arrow wrapper that dispatches to either
 * `formatShort` or `formatLong` based on the `long` flag. That wrapper is a small
 * indirect call on every invocation. V8 should inline it after warmup, but it's
 * still an extra call frame.
 *
 * Here the generated function handles both paths directly. Trade-off: one larger
 * function vs two smaller ones + a wrapper. If the body stays within Maglev's
 * threshold, the call-elimination should be a net win.
 *
 * `long` with no default in the generated params — `undefined` is falsy, so callers
 * can omit it and get the short path. Matches FastFormatFunction's `long?` signature.
 */
import { getUnitNotation } from '../utils/language.ts';
import { TIMES, UNITS, type Language } from '../../src/core/index.ts';
import { craftFunction } from '../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function buildBranches(language: Language, long: boolean): string {
	let body = '';

	for (const unit of UNITS) {
		const t = TIMES[unit];
		const sing = escapeString(getUnitNotation(language, unit, long, true));
		const plur = escapeString(getUnitNotation(language, unit, long, false));
		const expr = t === 1 ? 'Math.floor(a)' : `Math.floor(a/${t})`;

		if (sing === plur)
			body += `if(a>=${t})return p+${expr}+'${sing}';`;
		else
			body += `if(a>=${t}){var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
	}

	const zero = escapeString(getUnitNotation(language, UNITS.at(-1)!, long, false));
	body += `return '0${zero}';`;
	return body;
}

function buildMergedBody(language: Language): string {
	const shortBranches = buildBranches(language, false);
	const longBranches = buildBranches(language, true);
	// `long` is falsy when undefined — callers can omit it and get the short path
	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;var a=ms<0?-ms:ms;var p=ms<0?'- ':'';if(long){${longBranches}}else{${shortBranches}}`;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	return craftFunction<FastFormatFunction>('formatFn', [ 'ms', 'long' ], buildMergedBody(language), {});
}
