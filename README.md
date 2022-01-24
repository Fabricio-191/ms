<a href="https://www.buymeacoffee.com/Fabricio191" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="28" width="135"></a>
[![Discord](https://img.shields.io/discord/555535212461948936?style=for-the-badge&color=7289da)](https://discord.gg/zrESMn6)
[![Issues](https://img.shields.io/github/issues/Fabricio-191/ms?style=for-the-badge)](https://github.com/Fabricio-191/ms/issues)

# @fabricio-191/ms

Differences with [ms](https://www.npmjs.com/package/ms)

* Multiple units support
* Multiple languages support
* Can parse `hh:mm:ss` and `mm:ss` formats
* Does not round while formatting
* Formatting is more powerful and has more features
* Is unstable compared to ms (ms is for conversion, this is for parsing)

## Parse

If nothing can be parsed, it returns `null`

```js
const ms = require('@fabricio-191/ms');

ms('1 week 2 days'); // 777600000
ms('2 days 1 hour'); // 176400000
ms('1m10secs');      // 70000
ms('5s50ms');        // 5050

ms('1y');            // 31557600000
ms('1d');            // 86400000
ms('10h');           // 36000000
ms('2.5 hrs');       // 9000000
ms('.5m');           // 30000
ms('100');           // 100
ms('0 seconds');     // 0
ms('-.5 mins');      // -30000
ms('- 2m 30s');      // -150000
ms('-3 days');       // -259200000

ms('3:10');          // 190000 (mm:ss)
ms('2:09:00');       // 7740000 (hh:mm:ss)

// english is the default language
ms('1 day', 'es');   // null (wrong language)
ms('1 dia', 'es');   // 86400000

ms('12 seconds', ['en', 'es']);     // 12000   (english)
ms('-3 minutos', ['en', 'es']);     // -180000 (spanish)
ms('2 minutes 15 seconds', 'all');  // 135000
ms('2 minutos 15 segundos', 'all'); // 135000
ms('2.5 horas 30 minutes', 'all');  // 10800000 (mixed)
```

## Format

```js
ms(1412440000);                                 //16d 8h 20m
ms(1412440000, { length: 2 });                  //16d 8h
ms(1412440000, { length: Infinity });           //16d 8h 20m 40s

ms(1412440000, { long: true });                 //16 days 8 hours 20 minutes
ms(1412440000, { long: true, language: 'es' }); //16 dias 8 horas 20 minutos
ms(1412440000, { long: true, language: 'ja' }); //16 日 8 時間 20 分

ms(1412440000, { language: 'ja' });             //16日 8時間 20分
```

### Formats

* `Y`: year
* `Mo`: month
* `W`: week
* `D`: day
* `H`: hour
* `M`: minute
* `S`: second
* `Ms`: milisecond

```js
ms(1412440000); //16d 8h 20m
ms(1412440000, { format: 'HS' }); //392h 1240s

ms(4100940000, { format: 'WDHM', length: 2 }); //6w 5d
ms(4100940000, { format: 'WDHM', length: 8 }); //6w 5d 11h 9m
ms(10, { format: 'HS' }); //0s (too small)
```

The full format would be `YMoWDHMSMs`  
The default format is `YMoDHMSMs` (without weeks)

# Supported languages

```js
'en' => 'English'
'es' => 'Español' // Spanish
'ja' => '日本' // Japanese
```

If you want me to add a language, [contact me on my Discord server](https://discord.gg/zrESMn6) or by private Fabricio-191#8051 or in [github](https://github.com/Fabricio-191/ms/pulls).

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
