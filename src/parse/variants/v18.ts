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

function buildCore(language: Language, withMatchCount: boolean): {
	fn(this: void, ROOT: Uint8Array, BOUND: Uint8Array, str: string): number | null | [number | null, number];
	rootArr: Uint8Array;
	boundaryArr: Uint8Array;
} {
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

	const fn = Function('ROOT', 'BOUND', 'str', source) as (ROOT: Uint8Array, BOUND: Uint8Array, str: string) => number | null | [number | null, number];
	return { fn, rootArr, boundaryArr };
}

export function buildFastParse(language: Language, withMatchCount: true): ParseWithCountFunction;
export function buildFastParse(language: Language, withMatchCount?: false): ParseFunction;
export function buildFastParse(language: Language, withMatchCount = false): ParseFunction | ParseWithCountFunction {
	const { fn, rootArr, boundaryArr } = buildCore(language, withMatchCount);
	return ((str: string) => fn(rootArr, boundaryArr, str)) as ParseFunction | ParseWithCountFunction;
}
