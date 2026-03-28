export interface NotationEntry {
	chars: number[];
	multiplier: number;
}

export function extractNotations(dict: Record<string, number>): NotationEntry[] {
	return Object.entries(dict).map(([ notation, multiplier ]) => ({
		chars: Array.from(notation, c => c.toLowerCase().charCodeAt(0)),
		multiplier,
	}));
}

export function generateLookupCode(entries: NotationEntry[], indent: string): string {
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

	let code = '';
	for (const [ firstChar, list ] of expanded) {
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		for (const entry of sorted) {
			if (entry.chars.length === 1) {
				code += `${indent}if(c0===${firstChar}){{const _bci=i+1,_bc=s.charCodeAt(_bci);if(_bci>=len||_bc>=128||!BOUND[_bc]){i+=1;v+=pv*${entry.multiplier};mc++;break match}}}\n`;
			}
			else {
				const checks = entry.chars.slice(1).map((c, idx) => {
					const upper = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					return c === upper ?
						`s.charCodeAt(i+${idx + 1})===${c}` :
						`(s.charCodeAt(i+${idx + 1})===${c}||s.charCodeAt(i+${idx + 1})===${upper})`;
				}).join('&&');
				code += `${indent}if(c0===${firstChar}&&i+${entry.chars.length}<=len&&${checks}){{const _bci=i+${entry.chars.length},_bc=s.charCodeAt(_bci);if(_bci>=len||_bc>=128||!BOUND[_bc]){i+=${entry.chars.length};v+=pv*${entry.multiplier};mc++;break match}}}\n`;
			}
		}
	}
	return code;
}
