import { Bench, type Task, type TaskResultCompleted } from 'tinybench';
import vercelMs from 'ms';

import { LANGUAGES, format, parse, parseVariants as buildVariants } from '@src/index.ts';
import { createArgs, check, type FormatArgs } from '../utils.ts';
import { createRequire } from 'module';

type CompletedTask = Task & { result: TaskResultCompleted };

const parseVariants = {
	'vercel/ms': (s: string): number | null => vercelMs(s),
	normal: (s: string): number | null => parse(s, LANGUAGES.en),
	v18: buildVariants.v18(LANGUAGES.en),
	v23: buildVariants.v23(LANGUAGES.en),
	v25: buildVariants.v25(LANGUAGES.en),
	v29: buildVariants.v29(LANGUAGES.en),
	v31: buildVariants.v31(LANGUAGES.en),
	v32: buildVariants.v32(LANGUAGES.en),
};

const N = 10000;
const INVALID_SAMPLES = Array.from({ length: N }, () => createArgs(false, true));
const PARSE_SAMPLES_VERCEL = Array.from({ length: N }, (): FormatArgs => {
	const args = createArgs(true, true);
	const input = format(args.expected, args.options) ?? '';
	const expected = vercelMs(input);
	return { ...args, input, expected };
});

export function benchParse(fn: (input: string) => number | null): () => void {
	return () => {
		for (const s of PARSE_SAMPLES_VERCEL) check(fn(s.input), s.expected);
	};
}

export function benchParseInvalid(fn: (input: string) => number | null): () => void {
	return () => {
		for (const s of INVALID_SAMPLES) fn(s.input);
	};
}

// ─── Parse single-unit — valid ────────────────────────────────────────────────

const parseSingleValidBench = new Bench({ name: 'Parse single-unit — valid', time: 1_000 });

parseSingleValidBench
	.add('vercel/ms', benchParse(parseVariants['vercel/ms']))
	.add('parse', benchParse(parseVariants.normal))
	.add('v18 single-pass', benchParse(parseVariants.v18))
	.add('v23 turbofan-opt', benchParse(parseVariants.v23))
	.add('v25 flat-lookup', benchParse(parseVariants.v25))
	.add('v29 compressed-dfa', benchParse(parseVariants.v29))
	.add('v31 eval-dfa', benchParse(parseVariants.v31))
	.add('v32 craft-trie', benchParse(parseVariants.v32));

// ─── Parse single-unit — invalid ─────────────────────────────────────────────

const parseSingleInvalidBench = new Bench({ name: 'Parse single-unit — invalid', time: 1_000 });

parseSingleInvalidBench
	.add('vercel/ms', benchParseInvalid(parseVariants['vercel/ms']))
	.add('parse', benchParseInvalid(parseVariants.normal))
	.add('v18 single-pass', benchParseInvalid(parseVariants.v18))
	.add('v23 turbofan-opt', benchParseInvalid(parseVariants.v23))
	.add('v25 flat-lookup', benchParseInvalid(parseVariants.v25))
	.add('v29 compressed-dfa', benchParseInvalid(parseVariants.v29))
	.add('v31 eval-dfa', benchParseInvalid(parseVariants.v31))
	.add('v32 craft-trie', benchParseInvalid(parseVariants.v32));

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
