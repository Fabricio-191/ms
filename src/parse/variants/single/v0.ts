import type { Language } from '../../../core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges, buildBoundaryExpr } from '../../../utils/_trie.ts';

type FastParseFunction = (str: string) => number | null;

// Generates nested switch-on-charCode code for trie traversal.
// Checks terminal BEFORE descending into children to correctly handle prefixes (e.g. 'mo' vs 'month').
// Uses `break notationBlock` to exit on match.
// `isNotationChar` is defined in the generated function source as an arrow function.
function generateTrieCode(node: TrieNode, indent: string): string {
	let code = '';

	// Terminal check: if this node is a valid notation end, check boundary before going deeper
	if (node.multiplier !== null)
		code += `${indent}if (i >= len || !isNotationChar(s.charCodeAt(i))) { value += parsedValue * ${node.multiplier}; matchCount++; break notationBlock; }\n`;

	if (node.children.size === 0) return code;

	code += `${indent}switch (s.charCodeAt(i)) {\n`;
	for (const [ cc, child ] of node.children) {
		const char = String.fromCharCode(cc);
		code += `${indent}\tcase ${cc}: // '${char}'\n`;
		code += `${indent}\t\ti++;\n`;
		code += generateTrieCode(child, `${indent}\t\t`);
		code += `${indent}\t\tbreak;\n`;
	}
	code += `${indent}}\n`;

	return code;
}

// the user uses this function, to create the fast parse function for a specific language. it will be stored by the user, not us
export function buildFastParse(language: Language): FastParseFunction {
	const trie = buildTrie(language.dict);
	const letterCheck = buildBoundaryExpr(collectCharRanges(language.dict));
	const trieCode = generateTrieCode(trie, '\t\t\t\t\t\t');

	const source = `
        if (typeof str !== 'string' || str === '') return null;

        const s = str.toLowerCase();
        const len = s.length;
        const isNotationChar = (c) => ${letterCheck};
        let value = 0;
        let matchCount = 0;
        let i = 0;

        while (i < len) {
            const cc = s.charCodeAt(i);

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
                        if (_c0 === 32 || (_c0 >= 48 && _c0 <= 57) || _c0 === 46) {
                            // Skip all trailing digits and dots (invalid number like "1.2.3")
                            while (i < len) {
                                const c = s.charCodeAt(i);
                                if ((c >= 48 && c <= 57) || c === 46) { i++; }
                                else { break; }
                            }
                            break notationBlock;
                        }
                        // trie root switch reads from current i (first char of notation)
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

        return str.trim().startsWith('-') ? -value : value;
    `;

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return Function('str', source) as FastParseFunction;
}
