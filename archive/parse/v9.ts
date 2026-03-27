import type { Language } from '../../src/core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges } from '../../src/utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';

// v9: Combines all optimizations:
// - Case-insensitive without .toLowerCase() (from v8)
// - Inline boundary check (from v6)
// - Bitwise digit check (from v7)
function generateTrieCodeV9(node: TrieNode, indent: string, ranges: Array<[number, number]>): string {
	let code = '';

	if (node.multiplier !== null) {
		let check = 'i >= len';
		if (ranges.length > 0) {
			const parts = ranges.map(([ lo, hi ]) =>
				lo === hi ? `c === ${lo}` : `(c >= ${lo} && c <= ${hi})`);
			check = `i >= len || !(${parts.join(' || ')})`;
		}
		code += `${indent}{ const c = s.charCodeAt(i); if (${check}) { value += parsedValue * ${node.multiplier}; matchCount++; break notationBlock; } }\n`;
	}

	if (node.children.size === 0) return code;

	code += `${indent}switch (s.charCodeAt(i)) {\n`;
	for (const [ cc, child ] of node.children) {
		const char = String.fromCharCode(cc);
		const upperChar = char.toUpperCase();
		const upperCc = upperChar.charCodeAt(0);

		if (cc === upperCc) {
			code += `${indent}\tcase ${cc}: // '${char}'\n`;
		}
		else {
			code += `${indent}\tcase ${cc}: // '${char}'\n`;
			code += `${indent}\tcase ${upperCc}: // '${upperChar}'\n`;
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

		// v9: No .toLowerCase() - work directly with original string
		const s = str;
		const len = s.length;
		let value = 0;
		let matchCount = 0;
		let i = 0;

		while (i < len) {
			const cc = s.charCodeAt(i);

			// v9: Bitwise digit check + case-insensitive
			// Digits: 48-57, Dot: 46
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
						// Check for space, digit, or dot - if found, skip the entire trailing numeric segment
						// This handles cases like "1.2.3ms" where the number is invalid (multiple dots)
						if (_c0 === 32 || ((_c0 - 48) >>> 0) < 10 || _c0 === 46) {
							// Skip all trailing digits and dots (invalid number like "1.2.3")
							while (i < len) {
								const c = s.charCodeAt(i);
								if (((c - 48) >>> 0) < 10 || c === 46) { i++; }
								else { break; }
							}
							break notationBlock;
						}
${trieCode}                    }
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

		// Negative check is case-insensitive
		return str.trim().startsWith('-') ? -value : value;
	`;

	return Function('str', source) as ParseFunction;
}
