/**
 * Format v6 — v5 with short-first branch + CSE-friendly neg variable
 *
 * Two isolated changes from v5:
 *
 * 1. Branch ordering: `if(!long)` short path first instead of `if(long)` long path first.
 *    For the common `long=false` case, the "then" branch executes directly (no negation cost
 *    after JIT, but may affect branch layout in the Maglev baseline tier).
 *
 * 2. Single `neg` variable instead of evaluating `ms < 0` twice:
 *      v5: var a=ms<0?-ms:ms; var p=ms<0?'- ':'';
 *      v6: var neg=ms<0; var a=neg?-ms:ms; var p=neg?'- ':'';
 *    JIT's CSE should already eliminate the redundant check in v5, but making it
 *    explicit removes any ambiguity and reduces the source expression count.
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

		if (sing === plur)
			body += `if(a>=${t})return p+${expr}+'${sing}';`;
		else
			body += `if(a>=${t}){var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
	}

	const zero = escapeString(language.getNotation(UNITS.at(-1)!, long, false));
	body += `return '0${zero}';`;
	return body;
}

function buildMergedBody(language: Language): string {
	const shortBranches = buildBranches(language, false);
	const longBranches = buildBranches(language, true);
	// short path first: if(!long) is "then" for the common case
	// neg variable computed once, reused for both a and p
	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;var neg=ms<0;var a=neg?-ms:ms;var p=neg?'- ':'';if(!long){${shortBranches}}else{${longBranches}}`;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	return craftFunction<FastFormatFunction>('formatFn', [ 'ms', 'long' ], buildMergedBody(language), {});
}
