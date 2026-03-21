import { defineConfig } from 'tsup';

export default defineConfig([
	// https://github.com/egoist/tsup/issues/1286
	{
		entry: { index: 'src/index.ts' },
		format: [ 'esm' ],
		dts: true,
		outDir: 'lib/esm',
		clean: true,
		sourcemap: true,
	},
	{
		entry: { index: 'src/index.ts' },
		format: [ 'cjs' ],
		dts: true,
		outDir: 'lib/cjs',
		clean: true,
		sourcemap: true,
		shims: true,
	},
]);
