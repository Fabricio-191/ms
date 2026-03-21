import { createRequire } from 'node:module';

import Benchmark from 'benchmark';
import vercelMS from 'ms';

import { buildFastParse, buildFastFormat, format, LANGUAGES, parse } from '../lib/esm/index.js';
import { BENCH_PARSE_SAMPLES, BENCH_FORMAT_SAMPLES } from './generators.ts';

const require = createRequire(import.meta.url);

const localPkg = require('../package.json') as { version: string };
const vercelPkg = require('ms/package.json') as { version: string };

console.log();
console.log(`Node.js version: ${process.version}`);
console.log(`@fabricio-191/ms (compiled lib): ${localPkg.version}`);
console.log(`vercel/ms: ${vercelPkg.version}`);

async function runSuite(name: string, registerSuite: (suite: Benchmark.Suite) => void): Promise<void> {
	console.log(`\n${name}`);

	return new Promise(resolve => {
		const suite = new Benchmark.Suite(name);

		registerSuite(suite);

		suite
			.on('cycle', (event: Benchmark.Event) => {
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				console.log(String(event.target));
			})
			.on('complete', () => {
				const fastest = suite
					.filter('fastest')
					.map('name')
					.join(', ');

				console.log(`Fastest: ${fastest}\n`);
				resolve();
			})
			.run({ async: true });
	});
}

// notation-to-time

const fastParseEn = buildFastParse(LANGUAGES.en);

await runSuite('single unit parse (worst case: milliseconds)', suite => {
	suite
		.add('vercel/ms parse', () => {
			for (const sample of BENCH_PARSE_SAMPLES)
				vercelMS(sample);
		})
		.add('@fabricio-191/ms parse (lib/esm)', () => {
			for (const sample of BENCH_PARSE_SAMPLES)
				parse(sample, LANGUAGES.en);
		})
		.add('@fabricio-191/ms fastParse (lib/esm)', () => {
			for (const sample of BENCH_PARSE_SAMPLES)
				fastParseEn(sample);
		})
		.add('@fabricio-191/ms fastParse2 (lib/esm)', () => {
			for (const sample of BENCH_PARSE_SAMPLES)
				fastParseEn(sample);
		});
});

// simple-format

const fastFormatEn = buildFastFormat(LANGUAGES.en);

await runSuite('simple formatting (length = 1)', suite => {
	suite
		.add('vercel/ms short', () => {
			for (const value of BENCH_FORMAT_SAMPLES)
				vercelMS(value);
		})
		.add('@fabricio-191/ms short (lib/esm)', () => {
			for (const value of BENCH_FORMAT_SAMPLES)
				format(value, { language: LANGUAGES.en, length: 1 });
		})
		.add('@fabricio-191/ms fastFormat (lib/esm)', () => {
			for (const value of BENCH_FORMAT_SAMPLES)
				fastFormatEn(value);
		})
		.add('vercel/ms long', () => {
			for (const value of BENCH_FORMAT_SAMPLES)
				vercelMS(value, { long: true });
		})
		.add('@fabricio-191/ms long (lib/esm)', () => {
			for (const value of BENCH_FORMAT_SAMPLES)
				format(value, { language: LANGUAGES.en, length: 1, long: true });
		})
		.add('@fabricio-191/ms fastFormat long (lib/esm)', () => {
			for (const value of BENCH_FORMAT_SAMPLES)
				fastFormatEn(value, true);
		});
});
