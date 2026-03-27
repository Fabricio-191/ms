/**
 * V8 JIT Optimization Status
 *
 * Verifica si V8 está optimizando (TurboFan/Maglev) las funciones generadas.
 * Requiere el flag --allow-natives-syntax para acceder a los intrínsecos de V8.
 *
 * Correr con:
 *   npm run bench:jit
 * O directamente:
 *   node --allow-natives-syntax --import tsx/esm testing/benchmarks/jit.ts
 */

import { LANGUAGES } from '@src/index.ts';
import { buildFastParse as buildFastParseV18 } from '@src/parse/variants/v18.ts';
import { buildFastParse as buildFastParseV23 } from '@src/parse/variants/v23.ts';
import { buildFastParse as buildFastParseV25 } from '@src/parse/variants/v25.ts';
import { createArgs } from '../utils.ts';

// Intrínsecos de V8 — sólo disponibles con --allow-natives-syntax.
// Se usan via new Function() porque % no es sintaxis JS válida y
// el transpilador (tsx/tsc) lo rechazaría si aparece directo en el fuente.
const getOptStatus = new Function('fn', 'return %GetOptimizationStatus(fn)') as (fn: unknown) => number;

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
const samples = Array.from({ length: WARMUP }, () => createArgs(true, true));

// ─── Funciones generadas a analizar ───────────────────────────────────────────

const v18fn = buildFastParseV18(LANGUAGES.en);
const v23fn = buildFastParseV23(LANGUAGES.en);
const v25fn = buildFastParseV25(LANGUAGES.en);

const entries = [
	{
		name: 'v18 single-pass',
		fn: v18fn,
		warm(this: void): void { for (const s of samples) v18fn(s.input); },
	},
	{
		name: 'v23 turbofan-opt',
		fn: v23fn,
		warm(this: void): void { for (const s of samples) v23fn(s.input); },
	},
	{
		name: 'v25 flat-lookup',
		fn: v25fn,
		warm(this: void): void { for (const s of samples) v25fn(s.input); },
	},
];

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log('\n=== V8 JIT Optimization Status ===');
console.log(`Node.js ${process.version}  |  Warmup: ${WARMUP.toLocaleString()} calls por función\n`);
console.log(`${'  Función'.padEnd(26)} ${'Estado'.padEnd(30)} Raw`);
console.log('─'.repeat(62));

for (const { name, fn, warm } of entries) {
	warm();
	const status = getOptStatus(fn);
	let icon = '~';
	if (status & STATUS.kOptimized) icon = '✓';
	else if (status & STATUS.kNeverOptimize) icon = '✗';
	console.log(`${icon} ${name.padEnd(24)} ${describeStatus(status).padEnd(30)} ${status}`);
}
