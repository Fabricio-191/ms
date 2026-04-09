/**
 * Parse v47 — Smart single-char-first + `_avail` (uniform-multiplier groups only).
 *
 * Like v46 (single-char-first), but the promotion is applied ONLY to first-char groups
 * where every notation entry shares the same multiplier. For mixed-multiplier groups
 * (e.g. English 'm': m=60,000ms and ms=1ms), longest-first order is preserved.
 *
 * Why this fixes v46's regression:
 *   v46 applies single-char-first unconditionally. For the 'm' group, single-char 'm'
 *   is checked first — it FAILS for "30ms" because BOUND['s']=1 (correct behavior),
 *   but adds 1 wasted check per "30ms" input. Since "30ms" is a common format() output
 *   for millisecond-range values, this overhead outweighs the gains elsewhere.
 *
 *   v47 detects that the 'm' group has multiple multipliers and keeps it in longest-first
 *   order. The 'h', 's', 'd', 'w', 'y' groups (all entries share one multiplier) benefit
 *   from single-char-first: "2h" matches in 1 check, "2hours" also matches in 1 check
 *   (single-char 'h' + boundary 'o' not in BOUND → immediate match, same multiplier).
 *
 * Combined with `_avail = len - i` from v42.
 *
 * Per-group behavior (English):
 *   - h/H (all = 3,600,000): single-char 'h'/'H' first
 *   - m/M (m=60,000, ms=1): longest-first ('minutes', 'minute', 'mins', 'min', 'ms', 'm')
 *   - s/S (all = 1,000): single-char 's'/'S' first
 *   - d/D (all = 86,400,000): single-char 'd'/'D' first
 *   - w/W (all = 604,800,000): single-char 'w'/'W' first
 *   - y/Y (all = 31,557,600,000): single-char 'y'/'Y' first
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../utils/craft.ts';
import { extractNotations, generateLookupCode } from '../utils/notation.ts';

export function buildFastParse(language: Language): ParseFunction {
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const entries = extractNotations(language.dict);
	// 5 tabs = nesting level inside: while > if(digit) > if(pv===pv) > if(i<len) > else > match:
	// 'smart' = single-char first only for uniform-multiplier groups
	const lookupCode = generateLookupCode(entries, '\t\t\t\t\t', false, '_avail', 'smart');

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
							// ─── smart single-char-first dispatch + _avail ────────
							// Single-char checked first for uniform-multiplier groups
							// (h, s, d, w, y); longest-first for mixed (m group).
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

	return craftFunction<ParseFunction>('fastParseV47', [ 'str' ], body, { BOUND });
}
