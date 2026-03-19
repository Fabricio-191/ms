import { strictEqual } from 'node:assert';

import vercelMS from 'ms';

import { buildFastParse, LANGUAGES, parse } from '../../../lib/esm/index.js';
import { runSuite } from '../bench-utils.js';
import generators from '../../generators.cjs';

const fastParseEn = buildFastParse(LANGUAGES.en);

const samples = generators.createBenchNotationSamples(10_000, input => (
	vercelMS(input) !== undefined &&
	parse(input, LANGUAGES.en) !== null &&
	fastParseEn(input) !== null
));

for (const sample of samples) {
	strictEqual(parse(sample, LANGUAGES.en), vercelMS(sample));
	strictEqual(fastParseEn(sample), vercelMS(sample));
}

export async function runNotationToTimeBenchmark() {
	await runSuite('notation -> milliseconds', suite => {
		suite
			.add('vercel/ms parse', () => {
				for (const sample of samples)
					vercelMS(sample);
			})
			.add('@fabricio-191/ms parse (lib/esm)', () => {
				for (const sample of samples)
					parse(sample, LANGUAGES.en);
			})
			.add('@fabricio-191/ms fastParse (lib/esm)', () => {
				for (const sample of samples)
					fastParseEn(sample);
			});
	});
}
