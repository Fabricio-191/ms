import { describe, it } from '@jest/globals';
import { ok, strictEqual } from 'node:assert';
import { LANGUAGES, TIMES, buildParse, buildFormat } from '@lib';
import { check } from '../utils.ts';

const { Y, Mo, W, D, H, M, S, Ms } = TIMES;
const es = LANGUAGES.es;
const parseEs = buildParse(es);

// ─── Variant runner ───────────────────────────────────────────────────────────

interface Case {
	input: string;
	expected: number | null;
}

function runCases(cases: Case[]): void {
	const fn = parseEs;
	for (const { input, expected } of cases) {
		it(`"${input}" → ${expected ?? 'null'}`, () => {
			const actual = fn(input);
			if (typeof expected === 'number' && typeof actual === 'number')
				ok(actual === expected || Math.abs(expected - actual) < 1, `Expected ~${expected}, got ${actual}`);
			else
				strictEqual(actual, expected);
		});
	}
}

// ─── parse() ─────────────────────────────────────────────────────────────────

describe('parse (español)', () => {
	it('unit notations', () => {
		check(parseEs('1 dia'), 86400000);
		check(parseEs('2 horas'), 7200000);
		check(parseEs('1 hora'), 3600000);
		check(parseEs('30 minutos'), 1800000);
		check(parseEs('1 minuto'), 60000);
		check(parseEs('5 segundos'), 5000);
		check(parseEs('1 segundo'), 1000);
		check(parseEs('1 semana'), 604800000);
	});

	it('multi-unit', () => {
		check(parseEs('2 horas 30 minutos'), 9000000);
		check(parseEs('1 dia 2 horas'), 86400000 + 7200000);
		check(parseEs('2 minutos 15 segundos'), 135000);
	});

	it('negative values', () => {
		check(parseEs('-1 hora'), -3600000);
		check(parseEs('-3 minutos'), -180000);
		check(parseEs('- 2 horas 30 minutos'), -9000000);
	});

	it('english notations → null', () => {
		check(parseEs('1 hour'), null);
		check(parseEs('1 day'), null);
	});
});

// ─── Edge cases específicos del español ──────────────────────────────────────

describe('español — ñ en año/años', () => {
	it('año / años → año (31557600000ms)', () => {
		check(parseEs('1año'), 31557600000);
		check(parseEs('1años'), 31557600000);
		check(parseEs('2años'), 31557600000 * 2);
	});

	it('multi-unit con año', () => {
		check(parseEs('1año1mes'), 31557600000 + Mo);
		check(parseEs('2años 3meses'), 31557600000 * 2 + Mo * 3);
	});

	it('año seguido de char de notación → null', () => {
		check(parseEs('1añom'), null); // 'm' es char de notación en español
		check(parseEs('1añod'), null); // 'd' es char de notación en español
	});
});

describe('español — sem vs semana vs semanas', () => {
	it('sem / semana / semanas → semana (604800000ms)', () => {
		check(parseEs('1sem'), 604800000);
		check(parseEs('1semana'), 604800000);
		check(parseEs('2semanas'), 604800000 * 2);
	});

	it('sem + char de notación → null', () => {
		check(parseEs('1sems'), null); // 's' bloquea 'sem'
		check(parseEs('1semd'), null); // 'd' bloquea 'sem'
		check(parseEs('1semm'), null); // 'm' bloquea 'sem'
	});

	it('compact multi-unit con sem', () => {
		check(parseEs('1sem3dias'), 604800000 + 3 * 86400000);
	});
});

describe('español — ms vs m (milisegundo vs minuto)', () => {
	it('m → minuto, ms → milisegundo', () => {
		check(parseEs('1m'), 60000);
		check(parseEs('5m'), 300000);
		check(parseEs('1ms'), 1);
		check(parseEs('500ms'), 500);
	});

	it('ms + char de notación → null', () => {
		check(parseEs('1mss'), null);
		check(parseEs('1msm'), null);
		check(parseEs('1msh'), null);
	});
});

describe('español — seg / segs / segundo / segundos', () => {
	it('todas las formas → 1000ms', () => {
		check(parseEs('1seg'), 1000);
		check(parseEs('1segs'), 1000);
		check(parseEs('1segundo'), 1000);
		check(parseEs('1segundos'), 1000);
	});

	it('seg + char de notación → null', () => {
		check(parseEs('1segm'), null); // 'm' es notación
		check(parseEs('1segn'), null); // 'n' aparece en 'min', 'minuto'
		check(parseEs('1segd'), null); // 'd' es notación
	});
});

// ─── format() ────────────────────────────────────────────────────────────────

describe('format (español)', () => {
	it('short form', () => {
		check(buildFormat({ language: es })(7200000), '2h');
		check(buildFormat({ language: es })(3600000), '1h');
		check(buildFormat({ language: es })(60000), '1m');
		check(buildFormat({ language: es })(1000), '1s');
	});

	it('long form — singular and plural', () => {
		check(buildFormat({ language: es, long: true })(3600000), '1 hora');
		check(buildFormat({ language: es, long: true })(7200000), '2 horas');
		check(buildFormat({ language: es, long: true })(60000), '1 minuto');
		check(buildFormat({ language: es, long: true })(120000), '2 minutos');
		check(buildFormat({ language: es, long: true })(1000), '1 segundo');
		check(buildFormat({ language: es, long: true })(2000), '2 segundos');
	});

	it('multi-unit output', () => {
		const num = parseEs('16 dias 8 horas 20 minutos')!;
		check(buildFormat({ language: es, long: true, length: 3 })(num), '16 dias 8 horas 20 minutos');
	});

	it('parse(format(ms)) === ms', () => {
		for (const ms of [ 3600000, 5445000, 9000000, 86400000 ]) {
			const str = buildFormat({ language: es, length: 3 })(ms)!;
			check(parseEs(str), ms);
		}
	});
});

// ─── buildParse (español) ─────────────────────────────────────────────────────

describe('buildParse (español)', () => {
	it('current', () => {
		check(parseEs('2 horas'), 7200000);
		check(parseEs('1 hora'), 3600000);
		check(parseEs('30 minutos'), 1800000);
		check(parseEs('2 horas 30 minutos'), 9000000);
		check(parseEs('-1 hora'), -3600000);
		check(parseEs('2h'), 7200000);
		check(parseEs(''), null);
	});
});

describe('buildFormat (español)', () => {
	it('current', () => {
		const formatEs = buildFormat({ language: es });
		check(formatEs(7200000), '2h');
		check(formatEs(-3600000), '- 1h');
		check(formatEs(0), '0ms');

		const formatEsLong = buildFormat({ language: es, long: true });
		check(formatEsLong(7200000), '2 horas');
		check(formatEsLong(1000), '1 segundo');
		check(formatEsLong(2000), '2 segundos');
		check(formatEsLong(-3600000), '- 1 hora');
		check(formatEsLong(0), '0 milisegundos');
	});
});

// ─── all notations ────────────────────────────────────────────────────────────

const ALL_NOTATIONS: Case[] = [
	// Years — ñ is non-ASCII; trie handles it directly
	{ input: '1años', expected: Y },
	{ input: '1año', expected: Y },
	{ input: '3años', expected: 3 * Y },
	// Months
	{ input: '1meses', expected: Mo },
	{ input: '1mes', expected: Mo },
	{ input: '6meses', expected: 6 * Mo },
	// Weeks
	{ input: '1semanas', expected: W },
	{ input: '1semana', expected: W },
	{ input: '1sem', expected: W },
	{ input: '2semanas', expected: 2 * W },
	// Days
	{ input: '1dias', expected: D },
	{ input: '1dia', expected: D },
	{ input: '1d', expected: D },
	{ input: '7d', expected: 7 * D },
	// Hours
	{ input: '1horas', expected: H },
	{ input: '1hora', expected: H },
	{ input: '1hrs', expected: H },
	{ input: '1hr', expected: H },
	{ input: '1h', expected: H },
	{ input: '24h', expected: 24 * H },
	// Minutes
	{ input: '1minutos', expected: M },
	{ input: '1minuto', expected: M },
	{ input: '1mins', expected: M },
	{ input: '1min', expected: M },
	{ input: '1m', expected: M },
	{ input: '30m', expected: 30 * M },
	// Seconds
	{ input: '1segundos', expected: S },
	{ input: '1segundo', expected: S },
	{ input: '1segs', expected: S },
	{ input: '1seg', expected: S },
	{ input: '1s', expected: S },
	{ input: '45s', expected: 45 * S },
	// Milliseconds
	{ input: '1milisegundos', expected: Ms },
	{ input: '1milisegundo', expected: Ms },
	{ input: '1msegs', expected: Ms },
	{ input: '1mseg', expected: Ms },
	{ input: '1ms', expected: Ms },
	{ input: '500ms', expected: 500 * Ms },
	// Case insensitive
	{ input: '1H', expected: H },
	{ input: '1S', expected: S },
	{ input: '1HORA', expected: H },
	{ input: '1HORAS', expected: H },
	{ input: '1SEGUNDOS', expected: S },
	{ input: '1MIN', expected: M },
	{ input: '1MINUTOS', expected: M },
	{ input: '1HoRa', expected: H },
	// Spaces (0–3)
	{ input: '1 h', expected: H },
	{ input: '1  s', expected: S },
	{ input: '1   ms', expected: Ms },
	{ input: '2   hora', expected: 2 * H },
	// Decimals
	{ input: '2.5h', expected: 2.5 * H },
	{ input: '.5 hora', expected: 0.5 * H },
	{ input: '.5m', expected: 0.5 * M },
	{ input: '1.5 horas', expected: 1.5 * H },
	{ input: '0.001ms', expected: 0.001 * Ms },
	{ input: '2.5 dias', expected: 2.5 * D },
	{ input: '.5año', expected: 0.5 * Y },
	// Negative
	{ input: '-1hora', expected: -H },
	{ input: '-.5m', expected: -0.5 * M },
	{ input: '-100ms', expected: -100 * Ms },
	{ input: '-2.5 horas', expected: -2.5 * H },
	{ input: '- 1s', expected: -S },
];

describe('español — all notations', () => { runCases(ALL_NOTATIONS); });

// ─── m / ms disambiguation ────────────────────────────────────────────────────

const M_DISAMBIGUATION: Case[] = [
	// m → minuto
	{ input: '1m', expected: M },
	{ input: '10m', expected: 10 * M },
	{ input: '1M', expected: M },
	// ms → milisegundo
	{ input: '1ms', expected: Ms },
	{ input: '100ms', expected: 100 * Ms },
	{ input: '1MS', expected: Ms },
	// mes / meses → month
	{ input: '1mes', expected: Mo },
	{ input: '1meses', expected: Mo },
	{ input: '2mes', expected: 2 * Mo },
	{ input: '1MES', expected: Mo },
	// min / mins / minuto / minutos → minute
	{ input: '1min', expected: M },
	{ input: '1mins', expected: M },
	{ input: '1minuto', expected: M },
	{ input: '1minutos', expected: M },
	// m followed by notation char that's not a valid continuation → null
	{ input: '1mh', expected: null },
	{ input: '1md', expected: null },
	{ input: '1mm', expected: null },
	// ms followed by notation char → null
	{ input: '1mss', expected: null },
	{ input: '1msm', expected: null },
	{ input: '1msh', expected: null },
	// Decimal forms
	{ input: '1.5m', expected: 1.5 * M },
	{ input: '0.5ms', expected: 0.5 * Ms },
	{ input: '2.5mes', expected: 2.5 * Mo },
];

describe('español — m / ms disambiguation', () => { runCases(M_DISAMBIGUATION); });

// ─── multi-unit ───────────────────────────────────────────────────────────────

const MULTI_UNIT: Case[] = [
	// Two units
	{ input: '1h 30m', expected: H + 30 * M },
	{ input: '2h30m', expected: 2 * H + 30 * M },
	{ input: '1m30s', expected: M + 30 * S },
	{ input: '5s500ms', expected: 5 * S + 500 * Ms },
	{ input: '1d12h', expected: D + 12 * H },
	{ input: '1año 6meses', expected: Y + 6 * Mo },
	{ input: '2semanas3d', expected: 2 * W + 3 * D },
	// Three units
	{ input: '1h 2m 3s', expected: H + 2 * M + 3 * S },
	{ input: '1h30m45s', expected: H + 30 * M + 45 * S },
	{ input: '1d2h3m', expected: D + 2 * H + 3 * M },
	// Four units
	{ input: '1h 2m 3s 4ms', expected: H + 2 * M + 3 * S + 4 * Ms },
	{ input: '1 dia 12 horas 30 minutos', expected: D + 12 * H + 30 * M },
	// Five+ units
	{ input: '1 semana 2 dias 3 horas 4 minutos 5 segundos', expected: W + 2 * D + 3 * H + 4 * M + 5 * S },
	{ input: '1año 2meses 3semanas 4d 5h 6m 7s 8ms', expected: Y + 2 * Mo + 3 * W + 4 * D + 5 * H + 6 * M + 7 * S + 8 * Ms },
	// Decimal multi-unit
	{ input: '2.5h 15m', expected: 2.5 * H + 15 * M },
	{ input: '.5h .5m', expected: 0.5 * H + 0.5 * M },
	{ input: '1.5 dias 12h', expected: 1.5 * D + 12 * H },
	// Negative multi-unit
	{ input: '-1h 30m', expected: -(H + 30 * M) },
	{ input: '-2h30m', expected: -(2 * H + 30 * M) },
	{ input: '- 1h 2m 3s', expected: -(H + 2 * M + 3 * S) },
	// Long notation multi-unit
	{ input: '1 hora 30 minutos', expected: H + 30 * M },
	{ input: '2 dias 4 horas', expected: 2 * D + 4 * H },
	{ input: '1 semana 3 dias 2 horas', expected: W + 3 * D + 2 * H },
	{ input: '1 año 2 meses 3 semanas 4 dias', expected: Y + 2 * Mo + 3 * W + 4 * D },
	// First unit valid, second unknown → first accumulates
	{ input: '1h 2xyz', expected: H },
];

describe('español — multi-unit', () => { runCases(MULTI_UNIT); });

// ─── boundary cases ───────────────────────────────────────────────────────────

const BOUNDARY: Case[] = [
	// Single-char notations + notation char → null
	{ input: '1ss', expected: null }, // s + s
	{ input: '1sh', expected: null }, // s + h
	{ input: '1sm', expected: null }, // s + m
	{ input: '1sd', expected: null }, // s + d
	{ input: '1hs', expected: null }, // h + s
	{ input: '1hm', expected: null }, // h + m
	{ input: '1hd', expected: null }, // h + d
	{ input: '1hh', expected: null }, // h + h
	{ input: '1dm', expected: null }, // d + m
	{ input: '1ds', expected: null }, // d + s
	{ input: '1dh', expected: null }, // d + h
	{ input: '1mm', expected: null }, // m + m
	{ input: '1mh', expected: null }, // m + h
	{ input: '1ms', expected: Ms }, // ms IS a valid notation
	// 2-char notations + notation char → null or valid
	{ input: '1mss', expected: null }, // ms + s
	{ input: '1msm', expected: null }, // ms + m
	{ input: '1mse', expected: null }, // ms + e (e is in BOUND from 'meses' etc.)
	{ input: '1hrm', expected: null }, // hr + m
	{ input: '1hrs', expected: H }, // hrs IS valid
	{ input: '1hrss', expected: null }, // hrs + s
	// Longer notations + notation char → null or valid
	{ input: '1segm', expected: null }, // seg + m
	{ input: '1segs', expected: S }, // segs IS valid
	{ input: '1segss', expected: null }, // segs + s
	{ input: '1segsm', expected: null }, // segs + m
	{ input: '1minm', expected: null }, // min + m
	{ input: '1mins', expected: M }, // mins IS valid
	{ input: '1minss', expected: null }, // mins + s
	{ input: '1minsh', expected: null }, // mins + h
	{ input: '1semm', expected: null }, // sem + m (m ∈ BOUND)
	{ input: '1sems', expected: null }, // sem + s (s ∈ BOUND)
	{ input: '1semd', expected: null }, // sem + d
	{ input: '1segundom', expected: null }, // segundo + m
	{ input: '1segundos', expected: S }, // segundos IS valid
	{ input: '1segundoss', expected: null }, // segundos + s
	{ input: '1minutom', expected: null }, // minuto + m
	{ input: '1minutos', expected: M }, // minutos IS valid
	{ input: '1horam', expected: null }, // hora + m
	{ input: '1horas', expected: H }, // horas IS valid
	{ input: '1añom', expected: null }, // año + m (m ∈ BOUND)
	{ input: '1añod', expected: null }, // año + d (d ∈ BOUND)
	{ input: '1años', expected: Y }, // años IS valid
	{ input: '1mesm', expected: null }, // mes + m
	{ input: '1meses', expected: Mo }, // meses IS valid
	{ input: '1msegm', expected: null }, // mseg + m
	{ input: '1msegs', expected: Ms }, // msegs IS valid
	// ñ is non-ASCII → c >= 128 → immediate match (valid boundary)
	{ input: '1añoñ', expected: Y }, // año + ñ → year matches (ñ is non-ASCII boundary)
	// Chars NOT in ES BOUND (b, c, f, j, k, p, q, v, w, x, y, z) → valid boundary → notation matches
	{ input: '1mw', expected: M }, // 'w' not in ES BOUND → m matches as minuto
	{ input: '1my', expected: M }, // 'y' not in ES BOUND → m matches as minuto
	{ input: '1sw', expected: S }, // 'w' not in ES BOUND → s matches as segundo
	// Notation + digit → valid (digits NOT in BOUND)
	{ input: '1s2m', expected: S + 2 * M },
	{ input: '1h3s', expected: H + 3 * S },
];

describe('español — boundary: notation + notation-char', () => { runCases(BOUNDARY); });

// ─── invalid inputs ───────────────────────────────────────────────────────────

const INVALID: Case[] = [
	{ input: '', expected: null },
	{ input: '1xyz', expected: null },
	{ input: '1xhora', expected: null },
	{ input: '.s', expected: null }, // dot with no digit before unit
	{ input: '1.2.3ms', expected: null }, // double decimal
	{ input: '1    h', expected: null }, // 4 spaces (max is 3)
	{ input: '1\th', expected: null }, // tab not allowed
	{ input: '1\ns', expected: null }, // newline not allowed
	{ input: 'abc', expected: null },
	{ input: 'NaN', expected: null },
	// English notations → null with Spanish parser
	{ input: '1 hour', expected: null },
	{ input: '1 day', expected: null },
	{ input: '1 minute', expected: null },
	{ input: '1 second', expected: null },
	// Truncated Spanish notations
	{ input: '1hor', expected: null }, // truncated "hora"
	{ input: '1segun', expected: null }, // truncated "segundo"
	{ input: '1miliseg', expected: null }, // truncated "milisegundo"
	{ input: '1seman', expected: null }, // truncated "semana"
	{ input: '1minut', expected: null }, // truncated "minuto"
	{ input: '1segund', expected: null }, // truncated "segundo"
];

describe('español — invalid inputs', () => { runCases(INVALID); });
