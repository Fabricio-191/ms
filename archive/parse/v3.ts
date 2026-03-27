/**
 * Parse v3a - Char-by-char scan with inline charCode ranges
 *
 * Strategy: Replace Unicode property test (`/\p{L}/u`) with pre-computed charCode ranges.
 *
 * At build time, collects all character codes used in any notation of the language
 * and compacts them into ranges (e.g., `a-z` becomes single range check).
 * Generates inline charCode boundary check.
 *
 * This eliminates the function call overhead of `/\p{L}/u.test()`.
 *
 * Still uses `s.slice(_w0, i)` to extract notation strings for switch comparison.
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

function collectCharRanges(dict: Record<string, number>): Array<[number, number]> {
	const codes = new Set<number>();
	for (const notation of Object.keys(dict)) {
		for (let j = 0; j < notation.length; j++)
			codes.add(notation.charCodeAt(j));
	}

	const sorted = [ ...codes ].sort((a, b) => a - b);
	const ranges: Array<[number, number]> = [];
	let lo = sorted[0]!;
	let hi = lo;

	for (let j = 1; j < sorted.length; j++) {
		const c = sorted[j]!;
		if (c === hi + 1) {
			hi = c;
		}
		else {
			ranges.push([ lo, hi ]);
			lo = c;
			hi = c;
		}
	}
	ranges.push([ lo, hi ]);
	return ranges;
}

function buildLetterCheck(dict: Record<string, number>): string {
	const ranges = collectCharRanges(dict);
	return ranges
		.map(([ lo, hi ]) => lo === hi ? `c === ${lo}` : `(c >= ${lo} && c <= ${hi})`)
		.join(' || ');
}

export function buildFastParse(language: Language): ParseFunction {
	const switchCases = createSwitchCases(language.dict);
	const letterCheck = buildLetterCheck(language.dict);

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
                        while (i < len) { const c = s.charCodeAt(i); if (!(${letterCheck})) break; i++; }
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

	return Function('str', source) as ParseFunction;
}
