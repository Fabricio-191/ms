/**
 * Parse v18 — v17 + opt 8: single-pass scan+accumulate.
 *
 * All eight optimizations combined:
 * 1. Manual integer accumulation  — avoids parseFloat(slice()) for integer inputs
 * 2. In-scan sign detection       — avoids str.trim().startsWith('-') at the end
 * 3. Root flat-array dispatch     — Uint8Array[charCode] replaces root-level switch
 * 4. Trie path compression        — linear single-child chains become consecutive char checks
 * 5. Early exit                   — after sign scan, if first char is not digit or dot → Number() fallback
 * 6. Manual decimal accumulation  — avoids parseFloat(slice()) for decimal inputs, zero string allocation
 * 7. Boundary Uint8Array[128]     — single array lookup replaces inline range expression at every terminal
 * 8. Single-pass scan+accumulate  — scan and accumulate in one pass (no separate end-find + re-scan loops)
 *                                   The integer inner loop becomes a tight `while digit { acc; i++ }` with
 *                                   no hasDot branch per iteration. Two separate tight loops replace the
 *                                   mixed digit/dot single loop of v17.
 */
import type { Language } from '../../core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges, buildBoundaryTable, buildRootDispatch } from '../../utils/trie.ts';
import type { ParseFunction, ParseWithCountFunction } from '@src/core/types.ts';
import { craftFunction } from '../../utils/craft.ts';

// ─── opt 3: root dispatch table ───────────────────────────────────────────────

// ─── opt 4 + 7: code generator with path compression + boundary table ─────────

/**
 * Collects a maximal single-child chain from `(cc, node)` downward.
 * Path compression: instead of emitting one `charCodeAt` check per trie level,
 * consecutive single-child nodes are flattened into a sequence of consecutive
 * index checks (`i+0`, `i+1`, …), which V8 can compile as a straight-line
 * sequence with no branching overhead between chars.
 *
 * @returns `chain` — array of `[lo, hi]` char pairs for each position in the chain
 *          (lo = lowercase code, hi = uppercase code; equal when non-letter).
 *          `leaf` — first node that has zero or multiple children (chain terminus).
 */
function collectChain(cc: number, node: TrieNode): { chain: Array<[number, number]>; leaf: TrieNode } {
	const upper = String.fromCharCode(cc).toUpperCase().charCodeAt(0);
	const chain: Array<[number, number]> = [ [ cc, upper ] ];
	let cur = node;

	while (cur.children.size === 1 && cur.multiplier === null) {
		const [ nextCc, nextChild ] = cur.children.entries().next().value!;
		const nextUpper = String.fromCharCode(nextCc).toUpperCase().charCodeAt(0);
		chain.push([ nextCc, nextUpper ]);
		cur = nextChild;
	}

	return { chain, leaf: cur };
}

/**
 * Recursively generates trie-traversal code for a single trie node.
 *
 * For each node it emits (in order):
 *   1. If the node is an accepting state (has a multiplier): a boundary check block
 *      that, on success, adds `parsedValue * multiplier` to `value`, increments
 *      `matchCount`, and breaks the enclosing `notationBlock` label.
 *   2. If the node has one child: path-compressed consecutive char checks via
 *      `collectChain` (e.g. "ears" in "years" → 4 consecutive `charCodeAt` guards).
 *   3. If the node has multiple children: a `switch` on the next char with
 *      case-insensitive pairs (both `'e'` and `'E'` map to the same child).
 *
 * Generated boundary check (accepting node):
 * ```js
 * { const c = s.charCodeAt(i);
 *   if (i >= len || c >= 128 || !BOUND[c]) { value += parsedValue * <mult>; matchCount++; break notationBlock; } }
 * ```
 *
 * Generated single-child compressed check (e.g. 'e'/'E'):
 * ```js
 * { const _c = s.charCodeAt(i + 0); if (_c !== 101 && _c !== 69) break notationBlock; } // 'e'
 * ```
 *
 * Generated multi-child switch (e.g. 'e'/'E' and 'a'/'A' as siblings):
 * ```js
 * switch (s.charCodeAt(i)) {
 *   case 101: // 'e'
 *   case 69:  // 'E'
 *     i++;
 *     <recurse>
 *     break;
 *   ...
 * }
 * ```
 */
function generateCode(node: TrieNode, indent: string): string {
	let code = '';

	if (node.multiplier !== null)
		code += `${indent}{ const c = s.charCodeAt(i); if (i >= len || c >= 128 || !BOUND[c]) { value += parsedValue * ${node.multiplier}; matchCount++; break notationBlock; } }\n`;

	if (node.children.size === 0) return code;

	if (node.children.size === 1) {
		const [ cc, child ] = node.children.entries().next().value!;
		const { chain, leaf } = collectChain(cc, child);

		for (let k = 0; k < chain.length; k++) {
			const [ lo, hi ] = chain[k]!;
			if (lo === hi)
				code += `${indent}if (s.charCodeAt(i + ${k}) !== ${lo}) break notationBlock; // '${String.fromCharCode(lo)}'\n`;

			else
				code += `${indent}{ const _c = s.charCodeAt(i + ${k}); if (_c !== ${lo} && _c !== ${hi}) break notationBlock; } // '${String.fromCharCode(lo)}'\n`;
		}
		code += `${indent}i += ${chain.length};\n`;
		code += generateCode(leaf, indent);
	}
	else {
		code += `${indent}switch (s.charCodeAt(i)) {\n`;
		for (const [ cc, child ] of node.children) {
			const char = String.fromCharCode(cc);
			const upperCc = char.toUpperCase().charCodeAt(0);
			if (cc === upperCc) {
				code += `${indent}\tcase ${cc}: // '${char}'\n`;
			}
			else {
				code += `${indent}\tcase ${cc}: // '${char}'\n`;
				code += `${indent}\tcase ${upperCc}: // '${String.fromCharCode(upperCc)}'\n`;
			}
			code += `${indent}\t\ti++;\n`;
			code += generateCode(child, `${indent}\t\t`);
			code += `${indent}\t\tbreak;\n`;
		}
		code += `${indent}}\n`;
	}

	return code;
}

/**
 * Generates the top-level dispatch `switch` over `ROOT[_c0]` branch IDs.
 *
 * The root trie node's children are pre-indexed into `ROOT[128]` by `buildRootDispatch`:
 *   ROOT[charCode] = branch ID  (1-based; 0 = no notation starts with this char)
 *
 * Generated structure:
 * ```js
 * switch (_c0 < 128 ? ROOT[_c0] : 0) {
 *   case 1:           // e.g. branch for 'y'/'Y'
 *     i++;
 *     <generateCode for that child>
 *     break;
 *   ...
 *   case 0: if (_c0 >= 128) {   // non-ASCII dispatch (Japanese etc.)
 *     switch (_c0) {
 *       case <cc>:
 *         i++;
 *         <generateCode for that child>
 *         break;
 *     }
 *   } break;
 * }
 * ```
 */
function generateRootCode(
	branches: Map<number, TrieNode>,
	nonAscii: Map<number, TrieNode>,
	indent: string,
): string {
	let code = `${indent}switch (_c0 < 128 ? ROOT[_c0] : 0) {\n`;
	for (const [ id, child ] of branches) {
		code += `${indent}\tcase ${id}:\n`;
		code += `${indent}\t\ti++;\n`;
		code += generateCode(child, `${indent}\t\t`);
		code += `${indent}\t\tbreak;\n`;
	}
	if (nonAscii.size > 0) {
		code += `${indent}\tcase 0: if (_c0 >= 128) {\n`;
		code += `${indent}\t\tswitch (_c0) {\n`;
		for (const [ cc, child ] of nonAscii) {
			code += `${indent}\t\t\tcase ${cc}:\n`;
			code += `${indent}\t\t\t\ti++;\n`;
			code += generateCode(child, `${indent}\t\t\t\t`);
			code += `${indent}\t\t\t\tbreak;\n`;
		}
		code += `${indent}\t\t}\n`;
		code += `${indent}\t} break;\n`;
	}
	code += `${indent}}\n`;
	return code;
}

// ─── builder ──────────────────────────────────────────────────────────────────

export function buildFastParse(language: Language, withMatchCount: true): ParseWithCountFunction;
export function buildFastParse(language: Language, withMatchCount?: false): ParseFunction;
export function buildFastParse(language: Language, withMatchCount = false): ParseFunction | ParseWithCountFunction {
	const trie = buildTrie(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const { arr: rootArr, branches, nonAscii } = buildRootDispatch(trie);
	const boundaryArr = buildBoundaryTable(ranges);
	const rootCode = generateRootCode(branches, nonAscii, '\t\t\t\t\t\t');

	const wmc = withMatchCount;
	const retNull = wmc ? '[null, 0]' : 'null';
	const retNum0 = wmc ? '[Number.isNaN(num) ? null : num, 0]' : 'Number.isNaN(num) ? null : num';
	const retNullMid = wmc ? '[null, 0]' : 'null';
	const retNumMid = wmc ? '[num, 0]' : 'num';
	const retFinal = wmc ? '[isNeg ? -value : value, matchCount]' : 'isNeg ? -value : value';

	const source = `
		if (typeof str !== 'string' || str === '') return ${retNull};

		const s = str;
		const len = s.length;

		// opt 2: detect sign before main scan
		let _si = 0;
		while (_si < len && s.charCodeAt(_si) === 32) _si++;
		const isNeg = s.charCodeAt(_si) === 45;
		if (isNeg) {
			_si++;
			while (_si < len && s.charCodeAt(_si) === 32) _si++;
		}

		// opt 5: early exit
		{
			const _fc = s.charCodeAt(_si);
			if (_fc !== 45 && ((_fc - 48) >>> 0) >= 10 && _fc !== 46) {
				const num = Number(str);
				return ${retNum0};
			}
		}

		let value = 0;
		let matchCount = 0;
		let i = _si;

		while (i < len) {
			const cc = s.charCodeAt(i);

			if (((cc - 48) >>> 0) < 10 || cc === 46) {
				// opt 8: single-pass scan+accumulate
				let parsedValue = 0;
				let _c, _d;
				if (cc !== 46) {
					// integer-first path (common case) — tight loop with no hasDot branch per iteration
					parsedValue = cc - 48;
					i++;
					while (i < len && (_c = s.charCodeAt(i), (_d = (_c - 48) >>> 0) < 10)) {
						parsedValue = parsedValue * 10 + _d;
						i++;
					}
					// optional trailing dot + fractional part
					if (i < len && s.charCodeAt(i) === 46) {
						i++;
						let frac = 0, divisor = 1;
						while (i < len && (_c = s.charCodeAt(i), (_d = (_c - 48) >>> 0) < 10)) {
							frac = frac * 10 + _d;
							divisor *= 10;
							i++;
						}
						if (divisor > 1) parsedValue += frac / divisor;
						// "2." stays as integer ("2.h" = 2h)
					}
				} else {
					// dot-first path (".5h", ".h")
					i++;
					let frac = 0, divisor = 1;
					while (i < len && (_c = s.charCodeAt(i), (_d = (_c - 48) >>> 0) < 10)) {
						frac = frac * 10 + _d;
						divisor *= 10;
						i++;
					}
					parsedValue = divisor === 1 ? NaN : frac / divisor;
				}

				if (!Number.isNaN(parsedValue)) {
					let spaces = 0;
					while (i < len && s.charCodeAt(i) === 32 && spaces < 3) { i++; spaces++; }

					notationBlock: if (i < len) {
						const _c0 = s.charCodeAt(i);
						if (_c0 === 32 || ((_c0 - 48) >>> 0) < 10 || _c0 === 46) {
							while (i < len) {
								const c = s.charCodeAt(i);
								if (((c - 48) >>> 0) < 10 || c === 46) { i++; }
								else { break; }
							}
							break notationBlock;
						}
${rootCode}					}
		}
			continue;
		}

		i++;
	}

		if (matchCount === 0) {
			const num = Number(str);
			if (Number.isNaN(num)) return ${retNullMid};
			return ${retNumMid};
		}

		return ${retFinal};
	`;

	return craftFunction<ParseFunction | ParseWithCountFunction>('fastParseV18', [ 'str' ], source, { ROOT: rootArr, BOUND: boundaryArr });
}

/*
 * ─── Example: generated code for English, 'h'/'H' branch ─────────────────────
 *
 * ROOT[104] = ROOT[72] = 5  ← both 'h'(104) and 'H'(72) map to branch ID 5
 *
 * generateRootCode emits the outer dispatch switch:
 *
 *   switch (_c0 < 128 ? ROOT[_c0] : 0) {
 *     // ... other branches (case 1 = 'd'/'D', case 2 = 'm'/'M', ...) ...
 *
 *     case 5:       ← matched when _c0 is 'h'(104) or 'H'(72)
 *       i++;        ← consume the first char
 *       // generateCode for the 'h' child node:
 *       //   node is accepting (h alone = "h" = 3,600,000 ms) AND has children (hr/hrs/hour/hours)
 *       { const c = s.charCodeAt(i); if (i >= len || c >= 128 || !BOUND[c]) { value += parsedValue * 3600000; matchCount++; break notationBlock; } }
 *       switch (s.charCodeAt(i)) {
 *         case 111: // 'o'        ← "hour" / "hours" path
 *         case 79:  // 'O'
 *           i++;
 *           { const _c = s.charCodeAt(i + 0); if (_c !== 117 && _c !== 85) break notationBlock; } // 'u'
 *           { const _c = s.charCodeAt(i + 1); if (_c !== 114 && _c !== 82) break notationBlock; } // 'r'
 *           i += 2;
 *           // path-compressed: "ou" + "r" consumed in one block of consecutive checks
 *           { const c = s.charCodeAt(i); if (i >= len || c >= 128 || !BOUND[c]) { value += parsedValue * 3600000; matchCount++; break notationBlock; } }
 *           { const _c = s.charCodeAt(i + 0); if (_c !== 115 && _c !== 83) break notationBlock; } // 's'
 *           i += 1;
 *           { const c = s.charCodeAt(i); if (i >= len || c >= 128 || !BOUND[c]) { value += parsedValue * 3600000; matchCount++; break notationBlock; } }
 *           break;
 *         case 114: // 'r'        ← "hr" / "hrs" path
 *         case 82:  // 'R'
 *           i++;
 *           { const c = s.charCodeAt(i); if (i >= len || c >= 128 || !BOUND[c]) { value += parsedValue * 3600000; matchCount++; break notationBlock; } }
 *           { const _c = s.charCodeAt(i + 0); if (_c !== 115 && _c !== 83) break notationBlock; } // 's'
 *           i += 1;
 *           { const c = s.charCodeAt(i); if (i >= len || c >= 128 || !BOUND[c]) { value += parsedValue * 3600000; matchCount++; break notationBlock; } }
 *           break;
 *       }
 *       break;
 *
 *     // ... remaining branches ...
 *   }
 *
 * Reading the trace for input "2h":
 *   _c0 = 'h'(104) → ROOT[104] = 5 → case 5
 *   i++ (consume 'h')
 *   boundary check: i is now at end-of-string → condition passes
 *   → value += 2 * 3600000, matchCount++, break notationBlock  ✓
 *
 * Reading the trace for input "2hours":
 *   _c0 = 'h'(104) → case 5, i++ (consume 'h')
 *   boundary check fails (next char 'o' IS a notation char → BOUND['o'] = 1)
 *   switch 'o'(111) → case 111, i++ (consume 'o')
 *   compressed checks: charCodeAt(i+0)='u'(117) ✓, charCodeAt(i+1)='r'(114) ✓, i+=2
 *   boundary check at "hours" → next char 's' IS notation char → BOUND['s'] = 1 → fails
 *   compressed check: charCodeAt(i+0)='s'(115) ✓, i+=1
 *   boundary check at end-of-string → passes
 *   → value += 2 * 3600000, matchCount++, break notationBlock  ✓
 */
