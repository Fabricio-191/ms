/**
 * Parse v46 — Single-char-first dispatch order + `_avail` (v42 base + reordering).
 *
 * Reorders the notation dispatch within each first-char group:
 *   **single-char entry first**, then multi-char longest-first (unchanged).
 *
 * Why this is safe (BOUND guarantee):
 *   For any two notations sharing the same first char with DIFFERENT multipliers
 *   (e.g. 'm'=60000 minute and 'ms'=1 millisecond), the disambiguation comes from
 *   the second char ('s'). Because 's' starts other notations, it is in BOUND:
 *   BOUND['s']=1. The single-char boundary check `!BOUND[_bc]` fails when the next
 *   char is BOUND, so "30ms" correctly rejects single-char 'm' and falls through to
 *   match "ms". The single-char-first order is therefore safe for ALL well-designed
 *   time-unit dictionaries.
 *
 * Performance impact:
 *   For short notations that dominate typical format() output ("2h", "30m", "5s"):
 *   - "2h": 1 check (single-char 'h' + boundary ≥ end) ← vs 4 checks longest-first
 *   - "30m": 1 check ('m' at end) ← vs 5 checks longest-first
 *   - "30ms": 2 checks ('m' boundary-fails → 'ms' matches) ← vs 5 longest-first
 *   - "2hours": 1 check ('h' + boundary 'o' not in BOUND → MATCH; same mult as "hours")
 *
 * Combined with `_avail = len - i` from v42 for the length guard (also best base).
 */
import type { Language } from '../../core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../../utils/trie.ts';
import type { ParseFunction } from '../../core/types.ts';
import { craftFunction } from '../../utils/craft.ts';
import { extractNotations, generateLookupCode } from '../../utils/notation.ts';

export function buildFastParse(language: Language): ParseFunction {
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const entries = extractNotations(language.dict);
	// 5 tabs = nesting level inside: while > if(digit) > if(pv===pv) > if(i<len) > else > match:
	// singleCharFirst=true → single-char entries checked before multi-char within each group
	const lookupCode = generateLookupCode(entries, '\t\t\t\t\t', false, '_avail', true);

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
							// ─── notation dispatch: single-char first, then multi-char
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

	return craftFunction<ParseFunction>('fastParseV46', [ 'str' ], body, { BOUND });
}
