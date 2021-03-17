[![Issues](https://img.shields.io/github/issues/Fabricio-191/ms?style=for-the-badge)](https://github.com/Fabricio-191/ms/issues)
[![Donate](https://img.shields.io/badge/donate-patreon-F96854.svg?style=for-the-badge)](https://www.patreon.com/fabricio_191)
[![Discord](https://img.shields.io/discord/555535212461948936?style=for-the-badge&color=7289da)](https://discord.gg/zrESMn6)

# @fabricio-191/ms

It started as a copy of [ms](https://www.npmjs.com/package/ms) with some changes.

But now is quite different with multi-language support and multiple args

# Parse
* Any parse operation in `ms` should work here   
* The default language is english
```js
const ms = require('@fabricio-191/ms');

ms('2 days')  // 172800000
ms('1d')      // 86400000
ms('10h')     // 36000000
ms('2.5 hrs') // 9000000
ms('2h')      // 7200000
ms('1y')      // 31557600000
ms('100')     // 100
ms('-3 days') // -259200000
ms('.5m') // 300000
ms('-.5 mins'); //-150000
ms('-1h1h')   // 0
ms('1 week 2 day'); // 777600000
ms('1m10secs')// 70000
ms('5s50ms')  // 5050
ms('1 day', { language: 'es' }); // NaN (wrong language)
ms('1 dia', { language: 'es' }); // 86400000

ms('12 seconds', { languages: ['en', 'es'] }); // 12000 (english)
ms('-3 minutos', { languages: ['en', 'es'] }); // -180000 (spanish)

//multiple args and multiple languages
ms('2 minutes 15 seconds', { languages: ['en', 'es'] }); // 135000
ms('2 minutos 15 segundos', { languages: ['en', 'es'] }); // 135000

//multiple args and multiple languages in the same string
ms('2.5 horas 30 minutes', { languages: ['en', 'es'] }); // 10800000

//  5.5 minutes 2 days 30 seconds -0.5 hours
ms('5.5 minute, 2 days asdw 30s rqw -.5hour'); // 171360000

//bad input
ms(''); // null
ms(undefined); // null
ms(null); // null
ms([]); // null
ms({}); // null
ms(NaN); // null
ms(Infinity); // null
ms(-Infinity); // null
ms('absda'); //NaN
ms('123nothing'); //NaN

//result may be (depend on the input) NaN or null
//Simply use isNaN

if(isNaN(result)){
	//...
}

```

# Format
* When formatting the output may be different against `ms`
* Does not round, unlike ms

```js
const num = 1412440000;

//if not a number is introduced it will return null

//default quantity = 3
ms(num); //16d 8h 20m
ms(num, { quantity: 1 }); //16d
ms(num, { quantity: 4 }); //16d 8h 20m 40s

//Language doesn't matter much in the short form
ms(num, { quantity: 2, long: true }); //16 days 8 hours
ms(num, { language: 'es', long: true }); //16 dias 8 horas 20 minutos

//Use weeks
ms(2629800000, { long: true }); //1 month
ms(2629800000, { long: true, useWeeks: true }); //4 weeks 2 days 10 hours
```

# Supported languages
```js
'en' => 'English'  
'es' => 'Español'
```

If you want me to add a language, [contact me on Discord](https://discord.gg/zrESMn6), it is something I can do in 5 mins, but you will have to give me the translation (I guide you how)