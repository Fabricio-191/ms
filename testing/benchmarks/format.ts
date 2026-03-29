import { Bench, type Task, type TaskResultCompleted } from 'tinybench';
import vercelMs from 'ms';

import { LANGUAGES, format, formatVariants as buildFormatVariants, buildFastFormat } from '@src/index.ts';
import { createArgs } from '../utils.ts';
import { createRequire } from 'module';

type CompletedTask = Task & { result: TaskResultCompleted };

// Samples: single-unit, positive, vercel-compatible (no Mo, length=1)
const N = 10000;
const FORMAT_SAMPLES = Array.from({ length: N }, () => {
	const { expected } = createArgs(true, true);
	return Math.abs(expected);
});

type FormatFn = (ms: number, long: boolean) => unknown;

// v16 specialized functions — one per (long, length) combination
const v16Short = buildFastFormat({ language: LANGUAGES.en });
const v16Long = buildFastFormat({ language: LANGUAGES.en, long: true });
const v16Short3 = buildFastFormat({ language: LANGUAGES.en, length: 3 });
const v16Long3 = buildFastFormat({ language: LANGUAGES.en, long: true, length: 3 });

const formatFns: Record<string, FormatFn> = {
	'vercel/ms': (ms, long) => vercelMs(ms, long ? { long } : undefined),
	normal: (ms, long) => format(ms, long ? { long, language: LANGUAGES.en } : { language: LANGUAGES.en }),
	...Object.fromEntries(
		Object.entries(buildFormatVariants).map(([ k, build ]) => {
			const fn = build(LANGUAGES.en);
			return [ k, (ms: number, long: boolean) => fn(ms, long) ];
		}),
	),
	// v16: specialized per (long, length) — no runtime dispatch
	'v16 short l=1': ms => v16Short(ms),
	'v16 long  l=1': ms => v16Long(ms),
	'v16 short l=3': ms => v16Short3(ms),
	'v16 long  l=3': ms => v16Long3(ms),
};

// ─── Format — short ───────────────────────────────────────────────────────────

const formatShortBench = new Bench({ name: 'Format — short', time: 1_000 });

for (const [ name, fn ] of Object.entries(formatFns)) {
	formatShortBench.add(name, () => {
		for (const ms of FORMAT_SAMPLES) fn(ms, false);
	});
}

// ─── Format — long ────────────────────────────────────────────────────────────

const formatLongBench = new Bench({ name: 'Format — long', time: 1_000 });

for (const [ name, fn ] of Object.entries(formatFns)) {
	formatLongBench.add(name, () => {
		for (const ms of FORMAT_SAMPLES) fn(ms, true);
	});
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const localPkg = require('../../package.json') as { version: string };
const vercelPkg = require('ms/package.json') as { version: string };

console.log();
console.log(`Node.js: ${process.version} | @fabricio-191/ms: ${localPkg.version} | vercel/ms: ${vercelPkg.version}`);

await formatShortBench.run();
printResults(formatShortBench);

await formatLongBench.run();
printResults(formatLongBench);

function printResults(bench: Bench): void {
	console.log();
	console.log(`=== ${bench.name} ===`);
	console.log();
	console.log(`${'Method'.padEnd(26)} ${'ops/sec'.padStart(10)}`);
	console.log('─'.repeat(48));

	const completedTasks = bench.tasks
		.filter((t): t is CompletedTask => t.result.state === 'completed')
		.sort((a, b) => b.result.throughput.p50 - a.result.throughput.p50);

	const uncompletedTasks = bench.tasks.filter(t => t.result.state !== 'completed');

	const results = [
		...completedTasks.map(task => ({
			name: task.name,
			ops: task.result.throughput.p50,
			extra: `±${task.result.throughput.rme.toFixed(1)}%`,
		})),
		...uncompletedTasks.map(task => ({
			name: task.name,
			ops: 0,
			extra: task.result.state === 'errored' ?
				task.result.error.toString() :
				task.result.state,
		})),
	];

	for (const r of results)
		console.log(`${r.name.padEnd(26)} ${r.ops.toFixed(2).padStart(10)}  ${r.extra}`);

	if (completedTasks.length === 0) return;

	const fastest = completedTasks.reduce((a, b) => a.result.throughput.p50 >= b.result.throughput.p50 ? a : b);

	console.log();
	console.log(`fastest: ${fastest.name} (${fastest.result.throughput.p50.toFixed(2)} ops/sec)`);
}
