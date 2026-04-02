/**
 * Select2 Backward Compatibility Wrapper
 *
 * Wraps Select2 4.0.13 to support 3.3.0-style method calls.
 * Must be loaded AFTER select2.full.js.
 *
 * Supported 3.3.0 methods that are translated:
 *   - "data" (setter)  -> sets value via val() + trigger
 *   - "disable"        -> prop("disabled", true)
 *   - "opened"         -> isOpen()
 *   - "isFocused"      -> hasFocus()
 *   - "container"      -> returns the select2 container element
 *
 * Methods that work natively in 4.x (no wrapping needed):
 *   - "open", "close", "destroy", "focus", "enable", "val", "data" (getter)
 *
 * Unknown methods: logged as warnings, return undefined (no crash).
 */
(function ($) {
    "use strict";

    if (!$.fn.select2) {
        if (window.console) {
            console.error("[select2-compat] select2 is not loaded. Load select2.full.js before this wrapper.");
        }
        return;
    }

    var _originalSelect2 = $.fn.select2;

    var NATIVE_METHODS = {
        "open": true,
        "close": true,
        "destroy": true,
        "focus": true,
        "enable": true,
        "val": true,
        "isOpen": true,
        "hasFocus": true,
        "isEnabled": true,
        "isDisabled": true,
        "toggleDropdown": true
    };

    $.fn.select2 = function () {
        var args = Array.prototype.slice.call(arguments, 0);

        if (args.length === 0 || typeof args[0] === "object") {
            return _originalSelect2.apply(this, translateOptions(args));
        }

        if (typeof args[0] !== "string") {
            return _originalSelect2.apply(this, args);
        }

        var method = args[0];
        var methodArgs = args.slice(1);

        // -- "data" with setter argument --
        if (method === "data" && methodArgs.length > 0) {
            return this.each(function () {
                var $el = $(this);
                var data = methodArgs[0];
                if (data === null || typeof data === "undefined") {
                    $el.val(null).trigger("change");
                    return;
                }
                if ($.isArray(data)) {
                    var ids = $.map(data, function (item) {
                        if (typeof item === "object" && item !== null) {
                            ensureOptionExists($el, item.id, item.text);
                            return item.id;
                        }
                        return item;
                    });
                    $el.val(ids).trigger("change");
                } else if (typeof data === "object") {
                    ensureOptionExists($el, data.id, data.text);
                    $el.val(data.id).trigger("change");
                } else {
                    $el.val(data).trigger("change");
                }
            });
        }

        // -- "disable" -> prop("disabled", true) --
        if (method === "disable") {
            return this.each(function () {
                $(this).prop("disabled", true);
            });
        }

        // -- "opened" -> "isOpen" --
        if (method === "opened") {
            return _originalSelect2.call(this, "isOpen");
        }

        // -- "isFocused" -> "hasFocus" --
        if (method === "isFocused") {
            return _originalSelect2.call(this, "hasFocus");
        }

        // -- "container" -> return the select2 container element --
        if (method === "container") {
            var instance = $(this).data("select2");
            if (instance && instance.$container) {
                return instance.$container;
            }
            logWarn("container", "No select2 instance found on element.");
            return $();
        }

        // -- Native methods: pass through --
        if (NATIVE_METHODS[method]) {
            return _originalSelect2.apply(this, args);
        }

        // -- Unknown methods: log warning, do not crash --
        logWarn(method, "Unknown select2 method called. This method does not exist in 4.0.13 and has no backward-compatible mapping.");
        return this;
    };

    // Preserve defaults and amd references from the original
    $.fn.select2.defaults = _originalSelect2.defaults;
    $.fn.select2.amd = _originalSelect2.amd;

    // --- Option translation for init calls ---

    function translateOptions(args) {
        if (args.length === 0) {
            return args;
        }
        var opts = $.extend(true, {}, args[0]);

        // maximumSelectionSize -> maximumSelectionLength
        if ("maximumSelectionSize" in opts && !("maximumSelectionLength" in opts)) {
            opts.maximumSelectionLength = opts.maximumSelectionSize;
            delete opts.maximumSelectionSize;
        }

        // formatNoMatches -> language.noResults
        // formatInputTooShort -> language.inputTooShort
        // formatInputTooLong -> language.inputTooLong
        // formatSelectionTooBig -> language.maximumSelected
        // formatLoadMore -> language.loadingMore
        // formatSearching -> language.searching
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
        if (typeof lang === "string") {
            lang = {};
        }

        for (var oldKey in langMap) {
            if (oldKey in opts) {
                lang[langMap[oldKey]] = wrapLangFunction(oldKey, opts[oldKey]);
                delete opts[oldKey];
                hasLangOverride = true;
            }
        }
        if (hasLangOverride) {
            opts.language = lang;
        }

        // formatResult -> templateResult
        if ("formatResult" in opts && !("templateResult" in opts)) {
            var origFormatResult = opts.formatResult;
            opts.templateResult = function (data) {
                if (data.loading) {
                    return data.text;
                }
                return origFormatResult(data, null, {term: ""}, $.fn.select2.defaults.defaults ? $.fn.select2.defaults.defaults.escapeMarkup : function (m) { return m; });
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

        // sortResults -> sorter
        if ("sortResults" in opts && !("sorter" in opts)) {
            opts.sorter = opts.sortResults;
            delete opts.sortResults;
        }

        // createSearchChoice -> createTag
        if ("createSearchChoice" in opts && !("createTag" in opts)) {
            var origCreateSearchChoice = opts.createSearchChoice;
            opts.createTag = function (params) {
                return origCreateSearchChoice(params.term);
            };
            delete opts.createSearchChoice;
        }

        // tags as array/function -> tags: true + data
        if ("tags" in opts) {
            var tagsVal = opts.tags;
            if (typeof tagsVal !== "boolean") {
                var tagData = $.isFunction(tagsVal) ? tagsVal() : tagsVal;
                if ($.isArray(tagData)) {
                    opts.data = normalizeTagData(tagData);
                }
                opts.tags = true;
            }
        }

        // ajax.quietMillis -> ajax.delay
        if (opts.ajax && "quietMillis" in opts.ajax && !("delay" in opts.ajax)) {
            opts.ajax.delay = opts.ajax.quietMillis;
            delete opts.ajax.quietMillis;
        }

        // ajax.results -> ajax.processResults
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

        // matcher: old signature (term, text) -> new signature (params, data)
        if ("matcher" in opts) {
            var origMatcher = opts.matcher;
            if (origMatcher.length >= 2 && origMatcher.length <= 3) {
                var compat = $.fn.select2.amd && $.fn.select2.amd.require;
                if (compat) {
                    try {
                        var oldMatcherWrapper = $.fn.select2.amd.require("select2/compat/matcher");
                        opts.matcher = oldMatcherWrapper(origMatcher);
                    } catch (e) {
                        opts.matcher = buildMatcherCompat(origMatcher);
                    }
                } else {
                    opts.matcher = buildMatcherCompat(origMatcher);
                }
            }
        }

        // selectOnBlur -> selectOnClose
        if ("selectOnBlur" in opts && !("selectOnClose" in opts)) {
            opts.selectOnClose = opts.selectOnBlur;
            delete opts.selectOnBlur;
        }

        return [opts];
    }

    // --- Helpers ---

    function ensureOptionExists($el, id, text) {
        if (!$el.is("select")) {
            return;
        }
        if ($el.find("option[value='" + String(id).replace(/'/g, "\\'") + "']").length === 0) {
            var option = new Option(text || id, id, true, true);
            $el.append(option);
        }
    }

    function normalizeTagData(arr) {
        return $.map(arr, function (item) {
            if (typeof item === "string") {
                return { id: item, text: item };
            }
            return item;
        });
    }

    function wrapLangFunction(oldKey, fn) {
        if (typeof fn !== "function") {
            return function () { return fn; };
        }
        // 3.3.0 language functions have varied signatures, 4.x expects (params) -> string
        return function (params) {
            switch (oldKey) {
                case "formatInputTooShort":
                    return fn("", params.minimum);
                case "formatInputTooLong":
                    return fn("", params.maximum);
                case "formatSelectionTooBig":
                    return fn(params.maximum);
                case "formatLoadMore":
                    return fn(params.page);
                default:
                    return fn();
            }
        };
    }

    function buildMatcherCompat(oldMatcher) {
        return function (params, data) {
            var match = $.extend(true, {}, data);
            if (params.term == null || $.trim(params.term) === "") {
                return match;
            }
            if (data.children) {
                for (var c = data.children.length - 1; c >= 0; c--) {
                    var child = data.children[c];
                    if (!oldMatcher(params.term, child.text, child)) {
                        match.children.splice(c, 1);
                    }
                }
                if (match.children.length > 0) {
                    return match;
                }
            }
            if (oldMatcher(params.term, data.text, data)) {
                return match;
            }
            return null;
        };
    }

    function logWarn(method, message) {
        if (window.console && console.warn) {
            console.warn("[select2-compat] \"" + method + "\": " + message);
        }
    }

})(jQuery);
