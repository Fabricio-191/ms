import { defineConfig } from 'tsup';

export default defineConfig([
	{
		entry: { index: 'src/index.ts' },
		format: [ 'esm' ],
		dts: true,
		outDir: 'lib/esm',
		clean: true,
		sourcemap: 'inline',
	},
	{
		entry: { index: 'src/index.ts' },
		format: [ 'cjs' ],
		dts: true,
		outDir: 'lib/cjs',
		clean: true,
		sourcemap: 'inline',
		shims: true,
	},
]);
