# Select2 3.3.0 -> 4.0.13 Migration Analysis

## 1. METHODS (programmatic API)

### 3.3.0 allowed methods:
```
"val", "destroy", "opened", "open", "close", "focus", "isFocused",
"container", "onSortStart", "onSortEnd", "enable", "disable",
"positionDropdown", "data"
```

### 4.0.13 methods:
```
"open", "close", "destroy", "focus", "val", "data",
"enable", "isOpen", "hasFocus", "isEnabled", "isDisabled",
"toggleDropdown"
```

### Breaking changes:

| 3.3.0 Call | 4.0.13 Equivalent | Notes |
|---|---|---|
| `$el.select2("val")` | `$el.val()` | DEPRECATED but still works |
| `$el.select2("val", value)` | `$el.val(value).trigger("change")` | DEPRECATED but still works |
| `$el.select2("data")` | `$el.select2("data")` | READ-ONLY in 4.x, cannot set data |
| `$el.select2("data", obj)` | NO EQUIVALENT | Must use `$el.val().trigger("change")` |
| `$el.select2("opened")` | `$el.select2("isOpen")` | REMOVED |
| `$el.select2("isFocused")` | `$el.select2("hasFocus")` | REMOVED |
| `$el.select2("container")` | NO DIRECT EQUIVALENT | Was a special property access |
| `$el.select2("onSortStart")` | REMOVED | No equivalent |
| `$el.select2("onSortEnd")` | REMOVED | No equivalent |
| `$el.select2("positionDropdown")` | REMOVED | Handled internally |
| `$el.select2("enable")` | `$el.prop("disabled", false)` | DEPRECATED but still works with warning |
| `$el.select2("disable")` | `$el.prop("disabled", true)` | REMOVED, use prop |

---

## 2. INITIALIZATION OPTIONS

### 3.3.0 defaults:
```js
width: "copy"
loadMorePadding: 0
closeOnSelect: true
openOnEnter: true
containerCss: {}
dropdownCss: {}
containerCssClass: ""
dropdownCssClass: ""
formatResult: function(result, container, query, escapeMarkup)
formatSelection: function(data, container)
sortResults: function(results, container, query)
formatResultCssClass: function(data)
formatNoMatches: function()
formatInputTooShort: function(input, min)
formatInputTooLong: function(input, max)
formatSelectionTooBig: function(limit)
formatLoadMore: function(pageNumber)
formatSearching: function()
minimumResultsForSearch: 0
minimumInputLength: 0
maximumInputLength: null
maximumSelectionSize: 0
id: function(e) { return e.id; }
matcher: function(term, text)
separator: ","
tokenSeparators: []
tokenizer: defaultTokenizer
escapeMarkup: function(markup)
blurOnChange: false
selectOnBlur: false
```

### Other 3.3.0 options (not in defaults, used in code):
```
element, multiple, tags, placeholder, allowClear,
query, ajax, data, createSearchChoice, initSelection,
formatInputTooShort, formatInputTooLong
```

### 4.0.13 option mapping:

| 3.3.0 Option | 4.0.13 Option | Status |
|---|---|---|
| `width` | `width` | OK |
| `multiple` | `multiple` | OK |
| `placeholder` | `placeholder` | OK |
| `allowClear` | `allowClear` | OK |
| `tags` | `tags: true` | Changed: was array/function, now boolean + data |
| `data` | `data` | OK |
| `ajax` | `ajax` | Structure changed (see section 6) |
| `minimumInputLength` | `minimumInputLength` | OK |
| `maximumInputLength` | `maximumInputLength` | OK |
| `minimumResultsForSearch` | `minimumResultsForSearch` | OK |
| `closeOnSelect` | `closeOnSelect` | OK |
| `tokenSeparators` | `tokenSeparators` | OK |
| `separator` | `valueSeparator` (compat/inputData) | RENAMED |
| `maximumSelectionSize` | `maximumSelectionLength` | RENAMED |
| `containerCss` | `containerCss` | OK (via compat module) |
| `containerCssClass` | `containerCssClass` | OK (via compat module) |
| `dropdownCss` | `dropdownCss` | OK (via compat module) |
| `dropdownCssClass` | `dropdownCssClass` | OK (via compat module) |
| `matcher` | `matcher` | SIGNATURE CHANGED (see below) |
| `id` | REMOVED | 4.x always uses `item.id` |
| `formatResult` | `templateResult` | RENAMED + signature changed |
| `formatSelection` | `templateSelection` | RENAMED + signature changed |
| `formatNoMatches` | `language.noResults` | MOVED to language object |
| `formatInputTooShort` | `language.inputTooShort` | MOVED to language object |
| `formatInputTooLong` | `language.inputTooLong` | MOVED to language object |
| `formatSelectionTooBig` | `language.maximumSelected` | MOVED + RENAMED |
| `formatLoadMore` | `language.loadingMore` | MOVED + RENAMED |
| `formatSearching` | `language.searching` | MOVED to language object |
| `formatResultCssClass` | REMOVED | No equivalent |
| `sortResults` | `sorter` | RENAMED |
| `createSearchChoice` | `createTag` | RENAMED + signature changed |
| `initSelection` | `initSelection` | DEPRECATED but works via compat module |
| `query` | `query` | DEPRECATED but works via compat module |
| `tokenizer` | `tokenizer` | Signature changed |
| `escapeMarkup` | `escapeMarkup` | OK |
| `openOnEnter` | REMOVED | No equivalent |
| `blurOnChange` | REMOVED | No equivalent |
| `selectOnBlur` | `selectOnClose` | RENAMED |
| `loadMorePadding` | REMOVED | No equivalent |

---

## 3. EVENTS

### 3.3.0 events (triggered on the element):
```
"change"        - when value changes (with {val, added, removed} data)
"open"          - dropdown opened
"close"         - dropdown closed
"select2-focus"
"select2-blur"
"select2-opening"
"select2-open"
"select2-closing"
"select2-close"
"select2-highlight"
"select2-selecting"
"select2-removing"
"select2-removed"
"select2-loaded"
"select2-clearing"
```

### 4.0.13 events:
```
"change"              - value changed
"change.select2"      - value changed (namespaced)
"select2:open"        - dropdown opened
"select2:close"       - dropdown closed
"select2:select"      - item selected (data in e.params.data)
"select2:unselect"    - item unselected
"select2:clearing"    - before clearing
"select2:clear"       - after clearing
"select2:opening"     - before opening
"select2:closing"     - before closing
```

### Breaking changes:
- Event namespace changed from `select2-` (hyphen) to `select2:` (colon)
- `"select2-selecting"` -> `"select2:select"`
- `"select2-removing"` / `"select2-removed"` -> `"select2:unselect"`
- Event data structure changed: 3.3.0 uses `e.val`, `e.added`, `e.removed`; 4.x uses `e.params.data`
- `change` event in 3.3.0 passed `{val, added, removed}`; 4.x passes standard jQuery change event

---

## 4. HTML STRUCTURE

### 3.3.0:
- Works with `<select>` elements AND `<input type="hidden">` elements
- Generates container with class `select2-container`
- Single: `select2-choice`, `select2-chosen`, `select2-arrow`
- Multi: `select2-choices`, `select2-search-choice`, `select2-search-field`
- Dropdown: `select2-drop`, `select2-results`
- Active: `select2-dropdown-open`, `select2-container-active`

### 4.0.13:
- Primarily works with `<select>` elements
- Hidden `<input>` supported via compat/inputData but DEPRECATED
- Container: `select2-container`, `select2-container--default`
- Single: `select2-selection--single`, `select2-selection__rendered`
- Multi: `select2-selection--multiple`, `select2-selection__choice`
- Dropdown: `select2-dropdown`, `select2-results`
- Active: `select2-container--open`, `select2-container--focus`

### Breaking: All CSS classes changed with `--` BEM-style naming

---

## 5. DATA FORMAT

### 3.3.0:
```js
{ id: "value", text: "Label" }
{ id: "value", text: "Label", disabled: true }
{ text: "Group", children: [{id: ..., text: ...}] }
```
- `id` can be customized via `id` option (function or string key)

### 4.0.13:
```js
{ id: "value", text: "Label" }
{ id: "value", text: "Label", disabled: true }
{ text: "Group", children: [{id: ..., text: ...}] }
```
- `id` MUST always be the `id` property (no custom id function)
- If using `<select>`, data objects also have `element` (the DOM option)

---

## 6. AJAX / QUERY

### 3.3.0 ajax:
```js
$el.select2({
    ajax: {
        url: "/api/search",
        dataType: "json",
        quietMillis: 250,
        data: function(term, page) {
            return { q: term, page: page };
        },
        results: function(data, page) {
            return { results: data.items, more: data.has_more };
        }
    }
});
```

### 4.0.13 ajax:
```js
$el.select2({
    ajax: {
        url: "/api/search",
        dataType: "json",
        delay: 250,                          // was "quietMillis"
        data: function(params) {             // was (term, page)
            return { q: params.term, page: params.page };
        },
        processResults: function(data, params) {  // was "results"
            return { results: data.items, pagination: { more: data.has_more } };
        }
    }
});
```

### Breaking changes:
| 3.3.0 | 4.0.13 | Notes |
|---|---|---|
| `quietMillis` | `delay` | RENAMED |
| `data(term, page)` | `data(params)` | params.term, params.page |
| `results(data, page)` | `processResults(data, params)` | RENAMED + return `pagination.more` instead of `more` |
| `params` option (extra params) | N/A | Not needed, use `data` function |
| `transport` | `transport` | OK |

---

## 7. TAGS / TOKENIZER

### 3.3.0:
```js
$el.select2({
    tags: ["red", "green", "blue"],   // array of strings or objects
    // OR
    tags: function() { return [...]; },
    tokenSeparators: [",", " "],
    createSearchChoice: function(term) {
        return { id: term, text: term };
    }
});
```
- Attached to `<input type="hidden">`
- `tags` option was both the data source AND the flag

### 4.0.13:
```js
$el.select2({
    tags: true,                        // boolean only
    data: ["red", "green", "blue"],    // data is separate
    tokenSeparators: [",", " "],
    createTag: function(params) {      // was "createSearchChoice"
        return { id: params.term, text: params.term };
    }
});
```
- Attached to `<select>` with `<option>` elements
- `tags` is just a boolean flag
- Data source is separate (`data` option or `<option>` elements)

---

## 8. MATCHER

### 3.3.0:
```js
matcher: function(term, text, option) {
    return text.toUpperCase().indexOf(term.toUpperCase()) >= 0;
}
// Returns: boolean
```

### 4.0.13:
```js
matcher: function(params, data) {
    // params.term = search term
    // data.text = option text
    // data.children = child options (for optgroups)
    // Returns: data object or null
}
```
- 4.0.13 has `$.fn.select2.amd.require('select2/compat/matcher')` that wraps old-style matchers
- Usage: `matcher: $.fn.select2.amd.require('select2/compat/matcher')(oldMatcherFn)`

---

## 9. WRAPPER REQUIREMENTS SUMMARY

A backward-compatible wrapper must handle:

1. **Method translation**: `opened` -> `isOpen`, `isFocused` -> `hasFocus`, `container`, `onSortStart/End`, `positionDropdown`, `disable`
2. **Option translation**: All `format*` -> `language.*` or `template*`, `maximumSelectionSize` -> `maximumSelectionLength`, `separator` -> hidden input compat, `id` function
3. **Event translation**: `select2-*` (hyphen) events -> `select2:*` (colon) events, different event data structure
4. **AJAX translation**: `quietMillis` -> `delay`, `results` -> `processResults`, function signatures
5. **Tags translation**: Array/function tags -> `tags: true` + `data`, `createSearchChoice` -> `createTag`
6. **Matcher wrapping**: Old boolean matcher -> new object-returning matcher (compat module exists)
7. **CSS class mapping**: Old `select2-*` classes -> new BEM `select2-*--*` classes
8. **Hidden input support**: 3.3.0 commonly used `<input type="hidden">`; 4.x prefers `<select>` (compat module exists but deprecated)
9. **Data set via method**: `$el.select2("data", obj)` has no equivalent in 4.x
10. **initSelection**: Deprecated but supported via compat module
11. **query**: Deprecated but supported via compat module

### Good news:
4.0.13 already has compat modules for: `initSelection`, `query`, `inputData` (hidden inputs), `matcher`, `containerCss`, `dropdownCss`. These are automatically loaded when the old-style options are detected.
