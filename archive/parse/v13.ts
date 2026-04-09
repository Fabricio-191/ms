/**
 * Parse v13 — v9 + pre-scan for any digit before entering the main loop.
 *
 * Scans the entire string once looking for any digit (0-9) or dot.
 * If none found, skips straight to the Number(str) fallback.
 *
 * Helps for: "null", "NaN", "Infinity", "invalid", "xyz" (no digits at all).
 * Does NOT help for: "abc123", "1xyz" (has digits, main loop still runs).
 *
 * Contrast with v12 which only checks the first char but also catches "abc123".
 */
import type { Language } from '../../src/core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';

function generateTrieCodeV9(node: TrieNode, indent: string, ranges: Array<[number, number]>): string {
	let code = '';

	if (node.multiplier !== null) {
		const parts = ranges.map(([ lo, hi ]) =>
			lo === hi ? `c === ${lo}` : `(c >= ${lo} && c <= ${hi})`);
		const check = parts.length > 0 ?
			`i >= len || !(${parts.join(' || ')})` :
			'i >= len';
		code += `${indent}{ const c = s.charCodeAt(i); if (${check}) { value += parsedValue * ${node.multiplier}; matchCount++; break notationBlock; } }\n`;
	}

	if (node.children.size === 0) return code;

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
		code += generateTrieCodeV9(child, `${indent}\t\t`, ranges);
		code += `${indent}\t\tbreak;\n`;
	}
	code += `${indent}}\n`;

	return code;
}

export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrie(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const trieCode = generateTrieCodeV9(trie, '\t\t\t\t\t\t', ranges);

	const source = `
		if (typeof str !== 'string' || str === '') return null;

		const s = str;
		const len = s.length;

		// opt 5b: pre-scan — if no digit or dot anywhere in the string, skip to Number() fallback
		{
			let _hasNum = false;
			for (let _p = 0; _p < len; _p++) {
				const _c = s.charCodeAt(_p);
				if (((_c - 48) >>> 0) < 10 || _c === 46) { _hasNum = true; break; }
			}
			if (!_hasNum) {
				const num = Number(str);
				return Number.isNaN(num) ? null : num;
			}
		}

		let value = 0;
		let matchCount = 0;
		let i = 0;

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
				const parsedValue = parseFloat(s.slice(numStart, i));
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
${trieCode}					}
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

		return str.trim().startsWith('-') ? -value : value;
	`;

	return Function('str', source) as ParseFunction;
}
