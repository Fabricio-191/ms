/**
 * Parse v41 — `const c1` per-group caching via `craftFunction`.
 *
 * Same algorithm as v25/v32, but each first-char dispatch block pre-reads
 * `s.charCodeAt(i+1)` into a block-scoped `const c1` and reuses it for all
 * multi-char entries in the group, eliminating redundant charCodeAt calls.
 *
 * `const` vs `var` for the c1 cache:
 *   - `var c1` (v38) is hoisted to function scope — V8 sees one mutable variable
 *     shared across all groups, making type analysis harder.
 *   - `const c1` is block-scoped to the `if (c0===X) { ... }` block — each group
 *     has a semantically distinct variable. V8 can infer a stable integer type per
 *     group and potentially eliminate the read if it proves c1 is not used.
 *
 * Trade-off: the c1 read is unconditional (computed even if `i+elen<=len` would
 * fail). For groups where most inputs don't match, the mandatory read cost may
 * exceed the saved redundant reads.
 *
 * Unchanged from v25/v32:
 *   - Separate lo/hi first-char blocks (no merged groups).
 *   - Flat `if` structure within each block (ILP preserved).
 *   - `i+N<=len` length guard for bounds-check elimination.
 *   - 3-condition boundary check.
 */
import type { Language } from '../../core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../../utils/trie.ts';
import type { ParseFunction } from '../../core/types.ts';
import { craftFunction } from '../../utils/craft.ts';
import { extractNotations, generateConstC1LookupCode } from '../../utils/notation.ts';

export function buildFastParse(language: Language): ParseFunction {
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const entries = extractNotations(language.dict);
	// 5 tabs = nesting level inside: while > if(digit) > if(pv===pv) > if(i<len) > else > match:
	const lookupCode = generateConstC1LookupCode(entries, '\t\t\t\t\t');

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
							// ─── notation dispatch with const c1 caching ─────────
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

	return craftFunction<ParseFunction>('fastParseV41', [ 'str' ], body, { BOUND });
}
