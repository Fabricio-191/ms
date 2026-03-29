import { Bench, type Task, type TaskResultCompleted } from 'tinybench';
import vercelMs from 'ms';

import { LANGUAGES, format, parse, parseVariants as buildVariants } from '@src/index.ts';
import { createArgs, type FormatArgs } from '../utils.ts';
import { createRequire } from 'module';

type CompletedTask = Task & { result: TaskResultCompleted };

const parseVariants: Record<string, (s: string) => number | null> = {
	'vercel/ms': (s: string): number | null => vercelMs(s),
	normal: (s: string): number | null => parse(s, LANGUAGES.en),
	...Object.fromEntries(
		Object.entries(buildVariants).map(([ k, build ]) => [ k, build(LANGUAGES.en) ]),
	),
};

const concurrency = 'bench'; // null | 'task' | 'bench';
const N = 10000;
const INVALID_SAMPLES = Array.from({ length: N }, () => createArgs(false, true));
const PARSE_SAMPLES_VERCEL = Array.from({ length: N }, (): FormatArgs => {
	const args = createArgs(true, true);
	const input = format(args.expected, args.options) ?? '';
	const expected = vercelMs(input);
	return { ...args, input, expected };
});

// ─── Parse single-unit — valid ────────────────────────────────────────────────

const parseSingleValidBench = new Bench({
	name: 'Parse single-unit — valid',
	time: 1_000,
	concurrency,
});

for (const [ name, fn ] of Object.entries(parseVariants)) {
	parseSingleValidBench.add(name, () => {
		for (const s of PARSE_SAMPLES_VERCEL)
			fn(s.input);
	});
}

// ─── Parse single-unit — invalid ─────────────────────────────────────────────

const parseSingleInvalidBench = new Bench({
	name: 'Parse single-unit — invalid',
	time: 1_000,
	concurrency,
});

for (const [ name, fn ] of Object.entries(parseVariants)) {
	parseSingleInvalidBench.add(name, () => {
		for (const s of INVALID_SAMPLES)
			fn(s.input);
	});
}

// ─── Parse multi-unit ─────────────────────────────────────────────────────────

// ─── Multi-language overhead ──────────────────────────────────────────────────

// ─── Run ──────────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const localPkg = require('../../package.json') as { version: string };
const vercelPkg = require('ms/package.json') as { version: string };

console.log();
console.log(`Node.js: ${process.version} | @fabricio-191/ms: ${localPkg.version} | vercel/ms: ${vercelPkg.version}`);

await parseSingleValidBench.run();
printResults(parseSingleValidBench);

await parseSingleInvalidBench.run();
printResults(parseSingleInvalidBench);

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
