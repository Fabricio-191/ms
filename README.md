<a href="https://www.buymeacoffee.com/Fabricio191" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="28" width="135"></a>
[![Discord](https://img.shields.io/discord/555535212461948936?style=for-the-badge&color=7289da)](https://discord.gg/zrESMn6)
[![Issues](https://img.shields.io/github/issues/Fabricio-191/ms?style=for-the-badge)](https://github.com/Fabricio-191/ms/issues)

# @fabricio-191/ms

## Parse

> The default language is english

If nothing can be parsed, it return's `null`

```js
const ms = require('@fabricio-191/ms');

ms('2 days 1 hour'); // 172800000
ms('1 week 2 day');  // 777600000
ms('1d');            // 86400000
ms('10h');           // 36000000
ms('2.5 hrs');       // 9000000
ms('2h');            // 7200000
ms('1y');            // 31557600000
ms('100');           // 100
ms('-3 days');       // -259200000
ms('.5m');           // 30000
ms('-.5 mins');      // -30000
ms('0 seconds');     // 0
ms('1m10secs');      // 70000
ms('5s50ms');        // 5050

ms('1 day', 'es');   // null (wrong language)
ms('1 dia', 'es');   // 86400000

ms('12 seconds', ['en', 'es']);     // 12000   (english)
ms('-3 minutos', ['en', 'es']);     // -180000 (spanish)
ms('2 minutes 15 seconds', 'all');  // 135000
ms('2 minutos 15 segundos', 'all'); // 135000
ms('2.5 horas 30 minutes', 'all');  // 10800000

ms('5.5 minute, 2 days asdw 30s rqw -.5hour'); // 171360000

ms('-1h1h');         // 0 (i need to change/improve this)
```

## Format

```js
const num = 1412440000;

ms(num); //16d 8h 20m
ms(num, { length: 2 }); //16d 8h
ms(num, { length: 5 }); //16d 8h 20m

ms(num, { long: true }); //16 days 8 hours 20 minutes
ms(num, { long: true, language: 'es' }); //16 dias 8 horas 20 minutos
```

<details>
	<summary>Format</summary>

	The full format would be `YMoWDHMSMs`

	* `Y`: year
	* `Mo`: month
	* `W`: week
	* `D`: day
	* `H`: hour
	* `M`: minute
	* `S`: second
	* `Ms`: mili second

	The default format is `YMoDHMSMs` (without weeks)

	```js
	ms(1412440000); //16d 8h 20m
	ms(1412440000, { format: 'HS' }); //392h 1240s

	ms(41200994000, { format: 'WDHM', length: 2 }); //15mo 2w 6d
	ms(41200994000, { format: 'WDHM', length: 8 }); //15mo 2w 6d 7h 13m
	```
</details>

# Supported languages
```js
'en' => 'English'
'es' => 'Español'
```

If you want me to add a language, [contact me on Discord](https://discord.gg/zrESMn6), it is something I can do in 5 mins, but you will have to give me the translation (I guide you how)

<details>
	<summary>Extra</summary>
	Execute this, it looks nice

	```js
	const ms = require('@fabricio-191/ms'), years = ms('1970 years');

	setInterval(() => {
		process.stdout.clearLine(0);
		process.stdout.cursorTo(0);
		process.stdout.write(ms(Date.now() + years, { length: 8 }));
		process.stdout.cursorTo(31);
	}, 1);
	```
</details>