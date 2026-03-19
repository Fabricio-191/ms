import { createRequire } from 'node:module';

import { runNotationToTimeBenchmark } from './benchs/notation-to-time.js';
import { runSimpleFormatBenchmark } from './benchs/simple-format.js';

const require = createRequire(import.meta.url);

const localPkg = require('../../package.json');
const vercelPkg = require('ms/package.json');

console.log(`Node.js version: ${process.version}`);
console.log(`@fabricio-191/ms (compiled lib): ${localPkg.version}`);
console.log(`vercel/ms: ${vercelPkg.version}`);

await runNotationToTimeBenchmark();
await runSimpleFormatBenchmark();
