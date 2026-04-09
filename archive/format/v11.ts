/**
 * Format v11 — Two specialized functions (no dispatch branch)
 *
 * Hypothesis: v5/v6's merged function body (both short+long paths in one function)
 * is large enough to prevent Maglev promotion. V8's JIT heuristics use bytecode size
 * as a proxy for complexity — a merged body roughly doubles the branch count.
 *
 * v11 generates two separate craftFunctions: one for short output, one for long.
 * `buildFastFormat` returns an arrow wrapper that picks between them. Trade-offs:
 *
 * Pros:
 * - Each inner function is ~half the bytecode of v5/v6 → more likely to hit Maglev
 * - No `if(!long)` branch inside the hot path — each function does exactly one thing
 *
 * Cons:
 * - Extra call frame through the arrow wrapper on every invocation
 * - Two compilations instead of one
 *
 * Uses Math.trunc instead of Math.floor (v10 improvement — safe for a >= 0).
 */
import { getUnitNotation } from '../utils/language.ts';
import { TIMES, UNITS, type Language } from '../../src/core/index.ts';
import { craftFunction } from '../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function buildBody(language: Language, long: boolean): string {
	let branches = '';

	for (const unit of UNITS) {
		const t = TIMES[unit];
		const sing = escapeString(getUnitNotation(language, unit, long, true));
		const plur = escapeString(getUnitNotation(language, unit, long, false));
		const expr = t === 1 ? 'Math.trunc(a)' : `Math.trunc(a/${t})`;

		if (sing === plur)
			branches += `if(a>=${t})return p+${expr}+'${sing}';`;
		else
			branches += `if(a>=${t}){var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
	}

	const zero = escapeString(getUnitNotation(language, UNITS.at(-1)!, long, false));
	branches += `return '0${zero}';`;

	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;var neg=ms<0;var a=neg?-ms:ms;var p=neg?'- ':'';${branches}`;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	const shortFn = craftFunction<(ms: number) => string | null>('formatShort', [ 'ms' ], buildBody(language, false), {});
	const longFn = craftFunction<(ms: number) => string | null>('formatLong', [ 'ms' ], buildBody(language, true), {});
	return (ms, long) => long ? longFn(ms) : shortFn(ms);
}
