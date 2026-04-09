/**
 * Parse v17 — v15 + v16: manual decimal accumulation + boundary lookup table.
 *
 * All seven optimizations combined:
 * 1. Manual integer accumulation  — avoids parseFloat(slice()) for integer inputs
 * 2. In-scan sign detection       — avoids str.trim().startsWith('-') at the end
 * 3. Root flat-array dispatch     — Uint8Array[charCode] replaces root-level switch
 * 4. Trie path compression        — linear single-child chains become consecutive char checks
 * 5. Early exit                   — after sign scan, if first char is not digit or dot → Number() fallback
 * 6. Manual decimal accumulation  — avoids parseFloat(slice()) for decimal inputs, zero string allocation
 * 7. Boundary Uint8Array[128]     — single array lookup replaces inline range expression at every terminal
 */
import type { Language } from '../../src/core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges, buildBoundaryTable } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';

// ─── opt 3: root dispatch table ───────────────────────────────────────────────

interface RootDispatch {
	arr: Uint8Array;
	branches: Map<number, TrieNode>;
}

function buildRootDispatch(root: TrieNode): RootDispatch {
	const arr = new Uint8Array(128);
	const branches = new Map<number, TrieNode>();
	let nextId = 1;

	for (const [ cc, child ] of root.children) {
		const id = nextId++;
		branches.set(id, child);
		if (cc < 128) arr[cc] = id;
		const upperCc = String.fromCharCode(cc).toUpperCase().charCodeAt(0);
		if (upperCc !== cc && upperCc < 128) arr[upperCc] = id;
	}

	return { arr, branches };
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

	if (node.multiplier !== null) {
		// opt 7: single BOUND[] lookup
		code += `${indent}{ const c = s.charCodeAt(i); if (i >= len || c >= 128 || !BOUND[c]) { value += parsedValue * ${node.multiplier}; matchCount++; break notationBlock; } }\n`;
	}

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

function generateRootCode(branches: Map<number, TrieNode>, indent: string): string {
	let code = `${indent}switch (_c0 < 128 ? ROOT[_c0] : 0) {\n`;
	for (const [ id, child ] of branches) {
		code += `${indent}\tcase ${id}:\n`;
		code += `${indent}\t\ti++;\n`;
		code += generateCode(child, `${indent}\t\t`);
		code += `${indent}\t\tbreak;\n`;
	}
	code += `${indent}}\n`;
	return code;
}

// ─── builder ──────────────────────────────────────────────────────────────────

export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrie(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const { arr: rootArr, branches } = buildRootDispatch(trie);
	const boundaryArr = buildBoundaryTable(ranges);
	const rootCode = generateRootCode(branches, '\t\t\t\t\t\t');

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
				const numStart = i;
				let hasDot = cc === 46;
				i++;
				while (i < len) {
					const c = s.charCodeAt(i);
					if (((c - 48) >>> 0) < 10) { i++; }
					else if (c === 46 && !hasDot) { hasDot = true; i++; }
					else { break; }
				}

				// opt 1 + 6: manual accumulation for both integers and decimals
				let parsedValue = 0;
				if (hasDot) {
					if (i > numStart + 1) {
						// integer part up to the dot
						let k = numStart;
						while (k < i && s.charCodeAt(k) !== 46) {
							parsedValue = parsedValue * 10 + (s.charCodeAt(k) - 48);
							k++;
						}
						k++; // skip dot
						// fractional part
						let frac = 0;
						let divisor = 1;
						while (k < i) {
							frac = frac * 10 + (s.charCodeAt(k) - 48);
							divisor *= 10;
							k++;
						}
						parsedValue += frac / divisor;
					} else {
						parsedValue = NaN;
					}
				} else {
					for (let k = numStart; k < i; k++)
						parsedValue = parsedValue * 10 + (s.charCodeAt(k) - 48);
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

	const fn = Function('ROOT', 'BOUND', 'str', source) as (ROOT: Uint8Array, BOUND: Uint8Array, str: string) => number | null;
	return fn.bind(null, rootArr, boundaryArr) as ParseFunction;
}
