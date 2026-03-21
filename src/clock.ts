import { NEGATIVE_REGEX, TIMES } from './core/index.ts';

// hh:mm:ss, hh-mm-ss, mm:ss, mm-ss, hh:mm, hh-mm
const REGEX1 = /(?<hh>\d+:)?(?<mm>\d{2}):(?<ss>\d{2}(?:\.\d+)?)(?<pm> PM)?/u;
const REGEX2 = /(?<hh>\d+-)?(?<mm>\d{2})-(?<ss>\d{2}(?:\.\d+)?)(?<pm> PM)?/u;

export function parseClock(str: string, interpretAsMinutes = false): number | null {
	if (typeof str !== 'string' || str === '') return null;

	const rawMatch = REGEX1.exec(str) ?? REGEX2.exec(str);
	if (!rawMatch) return null;

	const { hh, mm, ss, pm } = rawMatch.groups as {
		hh: string | undefined;
		mm: string;
		ss: string;
		pm?: string;
	};

	let value = pm === undefined ? 0 : TIMES.H * 12;

	if (hh !== undefined) // if hours are specified, interpret as hh:mm:ss
		value += parseInt(hh, 10) * TIMES.H + parseInt(mm, 10) * TIMES.M + parseFloat(ss) * TIMES.S;
	else if (interpretAsMinutes) // if hours aren't specified and interpretAsMinutes is true, interpret as mm:ss
		value += parseInt(mm, 10) * TIMES.M + parseFloat(ss) * TIMES.S;
	else // by default interpeted as hh:mm as it's more common
		value += parseInt(mm, 10) * TIMES.H + parseFloat(ss) * TIMES.M;

	return NEGATIVE_REGEX.test(str) ? -value : value;
}
