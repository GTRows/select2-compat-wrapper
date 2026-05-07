/**
 * select2-legacy-adapter.js
 *
 * Single-file adapter that lets legacy Select2 3.x call sites keep working
 * against Select2 4.0.13.
 *
 * Version: 1.0.0
 * Requires: jQuery, Select2 4.0.13 loaded first.
 *
 * Layers:
 *   1. Generic 3.3.x -> 4.0.13 API bridge (options, methods, events, AJAX).
 *   2. Behavioral restorations for projects that used in-house modifications
 *      on top of a 3.x build (initSelection, query, dataValue/dataText
 *      key remapping, aria labels, placeholder-aware scroll, keypress
 *      forwarding, blur trigger, custom no-matches keyword).
 *
 * Usage:
 *   <script src="jquery.min.js"></script>
 *   <script src="select2.full.min.js"></script>
 *   <script src="select2-legacy-adapter.js"></script>
 *
 * Optional runtime config (set BEFORE any .select2() call):
 *   $.fn.select2.legacy = {
 *       placeholderLabel: "Select...",
 *       noMatchKeyword:   function () { return ""; },
 *       enableAriaLabels:       true,
 *       enableKeypressForward:  true,
 *       enableBlurTrigger:      true,
 *       stripUnknownOptions:    ["label"],
 *       debug:                  false
 *   };
 */
(function ($) {
    "use strict";

    if (!$.fn.select2) {
        return;
    }
    if ($.fn.select2.__legacyAdapterInstalled) {
        return;
    }

    // =======================================================
    // InputData patches.
    // 4.x adds InputData on top of every <input> dataAdapter. Its query
    // does not call `decorated`, so it shadows AjaxAdapter and any compat
    // layer. We rewire query to delegate, and we cache results in
    // _currentData so current()/select() can find them later.
    // =======================================================
    (function patchInputDataQuery() {
        var amd = $.fn.select2 && $.fn.select2.amd;
        if (!amd || !amd.require) { return; }
        var InputData;
        try { InputData = amd.require("select2/compat/inputData"); }
        catch (e) { return; }
        if (!InputData || !InputData.prototype || InputData.__legacyQueryPatched) { return; }

        InputData.prototype.query = function (decorated, params, callback) {
            var self = this;
            decorated.call(this, params, function (result) {
                if (result && $.isArray(result.results) && self._currentData) {
                    var seen = {};
                    $.each(self._currentData, function (_, d) {
                        if (d && d.id != null) { seen[d.id] = true; }
                    });
                    $.each(result.results, function (_, it) {
                        if (it && it.id != null && !seen[it.id]) {
                            self._currentData.push(it);
                            seen[it.id] = true;
                        }
                    });
                }
                callback(result);
            });
        };

        // Push the clicked item back into _currentData so current() can
        // resolve it. Stock select() sets val and triggers change but
        // never adds `data` to the cache; that only happens for inline
        // data via addOptions. Legacy `query` projects depend on the
        // deferred query patch for caching, and we still want the latest
        // copy here when the user mutates state.
        var originalSelect = InputData.prototype.select;
        InputData.prototype.select = function (decorated, data) {
            if (data && $.isArray(this._currentData)) {
                var foundIdx = -1;
                for (var i = 0; i < this._currentData.length; i++) {
                    var cur = this._currentData[i];
                    if (cur && cur.id != null && data.id != null
                            && String(cur.id) === String(data.id)) {
                        foundIdx = i;
                        break;
                    }
                }
                if (foundIdx === -1) {
                    this._currentData.push(data);
                } else {
                    this._currentData[foundIdx] = data;
                }
            }
            return originalSelect.call(this, decorated, data);
        };

        // current() with loose String comparison. Stock uses
        // `$.inArray(data.id, val.split(sep))` which is strict ===.
        // val() always returns a string, but legacy data often carries
        // numeric ids (card / account / sale ids). 123 !== "123" leaves
        // current() empty even right after a click, and update() falls
        // through to clear() so the rendered span stays blank. Coerce
        // both sides to String. Selected flag and children traversal
        // are preserved.
        InputData.prototype.current = function (_decorated, callback) {
            var self = this;
            var rawVal = self.$element.val();
            var idsArray = (rawVal == null ? "" : String(rawVal))
                .split(self._valueSeparator);
            var selected = [];
            function visit(data) {
                if (data == null) { return; }
                var match = !!data.selected;
                if (!match && data.id != null) {
                    var dataIdStr = String(data.id);
                    for (var k = 0; k < idsArray.length; k++) {
                        if (dataIdStr === idsArray[k]) {
                            match = true;
                            break;
                        }
                    }
                }
                if (match) {
                    data.selected = true;
                    selected.push(data);
                } else {
                    data.selected = false;
                }
                if ($.isArray(data.children)) {
                    for (var c = 0; c < data.children.length; c++) {
                        visit(data.children[c]);
                    }
                }
            }
            for (var d = 0; d < self._currentData.length; d++) {
                visit(self._currentData[d]);
            }
            callback(selected);
        };

        InputData.__legacyQueryPatched = true;
    }());

    // =======================================================
    // Config
    // =======================================================
    var CONFIG_DEFAULTS = {
        placeholderLabel:       "Seçiniz",
        placeholderAliases:     ["defaultItem"],
        // Optional per-element placeholder lookup. Useful when the project's
        // own select2 wrapper resolves placeholder text from a config layer
        // (data-config / window.config[name].defaultItem) and never passes
        // it through `placeholder`. Receives ($el, opts), returns a string
        // or null. When non-null, sets data-placeholder on the element so
        // 4.x's data-* path activates the Placeholder decorator. Default
        // is no-op.
        placeholderResolver:    null,
        noMatchKeyword:         function () { return GTRows.getMessage("common.label.all"); },
        enableAriaLabels:       true,
        enableKeypressForward:  true,
        enableBlurTrigger:      true,
        stripUnknownOptions:    ["label"],
        // Maps source-element classes to dropdown classes. 4.x drops all
        // source classes from the dropdown, which breaks project CSS
        // hooks like `.custom-select-big-dropdown`. Set to null or {}
        // to disable, extend to add project mappings.
        dropdownClassMap:       {
            "custom-select-big": "custom-select-big-dropdown",
            "nonprintable":      "nonprintable"
        },
        debug:                  false
    };

    function cfg() {
        return $.extend({}, CONFIG_DEFAULTS, $.fn.select2.legacy || {});
    }

    function logWarn(key, message) {
        var c = cfg();
        if (c.debug && window.console && console.warn) {
            console.warn("[select2-legacy] \"" + key + "\": " + message);
        }
    }

    // =======================================================
    // Event bridge: 4.x "select2:*" -> 3.x "select2-*"
    // =======================================================
    var EVENT_MAP = {
        "select2:open":      "select2-open",
        "select2:opening":   "select2-opening",
        "select2:close":     "select2-close",
        "select2:closing":   "select2-closing",
        "select2:select":    "select2-selecting",
        "select2:unselect":  "select2-removing",
        "select2:clear":     "select2-cleared",
        "select2:clearing":  "select2-clearing"
    };

    function installEventBridge($el) {
        $.each(EVENT_MAP, function (newEvt, oldEvt) {
            $el.on(newEvt + ".legacyAdapter", function (e) {
                var legacyEvent = $.Event(oldEvt);
                if (e.params && e.params.data) {
                    legacyEvent.choice = e.params.data;
                    legacyEvent.val = e.params.data.id;
                }
                $el.trigger(legacyEvent);
                if (legacyEvent.isDefaultPrevented()) {
                    e.preventDefault();
                }
            });
        });

        $el.on("select2:select.legacyAdapter", function (e) {
            var ev = $.Event("select2-selected");
            if (e.params && e.params.data) {
                ev.choice = e.params.data;
                ev.val = e.params.data.id;
            }
            $el.trigger(ev);
        });

        $el.on("select2:unselect.legacyAdapter", function (e) {
            var ev = $.Event("select2-removed");
            if (e.params && e.params.data) {
                ev.choice = e.params.data;
                ev.val = e.params.data.id;
            }
            $el.trigger(ev);
        });
    }

    function removeEventBridge($el) {
        $el.off(".legacyAdapter");
    }

    // =======================================================
    // Method tables
    // =======================================================
    var NATIVE_METHODS = {
        "open": true, "close": true, "focus": true, "enable": true,
        "val": true, "isOpen": true, "hasFocus": true,
        "isEnabled": true, "isDisabled": true, "toggleDropdown": true
    };

    var NOOP_METHODS = {
        "onSortStart":      "Sortable integration is not supported in 4.x.",
        "onSortEnd":        "Sortable integration is not supported in 4.x.",
        "positionDropdown": "Dropdown positioning is handled internally in 4.x."
    };

    // =======================================================
    // Main .select2() override
    // =======================================================
    var _originalSelect2 = $.fn.select2;

    $.fn.select2 = function () {
        var args = Array.prototype.slice.call(arguments, 0);

        // Init call: no args or first arg is an object
        if (args.length === 0 || typeof args[0] === "object") {
            var $this = this;
            var translated = translateInitOptions(args, $this);
            var result = _originalSelect2.apply(this, [translated]);
            $this.each(function () {
                var $el = $(this);
                installEventBridge($el);
                installPostInitBehaviors($el, translated);
            });
            return result;
        }

        if (typeof args[0] !== "string") {
            return _originalSelect2.apply(this, args);
        }

        var method = args[0];
        var methodArgs = args.slice(1);

        // 3.2 tolerance: 4.x throws when a method runs on an element with
        // no select2 instance (uninitialized, or already destroyed).
        // 3.2 was a no-op. Filter out uninitialized elements first.
        var callNative = function ($ctx, callArgs) {
            var $ready = $ctx.filter(function () {
                return $(this).data("select2") != null;
            });
            if ($ready.length === 0) { return $ctx; }
            return _originalSelect2.apply($ready, callArgs);
        };

        if (method === "destroy") {
            this.each(function () { removeEventBridge($(this)); });
            return callNative(this, args);
        }

        // Legacy "data" setter: convert to val+change, ensure options exist
        // for selects, and seed dataAdapter._currentData for inputs so the
        // patched current() can resolve the item back into the rendered
        // span on the next change.
        if (method === "data" && methodArgs.length > 0) {
            return this.each(function () {
                var $el = $(this);
                var data = methodArgs[0];
                if (data == null) {
                    $el.val(null).trigger("change");
                    return;
                }
                var isInput = $el.is("input");
                if ($.isArray(data)) {
                    var ids = $.map(data, function (item) {
                        if (typeof item === "object" && item !== null) {
                            ensureOptionExists($el, item.id, item.text);
                            if (isInput) { seedInputCurrentData($el, item); }
                            return item.id;
                        }
                        return item;
                    });
                    $el.val(ids).trigger("change");
                } else if (typeof data === "object") {
                    ensureOptionExists($el, data.id, data.text);
                    if (isInput) { seedInputCurrentData($el, data); }
                    $el.val(data.id != null ? data.id : "").trigger("change");
                } else {
                    $el.val(data).trigger("change");
                }
            });
        }

        if (method === "data" && methodArgs.length === 0) {
            return callNative(this, args);
        }

        if (method === "disable") {
            return this.each(function () { $(this).prop("disabled", true); });
        }

        if (method === "opened") {
            return callNative(this, ["isOpen"]);
        }

        if (method === "isFocused") {
            return callNative(this, ["hasFocus"]);
        }

        if (method === "container") {
            var instance = $(this).data("select2");
            if (instance && instance.$container) {
                return instance.$container;
            }
            logWarn("container", "No select2 instance found on element.");
            return $();
        }

        if (NOOP_METHODS[method]) {
            logWarn(method, NOOP_METHODS[method]);
            return this;
        }

        if (NATIVE_METHODS[method]) {
            return callNative(this, args);
        }

        logWarn(method, "Unknown method. No 4.0.13 equivalent.");
        return this;
    };

    // Preserve refs from the original
    $.fn.select2.defaults = _originalSelect2.defaults;
    $.fn.select2.amd = _originalSelect2.amd;
    $.fn.select2.__legacyAdapterInstalled = true;

    // =======================================================
    // Init-time option translation
    // =======================================================
    function translateInitOptions(args, $els) {
        if (args.length === 0) {
            return {};
        }
        var opts = $.extend(true, {}, args[0] || {});
        var c = cfg();

        // Strip project-specific aliases
        $.each(c.stripUnknownOptions, function (_, key) {
            if (key in opts) { delete opts[key]; }
        });

        // Width default. 3.2 used 'copy' (inline width only, no fallback),
        // so CSS class rules like `.custom-select-big { width: 675px }`
        // drove sizing when the source had no inline width. 4.x default
        // 'resolve' falls back to outerWidth() and writes it as an inline
        // `style="width:Npx"`, which then beats the class rule. 4.x's
        // 'style' mode is the closest match to 3.2's behavior.
        if (!("width" in opts)) {
            opts.width = "style";
        }

        // Placeholder attribute bridge. 3.2's getPlaceholder fell back to
        // element.attr("placeholder"); 4.x only reads data-placeholder via
        // Options.fromElement. Projects with `<input placeholder="...">`
        // (or with HTML-valued placeholders) lose the placeholder entirely
        // in 4.x because the Placeholder decorator never attaches. Mirror
        // the attribute to data-placeholder so the data-* path picks it up.
        // Also run the optional placeholderResolver hook to support
        // projects whose own framework strips `placeholder` from the
        // options before reaching select2 (and looks it up from a side
        // channel like data-config + window.config[name].defaultItem).
        $els.each(function () {
            var $el = $(this);
            if (!$el.attr("data-placeholder")) {
                var ph = $el.attr("placeholder");
                if ((ph == null || ph === "") && typeof c.placeholderResolver === "function") {
                    try {
                        ph = c.placeholderResolver($el, opts);
                    } catch (e) { /* ignore */ }
                }
                if (ph != null && ph !== "") {
                    $el.attr("data-placeholder", ph);
                }
            }
        });

        // Placeholder option aliases. Some codebases pass the empty-state
        // label under a non-standard key (e.g. `defaultItem` from an
        // internal config layer) that a thin wrapper used to translate to
        // `placeholder` before calling 3.x. After the wrapper is removed,
        // the option name survives but no longer activates the decorator.
        // Treat each configured alias as a synonym for `placeholder`.
        // Default: `defaultItem`. Extend via
        // `$.fn.select2.legacy.placeholderAliases`.
        var phAliases = c.placeholderAliases || ["defaultItem"];
        for (var pa = 0; pa < phAliases.length; pa++) {
            var aliasKey = phAliases[pa];
            if (aliasKey && (aliasKey in opts)) {
                if (opts.placeholder == null && opts[aliasKey] != null) {
                    opts.placeholder = opts[aliasKey];
                }
                delete opts[aliasKey];
            }
        }

        // Legacy `id` / `text` options. 3.2 accepted them as a string
        // property name or a function. 4.x dropped both and expects items
        // to carry plain `.id` and `.text` fields. Capture project getters
        // here; the normalizer below applies them everywhere data items
        // enter the adapter (query, initSelection, ajax, opts.data) so
        // `.id` and `.text` are set before items reach stock 4.x.
        if ("id" in opts && typeof opts.id === "function") {
            opts._legacy_idFn = opts.id;
            delete opts.id;
        } else if ("id" in opts && typeof opts.id === "string") {
            var idKey = opts.id;
            opts._legacy_idFn = function (item) { return item[idKey]; };
            delete opts.id;
        }
        if ("text" in opts && typeof opts.text === "function") {
            opts._legacy_textFn = opts.text;
            delete opts.text;
        } else if ("text" in opts && typeof opts.text === "string") {
            var textKey0 = opts.text;
            opts._legacy_textFn = function (item) { return item[textKey0]; };
            delete opts.text;
        }

        // dataValue / dataText -> rename to id/text on data and ajax results
        var valueKey = opts.dataValue || null;
        var textKey = opts.dataText || null;
        delete opts.dataValue;
        delete opts.dataText;

        // Item normalizer. Prefers explicit id/text getters, otherwise
        // falls back to dataValue/dataText property names. Returns the
        // input unchanged when no getter is configured.
        var normIdFn = opts._legacy_idFn
            || (valueKey ? function (it) { return it && it[valueKey]; } : null);
        var normTextFn = opts._legacy_textFn
            || (textKey ? function (it) { return it && it[textKey]; } : null);
        if (normIdFn || normTextFn) {
            opts._legacy_normalizer = (function (idFn, textFn) {
                return function normalize(item) {
                    if (item == null || typeof item !== "object") { return item; }
                    var out = $.extend({}, item);
                    if (idFn && out.id == null) {
                        try {
                            var derivedId = idFn(item);
                            if (derivedId != null) { out.id = derivedId; }
                        } catch (e) { /* ignore */ }
                    }
                    if (textFn && out.text == null) {
                        try {
                            var derivedText = textFn(item);
                            if (derivedText != null) { out.text = derivedText; }
                        } catch (e) { /* ignore */ }
                    }
                    if ($.isArray(item.children)) {
                        out.children = $.map(item.children, normalize);
                    }
                    return out;
                };
            }(normIdFn, normTextFn));
        }

        if (valueKey || textKey) {
            if ($.isArray(opts.data)) {
                opts.data = remapArray(opts.data, valueKey, textKey);
            }
            if (opts.ajax && typeof opts.ajax.processResults === "function") {
                var origProcess = opts.ajax.processResults;
                opts.ajax.processResults = function (data, params) {
                    var out = origProcess(data, params);
                    if (out && $.isArray(out.results)) {
                        out.results = remapArray(out.results, valueKey, textKey);
                    }
                    return out;
                };
            } else if (opts.ajax) {
                opts.ajax.processResults = function (data) {
                    var results = $.isArray(data) ? data : (data && data.results) || [];
                    return {
                        results: remapArray(results, valueKey, textKey),
                        pagination: { more: !!(data && data.more) }
                    };
                };
            }
        }

        // maximumSelectionSize -> maximumSelectionLength
        if ("maximumSelectionSize" in opts && !("maximumSelectionLength" in opts)) {
            opts.maximumSelectionLength = opts.maximumSelectionSize;
            delete opts.maximumSelectionSize;
        }

        // separator -> valueSeparator
        if ("separator" in opts && !("valueSeparator" in opts)) {
            opts.valueSeparator = opts.separator;
            delete opts.separator;
        }

        // format* -> language.*
        var langMap = {
            "formatNoMatches":       "noResults",
            "formatInputTooShort":   "inputTooShort",
            "formatInputTooLong":    "inputTooLong",
            "formatSelectionTooBig": "maximumSelected",
            "formatLoadMore":        "loadingMore",
            "formatSearching":       "searching"
        };
        var hasLangOverride = false;
        var lang = opts.language || {};
        if (typeof lang === "string") { lang = {}; }
        for (var oldKey in langMap) {
            if (langMap.hasOwnProperty(oldKey) && oldKey in opts) {
                lang[langMap[oldKey]] = wrapLangFunction(oldKey, opts[oldKey]);
                delete opts[oldKey];
                hasLangOverride = true;
            }
        }
        if (hasLangOverride) { opts.language = lang; }

        // Match 3.x escapeMarkup (only escapes &) when format* callbacks
        // return HTML. 4.x's default also escapes <, >, " which renders
        // legacy markup as literal text.
        var usesLegacyFormatters = ("formatResult" in opts) || ("formatSelection" in opts);
        if (usesLegacyFormatters && !("escapeMarkup" in opts)) {
            opts.escapeMarkup = function (m) {
                if (m && typeof m === "string") {
                    return m.replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;");
                }
                return m;
            };
        }

        // formatResult -> templateResult
        if ("formatResult" in opts && !("templateResult" in opts)) {
            var origFormatResult = opts.formatResult;
            opts.templateResult = function (data) {
                if (data.loading) { return data.text; }
                return origFormatResult(data, null, { term: "" }, defaultEscapeMarkup);
            };
            delete opts.formatResult;
        }

        // formatSelection -> templateSelection
        if ("formatSelection" in opts && !("templateSelection" in opts)) {
            var origFormatSelection = opts.formatSelection;
            opts.templateSelection = function (data) {
                return origFormatSelection(data, null);
            };
            delete opts.formatSelection;
        }

        if ("formatResultCssClass" in opts) {
            logWarn("formatResultCssClass", "Not supported in 4.x; use templateResult.");
            delete opts.formatResultCssClass;
        }

        // sortResults -> sorter
        if ("sortResults" in opts && !("sorter" in opts)) {
            opts.sorter = opts.sortResults;
            delete opts.sortResults;
        }

        // createSearchChoice -> createTag
        if ("createSearchChoice" in opts && !("createTag" in opts)) {
            var origCreateSearchChoice = opts.createSearchChoice;
            opts.createTag = function (params) { return origCreateSearchChoice(params.term); };
            delete opts.createSearchChoice;
        }

        // tags array/function -> tags:true + data
        if ("tags" in opts) {
            var tagsVal = opts.tags;
            if (typeof tagsVal !== "boolean") {
                var tagData = $.isFunction(tagsVal) ? tagsVal() : tagsVal;
                if ($.isArray(tagData)) { opts.data = normalizeTagData(tagData); }
                opts.tags = true;
            }
        }

        // ajax.quietMillis -> ajax.delay
        if (opts.ajax && "quietMillis" in opts.ajax && !("delay" in opts.ajax)) {
            opts.ajax.delay = opts.ajax.quietMillis;
            delete opts.ajax.quietMillis;
        }

        // ajax.results -> ajax.processResults (unless already set by dataValue/dataText path)
        if (opts.ajax && "results" in opts.ajax && !("processResults" in opts.ajax)) {
            var origResults = opts.ajax.results;
            opts.ajax.processResults = function (data, params) {
                var result = origResults(data, params.page || 1);
                if (result && typeof result.more !== "undefined" && !result.pagination) {
                    result.pagination = { more: result.more };
                    delete result.more;
                }
                return result;
            };
            delete opts.ajax.results;
        }

        // ajax.data(term, page) -> ajax.data(params)
        if (opts.ajax && opts.ajax.data) {
            var origAjaxData = opts.ajax.data;
            if (origAjaxData.length >= 2) {
                opts.ajax.data = function (params) {
                    return origAjaxData(params.term, params.page || 1);
                };
            }
        }

        // matcher old signature (term, text) -> new (params, data)
        if ("matcher" in opts) {
            var origMatcher = opts.matcher;
            if (typeof origMatcher === "function" && origMatcher.length >= 2 && origMatcher.length <= 3) {
                opts.matcher = buildMatcherCompat(origMatcher);
            }
        }

        // Wrap or install matcher to short-circuit on "no-match keyword"
        var existingMatcher = typeof opts.matcher === "function" ? opts.matcher : null;
        opts.matcher = function (params, data) {
            var kw = safeCall(c.noMatchKeyword);
            if (kw && params && typeof params.term === "string"
                && params.term.toLowerCase() === String(kw).toLowerCase()) {
                return null;
            }
            if (existingMatcher) { return existingMatcher(params, data); }
            if (!params || params.term == null || $.trim(params.term) === "") { return data; }
            if (data && data.text
                && data.text.toLowerCase().indexOf(params.term.toLowerCase()) > -1) {
                return data;
            }
            return null;
        };

        // selectOnBlur -> selectOnClose
        if ("selectOnBlur" in opts && !("selectOnClose" in opts)) {
            opts.selectOnClose = opts.selectOnBlur;
            delete opts.selectOnBlur;
        }

        // Removed options
        var removedOpts = {
            "openOnEnter":     "Not supported in 4.x.",
            "blurOnChange":    "Not supported in 4.x.",
            "loadMorePadding": "Not supported in 4.x. Use InfiniteScroll adapter."
        };
        for (var removedKey in removedOpts) {
            if (removedOpts.hasOwnProperty(removedKey) && removedKey in opts) {
                logWarn(removedKey, removedOpts[removedKey]);
                delete opts[removedKey];
            }
        }

        // nextSearchTerm: carry through for post-init
        if (typeof opts.nextSearchTerm === "function") {
            opts._legacy_nextSearchTerm = opts.nextSearchTerm;
        }
        delete opts.nextSearchTerm;

        // dropdownAriaLabel / selectedOptionAriaLabel: carry through
        if (opts.dropdownAriaLabel != null) {
            opts._legacy_dropdownAriaLabel = opts.dropdownAriaLabel;
            delete opts.dropdownAriaLabel;
        }
        if (opts.selectedOptionAriaLabel != null) {
            opts._legacy_selectedOptionAriaLabel = opts.selectedOptionAriaLabel;
            delete opts.selectedOptionAriaLabel;
        }

        // initSelection: <select> runs inline; hidden input deferred to post-init
        if (typeof opts.initSelection === "function") {
            var initFn = opts.initSelection;
            delete opts.initSelection;
            var initNormalizer = opts._legacy_normalizer;
            $els.each(function () { runInitSelection($(this), initFn, initNormalizer); });
        }

        // <select> uses QueryAdapter directly. <input> is deferred: 4.x's
        // InputData decorator shadows any custom dataAdapter, so we patch
        // dataAdapter.query in installPostInitBehaviors instead.
        if (typeof opts.query === "function") {
            var queryFn = opts.query;
            delete opts.query;
            var hasSelectEl = false;
            $els.each(function () {
                var $e = $(this);
                if ($e.is("input")) {
                    $e.data("_legacy_queryFn", queryFn);
                } else {
                    hasSelectEl = true;
                }
            });
            if (hasSelectEl) {
                var adapter = buildQueryDataAdapter(queryFn, opts._legacy_normalizer);
                if (adapter) { opts.dataAdapter = adapter; }
            }
        }

        // Source-class propagation. In 3.2 the container automatically
        // inherited the source element's class attribute; 4.x does not.
        // Setting `containerCssClass` to "" engages the ContainerCSS
        // decorator and lets non-select2-* classes propagate.
        if (opts.containerCssClass == null
                && opts.adaptContainerCssClass == null
                && opts.containerCss == null) {
            opts.containerCssClass = "";
        }

        // Dropdown class mapping. 4.x drops all source classes from the
        // dropdown. Apply dropdownClassMap so project CSS hooks
        // (custom-select-big-dropdown, nonprintable, ...) keep working.
        if (opts.dropdownCssClass == null
                && opts.adaptDropdownCssClass == null
                && opts.dropdownCss == null) {
            var dropMap = c.dropdownClassMap;
            if (dropMap && typeof dropMap === "object") {
                opts.adaptDropdownCssClass = function (clazz) {
                    if (Object.prototype.hasOwnProperty.call(dropMap, clazz)) {
                        return dropMap[clazz];
                    }
                    return null;
                };
            }
        }

        return opts;
    }

    // =======================================================
    // initSelection runner
    // =======================================================
    function runInitSelection($el, initFn, normalizer) {
        if ($el.is("input")) {
            $el.data("_legacy_initFn", initFn);
            return;
        }
        if (!$el.is("select")) { return; }
        initFn($el, function (data) {
            if (data == null) { return; }
            var items = $.isArray(data) ? data : [data];
            if (typeof normalizer === "function") {
                items = $.map(items, normalizer);
            }
            var values = [];
            $.each(items, function (_, item) {
                if (item == null) { return; }
                var id = item.id;
                var text = item.text != null ? item.text : id;
                var escaped = String(id).replace(/'/g, "\\'");
                if ($el.find("option[value='" + escaped + "']").length === 0) {
                    $el.append(new Option(text, id, true, true));
                }
                item.element = $el.find("option[value='" + escaped + "']")[0];
                values.push(id);
            });
            $el.val($.isArray(data) ? values : values[0]);
            $el.trigger("change");
        });
    }

    // =======================================================
    // query -> dataAdapter
    // =======================================================
    function buildQueryDataAdapter(queryFn, normalizer) {
        var amd = $.fn.select2.amd;
        if (!amd || !amd.require) { return null; }
        var ArrayAdapter, Utils;
        try {
            ArrayAdapter = amd.require("select2/data/array");
            Utils = amd.require("select2/utils");
        } catch (e) {
            return null;
        }
        function QueryAdapter($el, opts) {
            QueryAdapter.__super__.constructor.call(this, $el, opts);
        }
        Utils.Extend(QueryAdapter, ArrayAdapter);
        QueryAdapter.prototype.query = function (params, callback) {
            var page = params.page || 1;
            queryFn({
                element: this.$element,
                term:    params.term || "",
                page:    page,
                context: params,
                callback: function (result) {
                    var items = (result && result.results) || [];
                    if (typeof normalizer === "function") {
                        items = $.map(items, normalizer);
                    }
                    callback({
                        results:    items,
                        pagination: { more: !!(result && result.more) }
                    });
                }
            });
        };
        return QueryAdapter;
    }

    // =======================================================
    // Post-init behaviors
    // =======================================================
    function installPostInitBehaviors($el, opts) {
        var c = cfg();
        var inst = $el.data("select2");
        if (!inst) { return; }

        // dropdownAriaLabel
        if (c.enableAriaLabels && opts._legacy_dropdownAriaLabel) {
            $el.on("select2:open.legacyAdapter", function () {
                var label = typeof opts._legacy_dropdownAriaLabel === "function"
                    ? opts._legacy_dropdownAriaLabel()
                    : opts._legacy_dropdownAriaLabel;
                var $dd = $(".select2-container--open .select2-dropdown");
                $dd.attr("aria-label", label).attr("role", "application");
                $dd.find(".select2-search__field").attr("aria-label", label);
            });
        }

        // selectedOptionAriaLabel
        if (c.enableAriaLabels && opts._legacy_selectedOptionAriaLabel) {
            var applyAria = function () {
                var label = typeof opts._legacy_selectedOptionAriaLabel === "function"
                    ? opts._legacy_selectedOptionAriaLabel($el.val(), $el)
                    : opts._legacy_selectedOptionAriaLabel;
                var $c2 = inst.$container;
                if (!$c2) { return; }
                if (label) { $c2.attr("aria-label", label); }
                else { $c2.removeAttr("aria-label"); }
            };
            $el.on(
                "change.legacyAdapter select2:select.legacyAdapter select2:unselect.legacyAdapter",
                applyAria
            );
            applyAria();
        }

        // nextSearchTerm
        if (typeof opts._legacy_nextSearchTerm === "function") {
            var pendingTerm = null;
            $el.on("select2:select.legacyAdapter", function (e) {
                pendingTerm = opts._legacy_nextSearchTerm(e.params && e.params.data, "");
            });
            $el.on("select2:open.legacyAdapter", function () {
                if (pendingTerm != null) {
                    var $s = $(".select2-container--open .select2-search__field");
                    if ($s.length) { $s.val(pendingTerm).trigger("input"); }
                    pendingTerm = null;
                }
            });
        }

        // placeholder-aware scroll + touch focus skip
        if (inst.$container) {
            $el.on("select2:open.legacyAdapter", function () {
                if (isTouchSupport()) {
                    setTimeout(function () {
                        var $s = $(".select2-container--open .select2-search__field");
                        if ($s.length) { $s.blur(); }
                    }, 0);
                }
                setTimeout(function () {
                    var $results = $(".select2-container--open .select2-results__options");
                    var $hi = $results.find(".select2-results__option--highlighted").first();
                    if (!$hi.length) { return; }
                    var text = $.trim($hi.text());
                    if (text && text !== c.placeholderLabel) {
                        var index = $results.find(".select2-results__option").index($hi);
                        if (index > 0) { $results.scrollTop(index * 20); }
                    }
                }, 0);
            });
        }

        // blur forwarder
        if (c.enableBlurTrigger) {
            $el.on("select2:close.legacyAdapter", function () {
                try { $el.triggerHandler("blur"); } catch (e) { /* ignore */ }
            });
        }

        // Deferred initSelection / query for <input>. The InputData decorator
        // shadows any inner adapter, so we patch the live dataAdapter
        // instance after init rather than installing one upfront.
        if ($el.is("input")) {
            var dataAdapter = inst.dataAdapter;
            var deferredQueryFn = $el.data("_legacy_queryFn");
            var deferredInitFn = $el.data("_legacy_initFn");
            var legacyNormalizer = opts._legacy_normalizer;

            if (typeof deferredQueryFn === "function" && dataAdapter) {
                dataAdapter.query = function (params, callback) {
                    deferredQueryFn({
                        element: $el,
                        term:    (params && params.term) || "",
                        page:    (params && params.page) || 1,
                        context: params,
                        callback: function (result) {
                            var items = (result && result.results) || [];
                            if (typeof legacyNormalizer === "function") {
                                items = $.map(items, legacyNormalizer);
                            }
                            if (dataAdapter._currentData) {
                                var seen = {};
                                $.each(dataAdapter._currentData, function (_, d) {
                                    if (d) { seen[d.id] = true; }
                                });
                                $.each(items, function (_, it) {
                                    if (it && !seen[it.id]) {
                                        dataAdapter._currentData.push(it);
                                        seen[it.id] = true;
                                    }
                                });
                            }
                            callback({ results: items });
                        }
                    });
                };
            }

            if (typeof deferredInitFn === "function" && dataAdapter) {
                deferredInitFn($el, function (data) {
                    if (data == null) { return; }
                    var items = $.isArray(data) ? data : [data];
                    if (typeof legacyNormalizer === "function") {
                        items = $.map(items, legacyNormalizer);
                    }
                    var values = [];
                    $.each(items, function (_, item) {
                        if (item == null) { return; }
                        item.selected = true;
                        if (dataAdapter._currentData) {
                            var found = false;
                            $.each(dataAdapter._currentData, function (_, d) {
                                if (d && d.id === item.id) { found = true; }
                            });
                            if (!found) { dataAdapter._currentData.push(item); }
                        }
                        values.push(item.id);
                    });
                    $el.val($.isArray(data) ? values : values[0]);
                    $el.trigger("change");
                });
            }

            $el.removeData("_legacy_initFn");
            $el.removeData("_legacy_queryFn");
        }

        // Empty-state formatSelection bridge.
        // 3.2's single-select data setter called updateSelection() with the
        // raw value, which fired formatSelection even when value was [] or
        // an empty object. Projects relied on that to render a custom
        // placeholder HTML (e.g. `<span class="action">İşlem yapmak...</span>`)
        // for the no-selection state, especially when their config skipped
        // the standard `placeholder` option. 4.x's SingleSelection.update
        // takes the clear() branch on empty data and never calls
        // templateSelection, so the rendered span goes blank.
        // Hook selection:update; if data is empty, no Placeholder decorator
        // wrote a placeholder span, and templateSelection is configured,
        // call it with [] and inject the HTML so 3.x empty-state rendering
        // still works.
        if (typeof inst.on === "function"
                && typeof opts.templateSelection === "function") {
            var renderEmptyStateFromTemplate = function () {
                if (!inst.$container) { return; }
                var $rendered = inst.$container.find(".select2-selection__rendered");
                if (!$rendered.length) { return; }
                if ($rendered.children().length > 0) { return; }
                if ($.trim($rendered.text()) !== "") { return; }
                var html;
                try { html = opts.templateSelection([], $rendered); }
                catch (e) { return; }
                if (html == null || html === "") { return; }
                var escape = (inst.options && inst.options.get("escapeMarkup"))
                    || function (m) { return m; };
                $rendered.empty().append(escape(html));
            };
            inst.on("selection:update", function (params) {
                if (params && $.isArray(params.data) && params.data.length === 0) {
                    setTimeout(renderEmptyStateFromTemplate, 0);
                }
            });
            // First render: post-init runs after the constructor's initial
            // selection:update, so trigger once now in case current() was
            // already empty at that point.
            setTimeout(renderEmptyStateFromTemplate, 0);
        }

        // keypress forwarder on closed selection
        if (c.enableKeypressForward && inst.$container) {
            var $sel = inst.$container.find(".select2-selection");
            $sel.on("keypress.legacyAdapter", function (e) {
                if (!e.which || e.ctrlKey || e.altKey || e.metaKey) { return; }
                if (!$el.select2("isOpen")) { $el.select2("open"); }
                var ch = String.fromCharCode(e.which);
                setTimeout(function () {
                    var $search = $(".select2-container--open .select2-search__field");
                    if ($search.length) { $search.val(ch).trigger("input").focus(); }
                }, 0);
            });
        }

        // 3.x -> 4.x class alias bridge.
        // 4.x renamed almost every internal class. Mirror the 3.x names
        // onto the new DOM so unmodified project CSS keeps matching.
        // State classes are applied/removed on events; container aliases
        // are applied once; dropdown aliases re-apply each time AttachBody
        // re-attaches the dropdown to <body>.
        applyLegacyClassBridge($el, inst);
    }

    // =======================================================
    // 3.x class alias bridge
    // =======================================================
    var CONTAINER_CHILD_ALIASES = [
        [".select2-selection--single",           "select2-choice"],
        [".select2-selection--multiple",         "select2-choices"],
        // `first` matches the patched 3.2 wrapper between .select2-choice
        // and the rendered content. Project CSS often selects on
        // `.select2-choice .first .xyz` for inner layout.
        [".select2-selection__rendered",         "select2-chosen first"],
        [".select2-selection__arrow",            "select2-arrow"],
        [".select2-selection__choice",           "select2-search-choice"],
        [".select2-selection__choice__remove",   "select2-search-choice-close"],
        [".select2-selection__clear",            "select2-search-choice-close"]
    ];

    var DROPDOWN_CHILD_ALIASES = [
        [".select2-search--dropdown",            "select2-search"],
        [".select2-search__field",               "select2-input"],
        [".select2-results__options",            "select2-results"],
        [".select2-results__option",             "select2-result select2-result-selectable"],
        [".select2-results__option--highlighted", "select2-highlighted"],
        [".select2-results__option[aria-disabled=true]", "select2-disabled"],
        [".select2-results__option.loading-results", "select2-more-results"]
    ];

    function applyAliasList($root, list) {
        $.each(list, function (_, pair) {
            $root.find(pair[0]).addClass(pair[1]);
        });
    }

    // Arrow structure bridge. 3.x selectors often use `.select2-choice div b`.
    // 4.x renders `<span class="select2-selection__arrow"><b></b></span>`
    // with no intermediate div. Wrap the <b> in a <div> so legacy
    // selectors keep matching.
    function ensureArrowDivWrapper($container) {
        var $arrow = $container.find(".select2-selection__arrow");
        if (!$arrow.length) { return; }
        var $b = $arrow.children("b").first();
        if (!$b.length) { return; }
        if ($b.parent().is("div")) { return; }
        $b.wrap("<div></div>");
    }

    function bridgeContainerClassesFromSelection(inst) {
        if (!inst.$container) { return; }
        applyAliasList(inst.$container, CONTAINER_CHILD_ALIASES);
        ensureArrowDivWrapper(inst.$container);
    }

    function bridgeDropdownClasses($el) {
        // AttachBody moves the dropdown under <body>; find it there.
        var instId = $el.data("select2") && $el.data("select2").$container
            && $el.data("select2").$container.attr("id");
        var $dd;
        if (instId) {
            $dd = $("body > .select2-container[id='" + instId + "'] .select2-dropdown")
                .add("body > span > .select2-container[id='" + instId + "'] .select2-dropdown");
        }
        if (!$dd || !$dd.length) {
            $dd = $("body > .select2-container--open .select2-dropdown");
        }
        if (!$dd.length) { return; }
        $dd.addClass("select2-drop select2-drop-active");
        applyAliasList($dd, DROPDOWN_CHILD_ALIASES);
        // 4.x's mouseup handler filters on
        // `.select2-results__option[aria-selected]`. When a result has no
        // aria-selected (e.g. data.id == null from a legacy query that 3.x
        // tolerated) clicks never fire. Force the attribute on every
        // non-disabled option.
        $dd.find(".select2-results__option").each(function () {
            if (this.hasAttribute("aria-disabled")) { return; }
            if (!this.hasAttribute("aria-selected")) {
                this.setAttribute("aria-selected", "false");
            }
        });
    }

    function applyLegacyClassBridge($el, inst) {
        if (!inst || !inst.$container) { return; }
        bridgeContainerClassesFromSelection(inst);

        // Source-to-container class mirror.
        // 4.x's ContainerCSS only copies classes once at render time, so
        // projects that toggle class hooks on the source <select> after
        // init never see the change propagate. Mirror class mutations to
        // the container span via MutationObserver. Select2-internal
        // classes are left alone.
        if (window.MutationObserver) {
            var lastMirrored = [];
            var mirrorSrcClasses = function () {
                var raw = ($el.attr("class") || "").split(/\s+/);
                var next = [];
                $.each(raw, function (_, cls) {
                    if (cls && cls.indexOf("select2-") !== 0) { next.push(cls); }
                });
                $.each(next, function (_, cls) {
                    if (!inst.$container.hasClass(cls)) {
                        inst.$container.addClass(cls);
                    }
                });
                $.each(lastMirrored, function (_, cls) {
                    if ($.inArray(cls, next) === -1) {
                        inst.$container.removeClass(cls);
                    }
                });
                lastMirrored = next;
            };
            mirrorSrcClasses();
            var srcObs = new MutationObserver(mirrorSrcClasses);
            srcObs.observe($el[0], {
                attributes: true, attributeFilter: ["class"]
            });
        }

        // Static state class bridges driven by 4.x events.
        $el.on("select2:open.legacyAdapter", function () {
            inst.$container.addClass("select2-dropdown-open select2-container-active");
            setTimeout(function () { bridgeDropdownClasses($el); }, 0);
        });
        $el.on("select2:close.legacyAdapter", function () {
            inst.$container.removeClass(
                "select2-dropdown-open select2-container-active"
            );
        });

        // Results render hook. bridgeDropdownClasses runs the
        // aria-selected enforcement on dropdown open, but async query
        // results arrive after that, so freshly rendered <li>s would
        // stay unclickable. Re-apply on every results:all / results:append
        // so each render covers its own items.
        if (typeof inst.on === "function") {
            var enforceAriaSelected = function () {
                setTimeout(function () { bridgeDropdownClasses($el); }, 0);
            };
            inst.on("results:all", enforceAriaSelected);
            inst.on("results:append", enforceAriaSelected);
        }

        // Disabled state bridge: observe `select2-container--disabled` and
        // mirror it as `select2-container-disabled` (3.x name).
        if (window.MutationObserver) {
            var obs = new MutationObserver(function () {
                var $c = inst.$container;
                if (!$c || !$c.length) { return; }
                if ($c.hasClass("select2-container--disabled")) {
                    $c.addClass("select2-container-disabled");
                } else {
                    $c.removeClass("select2-container-disabled");
                }
                if ($c.hasClass("select2-container--above")) {
                    $c.addClass("select2-drop-above");
                } else {
                    $c.removeClass("select2-drop-above");
                }
                if ($c.hasClass("select2-container--focus")) {
                    $c.addClass("select2-container-active");
                }
            });
            obs.observe(inst.$container[0], {
                attributes: true, attributeFilter: ["class"]
            });
        }

        // Children can be re-rendered (e.g. selection refresh after change);
        // re-apply child aliases on any dataAdapter `select` or change event.
        $el.on(
            "change.legacyAdapter select2:select.legacyAdapter select2:unselect.legacyAdapter",
            function () { bridgeContainerClassesFromSelection(inst); }
        );
    }

    // =======================================================
    // Global defaults translation.
    // `$.fn.select2.defaults.formatNoMatches = fn` and similar 3.x-era
    // assignments are forwarded to the 4.x equivalent automatically.
    // =======================================================
    var DEFAULTS_TRANSLATIONS = {
        formatNoMatches:       ["language", "noResults"],
        formatInputTooShort:   ["language", "inputTooShort"],
        formatInputTooLong:    ["language", "inputTooLong"],
        formatSelectionTooBig: ["language", "maximumSelected"],
        formatLoadMore:        ["language", "loadingMore"],
        formatSearching:       ["language", "searching"],
        formatResult:          ["templateResult"],
        formatSelection:       ["templateSelection"],
        maximumSelectionSize:  ["maximumSelectionLength"],
        separator:             ["valueSeparator"],
        selectOnBlur:          ["selectOnClose"],
        sortResults:           ["sorter"]
    };

    try {
        var origDefaults = $.fn.select2.defaults || {};
        $.each(DEFAULTS_TRANSLATIONS, function (legacyKey) {
            var stored;
            Object.defineProperty(origDefaults, legacyKey, {
                configurable: true,
                enumerable: false,
                get: function () { return stored; },
                set: function (v) {
                    stored = v;
                    var target = DEFAULTS_TRANSLATIONS[legacyKey];
                    var wrapped = wrapLegacyDefault(legacyKey, v);
                    if (target.length === 1) {
                        origDefaults[target[0]] = wrapped;
                    } else {
                        origDefaults[target[0]] = origDefaults[target[0]] || {};
                        origDefaults[target[0]][target[1]] = wrapped;
                    }
                }
            });
        });
    } catch (e) {
        // non-fatal
    }

    // =======================================================
    // Helpers
    // =======================================================
    function remapArray(arr, valueKey, textKey) {
        return $.map(arr, function (item) {
            if (item == null || typeof item !== "object") { return item; }
            var out = $.extend({}, item);
            if (valueKey && out.id == null && valueKey in item) { out.id = item[valueKey]; }
            if (textKey && out.text == null && textKey in item) { out.text = item[textKey]; }
            if ($.isArray(item.children)) {
                out.children = remapArray(item.children, valueKey, textKey);
            }
            return out;
        });
    }

    function safeCall(fn) {
        if (typeof fn !== "function") { return null; }
        try { return fn(); } catch (e) { return null; }
    }

    function ensureOptionExists($el, id, text) {
        if (!$el.is("select")) { return; }
        var escaped = String(id).replace(/'/g, "\\'");
        if ($el.find("option[value='" + escaped + "']").length === 0) {
            $el.append(new Option(text != null ? text : id, id, true, true));
        }
    }

    // Push a data object into the live InputData._currentData cache so the
    // patched current() can resolve it after val/change. Used by the
    // legacy "data" setter for <input> elements: 4.x's InputData stores
    // selection data in _currentData but the public select2("data", obj)
    // path never adds to it, so without this seed the rendered span goes
    // empty after the framework calls select2("data", ...). The optional
    // legacy normalizer is applied to materialize id/text from project
    // getter functions (e.g. id: function(o){ return o.idx; }).
    function seedInputCurrentData($el, data) {
        if (data == null || typeof data !== "object") { return; }
        var inst = $el.data("select2");
        if (!inst || !inst.dataAdapter || !$.isArray(inst.dataAdapter._currentData)) {
            return;
        }
        var normalizer = inst.options
            && inst.options.options
            && inst.options.options._legacy_normalizer;
        var item = typeof normalizer === "function" ? normalizer(data) : data;
        if (item == null) { return; }
        var cache = inst.dataAdapter._currentData;
        var foundIdx = -1;
        for (var i = 0; i < cache.length; i++) {
            var cur = cache[i];
            if (cur && cur.id != null && item.id != null
                    && String(cur.id) === String(item.id)) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx === -1) {
            cache.push(item);
        } else {
            cache[foundIdx] = item;
        }
    }

    function normalizeTagData(arr) {
        return $.map(arr, function (item) {
            if (typeof item === "string") { return { id: item, text: item }; }
            return item;
        });
    }

    function wrapLangFunction(oldKey, fn) {
        if (typeof fn !== "function") {
            return function () { return fn; };
        }
        return function (params) {
            switch (oldKey) {
                case "formatInputTooShort": return fn("", params.minimum);
                case "formatInputTooLong":  return fn("", params.maximum);
                case "formatSelectionTooBig": return fn(params.maximum);
                case "formatLoadMore":      return fn(params.page);
                default:                    return fn();
            }
        };
    }

    function wrapLegacyDefault(legacyKey, v) {
        if (typeof v !== "function") {
            return function () { return v; };
        }
        switch (legacyKey) {
            case "formatResult":
                return function (data) {
                    if (data && data.loading) { return data.text; }
                    return v(data, null, { term: "" }, function (m) { return m; });
                };
            case "formatSelection":
                return function (data) { return v(data, null); };
            case "formatInputTooShort":
                return function (p) { return v("", p.minimum); };
            case "formatInputTooLong":
                return function (p) { return v("", p.maximum); };
            case "formatSelectionTooBig":
                return function (p) { return v(p.maximum); };
            case "formatLoadMore":
                return function (p) { return v(p.page); };
            default:
                return function () { return v(); };
        }
    }

    function buildMatcherCompat(oldMatcher) {
        return function (params, data) {
            var match = $.extend(true, {}, data);
            if (params.term == null || $.trim(params.term) === "") { return match; }
            if (data.children) {
                for (var c = data.children.length - 1; c >= 0; c--) {
                    var child = data.children[c];
                    if (!oldMatcher(params.term, child.text, child)) {
                        match.children.splice(c, 1);
                    }
                }
                if (match.children.length > 0) { return match; }
            }
            if (oldMatcher(params.term, data.text, data)) { return match; }
            return null;
        };
    }

    function defaultEscapeMarkup(markup) {
        var map = {
            "\\": "&#92;", "&": "&amp;", "<": "&lt;",
            ">": "&gt;", "\"": "&quot;", "'": "&#39;", "/": "&#47;"
        };
        return String(markup).replace(/[&<>"'\/\\]/g, function (ch) { return map[ch]; });
    }

    function isTouchSupport() {
        return ("ontouchstart" in window)
            || (navigator.maxTouchPoints > 0)
            || (navigator.msMaxTouchPoints > 0);
    }

})(jQuery);
