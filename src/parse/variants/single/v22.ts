/**
 * Parse v22 — v19+branchless digit lookup table.
 *
 * All optimizations from v19, plus:
 * 10. DIGIT_TABLE — Int8Array[256] maps ASCII codes to digit values (-1 for non-digits).
 *    Replaces arithmetic `(cc -48) >>> 0) < 10` with single table lookup.
 *    - Eliminates subtraction and unsigned coercion per-character
 *    - Table lookup is branchless (single memory access)
 *    - Likely L1 cache resident for hot paths
 *    - Direct comparison `d >=0` is CPU-predictable for typical digit streams
 */
import type { Language } from '../../../core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges, buildBoundaryTable } from '../../../utils/_trie.ts';

type FastParseFunction = (str: string) => number | null;

// ─── opt 10: branchless digit lookup table ───────────────────────────────────────

const DIGIT: Int8Array = new Int8Array(256);
DIGIT.fill(-1);
for (let i = 48; i <= 57; i++) DIGIT[i] = i - 48;

// ─── opt 3: root dispatch table ───────────────────────────────────────────────

interface RootDispatch {
	arr: Uint8Array;
	branches: Map<number, TrieNode>;
	nonAscii: Map<number, TrieNode>;
}

function buildRootDispatch(root: TrieNode): RootDispatch {
	const arr = new Uint8Array(128);
	const branches = new Map<number, TrieNode>();
	const nonAscii = new Map<number, TrieNode>();
	let nextId = 1;

	for (const [ cc, child ] of root.children) {
		if (cc < 128) {
			const id = nextId++;
			branches.set(id, child);
			arr[cc] = id;
			const upperCc = String.fromCharCode(cc).toUpperCase().charCodeAt(0);
			if (upperCc !== cc && upperCc < 128) arr[upperCc] = id;
		}
		else {
			nonAscii.set(cc, child);
		}
	}

	return { arr, branches, nonAscii };
}

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

export function buildFastParse(language: Language): FastParseFunction {
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

		// opt 5 + 10: early exit using DIGIT table
		{
			const _fc = s.charCodeAt(_si);
			if (_fc !== 45 && DIGIT[_fc] < 0 && _fc !== 46) {
				const num = Number(str);
				return Number.isNaN(num) ? null : num;
			}
		}

		let value = 0;
		let matchCount = 0;
		let i = _si;

		while (i < len) {
			const cc = s.charCodeAt(i);

			if (DIGIT[cc] >= 0 || cc === 46) {
				// opt 8 + 9 + 10: single-pass + unrolled first two extra digits + DIGIT table
				let parsedValue = 0;
				let d;
				if (cc !== 46) {
					// integer-first path: unroll 2 digits, then fall into general loop for 3+
					parsedValue = DIGIT[cc];
					i++;
					if (i < len && (d = DIGIT[s.charCodeAt(i)]) >= 0) {
						parsedValue = parsedValue * 10 + d;
						i++;
						if (i < len && (d = DIGIT[s.charCodeAt(i)]) >= 0) {
							parsedValue = parsedValue * 10 + d;
							i++;
							// general loop for 3+ additional digits
							let c;
							while (i < len && (c = s.charCodeAt(i), (d = DIGIT[c]) >= 0)) {
								parsedValue = parsedValue * 10 + d;
								i++;
							}
						}
					}
					// optional trailing dot + fractional part
					if (i < len && s.charCodeAt(i) === 46) {
						i++;
						let frac = 0, divisor = 1, c;
						while (i < len && (c = s.charCodeAt(i), (d = DIGIT[c]) >= 0)) {
							frac = frac * 10 + d;
							divisor *= 10;
							i++;
						}
						if (divisor > 1) parsedValue += frac / divisor;
					}
				} else {
					// dot-first path (".5h", ".h")
					i++;
					let frac = 0, divisor = 1, c;
					while (i < len && (c = s.charCodeAt(i), (d = DIGIT[c]) >= 0)) {
						frac = frac * 10 + d;
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
						if (_c0 === 32 || DIGIT[_c0] >= 0 || _c0 === 46) {
							while (i < len) {
								const c = s.charCodeAt(i);
								if (DIGIT[c] >= 0 || c === 46) { i++; }
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

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	const fn = Function('ROOT', 'BOUND', 'DIGIT', 'str', source) as (ROOT: Uint8Array, BOUND: Uint8Array, DIGIT: Int8Array, str: string) => number | null;
	return fn.bind(null, rootArr, boundaryArr, DIGIT) as FastParseFunction;
}
