# Adding a language dynamically

**You have to take into account that even if you add correctly the language, it may not work well, cause it may have somes sintactical rules or numbers that the module does not manage.**  
If this happens, you can contact me on [Discord](https://discord.gg/zrESMn6) (Fabricio-191#8051) or in [github](https://github.com/Fabricio-191/ms/pulls). Becacause the module will need an update to work with the language.

Also if you add a language correctly you should equally contact me so i can add it permanently.

## Rules

```js
// DAY would be a "key"
DAY: { // the rest are the "notations"
    all: [
        'दिन',
        'दिनों'
    ],
    singular: 'दिन',
    shortSingular: 'दिन',
},
```

* Language name must be a string
* All keys must be present in the language `[YEAR, MONTH, WEEK, DAY, HOUR, MINUTE, SECOND, MILISECOND]`
* Notations must have:
  * The `all` property containing an array of all the posible ways to write the unit
  * The `single` property containing the common write to write the unit in singular
  * The `shortSingular` property containing the common write to write the unit in singular in short form

Note:  
If the `plural` or `shortPlural` properties are not present, the module will use the `single` and `shortSingular` properties.

## Example

```js
const ms = require('@fabricio-191/ms');

// i don't talk hindi, this was made with google translator, and probably has errors
ms.addLanguage('hindi', {
    YEAR: {
        all: [
            'साल',
            'वर्ष'
        ],
        singular: 'साल',
        shortSingular: 'साल',
        plural: 'वर्ष',
        shortPlural: 'वर्ष'
    },
    MONTH: {
        all: [
            'महीना',
            'महीने'
        ],
        singular: 'महीना',
        shortSingular: 'महीना',
        plural: 'महीने',
        shortPlural: 'महीने',
    },
    WEEK: {
        all: [
            'हफ्ता',
            'सप्ताह'
        ],
        singular: 'हफ्ता',
        shortSingular: 'हफ्ता',
        plural: 'सप्ताह',
        shortPlural: 'सप्ताह',
    },
    DAY: {
        all: [
            'दिन',
            'दिनों'
        ],
        singular: 'दिन',
        shortSingular: 'दिन',
    },
    HOUR: {
        all: [ 'घंटा' ],
        singular: 'घंटा',
        shortSingular: 'घंटा',
    },
    MINUTE: {
        all: [
            'मिनट',
            'मिनटों'
        ],
        singular: 'मिनट',
        shortSingular: 'मिनट',
        plural: 'मिनटों',
        shortPlural: 'मिनटों',
    },
    SECOND: {
        all: [
            'सेकंड',
            'सेकंड्स'
        ],
        singular: 'सेकंड',
        shortSingular: 'सेकंड',
    },
    MS: {
        all: [
            'मिलिसेकंड',
            'मिलिसेकंड्स'
        ],
        singular: 'मिलिसेकंड',
        shortSingular: 'मिलिसेकंड',
    },
});

// 1 day
ms('1 दिन', 'hindi'); // 86400000
// 1 day 3 hours 20 minutes
ms('1 दिन 3 घंटा 20 मिनटों', 'hindi') // 98400000
```

## Check language

Checks the keys, and properties of the introduced language, throws an error if something is wrong.  
It's already used inside the addLanguage function.

```js
ms.checkLanguage({
    YEAR: {
        all: [
            'साल',
            'वर्ष'
        ],
        singular: 'साल',
        shortSingular: 'साल',
        plural: 'वर्ष',
        shortPlural: 'वर्ष'
    },
    // ...
})
```
