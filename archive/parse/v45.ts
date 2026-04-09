/**
 * Parse v45 — STARTS quick-rejection + `_avail` dispatch (v42 base + early reject).
 *
 * Adds a pre-dispatch bitset check before the full notation if-chain scan:
 *
 *   `if (c0 < 128 && !STARTS[c0]) break match;`
 *
 * `STARTS` is a Uint8Array[128] where `STARTS[c] = 1` iff at least one notation
 * starts with char code `c` (both cases stored). For English: only h/H, m/M,
 * s/S, d/D, w/W, y/Y — about 12 out of 128 chars — have STARTS=1.
 *
 * Why this helps for invalid inputs:
 *   When c0 doesn't start any notation (e.g., "123abc" where 'a' is not a known
 *   first char), the current flat dispatch exhausts all 37 if-chains before
 *   concluding no match. With STARTS, a single array lookup + branch exits
 *   the match block immediately — eliminating ~37 if-condition evaluations.
 *
 * Non-ASCII correctness:
 *   The guard is `c0 < 128 && !STARTS[c0]` (NOT `c0 >= 128 || !STARTS[c0]`).
 *   Non-ASCII first chars (e.g., Japanese kanji) always pass through to the
 *   dispatch — STARTS only rejects ASCII chars not in any notation.
 *
 * For valid inputs (c0 IS a notation first char):
 *   One extra array lookup + compare before the dispatch. Small constant overhead.
 *
 * Combined with `_avail = len - i` from v42 for the length guard.
 *
 * Expected impact:
 *   - Invalid inputs with non-notation c0: dramatic improvement (O(1) vs O(37))
 *   - Invalid inputs with notation c0 but no match: same as v42 (STARTS passes,
 *     still scan through all entries for that first-char group)
 *   - Valid inputs: tiny overhead from the STARTS check (+1 array lookup)
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../utils/craft.ts';
import { extractNotations, generateLookupCode, buildStartsTable } from '../utils/notation.ts';

export function buildFastParse(language: Language): ParseFunction {
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const entries = extractNotations(language.dict);
	const STARTS = buildStartsTable(entries);
	// 5 tabs = nesting level inside: while > if(digit) > if(pv===pv) > if(i<len) > else > match:
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
							match: {
								// ─── Quick rejection: c0 not a notation first-char ───
								// STARTS[c0] = 1 only for chars that start ≥1 notation.
								// For all other chars, skip the entire if-chain scan.
								if (c0 < 128 && !STARTS[c0]) break match;

								// ─── Notation dispatch (flat if-chains + _avail) ─────
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

	return craftFunction<ParseFunction>('fastParseV45', [ 'str' ], body, { BOUND, STARTS });
}
