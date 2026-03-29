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

import { LANGUAGES, buildParse, buildFormat } from '@src/index.ts';
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

const WARMUP = 100_000;
const samples = Array.from({ length: WARMUP }, () => createArgs(true, true));
const formatSamples = Array.from({ length: WARMUP }, () => {
	const { expected } = createArgs(true, true);
	return Math.abs(expected);
});

// ─── Funciones a analizar ─────────────────────────────────────────────────────

const v42 = buildParse(LANGUAGES.en);

const fv16Short = buildFormat({ language: LANGUAGES.en });
const fv16Long = buildFormat({ language: LANGUAGES.en, long: true });
const fv16Short3 = buildFormat({ language: LANGUAGES.en, length: 3 });
const fv16Long3 = buildFormat({ language: LANGUAGES.en, long: true, length: 3 });

interface Entry {
	name: string;
	fn: unknown;
	warm(this: void): void;
}

const entries: Entry[] = [
	// ─── Parse entries ────────────────────────────────────────────────────────
	{
		name: 'parse v42 (avail=len-i)',
		fn: v42,
		warm(): void { for (const s of samples) v42(s.input); },
	},

	// ─── Format entries ───────────────────────────────────────────────────────
	{
		name: 'format v16 short l=1 (fully parametric)',
		fn: fv16Short,
		warm(): void { for (const ms of formatSamples) fv16Short(ms); },
	},
	{
		name: 'format v16 long  l=1 (fully parametric)',
		fn: fv16Long,
		warm(): void { for (const ms of formatSamples) fv16Long(ms); },
	},
	{
		name: 'format v16 short l=3 (multi-unit)',
		fn: fv16Short3,
		warm(): void { for (const ms of formatSamples) fv16Short3(ms); },
	},
	{
		name: 'format v16 long  l=3 (multi-unit)',
		fn: fv16Long3,
		warm(): void { for (const ms of formatSamples) fv16Long3(ms); },
	},
];

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log('\n=== V8 JIT Optimization Status ===');
console.log(`Node.js ${process.version}  |  Warmup: ${WARMUP.toLocaleString()} calls per function\n`);
console.log(`${'  Function'.padEnd(42)} ${'Status'.padEnd(35)} Raw`);
console.log('─'.repeat(90));

for (const { name, fn, warm } of entries) {
	warm();
	const status = getOptStatus(fn);
	let icon = '~';
	if (status & STATUS.kOptimized) icon = '✓';
	else if (status & STATUS.kNeverOptimize) icon = '✗';
	console.log(`${icon} ${name.padEnd(40)} ${describeStatus(status).padEnd(35)} ${status}`);
}
