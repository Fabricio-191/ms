import type { Language } from '../../src/core/index.ts';
import type { ParseFunction } from '@src/core/types.ts';

// ─── perfect hash implementation ────────────────────────────────────────────────

// Perfect hash using: char_code * 31 + last_char_code * 17 + length
// This produces unique hash values for most notations. Collisions are resolved
// via linear scan within the collision bucket.

function computeHash(s: string): number {
	const len = s.length;
	if (len === 0) return -1;
	const first = s.charCodeAt(0) | 0x20; // lowercase
	const last = s.charCodeAt(len - 1) | 0x20; // lowercase
	return (first * 31 + last * 17 + len) >>> 0;
}

// ─── builder ────────────────────────────────────────────────────────────────────

export function buildFastParse(language: Language): ParseFunction {
	// Build sorted array of (hash, notation, multiplier) entries for binary search
	const entries: Array<{ hash: number; notation: string; multiplier: number }> = [];
	for (const [ notation, multiplier ] of Object.entries(language.dict)) {
		const normNotation = notation.toLowerCase();
		const hash = computeHash(normNotation);
		entries.push({ hash, notation: normNotation, multiplier });
	}
	entries.sort((a, b) => a.hash - b.hash);

	// Build compact arrays for runtime lookup
	const hashes = new Uint32Array(entries.map(e => e.hash));
	const notations = entries.map(e => e.notation);
	const multipliers = new Float64Array(entries.map(e => e.multiplier));

	const source = `
		if (typeof str !== 'string' || str === '') return null;

		const s = str;
		const len = s.length;

		// Detect sign before main scan
		let _si = 0;
		while (_si < len && s.charCodeAt(_si) === 32) _si++;
		const isNeg = s.charCodeAt(_si) === 45;
		if (isNeg) {
			_si++;
			while (_si < len && s.charCodeAt(_si) === 32) _si++;
		}

		// Early exit - after consuming sign, if first char is not digit, dot, or '-'
		{
			const _fc = s.charCodeAt(_si);
			if (_fc !== 45 && ((_fc - 48) >>> 0) >= 10 && _fc !== 46) {
				const num = Number(str);
				return Number.isNaN(num) ? null : num;
			}
		}

		let value = 0;
		let matchCount = 0;
		let i = _si;

		// Hash table for perfect hash lookup (sorted by hash for binary search)
		const HV = hashes;
		const NS = notations;
		const MS = multipliers;

		while (i < len) {
			const cc = s.charCodeAt(i);

			if (((cc - 48) >>> 0) < 10 || cc === 46) {
				let parsedValue = 0;
				let _c, _d;
				if (cc !== 46) {
					parsedValue = cc - 48;
					i++;
					while (i < len && (_c = s.charCodeAt(i), (_d = (_c - 48) >>> 0) < 10)) {
						parsedValue = parsedValue * 10 + _d;
						i++;
					}
					if (i < len && s.charCodeAt(i) === 46) {
						i++;
						let frac = 0, divisor = 1;
						while (i < len && (_c = s.charCodeAt(i), (_d = (_c - 48) >>> 0) < 10)) {
							frac = frac * 10 + _d;
							divisor *= 10;
							i++;
						}
						if (divisor > 1) parsedValue += frac / divisor;
					}
				} else {
					i++;
					let frac = 0, divisor = 1;
					while (i < len && (_c = s.charCodeAt(i), (_d = (_c - 48) >>> 0) < 10)) {
						frac = frac * 10 + _d;
						divisor *= 10;
						i++;
					}
					parsedValue = divisor === 1 ? NaN : frac / divisor;
				}

				if (!Number.isNaN(parsedValue)) {
					let spaces = 0;
					while (i < len && s.charCodeAt(i) === 32 && spaces < 3) { i++; spaces++; }

					notationBlock: if (i < len) {
						// Extract notation and compute hash using first/last char + length
						const _start = i;
						let lastCc = 0;
						let cc;
						while (i < len && ((cc = s.charCodeAt(i)) >= 97 && cc <= 122 || cc >= 65 && cc <= 90 || cc > 127)) {
							lastCc = cc | 0x20;
							i++;
						}
						const _nlen = i - _start;
						if (_nlen === 0) break notationBlock;

						const _firstCc = s.charCodeAt(_start) | 0x20;
						const _hash = (_firstCc * 31 + lastCc * 17 + _nlen) >>> 0;

						// Binary search for hash in sorted HV array
						let _lo = 0, _hi = HV.length - 1;
						while (_lo <= _hi) {
							const _mid = (_lo + _hi) >>> 1;
							if (HV[_mid] < _hash) {
								_lo = _mid + 1;
							} else if (HV[_mid] > _hash) {
								_hi = _mid - 1;
							} else {
								// Hash match - verify notation string (handle collisions)
								const _ns = s.substring(_start, i).toLowerCase();
								const _entryHash = HV[_mid];
								// Find first entry with this hash
								let _entryIdx = _mid;
								while (_entryIdx > 0 && HV[_entryIdx - 1] === _entryHash) _entryIdx--;
								// Scan forward to find matching notation
								for (let _ei = _entryIdx; _ei < HV.length && HV[_ei] === _entryHash; _ei++) {
									if (NS[_ei] === _ns) {
										value += parsedValue * MS[_ei];
										matchCount++;
										break notationBlock;
									}
								}
								break;
							}
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

		return isNeg ? -value : value;
	`;

	const fn = Function('hashes', 'notations', 'multipliers', 'str', source) as (
		hashes: Uint32Array,
		notations: string[],
		multipliers: Float64Array,
		str: string,
	) => number | null;

	return fn.bind(null, hashes, notations, multipliers) as ParseFunction;
}
