/**
 * Parse v32 — Flat lookup table via `craftFunction` (v25-equivalent, eval-free).
 *
 * Identical algorithm to v25. Created to test whether `craftFunction` vs `eval()`
 * affects JIT tier for the same generated body.
 *
 * craftFunction() builds:
 *   new Function('ctx', `
 *     var BOUND = ctx['BOUND'];
 *     function fastParseV32(str) { <same body as v25> }
 *     return fastParseV32;
 *   `)({ BOUND })
 *
 * The outer `new Function` is called once and discarded. The inner named function
 * captures `BOUND` as a closure local — zero arg-passing overhead, no eval.
 *
 * Hypothesis: V8 may TurboFan the inner function independently of the outer
 * wrapper, since it is not tainted by direct `eval()` scope. Result: both land at
 * Maglev — the body size (~75 lines) controls the tier, not the eval vs craftFunction choice.
 */
import type { Language } from '../../core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../../utils/trie.ts';
import type { ParseFunction } from '../../core/types.ts';
import { craftFunction } from '../../utils/craft.ts';
import { extractNotations, generateLookupCode } from '../../utils/notation.ts';

export type { ParseFunction };

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildFastParse(language: Language): ParseFunction {
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const entries = extractNotations(language.dict);
	// 5 tabs = nesting level inside: while > if(digit) > if(pv===pv) > if(i<len) > else > match:
	const lookupCode = generateLookupCode(entries, '\t\t\t\t\t');

	// ─── Generated function source ────────────────────────────────────────────
	// Variables captured from context (via craftFunction closure):
	//   BOUND — Uint8Array[128]: BOUND[c]=1 means c is a valid notation-start/boundary char
	//
	// See v25.ts for a full description of the runtime variables and algorithm.

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
						var c0 = s.charCodeAt(i);

						if (c0 === 32 || (c0 - 48 >>> 0) < 10 || c0 === 46) {
							while (i < len) {
								var _c = s.charCodeAt(i);
								if ((_c - 48 >>> 0) < 10 || _c === 46) i++;
								else break;
							}
						} else {
							// ─── notation dispatch ────────────────────────────────
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

	return craftFunction<ParseFunction>('fastParseV32', [ 'str' ], body, { BOUND });
}

/*
 * ─── Example: generated source and craftFunction wrapper ──────────────────────
 *
 * The generated notation dispatch is identical to v25 — see v25.ts for the full
 * 'h' group example and the ILP explanation.
 *
 * The key difference from v25 is that v32 captures only `BOUND` in the closure
 * (v25 also captures only `BOUND`). What craftFunction produces at build time:
 *
 *   new Function('ctx', `
 *     var BOUND = ctx['BOUND'];   // Uint8Array[128]: valid notation-boundary chars
 *
 *     function fastParseV32(str) {
 *       // ... number-parsing engine ...
 *       match: {
 *         // "hours" → 3,600,000 ms
 *         if (c0 === 104  // 'h'(104)
 *          && i+5 <= len
 *          && (s.charCodeAt(i+1) === 111 || s.charCodeAt(i+1) === 79)  // 'o'/'O'
 *          && (s.charCodeAt(i+2) === 117 || s.charCodeAt(i+2) === 85)  // 'u'/'U'
 *          && (s.charCodeAt(i+3) === 114 || s.charCodeAt(i+3) === 82)  // 'r'/'R'
 *          && (s.charCodeAt(i+4) === 115 || s.charCodeAt(i+4) === 83)) // 's'/'S'
 *         {
 *             const _bci = i+5, _bc = s.charCodeAt(_bci);
 *             if (_bci >= len || _bc >= 128 || !BOUND[_bc])
 *                 { i += 5; v += pv * 3600000; mc++; break match; }
 *         }
 *         // ... hour, hrs, hr, h, Hours, Hour, Hrs, Hr, H ...
 *         // ... all other first-char groups ...
 *       }
 *       // ...
 *     }
 *     return fastParseV32;
 *   })({ BOUND })
 *
 * v32 vs v25: both reach Maglev with the same body size (~75 lines of generated JS).
 * The hypothesis that craftFunction would reach TurboFan (avoiding eval() scope
 * taint) was disproved — JIT tier is controlled by bytecode size, not eval origin.
 */
