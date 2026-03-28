/**
 * Craft a named function whose body can reference context variables as locals,
 * without using eval(). Combines two properties:
 *   - Zero arg-passing overhead (context vars accessed as closure locals)
 *   - No direct eval() — avoids bundler warnings and potential V8 eval penalties
 *
 * Generated source pattern:
 *   new Function('ctx', `
 *     var k1 = ctx['k1'];
 *     var k2 = ctx['k2'];
 *     function <name>(<params>) { <body> }
 *     return <name>;
 *   `)(context)
 *
 * The outer function is called once and discarded. The inner named function
 * captures the context vars as closure locals and is what becomes hot.
 * V8 tracks optimization per function object, so the inner function's JIT
 * tier depends solely on its own body size — unaffected by the outer wrapper.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function craftFunction<T>(
	name: string,
	params: string[],
	body: string,
	context: Record<string, unknown>,
): T {
	const varDecls = Object.keys(context)
		.map(k => `var ${k}=ctx[${JSON.stringify(k)}];`)
		.join('');
	const source = `${varDecls}function ${name}(${params.join(',')}){${body}}return ${name};`;
	const factory = new Function('ctx', source) as (ctx: Record<string, unknown>) => T;
	return factory(context);
}
