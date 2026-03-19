import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import { globalIgnores } from 'eslint/config';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
	globalIgnores([
		'lib/',
		'eslint.config.ts',
		'jest.config.js',
		'tsup.config.ts',
	]),
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
			},
		},
	},
	eslint.configs.all,
	eslint.configs.recommended,
	...tseslint.configs.all,
	tseslint.configs.eslintRecommended,
	{
		rules: {
			camelcase: [ 'error' ],
			'one-var': 'off',
			'capitalized-comments': 'off',
			'sort-keys': 'off',
			'sort-imports': 'off',
			'id-length': 'off',
			'max-lines': 'off',
			'max-statements': 'off',
			'max-lines-per-function': 'off',
			'no-console': 'off',
			'no-magic-numbers': 'off',
			'no-inline-comments': 'off',
			'no-warning-comments': 'off',
			'no-ternary': 'off',
			'no-undefined': 'off',
			'vars-on-top': 'off',
			radix: 'off',
			'@typescript-eslint/no-unused-vars': 'off', // This rule is already covered by the TypeScript compiler
			'@typescript-eslint/no-magic-numbers': 'off',
			'@typescript-eslint/naming-convention': 'off',
			'@typescript-eslint/max-params': 'off',

			curly: [ 'error', 'multi-or-nest', 'consistent' ],
			'func-style': [
				'error',
				'declaration',
				{ allowArrowFunctions: true },
			],
			'no-plusplus': [ 'error', { allowForLoopAfterthoughts: true } ],
			'@typescript-eslint/array-type': [ 'error', { default: 'array-simple' } ],
			'@typescript-eslint/no-use-before-define': [ 'error', { functions: false } ],
			'@typescript-eslint/method-signature-style': [ 'error', 'method' ],
			'@typescript-eslint/dot-notation': [ 'error', { allowIndexSignaturePropertyAccess: true } ],
			'@typescript-eslint/prefer-destructuring': [ 'off' ],
			'@typescript-eslint/no-invalid-void-type': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off', //
			'@typescript-eslint/prefer-readonly-parameter-types': 'off', //
			'@typescript-eslint/strict-boolean-expressions': 'off', //
			'@typescript-eslint/no-unsafe-type-assertion': 'off', // Object.keys() requires narrowing assertion
			'@typescript-eslint/member-ordering': 'off',
			'@typescript-eslint/no-base-to-string': [ 'error', { checkUnknown: false } ],
		},
	},
	{
		files: [ 'test/**/*.{js,cjs,mjs}' ],
		languageOptions: {
			globals: {
				console: 'readonly',
				process: 'readonly',
				require: 'readonly',
				module: 'writable',
				exports: 'writable',
				__dirname: 'readonly',
				__filename: 'readonly',
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
			},
		},
		rules: {
			'no-undef': 'off',
			'func-names': 'off',
			'require-unicode-regexp': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-invalid-this': 'off',
			'@typescript-eslint/no-unnecessary-condition': 'off',
			'@typescript-eslint/no-shadow': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
		},
	},
	stylistic.configs.recommended,
	{
		rules: {
			camelcase: 'off',
			'new-cap': 'off',
			'no-continue': 'off',
			'no-underscore-dangle': 'off',
			'max-classes-per-file': 'off',
			'@stylistic/semi': [ 'error', 'always' ],
			'@stylistic/quote-props': [ 'error', 'as-needed' ],
			'@stylistic/indent': [ 'error', 'tab', { SwitchCase: 1 } ],
			'@stylistic/no-tabs': 'off',
			'@stylistic/linebreak-style': [ 'error', 'windows' ],
			'@stylistic/comma-dangle': [ 'error', 'always-multiline' ],
			'@stylistic/quotes': [ 'error', 'single' ],
			'@stylistic/dot-location': [ 'error', 'property' ],
			'@stylistic/padded-blocks': [ 'error', 'never' ],
			'@stylistic/arrow-parens': [ 'error', 'as-needed' ],
			'@stylistic/object-curly-spacing': [ 'error', 'always' ],
			'@stylistic/array-element-newline': [ 'error', { consistent: true, multiline: true } ],
			'@stylistic/array-bracket-spacing': [ 'error', 'always' ],
			'@stylistic/function-call-argument-newline': [ 'error', 'consistent' ],
			'@stylistic/object-property-newline': [
				'error',
				{
					allowAllPropertiesOnSameLine: true,
				},
			],
			'@stylistic/space-before-function-paren': [
				'error',
				{
					anonymous: 'never',
					named: 'never',
					asyncArrow: 'always',
				},
			],
			'@stylistic/function-paren-newline': [ 'error', 'multiline-arguments' ],
			'@stylistic/multiline-comment-style': 'off',
			'@stylistic/lines-between-class-members': [
				'error',
				'always',
				{ exceptAfterSingleLine: true },
			],

			'@stylistic/multiline-ternary': [ 'error', 'always-multiline' ],
			'@stylistic/operator-linebreak': [ 'error', 'after' ],
			'@stylistic/member-delimiter-style': [ 'error',
				{
					multiline: {
						delimiter: 'semi',
						requireLast: true,
					},
					singleline: {
						delimiter: 'semi',
						requireLast: false,
					},
					multilineDetection: 'brackets',
				} ],
		},
	},
];
