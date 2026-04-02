# select2-compat-wrapper

Backward compatibility wrapper for migrating from Select2 3.3.x to 4.0.13 without changing existing code.

Select2 3.x has known XSS vulnerabilities and is no longer maintained. This wrapper lets you upgrade to 4.0.13 while keeping your existing 3.3.x API calls intact. No need to refactor thousands of call sites across your project.

## Problem

Select2 4.x introduced major breaking changes:
- Methods renamed or removed (`disable`, `opened`, `isFocused`, `container`)
- `select2("data", obj)` no longer works as a setter
- Initialization options renamed (`formatResult` -> `templateResult`, `maximumSelectionSize` -> `maximumSelectionLength`, etc.)
- AJAX config structure changed (`quietMillis` -> `delay`, `results` -> `processResults`)
- `matcher` function signature completely changed
- Language/formatting functions moved to `language` object
- `tags` option changed from array/function to boolean
- Event namespace changed from `select2-` to `select2:`

Updating every usage across a large codebase is not practical. This wrapper translates 3.3.x calls to their 4.0.13 equivalents at runtime.

## Setup

Load the wrapper immediately after Select2 4.0.13:

```html
<link rel="stylesheet" href="select2.css" />
<script src="jquery.min.js"></script>
<script src="select2.full.js"></script>
<script src="select2-compat-wrapper.js"></script>
```

Your existing 3.3.x code continues to work as-is.

## What the wrapper handles

### Method translation

| 3.3.x Call | Translated to |
|---|---|
| `$el.select2("data", value)` | Creates `<option>`, sets via `val().trigger("change")` |
| `$el.select2("disable")` | `$el.prop("disabled", true)` |
| `$el.select2("opened")` | `$el.select2("isOpen")` |
| `$el.select2("isFocused")` | `$el.select2("hasFocus")` |
| `$el.select2("container")` | Returns `instance.$container` |

Methods that work natively in both versions (`open`, `close`, `destroy`, `focus`, `enable`, `val`, `data` getter) are passed through without modification.

### Option translation

| 3.3.x Option | Translated to |
|---|---|
| `formatResult` | `templateResult` |
| `formatSelection` | `templateSelection` |
| `formatNoMatches` | `language.noResults` |
| `formatInputTooShort` | `language.inputTooShort` |
| `formatInputTooLong` | `language.inputTooLong` |
| `formatSelectionTooBig` | `language.maximumSelected` |
| `formatLoadMore` | `language.loadingMore` |
| `formatSearching` | `language.searching` |
| `maximumSelectionSize` | `maximumSelectionLength` |
| `sortResults` | `sorter` |
| `createSearchChoice` | `createTag` |
| `selectOnBlur` | `selectOnClose` |
| `tags` (array/function) | `tags: true` + `data` |
| `matcher(term, text)` | Wrapped to match new `(params, data)` signature |

### AJAX translation

| 3.3.x | Translated to |
|---|---|
| `ajax.quietMillis` | `ajax.delay` |
| `ajax.results(data, page)` | `ajax.processResults(data, params)` |
| `ajax.data(term, page)` | `ajax.data(params)` |

Return value `{ more: true }` is converted to `{ pagination: { more: true } }`.

### Unknown methods

Any method call that does not exist in 4.0.13 and has no mapping will **not crash**. Instead, it logs a warning to the console and returns the jQuery object for chaining.

## What the wrapper does NOT handle

- **Event namespace migration**: If your code listens for `select2-` prefixed events (e.g., `select2-selecting`, `select2-removed`), you need to update those to `select2:` prefix (e.g., `select2:select`, `select2:unselect`) manually, or extend the wrapper.
- **Hidden input elements**: Select2 3.x commonly used `<input type="hidden">`. Version 4.x has a compat module for this but it is deprecated. Consider migrating to `<select>` elements over time.
- **CSS class changes**: 4.x uses BEM-style class names (`select2-selection--single` instead of `select2-choice`). If you have custom CSS targeting old class names, update those separately.
- **`formatResult` full signature**: The wrapper passes `null` for the `container` parameter and an empty object for `query`. If your formatter depends on those, adjust accordingly.

## Migration checklist

1. Replace `select2.js` (3.3.x) with `select2.full.js` (4.0.13)
2. Replace `select2.css` (3.3.x) with the 4.0.13 stylesheet
3. Add `select2-compat-wrapper.js` after `select2.full.js`
4. Search your codebase for `select2-` event listeners and update to `select2:` prefix
5. Test all pages that use Select2
6. Check any custom CSS targeting Select2 class names

## Full migration analysis

See [MIGRATION-ANALYSIS.md](MIGRATION-ANALYSIS.md) for a detailed breakdown of every difference between 3.3.x and 4.0.13.

## License

MIT
