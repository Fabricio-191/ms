/**
 * Parse v3c - Length-based dispatch
 *
 * Strategy: Check notation length first, then dispatch to appropriate handler.
 *
 * Groups notations by their length at build time:
 * - Length 1: Direct charCode switch (no slice needed)
 * - Length 2: Check first char, then second char (no slice needed)
 * - Length 3+: Use `slice` + `switch` (acceptable overhead for longer strings)
 *
 * Rationale: Most common notations are short (s, m, h, d, w, y, ms).
 * Avoiding `slice` for short notations should improve performance.
 *
 * Result: Slower than v3b! The extra check for length adds overhead.
 */
import type { Language } from '../../../core/index.ts';

type FastParseFunction = (str: string) => number | null;

function escapeStr(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
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

function buildLengthDispatch(dict: Record<string, number>): string {
	// Group entries by notation length
	const byLength = new Map<number, Array<[string, number]>>();
	for (const [ notation, multiplier ] of Object.entries(dict)) {
		const len = notation.length;
		if (!byLength.has(len)) byLength.set(len, []);
		byLength.get(len)!.push([ notation, multiplier ]);
	}

	const t = '\t\t\t\t\t\t';
	let code = 'switch (i - _w0) {\n';

	for (const [ len, entries ] of [ ...byLength ].sort(([ a ], [ b ]) => a - b)) {
		code += `${t}case ${len}: {\n`;

		if (len === 1) {
			// Direct charCode switch — no slice needed
			code += `${t}\tswitch (s.charCodeAt(_w0)) {\n`;
			for (const [ notation, multiplier ] of entries)
				code += `${t}\t\tcase ${notation.charCodeAt(0)}: value += parsedValue * ${multiplier}; matchCount++; break; // '${notation}'\n`;
			code += `${t}\t}\n`;
		}
		else if (len === 2) {
			// Group by first char to minimize charCode reads
			const byFirst = new Map<number, Array<[string, number]>>();
			for (const [ notation, multiplier ] of entries) {
				const cc = notation.charCodeAt(0);
				if (!byFirst.has(cc)) byFirst.set(cc, []);
				byFirst.get(cc)!.push([ notation, multiplier ]);
			}
			code += `${t}\tswitch (s.charCodeAt(_w0)) {\n`;
			for (const [ cc, sub ] of byFirst) {
				code += `${t}\t\tcase ${cc}: // '${String.fromCharCode(cc)}'\n`;
				if (sub.length === 1) {
					const [ notation, multiplier ] = sub[0]!;
					code += `${t}\t\t\tif (s.charCodeAt(_w0 + 1) === ${notation.charCodeAt(1)}) { value += parsedValue * ${multiplier}; matchCount++; } // '${notation}'\n`;
				}
				else {
					code += `${t}\t\t\tswitch (s.charCodeAt(_w0 + 1)) {\n`;
					for (const [ notation, multiplier ] of sub)
						code += `${t}\t\t\t\tcase ${notation.charCodeAt(1)}: value += parsedValue * ${multiplier}; matchCount++; break; // '${notation}'\n`;
					code += `${t}\t\t\t}\n`;
				}
				code += `${t}\t\t\tbreak;\n`;
			}
			code += `${t}\t}\n`;
		}
		else {
			// len >= 3: slice + reduced switch (only candidates at this length)
			code += `${t}\tswitch (s.slice(_w0, i)) {\n`;
			for (const [ notation, multiplier ] of entries)
				code += `${t}\t\tcase '${escapeStr(notation)}': value += parsedValue * ${multiplier}; matchCount++; break;\n`;
			code += `${t}\t}\n`;
		}

		code += `${t}\tbreak;\n`;
		code += `${t}}\n`;
	}

	code += `${t.slice(1)}}`; // close outer switch (one less tab)
	return code;
}

export function buildFastParse(language: Language): FastParseFunction {
	const letterCheck = buildLetterCheck(language.dict);
	const lengthDispatch = buildLengthDispatch(language.dict);

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
                        ${lengthDispatch}
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

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return Function('str', source) as FastParseFunction;
}
