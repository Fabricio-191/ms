import { describe, it } from '@jest/globals';
import * as lib from '../lib/esm/index.js';
import { check } from '../benchmarks/utils.ts';

const es = lib.LANGUAGES.es;

// ─── Parse ──────────────────────────────────────────────────────────────────

describe('parse (español)', () => {
	it('unit notations', () => {
		check(lib.parse('1 dia', es), 86400000);
		check(lib.parse('2 horas', es), 7200000);
		check(lib.parse('1 hora', es), 3600000);
		check(lib.parse('30 minutos', es), 1800000);
		check(lib.parse('1 minuto', es), 60000);
		check(lib.parse('5 segundos', es), 5000);
		check(lib.parse('1 segundo', es), 1000);
		check(lib.parse('1 semana', es), 604800000);
	});

	it('multi-unit', () => {
		check(lib.parse('2 horas 30 minutos', es), 9000000);
		check(lib.parse('1 dia 2 horas', es), 86400000 + 7200000);
		check(lib.parse('2 minutos 15 segundos', es), 135000);
	});

	it('negative values', () => {
		check(lib.parse('-1 hora', es), -3600000);
		check(lib.parse('-3 minutos', es), -180000);
		check(lib.parse('- 2 horas 30 minutos', es), -9000000);
	});

	it('english notations → null', () => {
		check(lib.parse('1 hour', es), null);
		check(lib.parse('1 day', es), null);
	});
});

// ─── Format ─────────────────────────────────────────────────────────────────

describe('format (español)', () => {
	it('short form', () => {
		check(lib.format(7200000, { language: es }), '2h');
		check(lib.format(3600000, { language: es }), '1h');
		check(lib.format(60000, { language: es }), '1m');
		check(lib.format(1000, { language: es }), '1s');
	});

	it('long form — singular and plural', () => {
		check(lib.format(3600000, { language: es, long: true }), '1 hora');
		check(lib.format(7200000, { language: es, long: true }), '2 horas');
		check(lib.format(60000, { language: es, long: true }), '1 minuto');
		check(lib.format(120000, { language: es, long: true }), '2 minutos');
		check(lib.format(1000, { language: es, long: true }), '1 segundo');
		check(lib.format(2000, { language: es, long: true }), '2 segundos');
	});

	it('multi-unit output', () => {
		const num = lib.parse('16 dias 8 horas 20 minutos', es)!;
		check(lib.format(num, { language: es, long: true }), '16 dias 8 horas 20 minutos');
	});

	it('parse(format(ms)) === ms', () => {
		for (const ms of [ 3600000, 5445000, 9000000, 86400000 ]) {
			const str = lib.format(ms, { language: es })!;
			check(lib.parse(str, es), ms);
		}
	});
});

// ─── Fast variants ───────────────────────────────────────────────────────────

describe('buildFastParse (español)', () => {
	it('current (v9 combined)', () => {
		const parseEs = lib.buildFastParse(es);
		check(parseEs('2 horas'), 7200000);
		check(parseEs('1 hora'), 3600000);
		check(parseEs('30 minutos'), 1800000);
		check(parseEs('2 horas 30 minutos'), 9000000);
		check(parseEs('-1 hora'), -3600000);
		check(parseEs('2h'), 7200000);
		check(parseEs(''), null);
	});
});

describe('buildFastFormat (español)', () => {
	it('current', () => {
		const formatEs = lib.buildFastFormat(es);
		check(formatEs(7200000), '2h');
		check(formatEs(7200000, true), '2 horas');
		check(formatEs(1000, true), '1 segundo');
		check(formatEs(2000, true), '2 segundos');
		check(formatEs(-3600000), '- 1h');
		check(formatEs(-3600000, true), '- 1 hora');
		check(formatEs(0, true), '0 milisegundos');
	});
});
