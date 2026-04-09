/**
 * Parse v44 — MULT1 single-char fast path + `_avail` multi-char dispatch.
 *
 * Restructures the notation dispatch into two phases:
 *
 * Phase 1 — Single-char fast path (O(1) table lookup):
 *   `MULT1[c0]` is a Float64Array[128] with multiplier values for single-char
 *   notations (0 = no single-char notation for this char code). Stores BOTH
 *   uppercase and lowercase, so `MULT1[c0]` works directly without folding.
 *   If MULT1[c0] is non-zero AND the word-boundary check passes → match
 *   immediately (i+=1, v+=pv*mult, mc++). This O(1) path handles the most
 *   common real-world inputs: "2h", "30m", "5s", "1d", "2w", "1y".
 *
 * Phase 2 — Multi-char dispatch (only runs when Phase 1 missed):
 *   Standard flat if-chains (v25/v42-style) using `_avail = len - i` for the
 *   length guard, but with ONLY multi-char entries — single-char notations are
 *   fully handled by Phase 1 and excluded from Phase 2's generated code.
 *   This makes Phase 2's code shorter and more JIT-friendly.
 *
 * Why Phase 1 is safe for inputs like "2hours":
 *   "hours" → c0='h'(104), MULT1[104]=3600000 (non-zero). Boundary check:
 *   _bci=i+1, _bc=s.charCodeAt(i+1)='o'(111). BOUND['o']=1 (it's a letter
 *   that can appear in notations). So !BOUND[_bc] = false → condition fails →
 *   falls through to Phase 2, which correctly matches "hours" as a 5-char entry.
 *
 * Expected gains:
 *   - Inputs with single-char notations: O(1) vs O(N) linear scan — significant
 *     reduction in code executed per token.
 *   - Inputs with multi-char notations: one extra MULT1 array lookup + boundary
 *     check (both miss) before falling through — small overhead.
 *   - Phase 2 code is shorter (no single-char entries) → potentially TurboFan.
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../utils/craft.ts';
import { extractNotations, generateLookupCode, buildBothCaseSingleCharTable } from '../utils/notation.ts';

export function buildFastParse(language: Language): ParseFunction {
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const allEntries = extractNotations(language.dict);
	const MULT1 = buildBothCaseSingleCharTable(allEntries);

	// Phase 2 handles:
	//   - All multi-char notations (always)
	//   - Single-char non-ASCII notations (MULT1 is ASCII-only, so they must stay in Phase 2)
	const multiCharEntries = allEntries.filter(e => e.chars.length > 1 || e.chars[0]! >= 128);
	// 5 tabs = nesting level inside: while > if(digit) > if(pv===pv) > if(i<len) > else > match:
	const lookupCode = generateLookupCode(multiCharEntries, '\t\t\t\t\t', false, '_avail');

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
							match: {
								// ─── Phase 1: single-char fast path (O(1)) ───────────
								// MULT1[c0] = multiplier if c0 starts a single-char notation
								// (both upper and lower case stored); 0 = no match.
								if (c0 < 128) {
									var _m1 = MULT1[c0];
									if (_m1) {
										const _bci = i+1, _bc = s.charCodeAt(_bci);
										if (_bci >= len || _bc >= 128 || !BOUND[_bc])
											{ i += 1; v += pv * _m1; mc++; break match; }
									}
								}

								// ─── Phase 2: multi-char dispatch (flat if-chains) ────
								// Single-char entries excluded — handled entirely by Phase 1.
								var _avail = len - i;
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

	return craftFunction<ParseFunction>('fastParseV44', [ 'str' ], body, { BOUND, MULT1 });
}
