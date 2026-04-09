/**
 * Parse v31 — Compressed DFA via `craftFunction` closure.
 *
 * Originally written with `eval()` to test whether an eval closure whose body
 * is a compressed-alphabet DFA (small, fixed-size) could reach TurboFan.
 * The experiment confirmed it could (status 1073 = TurboFan + Maglev).
 *
 * Now migrated to `craftFunction()` — same zero arg-overhead, same TurboFan
 * eligibility, no direct `eval()`.
 *
 * Algorithm: identical to v29. See v29.ts for the compressed-alphabet DFA details.
 */
import type { Language } from '../../src/core/index.ts';
import { buildTrie, collectCharRanges, buildBoundaryTable } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { buildDFA } from '../utils/dfa.ts';
import { craftFunction } from '../utils/craft.ts';

export type { ParseFunction };

// ─── Compressed-alphabet builder (same as v29) ───────────────────────────────

function buildCompressed(TRANS_full: Uint16Array, numStates: number): {
	CHAR_MAP: Uint8Array;
	TRANS_C: Uint16Array;
	ALPHA: number;
} {
	const usedChars = new Set<number>();
	for (let s = 1; s < numStates; s++) {
		for (let c = 0; c < 128; c++)
			if (TRANS_full[s * 128 + c] !== 0) usedChars.add(c);
	}

	const sortedChars = [ ...usedChars ].sort((a, b) => a - b);
	const K = sortedChars.length;
	const ALPHA = K + 1;

	const CHAR_MAP = new Uint8Array(128);
	for (let i = 0; i < K; i++) CHAR_MAP[sortedChars[i]!] = i + 1;

	const TRANS_C = new Uint16Array(numStates * ALPHA);
	for (let s = 1; s < numStates; s++) {
		for (let c = 0; c < 128; c++) {
			const toState = TRANS_full[s * 128 + c];
			if (!toState) continue;
			const ai = CHAR_MAP[c]!; // always > 0 here since TRANS[s*128+c] != 0
			TRANS_C[s * ALPHA + ai] = toState;
		}
	}

	return { CHAR_MAP, TRANS_C, ALPHA };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds the fast-parse function using a compressed-alphabet DFA.
 *
 * Variables captured from context (via craftFunction closure):
 *   CHAR_MAP — Uint8Array[128]: charCode → compressed alphabet index (0 = not in alphabet)
 *   TRANS    — Uint16Array[numStates × ALPHA]: state × compressedChar → nextState (0 = dead)
 *   MULTS    — Float64Array[numStates]: multiplier for accepting states (0 = not accepting)
 *   BOUND    — Uint8Array[128]: BOUND[c]=1 means c is a valid notation-boundary char
 *   NA_KEYS  — Uint32Array: sorted (fromState<<16|charCode) keys for non-ASCII transitions
 *   NA_VALS  — Uint16Array: toState for each NA_KEYS entry
 *
 * See v29.ts `makeSource` for full source comments.
 */
export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrie(language.dict);
	const { TRANS: TRANS_full, MULTS, NA_KEYS, NA_VALS, numStates } = buildDFA(trie);
	const { CHAR_MAP, TRANS_C: TRANS, ALPHA } = buildCompressed(TRANS_full, numStates);
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);

	const source = `
		// ─── guard: type check and empty string ──────────────────────────────────
		if (typeof str !== 'string' || str === '') return null;

		var s = str, len = s.length;

		// ─── skip leading spaces, detect optional leading sign ────────────────────
		var si = 0;
		while (si < len && s.charCodeAt(si) === 32) si++;  // 32 = ' '
		var neg = s.charCodeAt(si) === 45;                  // 45 = '-'
		if (neg) {
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
							// ─── DFA-based notation dispatch ──────────────────────
							// Run the compressed-alphabet DFA from root state 1.
							// See v29.ts makeSource for detailed comments.
							match: {
								var st = 1, nxt = 0;

								while (i < len) {
									var cc = s.charCodeAt(i);

									if (cc < 128) {
										// ASCII: CHAR_MAP[cc] = compressed index (0 = not in alphabet)
										nxt = TRANS[st * ${ALPHA} + (CHAR_MAP[cc] | 0)];
									} else {
										// Non-ASCII: binary search in NA_KEYS/NA_VALS
										var lo = 0, hi = NA_KEYS.length - 1, key = (st << 16) | cc;
										nxt = 0;
										while (lo <= hi) {
											var mid = (lo + hi) >>> 1;
											if (NA_KEYS[mid] === key) { nxt = NA_VALS[mid]; break; }
											else if (NA_KEYS[mid] < key) lo = mid + 1;
											else hi = mid - 1;
										}
									}

									if (!nxt) break;  // dead state
									st = nxt;
									i++;

									var m = MULTS[st];  // multiplier (0 = not accepting)
									if (m) {
										var bc = s.charCodeAt(i);
										if (i >= len || bc >= 128 || !BOUND[bc]) {
											v += pv * m;
											mc++;
											break match;
										}
									}
								}
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

	return craftFunction<ParseFunction>(
		'fastParseV31',
		[ 'str' ],
		source,
		{ CHAR_MAP, TRANS, MULTS, BOUND, NA_KEYS, NA_VALS },
	);
}

/*
 * ─── Example: generated source and craftFunction wrapper ──────────────────────
 *
 * The generated source is identical to v29's makeSource(ALPHA) — see v29.ts for
 * DFA dimensions, CHAR_MAP indices, and dispatch trace.
 *
 * What craftFunction produces at build time (called once per language):
 *
 *   // outer factory — called immediately and discarded:
 *   new Function('ctx', `
 *     var CHAR_MAP = ctx['CHAR_MAP'];   // Uint8Array[128]
 *     var TRANS    = ctx['TRANS'];      // Uint16Array[numStates * ALPHA]
 *     var MULTS    = ctx['MULTS'];      // Float64Array[numStates]
 *     var BOUND    = ctx['BOUND'];      // Uint8Array[128]
 *     var NA_KEYS  = ctx['NA_KEYS'];    // Uint32Array  (non-ASCII transition keys)
 *     var NA_VALS  = ctx['NA_VALS'];    // Uint16Array  (non-ASCII transition values)
 *
 *     function fastParseV31(str) {
 *       // ... full source from makeSource(ALPHA) ...
 *       match: {
 *         var st = 1, nxt = 0;
 *         while (i < len) {
 *           var cc = s.charCodeAt(i);
 *           if (cc < 128) {
 *             nxt = TRANS[st * 35 + (CHAR_MAP[cc] | 0)];  // ALPHA=35 for English
 *           } else {
 *             // binary search in NA_KEYS / NA_VALS
 *             var lo=0, hi=NA_KEYS.length-1, key=(st<<16)|cc; nxt=0;
 *             while (lo<=hi) { var mid=(lo+hi)>>>1; ... }
 *           }
 *           if (!nxt) break;
 *           st = nxt; i++;
 *           var m = MULTS[st];
 *           if (m) {
 *             var bc = s.charCodeAt(i);
 *             if (i>=len || bc>=128 || !BOUND[bc]) { v+=pv*m; mc++; break match; }
 *           }
 *         }
 *       }
 *       // ...
 *     }
 *     return fastParseV31;
 *   `)({ CHAR_MAP, TRANS, MULTS, BOUND, NA_KEYS, NA_VALS })
 *
 * The inner `fastParseV31` captures all six typed arrays as closure locals.
 * This is why TRANS[st * 35 + ...] compiles to a plain array-index op at
 * TurboFan tier — no property lookup, no argument passing overhead.
 */
