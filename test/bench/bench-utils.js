import Benchmark from 'benchmark';

export function createRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pad2(value) {
	return String(value).padStart(2, '0');
}

export async function runSuite(name, registerSuite) {
	console.log(`\n${name}`);

	return new Promise(resolve => {
		const suite = new Benchmark.Suite(name);

		registerSuite(suite);

		suite
			.on('cycle', event => {
				console.log(String(event.target));
			})
			.on('complete', function() {
				const fastest = this
					.filter('fastest')
					.map('name')
					.join(', ');

				console.log(`Fastest: ${fastest}\n`);
				resolve();
			})
			.run({ async: true });
	});
}
