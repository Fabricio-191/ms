const { LANGUAGES } = require('../lib/esm/index.js');

const TIMES = Object.freeze({
	Y: 1000 * 60 * 60 * 24 * 365.25,
	Mo: 1000 * 60 * 60 * 24 * 30,
	W: 1000 * 60 * 60 * 24 * 7,
	D: 1000 * 60 * 60 * 24,
	H: 1000 * 60 * 60,
	M: 1000 * 60,
	S: 1000,
	Ms: 1,
});

const MAXS = { Y: 100, Mo: 12, W: 4, D: 7, H: 24, M: 60, S: 60, Ms: 1000 };

const UNIT_ALIASES = Object.values(LANGUAGES['en'].units).flatMap(unit => unit.all);

function random(thing, fixedDecimals = 0) {
	if (Array.isArray(thing)) return thing[Math.floor(Math.random() * thing.length)];
	if (thing === true) return Math.random() > 0.5;
	if (fixedDecimals !== 0) return parseFloat((Math.random() * thing).toFixed(fixedDecimals));
	return Math.floor(Math.random() * thing);
}

// #region individual item creators

function createFormatArgs(LANGUAGES, opts = {}) {
	const keys = [];
	while (keys.length === 0) {
		for (const key in TIMES)
			if (random(1, 1) < 0.3) keys.push(key);
	}

	const length = opts.length ?? (random(8) + 1);
	let num = 0;
	for (let i = 0; i < length && i < keys.length; i++)
		num += random(MAXS[keys[i]]) * TIMES[keys[i]];

	return {
		num,
		options: { language: random(Object.values(LANGUAGES)),
			long: random(true),
			format: keys.join(''),
			length,
			...opts },
	};
}

function createClockArgs() {
	let result = 0;
	let fmt = random([
		'hhsepmmsepss.sss',
		'hhsepmmsepss',
		'hhsepmm.mmm',
		'hhsepmm',
		'mmsepss.sss',
		'mmsepss',
	]).replace(/sep/g, random([ '-', ':' ]));

	const n = (max, digits, key, val) => {
		if (!fmt.includes(key)) return;
		const num = String(random(max)).padStart(digits, '0');
		fmt = fmt.replace(key, num);
		result += parseFloat(num) * val;
	};

	const minutes = fmt.includes('ss') && !fmt.includes('hh');
	n(24, 2, 'hh', 3600000);
	n(1000, 3, 'mmm', 60);
	n(1000, 3, 'sss', 1);
	n(60, 2, 'mm', 60000);
	n(60, 2, 'ss', 1000);

	return { args: [ fmt, minutes ], result };
}

// #endregion

// #region batch generators

/** Test fixtures: FORMAT_ARGS, FORMAT_ARGS_VERCEL, CLOCK_ARGS */
function createTestFixtures(LANGUAGES, count = 1000) {
	return {
		FORMAT_ARGS: Array.from({ length: count }, () => createFormatArgs(LANGUAGES)),
		FORMAT_ARGS_VERCEL: Array.from({ length: count }, () => createFormatArgs(LANGUAGES, { language: LANGUAGES.en, length: 1 })),
		CLOCK_ARGS: Array.from({ length: count }, () => createClockArgs()),
	};
}

/** Bench: random numeric ms values (for format benchmarks) */
function createBenchFormatSamples(count = 10_000) {
	const maxValue = TIMES.Y * 10;
	return Array.from({ length: count }, () => {
		const isNegative = random(2) === 1;
		const integerPart = random(maxValue);
		const decimalPart = Math.random();
		return (integerPart + decimalPart) * (isNegative ? -1 : 1);
	});
}

/** Bench: notation strings like "42ms", "5hours" (for parse benchmarks) */
function createBenchNotationSamples(count = 10_000, isValid = () => true) {
	const samples = [];
	while (samples.length < count) {
		const input = `${random(250) + 1}${random(UNIT_ALIASES)}`;
		if (isValid(input)) samples.push(input);
	}
	return samples;
}

// #endregion

module.exports = {
	TIMES,
	UNIT_ALIASES,
	random,
	createFormatArgs,
	createClockArgs,
	createTestFixtures,
	createBenchFormatSamples,
	createBenchNotationSamples,
};
