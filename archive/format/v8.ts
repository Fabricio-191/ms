/**
 * Format v8 — Merged function with context variables (context data, minimal source)
 *
 * Tests whether replacing inline literals (thresholds + notation strings) with
 * context-captured closure variables reduces the inner function's bytecode
 * enough for TurboFan to inline it (and thus match or beat v3).
 *
 * Current v6 inner body: string literals ('y', ' year', ' years'...) and
 * numeric literals (31557600000, 3600000...) are embedded directly in source.
 *
 * v8 inner body: all those values become variable references (t0, ss0, ls0, lp0...).
 * The source string is shorter, but the bytecode instruction count is likely the same:
 *   LdaConstant [pool_entry]    ← literal in source
 *   LdaCurrentContextSlot [n]  ← closure variable
 * Both are single bytecode instructions — the inner function's bytecode size
 * should be identical in instruction count.
 *
 * Expected: no inlining improvement, similar to v6 performance.
 * If correct, documents that TurboFan's inlining threshold is instruction-count based,
 * not source-size based.
 */
import { TIMES, UNITS, type Language } from '../../core/index.ts';
import { craftFunction } from '../../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

function buildContext(language: Language): Record<string, unknown> {
	const ctx: Record<string, unknown> = {};
	for (let i = 0; i < UNITS.length; i++) {
		const unit = UNITS[i]!;
		ctx[`t${i}`] = TIMES[unit];
		ctx[`ss${i}`] = language.getNotation(unit, false, true);
		ctx[`sp${i}`] = language.getNotation(unit, false, false);
		ctx[`ls${i}`] = language.getNotation(unit, true, true);
		ctx[`lp${i}`] = language.getNotation(unit, true, false);
	}
	const last = UNITS.at(-1)!;
	ctx['z'] = '0' + language.getNotation(last, false, false);
	ctx['zl'] = '0' + language.getNotation(last, true, false);
	return ctx;
}

function buildMergedBody(language: Language): string {
	let shortBranches = '';
	let longBranches = '';

	for (let i = 0; i < UNITS.length; i++) {
		const unit = UNITS[i]!;
		const t = TIMES[unit];
		const expr = t === 1 ? 'Math.floor(a)' : `Math.floor(a/t${i})`;

		const ss = language.getNotation(unit, false, true);
		const sp = language.getNotation(unit, false, false);
		const ls = language.getNotation(unit, true, true);
		const lp = language.getNotation(unit, true, false);

		if (ss === sp) {
			shortBranches += `if(a>=t${i})return p+${expr}+ss${i};`;
		} else {
			shortBranches += `if(a>=t${i}){var v=${expr};return p+v+(v===1?ss${i}:sp${i});}`;
		}

		if (ls === lp) {
			longBranches += `if(a>=t${i})return p+${expr}+ls${i};`;
		} else {
			longBranches += `if(a>=t${i}){var v=${expr};return p+v+(v===1?ls${i}:lp${i});}`;
		}
	}

	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;var neg=ms<0;var a=neg?-ms:ms;var p=neg?'- ':'';if(!long){${shortBranches}return z;}else{${longBranches}return zl;}`;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	const ctx = buildContext(language);
	return craftFunction<FastFormatFunction>(
		'formatFn', ['ms', 'long'], buildMergedBody(language), ctx,
	);
}
