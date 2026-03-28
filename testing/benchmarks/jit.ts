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
 *
 * Hipótesis investigada:
 *   - El wrapper (str) => fn(ROOT, BOUND, str) llega a TurboFan
 *   - La fn generada directamente se queda en Maglev (código muy grande)
 *   - craftFunction elimina el wrapper y captura contexto como closure
 */

import { LANGUAGES, parseVariants } from '@src/index.ts';
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

// ─── Funciones a analizar ─────────────────────────────────────────────────────

const v18Wrap = parseVariants.v18(LANGUAGES.en);
const v23Wrap = parseVariants.v23(LANGUAGES.en);
const v25Wrap = parseVariants.v25(LANGUAGES.en);
const v29Wrap = parseVariants.v29(LANGUAGES.en);
const v31Wrap = parseVariants.v31(LANGUAGES.en);
const v32Wrap = parseVariants.v32(LANGUAGES.en);

interface Entry {
	name: string;
	fn: unknown;
	warm(this: void): void;
}

const entries: Entry[] = [
	{
		name: 'v18 (craftFunction, trie)',
		fn: v18Wrap,
		warm(): void { for (const s of samples) v18Wrap(s.input); },
	},
	{
		name: 'v23 (craftFunction, trie)',
		fn: v23Wrap,
		warm(): void { for (const s of samples) v23Wrap(s.input); },
	},
	{
		name: 'v25 (craftFunction, lookup)',
		fn: v25Wrap,
		warm(): void { for (const s of samples) v25Wrap(s.input); },
	},
	{
		name: 'v29 (craftFunction, compressed DFA)',
		fn: v29Wrap,
		warm(): void { for (const s of samples) v29Wrap(s.input); },
	},
	{
		name: 'v31 (eval closure, compressed)',
		fn: v31Wrap,
		warm(): void { for (const s of samples) v31Wrap(s.input); },
	},
	{
		name: 'v32 (craftFunction, trie)',
		fn: v32Wrap,
		warm(): void { for (const s of samples) v32Wrap(s.input); },
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
