# Adding a language

Create a `Language` instance with a name and the notation data for each unit, then pass it to `parse` or `format`.

## Unit keys

| Key | Unit |
|-----|------|
| `Y` | year |
| `Mo` | month |
| `W` | week |
| `D` | day |
| `H` | hour |
| `M` | minute |
| `S` | second |
| `Ms` | millisecond |

## Notation data structure

Each unit requires a `NotationsData` object:

```ts
interface NotationsData {
    all:            string[];  // every accepted notation (required, at least one)
    singular:       string;    // long form, singular — must be in `all`
    shortSingular?: string;    // short form, singular — must be in `all` (falls back to singular)
    plural?:        string;    // long form, plural   — must be in `all` (falls back to singular)
    shortPlural?:   string;    // short form, plural  — must be in `all` (falls back as above)
}
```

Rules:
- All keys (`Y`, `Mo`, `W`, `D`, `H`, `M`, `S`, `Ms`) must be present.
- `all` must contain at least one non-empty string, with no duplicates (case-insensitive).
- `singular` must be one of the values in `all`.
- Any optional property that is provided must also be in `all`.

## Example

```ts
import { Language, parse, format, LANGUAGES } from '@fabricio-191/ms';

// Note: translations below are from Google Translate and may have errors.
const hindi = new Language('hindi', {
    Y: {
        all: ['साल', 'वर्ष'],
        singular: 'साल',
        shortSingular: 'साल',
        plural: 'वर्ष',
        shortPlural: 'वर्ष',
    },
    Mo: {
        all: ['महीना', 'महीने'],
        singular: 'महीना',
        shortSingular: 'महीना',
        plural: 'महीने',
        shortPlural: 'महीने',
    },
    W: {
        all: ['हफ्ता', 'सप्ताह'],
        singular: 'हफ्ता',
        shortSingular: 'हफ्ता',
        plural: 'सप्ताह',
        shortPlural: 'सप्ताह',
    },
    D: {
        all: ['दिन', 'दिनों'],
        singular: 'दिन',
        shortSingular: 'दिन',
    },
    H: {
        all: ['घंटा'],
        singular: 'घंटा',
        shortSingular: 'घंटा',
    },
    M: {
        all: ['मिनट', 'मिनटों'],
        singular: 'मिनट',
        shortSingular: 'मिनट',
        plural: 'मिनटों',
        shortPlural: 'मिनटों',
    },
    S: {
        all: ['सेकंड', 'सेकंड्स'],
        singular: 'सेकंड',
        shortSingular: 'सेकंड',
    },
    Ms: {
        all: ['मिलिसेकंड', 'मिलिसेकंड्स'],
        singular: 'मिलिसेकंड',
        shortSingular: 'मिलिसेकंड',
    },
});

// Parse with the custom language
parse('1 दिन', hindi);                          // 86400000
parse('1 दिन 3 घंटा 20 मिनटों', hindi);        // 98400000

// Combine with built-in languages (uses whichever matches more units)
parse('2 hours', [LANGUAGES.en, hindi]);        // 7200000
parse('2 घंटा', [LANGUAGES.en, hindi]);         // 7200000

// Format with the custom language
format(86400000, { language: hindi });          // '1दिन'
format(86400000, { language: hindi, long: true }); // '1 दिन'
```

## Contact

If your language has syntactical rules this module doesn't handle, or if you'd like it added permanently, open an issue or PR on [GitHub](https://github.com/Fabricio-191/ms).
