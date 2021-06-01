const LANGUAGES = {
	en: {
		YEAR: [
			'years',
			'year',
			'yrs',
			'yr',
			'y',
		],
		MONTH: [
			'months',
			'month',
			'mth',
			'mo',
		],
		WEEK: [
			'weeks',
			'week',
			'w',
		],
		DAY: [
			'days',
			'day',
			'd',
		],
		HOUR: [
			'hours',
			'hour',
			'hrs',
			'hr',
			'h',
		],
		MINUTE: [
			'minutes',
			'minute',
			'mins',
			'min',
			'm',
		],
		SECOND: [
			'seconds',
			'second',
			'secs',
			'segs',
			'sec',
			'seg',
			's',
		],
		MS: [
			'milliseconds',
			'millisecond',
			'mseconds',
			'msecond',
			'msecs',
			'msec',
			'ms',
		],
	},
	es: {
		YEAR: [
			'años',
			'año',
		],
		MONTH: [
			'meses',
			'mes',
		],
		WEEK: [
			'semanas',
			'semana',
			'sem',
		],
		DAY: [
			'dias',
			'dia',
			'd',
		],
		HOUR: [
			'horas',
			'hora',
			'hrs',
			'hr',
			'h',
		],
		MINUTE: [
			'minutos',
			'minuto',
			'mins',
			'min',
			'm',
		],
		SECOND: [
			'segundos',
			'segundo',
			'secs',
			'segs',
			'sec',
			'seg',
			's',
		],
		MS: [
			'milisegundos',
			'milisegundo',
			'msegs',
			'msecs',
			'mseg',
			'msec',
			'ms',
		],
	},
};

const TIMES = {
	YEAR: 31557600000,
	MONTH: 2629800000,
	WEEK: 604800000,
	DAY: 86400000,
	HOUR: 3600000,
	MINUTE: 60000,
	SECOND: 1000,
	MS: 1,
};

const FORMATS = {
	Y: 'YEAR',
	Mo: 'MONTH',
	W: 'WEEK',
	D: 'DAY',
	H: 'HOUR',
	M: 'MINUTE',
	S: 'SECOND',
	Ms: 'MS',
};

const DEFAULT_PARSE_OPTIONS = {
	language: 'en',
	long: false,
	format: 'YMoDHMSMs',
	length: 3,
};

module.exports = {
	LANGUAGES,
	TIMES,
	FORMATS,
	ALL_LANGUAGES: Object.keys(LANGUAGES),
	TIMES_KEYS: Object.keys(TIMES),
	FORMATS_REGEX: /Ms|Y|Mo|W|D|H|M|S|./g,
	DEFAULT_PARSE_OPTIONS,
};