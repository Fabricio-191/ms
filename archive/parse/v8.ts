import type { Language } from '../../src/core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges, buildBoundaryExpr } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';

// v3.6: Avoids .toLowerCase() entirely by comparing both uppercase and lowercase
// Theory: .toLowerCase() creates a new string and iterates over all chars
// Instead, we check both cases in the switch: case for 'Y' (89) and 'y' (121)
function generateTrieCodeCaseInsensitive(node: TrieNode, indent: string): string {
	let code = '';

	// For case-insensitive, build the check inline
	if (node.multiplier !== null)
		code += `${indent}if (i >= len || !isNotationCharIgnoreCase(s.charCodeAt(i))) { value += parsedValue * ${node.multiplier}; matchCount++; break notationBlock; }\n`;

	if (node.children.size === 0) return code;

	code += `${indent}switch (s.charCodeAt(i)) {\n`;
	for (const [ cc, child ] of node.children) {
		const char = String.fromCharCode(cc);
		const upperChar = char.toUpperCase();
		const upperCc = upperChar.charCodeAt(0);

		// Add both lowercase and uppercase cases
		if (cc === upperCc) {
			code += `${indent}\tcase ${cc}: // '${char}'\n`;
		}
		else {
			code += `${indent}\tcase ${cc}: // '${char}'\n`;
			code += `${indent}\tcase ${upperCc}: // '${upperChar}'\n`;
		}
		code += `${indent}\t\ti++;\n`;
		code += generateTrieCodeCaseInsensitive(child, `${indent}\t\t`);
		code += `${indent}\t\tbreak;\n`;
	}
	code += `${indent}}\n`;

	return code;
}

export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrie(language.dict);
	const letterCheck = buildBoundaryExpr(collectCharRanges(language.dict, true));
	const trieCode = generateTrieCodeCaseInsensitive(trie, '\t\t\t\t\t\t');

	const source = `
		if (typeof str !== 'string' || str === '') return null;

		// v3.6: Skip .toLowerCase() - work directly with original string
		// Check both uppercase (65-90) and lowercase (97-122) ranges
		const s = str;  // No .toLowerCase()!
		const len = s.length;
		const isNotationCharIgnoreCase = (c) => ${letterCheck};
		let value = 0;
		let matchCount = 0;
		let i = 0;

		while (i < len) {
			const cc = s.charCodeAt(i);

			// Case-insensitive digit check: digits don't have case
			if ((cc >= 48 && cc <= 57) || cc === 46) {
				const numStart = i;
				let hasDot = cc === 46;
				i++;
				while (i < len) {
					const c = s.charCodeAt(i);
					if (c >= 48 && c <= 57) { i++; }
					else if (c === 46 && !hasDot) { hasDot = true; i++; }
					else { break; }
				}
				const parsedValue = parseFloat(s.slice(numStart, i));
				if (!Number.isNaN(parsedValue)) {
					let spaces = 0;
					while (i < len && s.charCodeAt(i) === 32 && spaces < 3) { i++; spaces++; }

					notationBlock: if (i < len) {
						const _c0 = s.charCodeAt(i);
						// Check for space, digit, or dot (case-insensitive for digits not needed)
						if (_c0 === 32 || (_c0 >= 48 && _c0 <= 57) || _c0 === 46) {
							// Skip all trailing digits and dots (invalid number like "1.2.3")
							while (i < len) {
								const c = s.charCodeAt(i);
								if ((c >= 48 && c <= 57) || c === 46) { i++; }
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

		// Negative check is case-insensitive (just looks for '-' at start)
		return str.trim().startsWith('-') ? -value : value;
	`;

	return Function('str', source) as ParseFunction;
}
