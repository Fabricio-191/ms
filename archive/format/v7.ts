/**
 * Format v7 — Merged function + arrow wrapper
 *
 * Tests the inlining hypothesis from v3 vs v5/v6:
 *   - v3 wins short because TurboFan inlines the small formatShort/formatLong into the arrow wrapper
 *   - v5/v6 have no wrapper → no TurboFan inlining → Optimized + Interpreted
 *
 * v7 wraps v6's merged function in an arrow wrapper (same pattern as v3).
 * TurboFan will compile the wrapper, and then decide whether to inline the merged inner function.
 *
 * If TurboFan inlines the merged function → wins both short AND long (best of both)
 * If TurboFan does NOT inline (body too large) → same perf as v6 (confirms size is the limit)
 */
import { TIMES, UNITS, type Language } from '../../core/index.ts';
import { craftFunction } from '../../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function buildBranches(language: Language, long: boolean): string {
	let body = '';

	for (const unit of UNITS) {
		const t = TIMES[unit];
		const sing = escapeString(language.getNotation(unit, long, true));
		const plur = escapeString(language.getNotation(unit, long, false));
		const expr = t === 1 ? 'Math.floor(a)' : `Math.floor(a/${t})`;

		if (sing === plur) {
			body += `if(a>=${t})return p+${expr}+'${sing}';`;
		} else {
			body += `if(a>=${t}){var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
		}
	}

	const zero = escapeString(language.getNotation(UNITS.at(-1)!, long, false));
	body += `return '0${zero}';`;
	return body;
}

function buildMergedBody(language: Language): string {
	const shortBranches = buildBranches(language, false);
	const longBranches = buildBranches(language, true);
	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;var neg=ms<0;var a=neg?-ms:ms;var p=neg?'- ':'';if(!long){${shortBranches}}else{${longBranches}}`;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	const inner = craftFunction<FastFormatFunction>(
		'formatFn', ['ms', 'long'], buildMergedBody(language), {},
	);
	// Arrow wrapper: TurboFan-eligible static function.
	// TurboFan will decide whether to inline `inner` based on its body size.
	return (ms: number, long = false) => inner(ms, long);
}
