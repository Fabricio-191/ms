import type { Language } from '../core/index.ts';

type FastParseFunction = (str: string) => number | null;

function escapeStr(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function createSwitchCases(dict: Record<string, number>): string {
	let body = '';
	for (const [ notation, multiplier ] of Object.entries(dict))
		body += `\n\t\t\t\t\t\tcase '${escapeStr(notation)}': value += parsedValue * ${multiplier}; matchCount++; break;`;
	return body;
}

// the user uses this function, to create the fast parse function for a specific language. it will be stored by the user, not us
export function buildFastParse(language: Language): FastParseFunction {
	const dialectRe = new RegExp(`[${language.dialect}]`, 'iu');
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
                        if (_c0 === 32 || (_c0 >= 48 && _c0 <= 57) || _c0 === 46) break notationBlock;
                        i++;
                        if (dr.test(s[_w0])) {
                            // dialect word (e.g. 'hours'): collect while chars stay in dialect
                            // boundary is implicit — stops at first non-dialect char
                            while (i < len && dr.test(s[i])) i++;
                        } else {
                            // non-dialect word (e.g. Devanagari): collect until dialect/space/digit
                            // if stopped by a dialect char the boundary condition fails
                            while (i < len) {
                                const _c = s.charCodeAt(i);
                                if (_c === 32 || (_c >= 48 && _c <= 57) || _c === 46 || dr.test(s[i])) break;
                                i++;
                            }
                            if (i < len && dr.test(s[i])) { i = _w0; break notationBlock; }
                        }
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

        return /^\\s*-/u.test(str) ? -value : value;
    `;

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return Function('dr', 'str', source).bind(null, dialectRe) as FastParseFunction;
}
