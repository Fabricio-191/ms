/**
 * Parse v29 — Compressed-alphabet DFA.
 *
 * Evolution of v27: same fixed-size function body (→ TurboFan) but the
 * transition table is ~7× smaller thanks to alphabet compression.
 *
 * v27 problem: TRANS[numStates × 128] ≈ 15 KB for English — poor L1 cache
 * fit when the benchmark cycles through many different notation strings.
 *
 * Solution:
 *   CHAR_MAP[128]   — maps each ASCII char to a compressed index 1..K.
 *                     0 = "not a notation char" (always transitions to dead state).
 *   TRANS[numStates × (K+1)]  — K = number of distinct ASCII notation chars.
 *
 * For English: K ≈ 17 → TRANS ≈ 60 × 18 × 2 bytes ≈ 2 KB.
 * CHAR_MAP itself is 128 bytes, permanently hot in L1.
 * Total working set: ~2.5 KB (vs ~15 KB for v27).
 *
 * The generated source is still fully language-independent (ALPHA is baked in
 * as a numeric literal). Function body size ≈ v27 → TurboFan expected.
 *
 * Non-ASCII languages (Japanese): all notation chars are non-ASCII, so K = 0
 * and ALPHA = 1. All transitions go through the NA_KEYS/NA_VALS binary search,
 * same as v27.
 */
import type { Language } from '../../core/index.ts';
import { buildTrie, collectCharRanges, buildBoundaryTable } from '../../utils/trie.ts';
import type { ParseFunction } from '../../core/types.ts';
import { buildDFA } from '../../utils/dfa.ts';
import { craftFunction } from '../../utils/craft.ts';

export type { ParseFunction };

// ─── Compressed-alphabet DFA builder ─────────────────────────────────────────

/**
 * Builds the compressed alphabet mapping and a compressed TRANS table from a
 * full 128-wide DFA transition table.
 *
 * Returns:
 *   CHAR_MAP[128]   — char code → compressed index (1-based; 0 = not in alphabet)
 *   TRANS_C[numStates × ALPHA]  — compressed table (ALPHA = K + 1, K distinct chars)
 *   ALPHA           — number of columns in TRANS_C
 */
function buildCompressed(TRANS_full: Uint16Array, numStates: number): {
	CHAR_MAP: Uint8Array;
	TRANS_C: Uint16Array;
	ALPHA: number;
} {
	// Collect all ASCII chars that appear as non-zero transitions anywhere.
	const usedChars = new Set<number>();
	for (let s = 1; s < numStates; s++) {
		for (let c = 0; c < 128; c++)
			if (TRANS_full[s * 128 + c] !== 0) usedChars.add(c);
	}

	// Sort for determinism; assign compressed indices 1..K.
	const sortedChars = [ ...usedChars ].sort((a, b) => a - b);
	const K = sortedChars.length;
	const ALPHA = K + 1; // column 0 = "not in alphabet" (always dead)

	const CHAR_MAP = new Uint8Array(128); // default 0 = not in alphabet
	for (let i = 0; i < K; i++) CHAR_MAP[sortedChars[i]!] = i + 1;

	// Build compressed table.
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

/**
 * Generates a fixed-size parse source string parameterised only by the ALPHA
 * constant. The body structure is identical to v27's; the only difference is
 * the inner DFA step:
 *
 *   v27: `nxt = TRANS[st * 128 + cc]`
 *   v29: `nxt = TRANS[st * ALPHA + (CHAR_MAP[cc] | 0)]`
 *
 * Since ALPHA is baked as a literal and the structure is otherwise unchanged,
 * the bytecode size is essentially the same as v27 → TurboFan expected.
 *
 * Variables captured from context (via craftFunction closure):
 *   CHAR_MAP — Uint8Array[128]: charCode → compressed alphabet index (0 = not in alphabet)
 *   TRANS    — Uint16Array[numStates × ALPHA]: state × compressedChar → nextState (0 = dead)
 *   MULTS    — Float64Array[numStates]: multiplier for accepting states (0 = not accepting)
 *   BOUND    — Uint8Array[128]: BOUND[c]=1 means c is a valid notation-boundary char
 *   NA_KEYS  — Uint32Array: sorted (fromState<<16|charCode) keys for non-ASCII transitions
 *   NA_VALS  — Uint16Array: toState for each NA_KEYS entry
 */
function makeSource(ALPHA: number): string {
	return `
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
							// Run the compressed-alphabet DFA starting from root state 1.
							// Advance i on each matching char; stop on dead state (nxt=0).
							// On reaching an accepting state with a valid word boundary,
							// accumulate pv*multiplier and break match.
							match: {
								var st = 1, nxt = 0;

								while (i < len) {
									var cc = s.charCodeAt(i);

									if (cc < 128) {
										// ASCII: CHAR_MAP[cc] = compressed index (0 = not in alphabet)
										// TRANS[st * ALPHA + idx] = next state (0 = dead)
										nxt = TRANS[st * ${ALPHA} + (CHAR_MAP[cc] | 0)];
									} else {
										// Non-ASCII: binary search over packed (fromState<<16|charCode) keys
										var lo = 0, hi = NA_KEYS.length - 1, key = (st << 16) | cc;
										nxt = 0;
										while (lo <= hi) {
											var mid = (lo + hi) >>> 1;
											if (NA_KEYS[mid] === key) { nxt = NA_VALS[mid]; break; }
											else if (NA_KEYS[mid] < key) lo = mid + 1;
											else hi = mid - 1;
										}
									}

									if (!nxt) break;  // dead state → no notation matched
									st = nxt;
									i++;

									var m = MULTS[st];  // multiplier (0 = not an accepting state)
									if (m) {
										// Accepting state — check word boundary
										var bc = s.charCodeAt(i);
										if (i >= len || bc >= 128 || !BOUND[bc]) {
											v += pv * m;
											mc++;
											break match;
										}
										// Boundary check failed → notation may continue ("hour" before "hours")
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
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrie(language.dict);
	const { TRANS: TRANS_full, MULTS, NA_KEYS, NA_VALS, numStates } = buildDFA(trie);
	const { CHAR_MAP, TRANS_C: TRANS, ALPHA } = buildCompressed(TRANS_full, numStates);
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);

	const source = makeSource(ALPHA);
	return craftFunction<ParseFunction>(
		'fastParseV29',
		[ 'str' ],
		source,
		{ CHAR_MAP, TRANS, MULTS, BOUND, NA_KEYS, NA_VALS },
	);
}

/*
 * ─── Example: English DFA dimensions and dispatch trace ───────────────────────
 *
 * For LANGUAGES.en:
 *   numStates = 66  (1 dead + 1 root + 64 trie nodes in BFS order)
 *   K         = 34  distinct ASCII notation chars (both cases of each letter used)
 *   ALPHA     = 35  columns in TRANS (index 0 = "not in alphabet" → dead state)
 *
 * ASCII notation chars mapped by CHAR_MAP (a–z range, both cases):
 *   A(65)→1  C(67)→2  D(68)→3  E(69)→4  H(72)→5  I(73)→6  K(75)→7
 *   L(76)→8  M(77)→9  N(78)→10 O(79)→11 R(82)→12 S(83)→13 T(84)→14
 *   U(85)→15 W(87)→16 Y(89)→17 a(97)→18 c(99)→19 d(100)→20 e(101)→21
 *   h(104)→22 i(105)→23 k(107)→24 l(108)→25 m(109)→26 n(110)→27
 *   o(111)→28 r(114)→29 s(115)→30 t(116)→31 u(117)→32 w(119)→33 y(121)→34
 *   all others → 0 (dead)
 *
 * TRANS layout:
 *   TRANS[state * 35 + compressedIndex] = nextState  (0 = dead)
 *   e.g. TRANS[1 * 35 + 22] = state for 'h' child of root   (22 = CHAR_MAP['h'])
 *        TRANS[1 * 35 + 5]  = same state                     ( 5 = CHAR_MAP['H'])
 *
 * makeSource(35) bakes "35" as a literal in the generated source:
 *   nxt = TRANS[st * 35 + (CHAR_MAP[cc] | 0)];
 *   ─────────────────────────────────────────
 *   2 array reads per char (CHAR_MAP + TRANS) vs 2 comparisons per char in v25.
 *   The memory indirection is why v29 (TurboFan) is slower than v25 (Maglev).
 *
 * Dispatch trace for input "2hours":
 *   st=1, cc='h'(104) → CHAR_MAP[104]=22 → nxt=TRANS[1*35+22]=stateH
 *   MULTS[stateH] = 3600000 (accepting: "h" alone is valid)
 *   boundary: next char 'o' → BOUND['o']=1 → fails → continue DFA
 *
 *   st=stateH, cc='o'(111) → CHAR_MAP[111]=28 → nxt=TRANS[stateH*35+28]=stateHO
 *   MULTS[stateHO] = 0 (not accepting)
 *
 *   st=stateHO, cc='u' → nxt=stateHOU  (MULTS=0)
 *   st=stateHOU, cc='r' → nxt=stateHOUR
 *   MULTS[stateHOUR] = 3600000 → boundary: next char 's' → BOUND['s']=1 → fails
 *
 *   st=stateHOUR, cc='s' → nxt=stateHOURS
 *   MULTS[stateHOURS] = 3600000 → boundary: end-of-string → passes
 *   → v += 2 * 3600000, mc++, break match  ✓
 */
