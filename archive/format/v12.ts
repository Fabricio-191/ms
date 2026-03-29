/**
 * Format v12 — Crafted dispatcher over two specialized functions
 *
 * Extends v11 by making the dispatcher itself a craftFunction instead of a plain
 * arrow. The goal: if V8 sees three small functions (shortFn, longFn, dispatcher)
 * rather than one large merged function, TurboFan may inline shortFn/longFn directly
 * into the dispatcher after enough calls with a stable `long` argument.
 *
 * Architecture:
 *   craftedDispatcher(ms, long) → long ? craftedLongFn(ms) : craftedShortFn(ms)
 *
 * Each of the three functions is a separate craftFunction (separate Function()
 * allocations), so V8 tracks their call frequency and inline state independently.
 *
 * If TurboFan inlines shortFn/longFn into the dispatcher, the call overhead disappears
 * and we get the benefit of v11's smaller per-function bytecode WITHOUT the wrapper
 * penalty. If it doesn't inline, this is strictly slower than v11 due to the extra
 * craftFunction indirection.
 *
 * Uses Math.trunc instead of Math.floor (same as v10/v11).
 */
import { TIMES, UNITS, type Language } from '../../core/index.ts';
import { craftFunction } from '../../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function buildBody(language: Language, long: boolean): string {
	let branches = '';

	for (const unit of UNITS) {
		const t = TIMES[unit];
		const sing = escapeString(language.getNotation(unit, long, true));
		const plur = escapeString(language.getNotation(unit, long, false));
		const expr = t === 1 ? 'Math.trunc(a)' : `Math.trunc(a/${t})`;

		if (sing === plur)
			branches += `if(a>=${t})return p+${expr}+'${sing}';`;
		else
			branches += `if(a>=${t}){var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
	}

	const zero = escapeString(language.getNotation(UNITS.at(-1)!, long, false));
	branches += `return '0${zero}';`;

	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;var neg=ms<0;var a=neg?-ms:ms;var p=neg?'- ':'';${branches}`;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	const shortFn = craftFunction<(ms: number) => string | null>('formatShort', [ 'ms' ], buildBody(language, false), {});
	const longFn = craftFunction<(ms: number) => string | null>('formatLong', [ 'ms' ], buildBody(language, true), {});
	// Dispatcher is itself a craftFunction so V8 can inline shortFn/longFn into it
	return craftFunction<FastFormatFunction>(
		'formatFn',
		[ 'ms', 'long' ],
		'return long?longFn(ms):shortFn(ms);',
		{ shortFn, longFn },
	);
}
