import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANGUAGES } from '../src/core/languages.ts';
import { buildParse as buildParseV25 } from '../src/parse/v25.ts';
import { buildParse as buildParseV42 } from '../src/parse/v42.ts';
import { buildFormat as buildFormatV16 } from '../src/format/v16.ts';
import { buildFastParse as buildFastParseV45 } from '../archive/parse/v45.ts';
import { buildFastParse as buildFastParseV47 } from '../archive/parse/v47.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = join(__dirname, '..', 'examples');
const LANG = LANGUAGES.en;

function header(title: string, description: string): string {
	return [
		'/**',
		` * ${title}`,
		' *',
		...description.split('\n').map(line => ` * ${line}`),
		' *',
		' * AUTO-GENERATED — DO NOT EDIT',
		' * Run: npm run generate:examples',
		' */',
		'',
	].join('\n');
}

function writeExample(filename: string, content: string): void {
	const filepath = join(EXAMPLES_DIR, filename);
	if (!existsSync(EXAMPLES_DIR)) {
		mkdirSync(EXAMPLES_DIR, { recursive: true });
	}
	writeFileSync(filepath, content, 'utf-8');
	console.log(`✓ ${filename}`);
}

function extractFunctionSource(fn: Function): string {
	const source = fn.toString();
	const arrowIndex = source.indexOf('=>');
	if (arrowIndex === -1) return source;
	const bodyStart = source.indexOf('{', arrowIndex);
	if (bodyStart === -1) return source;
	let depth = 0;
	for (let i = bodyStart; i < source.length; i++) {
		if (source[i] === '{') depth++;
		if (source[i] === '}') {
			depth--;
			if (depth === 0) return source.slice(bodyStart + 1, i);
		}
	}
	return source;
}

function generateParseExample(name: string, buildFn: (lang: typeof LANG) => Function): void {
	const fn = buildFn(LANG);
	const source = extractFunctionSource(fn);

	const content = header(
		`${name} — Generated parse function`,
		[
			'Parse function for English language.',
			'Generated at build time via craftFunction().',
			'',
			'This is the actual code that executes at runtime.',
		].join('\n'),
	) + source;

	writeExample(`${name.toLowerCase()}.example.ts`, content);
}

function generateFormatExample(): void {
	const fn = buildFormatV16({ language: LANG, long: false, length: 1 });
	const source = extractFunctionSource(fn);

	const content = header(
		'v16 — Generated format function',
		[
			'Format function for English, short format, single unit.',
			'Generated at build time via craftFunction().',
			'',
			'This is the actual code that executes at runtime.',
		].join('\n'),
	) + source;

	writeExample('v16.example.ts', content);
}

function generateAllExamples(): void {
	console.log('\n📝 Generating code examples...\n');
	generateParseExample('v25', buildParseV25 as (lang: typeof LANG) => Function);
	generateParseExample('v42', buildParseV42 as (lang: typeof LANG) => Function);
	generateParseExample('v45', buildFastParseV45 as (lang: typeof LANG) => Function);
	generateParseExample('v47', buildFastParseV47 as (lang: typeof LANG) => Function);
	generateFormatExample();
	console.log('\n✅ Done! Examples written to examples/');
}

generateAllExamples();
