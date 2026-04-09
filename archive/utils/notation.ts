export interface NotationEntry {
	chars: number[];
	multiplier: number;
}

export { extractNotations, generateLookupCode } from '../../src/utils/notation.ts';

function charLabel(c: number): string {
	return `'${String.fromCharCode(c)}'(${c})`;
}

function charPairLabel(lo: number, hi: number): string {
	if (lo === hi) return charLabel(lo);
	return `'${String.fromCharCode(lo)}'(${lo})/'${String.fromCharCode(hi)}'(${hi})`;
}

function fmtNum(n: number): string {
	return n.toLocaleString('en-US');
}

function emitBoundaryLines(i1: string, elen: number, mult: number, simpleBoundary: boolean): string {
	if (simpleBoundary) {
		return `${i1}const _bc = s.charCodeAt(i+${elen});\n` +
			`${i1}if (_bc >= 128 || !BOUND[_bc])\n` +
			`${i1} { i += ${elen}; v += pv * ${mult}; mc++; break match; }\n`;
	}
	return `${i1}const _bci = i+${elen}, _bc = s.charCodeAt(_bci);\n` +
		`${i1}if (_bci >= len || _bc >= 128 || !BOUND[_bc]) // end | non-ASCII | not a boundary char\n` +
		`${i1} { i += ${elen}; v += pv * ${mult}; mc++; break match; }\n`;
}

export function generateGroupedLookupCode(entries: NotationEntry[], indent: string): string {
	const byFirst = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirst.has(first)) byFirst.set(first, []);
		byFirst.get(first)!.push(entry);
	}

	const i1 = `${indent}\t`;
	const i2 = `${indent}\t\t`;

	let code = '';
	let firstGroup = true;

	for (const [ firstChar, list ] of byFirst) {
		const upper = String.fromCharCode(firstChar).toUpperCase().charCodeAt(0);
		const hasCase = upper !== firstChar;
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);

		const outerKw = firstGroup ? 'if' : 'else if';
		firstGroup = false;
		const firstLabel = hasCase ?
			`${charLabel(firstChar)}/${charLabel(upper)}` :
			charLabel(firstChar);
		const cond = hasCase ?
			`c0 === ${firstChar} || c0 === ${upper}` :
			`c0 === ${firstChar}`;
		code += `${indent}// Group: ${firstLabel}\n`;
		code += `${indent}${outerKw} (${cond}) {\n`;

		let innerFirst = true;
		for (const entry of sorted) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));

			if (elen === 1) {
				const kw = innerFirst ? '' : 'else ';
				code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;
				code += `${i1}${kw}{\n`;
				code += emitBoundaryLines(i2, 1, entry.multiplier, false);
				code += `${i1}}\n`;
			}
			else {
				const innerKw = innerFirst ? 'if' : 'else if';
				innerFirst = false;
				const remaining = entry.chars.slice(1);

				const segments = remaining.map((c, idx) => {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					const pos = idx + 1;
					const comment = `// [${pos}] ${charPairLabel(c, up)}`;
					const check = c === up ?
						`s.charCodeAt(i+${pos}) === ${c}` :
						`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
					return { check, comment };
				});

				code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;
				code += `${i1}${innerKw} (i+${elen} <= len // needs ${elen} chars\n`;
				for (let k = 0; k < segments.length; k++) {
					const { check, comment } = segments[k]!;
					const isLast = k === segments.length - 1;
					code += `${i1} && ${check}${isLast ? ')' : ''} ${comment}\n`;
				}
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, elen, entry.multiplier, false);
				code += `${i1}}\n`;
			}
		}

		code += `${indent}}\n`;
	}
	return code;
}

export function generateC1CachedLookupCode(entries: NotationEntry[], indent: string): string {
	const byFirstChar = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirstChar.has(first)) byFirstChar.set(first, []);
		byFirstChar.get(first)!.push(entry);
	}

	const expanded = new Map<number, NotationEntry[]>();
	for (const [ first, list ] of byFirstChar) {
		const upper = String.fromCharCode(first).toUpperCase().charCodeAt(0);
		if (!expanded.has(first)) expanded.set(first, []);
		if (!expanded.has(upper)) expanded.set(upper, []);
		for (const entry of list) {
			expanded.get(first)!.push(entry);
			expanded.get(upper)!.push(entry);
		}
	}

	const i1 = `${indent}\t`;
	const i2 = `${indent}\t\t`;

	let code = '';
	for (const [ firstChar, list ] of expanded) {
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		const hasMultiChar = sorted.some(e => e.chars.length > 1);

		code += `${indent}// ${charLabel(firstChar)} group\n`;
		code += `${indent}if (c0 === ${firstChar}) {\n`;
		if (hasMultiChar) {
			code += `${i1}var c1 = s.charCodeAt(i+1); // cache [1] for all entries below\n`;
		}

		for (const entry of sorted) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));

			code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;

			if (elen === 1) {
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, 1, entry.multiplier, false);
				code += `${i1}}\n`;
			}
			else {
				const remaining = entry.chars.slice(1);
				const segments = remaining.map((c, idx) => {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					const pos = idx + 1;
					const comment = `// [${pos}] ${charPairLabel(c, up)}`;
					let check: string;
					if (idx === 0) {
						check = c === up ? `c1 === ${c}` : `(c1 === ${c} || c1 === ${up})`;
					}
					else {
						check = c === up ?
							`s.charCodeAt(i+${pos}) === ${c}` :
							`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
					}
					return { check, comment };
				});

				code += `${i1}if (i+${elen} <= len // needs ${elen} chars\n`;
				for (let k = 0; k < segments.length; k++) {
					const { check, comment } = segments[k]!;
					const isLast = k === segments.length - 1;
					code += `${i1} && ${check}${isLast ? ')' : ''} ${comment}\n`;
				}
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, elen, entry.multiplier, false);
				code += `${i1}}\n`;
			}
		}

		code += `${indent}}\n`;
	}
	return code;
}

export function generateSwitchLookupCode(entries: NotationEntry[], indent: string, availVar?: string): string {
	const byFirstChar = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirstChar.has(first)) byFirstChar.set(first, []);
		byFirstChar.get(first)!.push(entry);
	}

	const i1 = `${indent}\t`;
	const i2 = `${indent}\t\t`;
	const i3 = `${indent}\t\t\t`;

	let code = `${indent}switch (c0) {\n`;

	for (const [ firstChar, list ] of byFirstChar) {
		const upper = String.fromCharCode(firstChar).toUpperCase().charCodeAt(0);
		const hasCase = upper !== firstChar;
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);

		if (hasCase)
			code += `${i1}case ${firstChar}: case ${upper}: { // ${charPairLabel(firstChar, upper)}\n`;

		else
			code += `${i1}case ${firstChar}: { // ${charLabel(firstChar)}\n`;

		for (const entry of sorted) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));

			code += `${i2}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;

			if (elen === 1) {
				const innerIndent = i2;
				code += emitBoundaryLines(innerIndent, 1, entry.multiplier, false);
			}
			else {
				const remaining = entry.chars.slice(1);
				const segments = remaining.map((c, idx) => {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					const pos = idx + 1;
					const comment = `// [${pos}] ${charPairLabel(c, up)}`;
					const check = c === up ?
						`s.charCodeAt(i+${pos}) === ${c}` :
						`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
					return { check, comment };
				});

				const lenGuard = availVar ? `${availVar} >= ${elen}` : `i+${elen} <= len`;
				code += `${i2}if (${lenGuard} // needs ${elen} chars\n`;
				for (let k = 0; k < segments.length; k++) {
					const { check, comment } = segments[k]!;
					const isLast = k === segments.length - 1;
					code += `${i2} && ${check}${isLast ? ')' : ''} ${comment}\n`;
				}
				code += `${i2}{\n`;
				code += emitBoundaryLines(i3, elen, entry.multiplier, false);
				code += `${i2}}\n`;
			}
		}

		code += `${i2}break; // no match in this group — do not fall through to next case\n`;
		code += `${i1}}\n`;
	}

	code += `${indent}}\n`;
	return code;
}

export function generateConstC1LookupCode(entries: NotationEntry[], indent: string): string {
	const byFirstChar = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirstChar.has(first)) byFirstChar.set(first, []);
		byFirstChar.get(first)!.push(entry);
	}

	const expanded = new Map<number, NotationEntry[]>();
	for (const [ first, list ] of byFirstChar) {
		const upper = String.fromCharCode(first).toUpperCase().charCodeAt(0);
		if (!expanded.has(first)) expanded.set(first, []);
		if (!expanded.has(upper)) expanded.set(upper, []);
		for (const entry of list) {
			expanded.get(first)!.push(entry);
			expanded.get(upper)!.push(entry);
		}
	}

	const i1 = `${indent}\t`;
	const i2 = `${indent}\t\t`;

	let code = '';
	for (const [ firstChar, list ] of expanded) {
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		const hasMultiChar = sorted.some(e => e.chars.length > 1);

		code += `${indent}// ${charLabel(firstChar)} group\n`;
		code += `${indent}if (c0 === ${firstChar}) {\n`;
		if (hasMultiChar) {
			code += `${i1}const c1 = s.charCodeAt(i+1); // cache [1] — block-scoped const per group\n`;
		}

		for (const entry of sorted) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));

			code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;

			if (elen === 1) {
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, 1, entry.multiplier, false);
				code += `${i1}}\n`;
			}
			else {
				const remaining = entry.chars.slice(1);
				const segments = remaining.map((c, idx) => {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					const pos = idx + 1;
					const comment = `// [${pos}] ${charPairLabel(c, up)}`;
					let check: string;
					if (idx === 0) {
						check = c === up ? `c1 === ${c}` : `(c1 === ${c} || c1 === ${up})`;
					}
					else {
						check = c === up ?
							`s.charCodeAt(i+${pos}) === ${c}` :
							`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
					}
					return { check, comment };
				});

				code += `${i1}if (i+${elen} <= len // needs ${elen} chars\n`;
				for (let k = 0; k < segments.length; k++) {
					const { check, comment } = segments[k]!;
					const isLast = k === segments.length - 1;
					code += `${i1} && ${check}${isLast ? ')' : ''} ${comment}\n`;
				}
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, elen, entry.multiplier, false);
				code += `${i1}}\n`;
			}
		}

		code += `${indent}}\n`;
	}
	return code;
}

export function generateOptimizedLookupCode(entries: NotationEntry[], indent: string): string {
	const byFirst = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirst.has(first)) byFirst.set(first, []);
		byFirst.get(first)!.push(entry);
	}

	const i1 = `${indent}\t`;
	const i2 = `${indent}\t\t`;

	let code = '';
	let firstGroup = true;

	for (const [ firstChar, list ] of byFirst) {
		const isAsciiLetter = firstChar >= 97 && firstChar <= 122;
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		const multiChars = sorted.filter(e => e.chars.length > 1);
		const singleChar = sorted.find(e => e.chars.length === 1);

		const outerKw = firstGroup ? 'if' : 'else if';
		firstGroup = false;

		const firstCheck = isAsciiLetter ?
			`(c0|0x20) === ${firstChar}` :
			`c0 === ${firstChar}`;
		const groupNote = isAsciiLetter ?
			`// matches ${charPairLabel(firstChar, firstChar - 32)} via |0x20` :
			`// ${charLabel(firstChar)}`;

		code += `${indent}${outerKw} (${firstCheck}) { ${groupNote}\n`;

		let innerFirst = true;
		for (const entry of multiChars) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));
			const innerKw = innerFirst ? 'if' : 'else if';
			innerFirst = false;

			const remaining = entry.chars.slice(1);
			const segments = remaining.map((c, idx) => {
				const pos = idx + 1;
				let check: string;
				let comment: string;
				if (c >= 97 && c <= 122) {
					check = `(s.charCodeAt(i+${pos})|0x20) === ${c}`;
					const up = c - 32;
					comment = `// [${pos}] ${charPairLabel(c, up)} via |0x20`;
				}
				else {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					comment = `// [${pos}] ${charPairLabel(c, up)}`;
					check = c === up ?
						`s.charCodeAt(i+${pos}) === ${c}` :
						`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
				}
				return { check, comment };
			});

			code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;
			code += `${i1}${innerKw} (i+${elen} <= len // needs ${elen} chars\n`;
			for (let k = 0; k < segments.length; k++) {
				const { check, comment } = segments[k]!;
				const isLast = k === segments.length - 1;
				code += `${i1} && ${check}${isLast ? ')' : ''} ${comment}\n`;
			}
			code += `${i1}{\n`;
			code += emitBoundaryLines(i2, elen, entry.multiplier, false);
			code += `${i1}}\n`;
		}

		if (singleChar) {
			const notation = String.fromCharCode(firstChar);
			const kw = innerFirst ? '' : 'else ';
			code += `${i1}// "${notation}" → ${fmtNum(singleChar.multiplier)} ms\n`;
			code += `${i1}${kw}{\n`;
			code += emitBoundaryLines(i2, 1, singleChar.multiplier, false);
			code += `${i1}}\n`;
		}

		code += `${indent}}\n`;
	}
	return code;
}

export function buildStartsTable(entries: NotationEntry[]): Uint8Array {
	const table = new Uint8Array(128);
	for (const entry of entries) {
		const lo = entry.chars[0]!;
		if (lo >= 128) continue;
		table[lo] = 1;
		const hi = lo - 32;
		if (hi >= 65 && hi <= 90) table[hi] = 1;
	}
	return table;
}

export function buildBothCaseSingleCharTable(entries: NotationEntry[]): Float64Array {
	const table = new Float64Array(128);
	for (const entry of entries) {
		if (entry.chars.length !== 1) continue;
		const lo = entry.chars[0]!;
		if (lo >= 128) continue;
		table[lo] = entry.multiplier;
		const hi = lo - 32;
		if (hi >= 65 && hi <= 90) table[hi] = entry.multiplier;
	}
	return table;
}

export function buildSingleCharTable(entries: NotationEntry[]): Float64Array {
	const table = new Float64Array(128);
	for (const entry of entries) {
		if (entry.chars.length !== 1) continue;
		const c = entry.chars[0]!;
		if (c < 128) table[c] = entry.multiplier;
	}
	return table;
}

export function buildPackedEntries(entries: NotationEntry[]): {
	DISPATCH: Uint32Array;
	ENTRIES: Uint32Array;
	MULT_F64: Float64Array;
	NA_FIRST_KEYS: Uint32Array;
	NA_FIRST_VALS: Uint32Array;
} {
	const multSet = new Set<number>(entries.map(e => e.multiplier));
	const multArr = [ ...multSet ];
	const multIdx = new Map(multArr.map((m, i) => [ m, i ]));
	const MULT_F64 = new Float64Array(multArr);

	const byFirst = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirst.has(first)) byFirst.set(first, []);
		byFirst.get(first)!.push(entry);
	}

	const packedData: number[] = [ 0 ];
	const DISPATCH = new Uint32Array(128);
	const naEntries: Array<[ number, number ]> = [];

	for (const [ firstChar, list ] of byFirst) {
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		const offset = packedData.length;

		if (firstChar < 128)
			DISPATCH[firstChar] = offset;
		else
			naEntries.push([ firstChar, offset ]);

		for (const entry of sorted) {
			const elen = entry.chars.length;
			packedData.push(elen);
			for (let k = 1; k < elen; k++) packedData.push(entry.chars[k]!);
			packedData.push(multIdx.get(entry.multiplier)!);
		}
		packedData.push(0);
	}

	naEntries.sort((a, b) => a[0] - b[0]);
	return {
		DISPATCH,
		ENTRIES: new Uint32Array(packedData),
		MULT_F64,
		NA_FIRST_KEYS: new Uint32Array(naEntries.map(e => e[0])),
		NA_FIRST_VALS: new Uint32Array(naEntries.map(e => e[1])),
	};
}

export function buildHashTable(entries: NotationEntry[]): {
	HTAB: Uint32Array;
	HH2: Uint32Array;
	HLEN: Uint32Array;
	HMULT: Float64Array;
} {
	const HSIZE = 512;
	const HTAB = new Uint32Array(HSIZE);
	const HH2 = new Uint32Array(entries.length);
	const HLEN = new Uint32Array(entries.length);
	const mults: number[] = [];

	for (let idx = 0; idx < entries.length; idx++) {
		const entry = entries[idx]!;
		let h1 = 0, h2 = 0;
		for (const c of entry.chars) {
			const lc = c < 128 ? c | 0x20 : c;
			h1 = (h1 * 31 + lc) & 0x7fffffff;
			h2 = (h2 * 37 + lc) & 0x7fffffff;
		}
		const slot = h1 & (HSIZE - 1);
		if (HTAB[slot] !== 0)
			throw new Error(`buildHashTable: collision at slot ${slot} between notations`);
		HTAB[slot] = idx + 1;
		HH2[idx] = h2;
		HLEN[idx] = entry.chars.length;
		mults.push(entry.multiplier);
	}

	return { HTAB, HH2, HLEN, HMULT: new Float64Array(mults) };
}
