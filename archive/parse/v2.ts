/**
 * Parse v2 - Char-by-char scan with Unicode property test
 *
 * Strategy: Eliminate regex entirely by scanning character-by-character.
 * Uses `/\p{L}/u` regex to detect when we've finished reading letters (notation boundary).
 *
 * Key insight: Numbers are detected with charCode checks (cc >= 48 && cc <= 57).
 * Notation ends when `/\p{L}/u.test(char)` becomes false.
 *
 * This was slower than expected due to Unicode property test overhead.
 */
import type { Language } from '../../src/core/index.ts';
import type { ParseFunction } from '../../src/core/types.ts';

function escapeStr(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function createSwitchCases(dict: Record<string, number>): string {
	let body = '';
	for (const [ notation, multiplier ] of Object.entries(dict))
		body += `\n\t\t\t\t\t\tcase '${escapeStr(notation)}': value += parsedValue * ${multiplier}; matchCount++; break;`;
	return body;
}

export function buildFastParse(language: Language): ParseFunction {
	const switchCases = createSwitchCases(language.dict);

	const source = `
        if (typeof str !== 'string' || str === '') return null;

        const s = str.toLowerCase();
        const len = s.length;
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
                        const _w0 = i;
                        const _c0 = s.charCodeAt(_w0);
                        if (_c0 === 32 || (_c0 >= 48 && _c0 <= 57) || _c0 === 46) {
                            // Skip all trailing digits and dots (invalid number like "1.2.3")
                            while (i < len) {
                                const c = s.charCodeAt(i);
                                if ((c >= 48 && c <= 57) || c === 46) { i++; }
                                else { break; }
                            }
                            break notationBlock;
                        }
                        i++;
                        // collect the full notation token: all consecutive Unicode letters (p{L})
                        // this covers every script (Latin, CJK, Devanagari, etc.) without special-casing
                        while (i < len && isLetter.test(s[i])) i++;
                        switch (s.slice(_w0, i)) {${switchCases}
                        }
                    }
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

	return Function('isLetter', 'str', source).bind(null, /\p{L}/u) as ParseFunction;
}
