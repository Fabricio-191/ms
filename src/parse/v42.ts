/**
 * Parse v42 — `avail = len - i` pre-computed length variable via `craftFunction`.
 *
 * Same algorithm as v25/v32, but the length guard uses a pre-computed variable
 * `_avail = len - i` instead of recomputing `i+N <= len` per entry.
 *
 * Why `_avail >= N` might be faster than `i+N <= len`:
 *   - `i+N <= len` recomputes a sum on every entry check: 1 add + 1 compare per entry.
 *   - `_avail >= N` is just 1 compare per entry — V8 sees a single stable variable
 *     (type: integer, no pointer arithmetic) against a constant.
 *   - With a single `_avail` variable, V8 can reason holistically across all length
 *     guards in the dispatch block, potentially hoisting range checks.
 *   - Reduces pressure on the integer arithmetic pipeline.
 *
 * Trade-off: `_avail` must be recomputed after `i` advances (after each successful
 * notation match, before the next token). Here `_avail` is computed once before the
 * `match:` block and used only within it — `i` is not mutated between the declaration
 * and the end of the block, so the value stays valid.
 *
 * Unchanged from v25/v32:
 *   - Separate lo/hi first-char blocks (no merged groups).
 *   - Flat `if` structure within each block (ILP preserved).
 *   - Per-char two-constant comparisons.
 *   - 3-condition boundary check.
 */
import { Language } from '../core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../utils/trie.ts';
import type { ParseFunction } from '../core/types.ts';
import { craftFunction } from '../utils/craft.ts';
import { extractNotations, generateLookupCode } from '../utils/notation.ts';

function buildSingleParse(language: Language): ParseFunction {
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const entries = extractNotations(language.dict);
	// 5 tabs = nesting level inside: while > if(digit) > if(pv===pv) > if(i<len) > else > match:
	// availVar='_avail' → emits `_avail >= N` instead of `i+N <= len` for all length guards
	const lookupCode = generateLookupCode(entries, '\t\t\t\t\t', false, '_avail');

	const body = `
		// ─── guard: type check and empty string ──────────────────────────────────
		if (typeof str !== 'string' || str === '') return null;

		var s = str, len = s.length;

		// ─── skip leading spaces, detect optional leading sign ────────────────────
		var si = 0;
		while (si < len && s.charCodeAt(si) === 32) si++;  // 32 = ' '
		var neg = false;
		if (s.charCodeAt(si) === 45) {  // 45 = '-'
			neg = true;
			si++;
			while (si < len && s.charCodeAt(si) === 32) si++;
		}

		// ─── early exit: first meaningful char is not '-', digit or '.' ──────────
		var fc = s.charCodeAt(si);
		if (fc !== 45 && (fc - 48 >>> 0) >= 10 && fc !== 46) {
			var n = +str;
			return n !== n ? null : n;
		}

		var v = 0,   // accumulated result
		    mc = 0,  // notation match count
		    i = si;  // scan position

		// ─── main scan loop ───────────────────────────────────────────────────────
		while (i < len) {
			var c = s.charCodeAt(i);

			if ((c - 48 >>> 0) < 10 || c === 46) {  // digit (48–57) or '.' (46)

				// ─── parse one numeric token ──────────────────────────────────────
				var pv = 0;

				if (c !== 46) {
					// integer-first path: "2h", "30ms", "2.5h"
					pv = c - 48;
					i++;
					while (i < len) {
						var _c = s.charCodeAt(i);
						var d = _c - 48 >>> 0;
						if (d >= 10) break;
						pv = pv * 10 + d;
						i++;
					}
					if (i < len && s.charCodeAt(i) === 46) {
						i++;
						var fr = 0, div = 1;
						while (i < len) {
							var _c = s.charCodeAt(i);
							var d = _c - 48 >>> 0;
							if (d >= 10) break;
							fr = fr * 10 + d;
							div *= 10;
							i++;
						}
						if (div > 1) pv += fr / div;
					}
				} else {
					// dot-first path: ".5h"
					i++;
					var fr = 0, div = 1;
					while (i < len) {
						var _c = s.charCodeAt(i);
						var d = _c - 48 >>> 0;
						if (d >= 10) break;
						fr = fr * 10 + d;
						div *= 10;
						i++;
					}
					pv = div === 1 ? NaN : fr / div;
				}

				if (pv === pv) {  // NaN guard
					var sp = 0;
					while (i < len && s.charCodeAt(i) === 32 && sp < 3) { i++; sp++; }

					if (i < len) {
						var c0 = s.charCodeAt(i);  // first char of potential notation

						if (c0 === 32 || (c0 - 48 >>> 0) < 10 || c0 === 46) {
							while (i < len) {
								var _c = s.charCodeAt(i);
								if ((_c - 48 >>> 0) < 10 || _c === 46) i++;
								else break;
							}
						} else {
							// ─── notation dispatch with pre-computed avail ────────
							// _avail = remaining chars from current position.
							// Generated checks use _avail >= N instead of i+N <= len.
							var _avail = len - i;
							match: {
${lookupCode}
							}
						}
					}
				}
				continue;
			}

			i++;
		}

		// ─── fallback: mc===0 → no notation matched → try Number() ───────────────
		if (mc === 0) {
			var n = +str;
			return n !== n ? null : n;
		}
		return neg ? -v : v;
	`;

	return craftFunction<ParseFunction>('fastParseV42', [ 'str' ], body, { BOUND });
}

export function buildParse(languages: Language | Language[]): ParseFunction {
	if (languages instanceof Language) return buildSingleParse(languages);
	if (!Array.isArray(languages) || languages.length === 0 || languages.some(l => !(l instanceof Language)))
		throw new Error('`languages` must be a Language or a non-empty Language[]');
	if (languages.length === 1) return buildSingleParse(languages[0]!);
	const parsers = languages.map(lang => buildSingleParse(lang));
	return (str: string): number | null => {
		if (typeof str !== 'string' || str === '') return null;
		for (const parser of parsers) {
			const result = parser(str);
			if (result !== null) return result;
		}
		const n = Number(str);
		return Number.isNaN(n) ? null : n;
	};
}
