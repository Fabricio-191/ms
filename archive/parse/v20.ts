/**
 * Parse v20 — v19 + INT_TABLE for 0-9999 lookup.
 *
 * All optimizations from v19, plus:
 * 10. INT_TABLE — pre-computed 10000-entry table for integers 0-9999.
 *    Instead of digit-by-digit accumulation (`value = value * 10 + digit`),
 *    we look up 1-4 digit clusters in O(1). For common cases (1-4 digit numbers),
 *    this replaces 1-4 multiply-add operations with a single table lookup.
 *    The index is computed from character codes directly without string slicing.
 */
import type { Language } from '../../src/core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges, buildBoundaryTable, buildRootDispatch } from '../utils/trie.ts';
import type { ParseFunction } from '@src/core/types.ts';

// #region INT_TABLE: 10000-entry lookup for integers 0-9999
const INT_TABLE: number[] = [];
for (let i = 0; i < 10000; i++) INT_TABLE[i] = i;
// #endregion

// ─── opt 3: root dispatch table ───────────────────────────────────────────────

// ─── opt 4 + 7: code generator with path compression + boundary table ─────────

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

export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrie(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const { arr: rootArr, branches, nonAscii } = buildRootDispatch(trie);
	const boundaryArr = buildBoundaryTable(ranges);
	const rootCode = generateRootCode(branches, nonAscii, '\t\t\t\t\t\t');

	const source = `
		if (typeof str !== 'string' || str === '') return null;

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
				return Number.isNaN(num) ? null : num;
			}
		}

		let value = 0;
		let matchCount = 0;
		let i = _si;

		while (i < len) {
			const cc = s.charCodeAt(i);

			if (((cc - 48) >>> 0) < 10 || cc === 46) {
				// opt 8 + 9 + 10: INT_TABLE lookup for 1-4 digit clusters
				let parsedValue = 0;
				let _d;
				if (cc !== 46) {
					// integer-first path: try INT_TABLE lookup for up to 4 digits
					parsedValue = cc - 48;
					i++;

					// opt 10: check for 4-digit cluster (most common: 1-4 digits)
					if (i + 3 < len) {
						const d1 = (s.charCodeAt(i) - 48) >>> 0;
						const d2 = (s.charCodeAt(i + 1) - 48) >>> 0;
						const d3 = (s.charCodeAt(i + 2) - 48) >>> 0;
						const d4 = (s.charCodeAt(i + 3) - 48) >>> 0;
						if (d1 < 10 && d2 < 10 && d3 < 10 && d4 < 10) {
							// 4+ digit fast path: INT_TABLE gives us the 4-digit value
							const fourDigitIdx = parsedValue * 1000 + d1 * 100 + d2 * 10 + d3;
							parsedValue = TABLE[fourDigitIdx] * 10 + d4;
							i += 4;

							// continue with remaining digits (5+) using standard loop
							let _c;
							while (i < len && (_c = s.charCodeAt(i), (_d = (_c - 48) >>> 0) < 10)) {
								parsedValue = parsedValue * 10 + _d;
								i++;
							}
						} else if (d1 < 10) {
							// 2nd digit is valid but not enough for 4-digit cluster
							parsedValue = parsedValue * 10 + d1;
							i++;
							if (d2 < 10) {
								parsedValue = parsedValue * 10 + d2;
								i++;
								if (d3 < 10) {
									parsedValue = parsedValue * 10 + d3;
									i++;
								}
							}
						}
					} else {
						// string ends within 4 chars of start - unrolled check
						if (i < len && (_d = (s.charCodeAt(i) - 48) >>> 0) < 10) {
							parsedValue = parsedValue * 10 + _d;
							i++;
							if (i < len && (_d = (s.charCodeAt(i) - 48) >>> 0) < 10) {
								parsedValue = parsedValue * 10 + _d;
								i++;
								if (i < len && (_d = (s.charCodeAt(i) - 48) >>> 0) < 10) {
									parsedValue = parsedValue * 10 + _d;
									i++;
								}
							}
						}
					}

					// optional trailing dot + fractional part
					if (i < len && s.charCodeAt(i) === 46) {
						i++;
						let frac = 0, divisor = 1, _c;
						while (i < len && (_c = s.charCodeAt(i), (_d = (_c - 48) >>> 0) < 10)) {
							frac = frac * 10 + _d;
							divisor *= 10;
							i++;
						}
						if (divisor > 1) parsedValue += frac / divisor;
					}
				} else {
					// dot-first path (".5h", ".h")
					i++;
					let frac = 0, divisor = 1, _c;
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
			if (Number.isNaN(num)) return null;
			return num;
		}

		return isNeg ? -value : value;
	`;

	const fn = Function('ROOT', 'BOUND', 'TABLE', 'str', source) as (ROOT: Uint8Array, BOUND: Uint8Array, TABLE: number[], str: string) => number | null;
	return fn.bind(null, rootArr, boundaryArr, INT_TABLE) as ParseFunction;
}
