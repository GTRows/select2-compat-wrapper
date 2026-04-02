/**
 * Select2 Backward Compatibility Wrapper
 * Version: 1.0.0
 *
 * Wraps Select2 4.0.13 to support 3.3.x-style API calls.
 * Must be loaded AFTER select2.full.js.
 *
 * Covers: methods, init options, events, AJAX config, tags, matcher.
 * Unknown methods are logged as warnings and do not crash.
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

    // -------------------------------------------------------
    // Event bridge: re-emit 4.x "select2:*" events as 3.x "select2-*"
    // -------------------------------------------------------
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
            $el.on(newEvt + ".select2compat", function (e) {
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

        $el.on("select2:select.select2compat", function (e) {
            var selectedEvt = $.Event("select2-selected");
            if (e.params && e.params.data) {
                selectedEvt.choice = e.params.data;
                selectedEvt.val = e.params.data.id;
            }
            $el.trigger(selectedEvt);
        });

        $el.on("select2:unselect.select2compat", function (e) {
            var removedEvt = $.Event("select2-removed");
            if (e.params && e.params.data) {
                removedEvt.choice = e.params.data;
                removedEvt.val = e.params.data.id;
            }
            $el.trigger(removedEvt);
        });
    }

    function removeEventBridge($el) {
        $el.off(".select2compat");
    }

    // -------------------------------------------------------
    // Native 4.x methods that need no translation
    // -------------------------------------------------------
    var NATIVE_METHODS = {
        "open": true,
        "close": true,
        "focus": true,
        "enable": true,
        "val": true,
        "isOpen": true,
        "hasFocus": true,
        "isEnabled": true,
        "isDisabled": true,
        "toggleDropdown": true
    };

    // -------------------------------------------------------
    // 3.3.x methods that have no functional equivalent in 4.x
    // -------------------------------------------------------
    var NOOP_METHODS = {
        "onSortStart":     "Sortable integration is not supported in 4.x.",
        "onSortEnd":       "Sortable integration is not supported in 4.x.",
        "positionDropdown": "Dropdown positioning is handled internally in 4.x."
    };

    // -------------------------------------------------------
    // Main override
    // -------------------------------------------------------
    $.fn.select2 = function () {
        var args = Array.prototype.slice.call(arguments, 0);

        // -- Init call: no args or object --
        if (args.length === 0 || typeof args[0] === "object") {
            var self = this;
            var result = _originalSelect2.apply(this, translateOptions(args));
            self.each(function () {
                installEventBridge($(this));
            });
            return result;
        }

        if (typeof args[0] !== "string") {
            return _originalSelect2.apply(this, args);
        }

        var method = args[0];
        var methodArgs = args.slice(1);

        // -- "destroy": clean up event bridge, then call native destroy --
        if (method === "destroy") {
            this.each(function () {
                removeEventBridge($(this));
            });
            return _originalSelect2.apply(this, args);
        }

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

        // -- "data" getter: pass through --
        if (method === "data" && methodArgs.length === 0) {
            return _originalSelect2.apply(this, args);
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

        // -- No-op methods: log and return this --
        if (NOOP_METHODS[method]) {
            logWarn(method, NOOP_METHODS[method]);
            return this;
        }

        // -- Native methods: pass through --
        if (NATIVE_METHODS[method]) {
            return _originalSelect2.apply(this, args);
        }

        // -- Unknown methods: log warning, do not crash --
        logWarn(method, "Unknown method. Does not exist in 4.0.13 and has no backward-compatible mapping.");
        return this;
    };

    // Preserve defaults and amd references from the original
    $.fn.select2.defaults = _originalSelect2.defaults;
    $.fn.select2.amd = _originalSelect2.amd;

    // -------------------------------------------------------
    // Option translation for init calls
    // -------------------------------------------------------
    function translateOptions(args) {
        if (args.length === 0) {
            return args;
        }
        var opts = $.extend(true, {}, args[0]);

        // -- id option: 4.x always uses item.id, so wrap data/ajax to remap --
        if ("id" in opts && typeof opts.id === "function") {
            var idFn = opts.id;
            opts._compat_idFn = idFn;
            delete opts.id;
        } else if ("id" in opts && typeof opts.id === "string") {
            var idKey = opts.id;
            opts._compat_idFn = function (item) { return item[idKey]; };
            delete opts.id;
        }

        // -- maximumSelectionSize -> maximumSelectionLength --
        if ("maximumSelectionSize" in opts && !("maximumSelectionLength" in opts)) {
            opts.maximumSelectionLength = opts.maximumSelectionSize;
            delete opts.maximumSelectionSize;
        }

        // -- separator (used with hidden inputs) --
        if ("separator" in opts && !("valueSeparator" in opts)) {
            opts.valueSeparator = opts.separator;
            delete opts.separator;
        }

        // -- format* -> language.* --
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
            if (langMap.hasOwnProperty(oldKey) && oldKey in opts) {
                lang[langMap[oldKey]] = wrapLangFunction(oldKey, opts[oldKey]);
                delete opts[oldKey];
                hasLangOverride = true;
            }
        }
        if (hasLangOverride) {
            opts.language = lang;
        }

        // -- formatResult -> templateResult --
        if ("formatResult" in opts && !("templateResult" in opts)) {
            var origFormatResult = opts.formatResult;
            opts.templateResult = function (data) {
                if (data.loading) {
                    return data.text;
                }
                var escFn = defaultEscapeMarkup;
                return origFormatResult(data, null, {term: ""}, escFn);
            };
            delete opts.formatResult;
        }

        // -- formatSelection -> templateSelection --
        if ("formatSelection" in opts && !("templateSelection" in opts)) {
            var origFormatSelection = opts.formatSelection;
            opts.templateSelection = function (data) {
                return origFormatSelection(data, null);
            };
            delete opts.formatSelection;
        }

        // -- formatResultCssClass: no direct equivalent --
        if ("formatResultCssClass" in opts) {
            logWarn("formatResultCssClass", "Not supported in 4.x. Custom result styling should use templateResult instead.");
            delete opts.formatResultCssClass;
        }

        // -- sortResults -> sorter --
        if ("sortResults" in opts && !("sorter" in opts)) {
            opts.sorter = opts.sortResults;
            delete opts.sortResults;
        }

        // -- createSearchChoice -> createTag --
        if ("createSearchChoice" in opts && !("createTag" in opts)) {
            var origCreateSearchChoice = opts.createSearchChoice;
            opts.createTag = function (params) {
                return origCreateSearchChoice(params.term);
            };
            delete opts.createSearchChoice;
        }

        // -- tags as array/function -> tags: true + data --
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

        // -- ajax.quietMillis -> ajax.delay --
        if (opts.ajax && "quietMillis" in opts.ajax && !("delay" in opts.ajax)) {
            opts.ajax.delay = opts.ajax.quietMillis;
            delete opts.ajax.quietMillis;
        }

        // -- ajax.results -> ajax.processResults --
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

        // -- ajax.data(term, page) -> ajax.data(params) --
        if (opts.ajax && opts.ajax.data) {
            var origAjaxData = opts.ajax.data;
            if (origAjaxData.length >= 2) {
                opts.ajax.data = function (params) {
                    return origAjaxData(params.term, params.page || 1);
                };
            }
        }

        // -- matcher: old signature (term, text) -> new signature (params, data) --
        if ("matcher" in opts) {
            var origMatcher = opts.matcher;
            if (origMatcher.length >= 2 && origMatcher.length <= 3) {
                var compatModule = $.fn.select2.amd && $.fn.select2.amd.require;
                if (compatModule) {
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

        // -- selectOnBlur -> selectOnClose --
        if ("selectOnBlur" in opts && !("selectOnClose" in opts)) {
            opts.selectOnClose = opts.selectOnBlur;
            delete opts.selectOnBlur;
        }

        // -- Removed options: warn and drop --
        var removedOpts = {
            "openOnEnter":    "Not supported in 4.x.",
            "blurOnChange":   "Not supported in 4.x.",
            "loadMorePadding": "Not supported in 4.x. Infinite scroll is handled by the InfiniteScroll adapter."
        };
        for (var removedKey in removedOpts) {
            if (removedOpts.hasOwnProperty(removedKey) && removedKey in opts) {
                logWarn(removedKey, removedOpts[removedKey]);
                delete opts[removedKey];
            }
        }

        return [opts];
    }

    // -------------------------------------------------------
    // Helpers
    // -------------------------------------------------------
    function ensureOptionExists($el, id, text) {
        if (!$el.is("select")) {
            return;
        }
        var escaped = String(id).replace(/'/g, "\\'");
        if ($el.find("option[value='" + escaped + "']").length === 0) {
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

    function defaultEscapeMarkup(markup) {
        var map = {
            '\\': '&#92;', '&': '&amp;', '<': '&lt;',
            '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#47;'
        };
        return String(markup).replace(/[&<>"'\/\\]/g, function (ch) {
            return map[ch];
        });
    }

    function logWarn(key, message) {
        if (window.console && console.warn) {
            console.warn("[select2-compat] \"" + key + "\": " + message);
        }
    }

})(jQuery);
