/**
 * V8 JIT Optimization Status
 *
 * Verifica si V8 está optimizando (TurboFan/Maglev) las funciones críticas.
 * Requiere el flag --allow-natives-syntax para acceder a los intrínsecos de V8.
 *
 * Correr con:
 *   npm run bench:jit
 * O directamente:
 *   node --allow-natives-syntax --import tsx/esm benchmarks/jit.ts
 */

import { LANGUAGES, parse, format, buildFastParse, buildFastFormat } from '../src/index.ts';
import { buildFastParse as buildFastParseV23, buildFastParseRaw as buildFastParseRawV23 } from '../src/parse/variants/single/v23.ts';
import { buildFastParse as buildFastParseV25, buildFastParseRaw as buildFastParseRawV25 } from '../src/parse/variants/single/v25.ts';
import { buildFastParseMulti } from '../src/parse/fast.ts';
import { buildFastParseRaw } from '../src/parse/variants/single/v18.ts';
import { createArgs } from './utils.ts';

// Intrínsecos de V8 — sólo disponibles con --allow-natives-syntax.
// Se usan via new Function() porque % no es sintaxis JS válida y
// el transpilador (tsx/tsc) lo rechazaría si aparece directo en el fuente.
//
// Nota: %OptimizeFunctionOnNextCall fue removido en Node.js v24 (requiere --fuzzing).
// Se usa solo el warmup natural: 20k llamadas son más que suficientes para que
// V8 JIT-compile las funciones hot por sí solo.
// eslint-disable-next-line no-new-func
const getOptStatus = new Function('fn', 'return %GetOptimizationStatus(fn)') as (fn: Function) => number;

// ─── Status bits ──────────────────────────────────────────────────────────────

const STATUS = {
	kNeverOptimize: 1 << 1,
	kMaybeDeopted: 1 << 3,
	kOptimized: 1 << 4,
	kTurboFanned: 1 << 5,
	kInterpreted: 1 << 6,
	kMaglevved: 1 << 10,
} as const;

function describeStatus(n: number): string {
	const parts: string[] = [];
	if (n & STATUS.kOptimized) parts.push('Optimized');
	if (n & STATUS.kTurboFanned) parts.push('TurboFan');
	if (n & STATUS.kMaglevved) parts.push('Maglev');
	if (n & STATUS.kInterpreted) parts.push('Interpreted');
	if (n & STATUS.kMaybeDeopted) parts.push('MaybeDeopted ⚠');
	if (n & STATUS.kNeverOptimize) parts.push('NeverOptimize ✗');
	return parts.length > 0 ? parts.join(' + ') : `unknown(${n})`;
}

// ─── Samples ──────────────────────────────────────────────────────────────────

const WARMUP = 20_000;

const parseSamples = Array.from({ length: WARMUP }, () => createArgs(true, true));
const formatSamples = parseSamples.map(s => ({ ms: s.expected, long: s.options.long }));

// ─── Funciones a analizar ─────────────────────────────────────────────────────

const multiParse = buildFastParseMulti([ LANGUAGES.en, LANGUAGES.es, LANGUAGES.ja ]);
const fastFormat = buildFastFormat(LANGUAGES.en);

// buildFastParse devuelve fn.bind(null, rootArr, boundaryArr) — un JSBoundFunction.
// %GetOptimizationStatus no puede inspeccionar bound functions en Node.js v24+
// (crashea con fatal error). Solución: un wrapper delgado sobre la bound function.
// V8 verá este wrapper como función hot y lo optimizará; después de suficiente
// warmup probablemente inlinee la bound function adentro.
const fastParseBound = buildFastParse(LANGUAGES.en);
const fastParseWrap = (s: string): number | null => fastParseBound(s);
const { fn: fastParseRawFn, rootArr, boundaryArr } = buildFastParseRaw(LANGUAGES.en);

const v23Bound = buildFastParseV23(LANGUAGES.en);
const v23Wrap = (s: string): number | null => v23Bound(s);
const { fn: v23RawFn, rootArr: v23RootArr, boundaryArr: v23BoundaryArr } = buildFastParseRawV23(LANGUAGES.en);

const v25Bound = buildFastParseV25(LANGUAGES.en);
const v25Wrap = (s: string): number | null => v25Bound(s);
const { fn: v25RawFn, rootArr: v25RootArr, boundaryArr: v25BoundaryArr } = buildFastParseRawV25(LANGUAGES.en);

interface Entry {
	name: string;
	fn: Function;
	warm(): void;
	trigger(): void;
}

const entries: Entry[] = [
	{
		name: 'parse',
		fn: parse,
		warm: () => { for (const s of parseSamples) parse(s.input, LANGUAGES.en); },
		trigger: () => parse(parseSamples[0]!.input, LANGUAGES.en),
	},
	{
		name: 'buildFastParse (wrapper)',
		fn: fastParseWrap,
		warm: () => { for (const s of parseSamples) fastParseWrap(s.input); },
		trigger: () => fastParseWrap(parseSamples[0]!.input),
	},
	{
		name: 'buildFastParse (raw fn)',
		fn: fastParseRawFn,
		warm: () => { for (const s of parseSamples) fastParseRawFn(rootArr, boundaryArr, s.input); },
		trigger: () => fastParseRawFn(rootArr, boundaryArr, parseSamples[0]!.input),
	},
	{
		name: 'v23 (wrapper)',
		fn: v23Wrap,
		warm: () => { for (const s of parseSamples) v23Wrap(s.input); },
		trigger: () => v23Wrap(parseSamples[0]!.input),
	},
	{
		name: 'v23 (raw fn)',
		fn: v23RawFn,
		warm: () => { for (const s of parseSamples) v23RawFn(v23RootArr, v23BoundaryArr, s.input); },
		trigger: () => v23RawFn(v23RootArr, v23BoundaryArr, parseSamples[0]!.input),
	},
	{
		name: 'v25 lookup (wrapper)',
		fn: v25Wrap,
		warm: () => { for (const s of parseSamples) v25Wrap(s.input); },
		trigger: () => v25Wrap(parseSamples[0]!.input),
	},
	{
		name: 'v25 lookup (raw fn)',
		fn: v25RawFn,
		warm: () => { for (const s of parseSamples) v25RawFn(v25RootArr, v25BoundaryArr, s.input); },
		trigger: () => v25RawFn(v25RootArr, v25BoundaryArr, parseSamples[0]!.input),
	},
	{
		name: 'buildFastParseMulti',
		fn: multiParse,
		warm: () => { for (const s of parseSamples) multiParse(s.input); },
		trigger: () => multiParse(parseSamples[0]!.input),
	},
	{
		name: 'format',
		fn: format,
		warm: () => { for (const s of formatSamples) format(s.ms, { language: LANGUAGES.en, long: s.long }); },
		trigger: () => format(formatSamples[0]!.ms, { language: LANGUAGES.en, long: formatSamples[0]!.long }),
	},
	{
		name: 'buildFastFormat',
		fn: fastFormat,
		warm: () => { for (const s of formatSamples) fastFormat(s.ms, s.long); },
		trigger: () => fastFormat(formatSamples[0]!.ms, formatSamples[0]!.long),
	},
];

// ─── Run ──────────────────────────────────────────────────────────────────────

// Guard: bound functions (JSBoundFunction) crashean con fatal error en Node.js v24+.
// buildFastParse retorna fn.bind(...) → se usa fastParseWrap en su lugar.
// Este guard existe como seguridad por si alguien agrega una bound function en el futuro.
function isBoundFunction(fn: Function): boolean {
	return fn.name.startsWith('bound ');
}

console.log('\n=== V8 JIT Optimization Status ===');
console.log(`Node.js ${process.version}  |  Warmup: ${WARMUP.toLocaleString()} calls por función\n`);
console.log(`${'  Función'.padEnd(30)} ${'Estado'.padEnd(30)} Raw`);
console.log('─'.repeat(66));

for (const { name, fn, warm, trigger } of entries) {
	if (isBoundFunction(fn)) {
		console.log(`- ${name.padEnd(28)} ${'bound function (skip)'.padEnd(30)} -`);
		continue;
	}

	// 1. Calentar: V8 necesita ver la función ejecutarse muchas veces
	//    para considerarla "hot" y compilarla con TurboFan/Maglev
	warm();

	// 2. Una llamada más para que el estado sea estable
	trigger();

	// 3. Leer el estado resultante
	const status = getOptStatus(fn);
	const icon = (status & STATUS.kOptimized) ?
		'✓' :
		(status & STATUS.kNeverOptimize) ?
			'✗' :
			'~';

	console.log(`${icon} ${name.padEnd(28)} ${describeStatus(status).padEnd(30)} ${status}`);
}
