import type { Language } from '../../core/index.ts';

type FastParseFunction = (str: string) => number | null;

interface TrieNode {
	children: Map<number, TrieNode>;
	multiplier: number | null;
}

function buildTrieCaseInsensitive(dict: Record<string, number>): TrieNode {
	// Build trie with lowercase chars only
	const root: TrieNode = { children: new Map(), multiplier: null };
	for (const [ notation, multiplier ] of Object.entries(dict)) {
		let node = root;
		for (const char of notation) {
			// Convert to lowercase charCode
			const lowerChar = char.toLowerCase();
			const cc = lowerChar.charCodeAt(0);
			if (!node.children.has(cc))
				node.children.set(cc, { children: new Map(), multiplier: null });
			node = node.children.get(cc)!;
		}
		node.multiplier = multiplier;
	}
	return root;
}

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

export function buildFastParse(language: Language): FastParseFunction {
	const trie = buildTrieCaseInsensitive(language.dict);

	// Collect character ranges for case-insensitive boundary check
	const codes = new Set<number>();
	for (const notation of Object.keys(language.dict)) {
		for (let j = 0; j < notation.length; j++) {
			const cc = notation.charCodeAt(j);
			codes.add(cc);
			// Add uppercase equivalent if it's a letter
			if (cc >= 97 && cc <= 122) codes.add(cc - 32);
		}
	}

	const trieCode = generateTrieCodeCaseInsensitive(trie, '\t\t\t\t\t\t');

	// Build case-insensitive letter check
	// For lowercase (97-122), uppercase (65-90) is (cc - 32)
	const letterChecks: string[] = [];
	const sortedCodes = [ ...codes ].sort((a, b) => a - b);

	// Group into ranges
	let lo = sortedCodes[0]!;
	let hi = lo;
	for (let j = 1; j < sortedCodes.length; j++) {
		const c = sortedCodes[j]!;
		if (c === hi + 1) {
			hi = c;
		}
		else {
			letterChecks.push(lo === hi ? `c === ${lo}` : `(c >= ${lo} && c <= ${hi})`);
			lo = c;
			hi = c;
		}
	}
	letterChecks.push(lo === hi ? `c === ${lo}` : `(c >= ${lo} && c <= ${hi})`);

	const source = `
		if (typeof str !== 'string' || str === '') return null;

		// v3.6: Skip .toLowerCase() - work directly with original string
		// Check both uppercase (65-90) and lowercase (97-122) ranges
		const s = str;  // No .toLowerCase()!
		const len = s.length;
		const isNotationCharIgnoreCase = (c) => ${letterChecks.join(' || ')};
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
						if (_c0 === 32 || (_c0 >= 48 && _c0 <= 57) || _c0 === 46) break notationBlock;
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

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return Function('str', source) as FastParseFunction;
}
