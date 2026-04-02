/**
 * Shared test scenarios for Select2 3.3.x and 4.0.13+wrapper.
 *
 * Each test function receives a context object with:
 *   - $container: jQuery element to append test DOM into
 *   - log(testName, passed, detail): function to record result
 *   - isV3: boolean, true if running against 3.3.x
 *
 * Tests must work identically on both versions when the wrapper is active.
 */
(function (window) {
    "use strict";

    var tests = [];

    function define(name, fn) {
        tests.push({ name: name, fn: fn });
    }

    // -------------------------------------------------------
    // TEST: Basic initialization with no options
    // -------------------------------------------------------
    define("Basic init: .select2() with no options", function (ctx) {
        var $sel = $('<select><option value="a">Alpha</option><option value="b">Beta</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            var hasInstance = !!$sel.data("select2");
            ctx.log(this.name, hasInstance, hasInstance ? "Instance created" : "No instance found");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: Init with placeholder and allowClear
    // -------------------------------------------------------
    define("Init with placeholder and allowClear", function (ctx) {
        var $sel = $('<select><option></option><option value="x">X</option><option value="y">Y</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2({ placeholder: "Pick one", allowClear: true });
            var hasInstance = !!$sel.data("select2");
            ctx.log(this.name, hasInstance, hasInstance ? "Placeholder init OK" : "Failed");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: select2("open") and select2("close")
    // -------------------------------------------------------
    define("Method: open / close", function (ctx) {
        var $sel = $('<select><option value="a">A</option><option value="b">B</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            $sel.select2("open");

            var isOpen;
            if (ctx.isV3) {
                isOpen = $sel.select2("opened");
            } else {
                isOpen = $sel.select2("opened");
            }

            $sel.select2("close");
            ctx.log(this.name, isOpen === true, "opened returned: " + isOpen);
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: select2("disable") and select2("enable")
    // -------------------------------------------------------
    define("Method: disable / enable", function (ctx) {
        var $sel = $('<select><option value="a">A</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            $sel.select2("disable");
            var disabled = $sel.prop("disabled") || $sel.is(":disabled");
            $sel.select2("enable");
            var enabled = !$sel.prop("disabled");
            var pass = disabled && enabled;
            ctx.log(this.name, pass, "disabled=" + disabled + ", re-enabled=" + enabled);
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: select2("data", obj) setter
    // -------------------------------------------------------
    define("Method: data setter - single object", function (ctx) {
        var $sel = $('<select><option value="a">Alpha</option><option value="b">Beta</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            $sel.select2("data", { id: "b", text: "Beta" });

            var val = $sel.val();
            var pass = val === "b";
            ctx.log(this.name, pass, "Expected 'b', got '" + val + "'");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: select2("data", obj) setter with new option
    // -------------------------------------------------------
    define("Method: data setter - creates missing option", function (ctx) {
        var $sel = $('<select><option value="a">Alpha</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            $sel.select2("data", { id: "new1", text: "Dynamically Added" });

            var val = $sel.val();
            var optionExists = $sel.find("option[value='new1']").length > 0;
            var pass = (val === "new1") && optionExists;
            ctx.log(this.name, pass, "val='" + val + "', option exists=" + optionExists);
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: select2("data") getter
    // -------------------------------------------------------
    define("Method: data getter", function (ctx) {
        var $sel = $('<select><option value="a">Alpha</option><option value="b" selected>Beta</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            var data = $sel.select2("data");

            var pass, detail;
            if (ctx.isV3) {
                pass = data && data.id === "b";
                detail = "data.id=" + (data ? data.id : "null");
            } else {
                pass = $.isArray(data) && data.length > 0 && data[0].id === "b";
                detail = "data[0].id=" + (data && data[0] ? data[0].id : "null");
            }
            ctx.log(this.name, pass, detail);
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: select2("destroy")
    // -------------------------------------------------------
    define("Method: destroy", function (ctx) {
        var $sel = $('<select><option value="a">A</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            var hadInstance = !!$sel.data("select2");
            $sel.select2("destroy");
            var gone = !$sel.data("select2");
            var pass = hadInstance && gone;
            ctx.log(this.name, pass, "had=" + hadInstance + ", gone=" + gone);
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: select2("container")
    // -------------------------------------------------------
    define("Method: container", function (ctx) {
        var $sel = $('<select><option value="a">A</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            var $c = $sel.select2("container");
            var pass = $c && $c.length > 0;
            ctx.log(this.name, pass, "container length=" + ($c ? $c.length : 0));
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: Unknown method does not crash
    // -------------------------------------------------------
    define("Unknown method: does not throw", function (ctx) {
        var $sel = $('<select><option value="a">A</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            $sel.select2("nonExistentMethod");
            ctx.log(this.name, true, "No crash");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Threw: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: maximumSelectionSize option
    // -------------------------------------------------------
    define("Option: maximumSelectionSize", function (ctx) {
        var $sel = $('<select multiple><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2({ maximumSelectionSize: 2 });
            var hasInstance = !!$sel.data("select2");
            ctx.log(this.name, hasInstance, hasInstance ? "Init OK with maximumSelectionSize" : "Failed");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: formatNoMatches option
    // -------------------------------------------------------
    define("Option: formatNoMatches", function (ctx) {
        var $sel = $('<select><option value="a">Alpha</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2({
                formatNoMatches: function () { return "Nothing here"; }
            });
            var hasInstance = !!$sel.data("select2");
            ctx.log(this.name, hasInstance, hasInstance ? "Init OK with formatNoMatches" : "Failed");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: formatSelection option
    // -------------------------------------------------------
    define("Option: formatSelection", function (ctx) {
        var called = false;
        var $sel = $('<select><option value="a" selected>Alpha</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2({
                formatSelection: function (data) {
                    called = true;
                    return "[" + data.text + "]";
                }
            });
            ctx.log(this.name, true, "Init OK, formatSelection called=" + called);
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: formatResult option
    // -------------------------------------------------------
    define("Option: formatResult", function (ctx) {
        var $sel = $('<select><option value="a">Alpha</option><option value="b">Beta</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2({
                formatResult: function (result, container, query, escapeMarkup) {
                    return ">> " + result.text;
                }
            });
            ctx.log(this.name, true, "Init OK with formatResult");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: matcher option (old 3-arg signature)
    // -------------------------------------------------------
    define("Option: matcher (old signature)", function (ctx) {
        var $sel = $('<select><option value="a">Alpha</option><option value="b">Beta</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2({
                matcher: function (term, text, option) {
                    return text.toLowerCase().indexOf(term.toLowerCase()) >= 0;
                }
            });
            ctx.log(this.name, true, "Init OK with old-style matcher");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: AJAX with 3.3.x config
    // -------------------------------------------------------
    define("Option: ajax (3.3.x config shape)", function (ctx) {
        var $sel = $('<select><option></option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2({
                placeholder: "Search...",
                minimumInputLength: 1,
                ajax: {
                    url: "https://httpbin.org/get",
                    dataType: "json",
                    quietMillis: 300,
                    data: function (term, page) {
                        return { q: term, p: page };
                    },
                    results: function (data, page) {
                        return { results: [], more: false };
                    }
                }
            });
            var hasInstance = !!$sel.data("select2");
            ctx.log(this.name, hasInstance, hasInstance ? "Init OK with 3.3.x ajax config" : "Failed");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: tags with array
    // -------------------------------------------------------
    define("Option: tags (array)", function (ctx) {
        var $sel;
        if (ctx.isV3) {
            $sel = $('<input type="hidden" />');
        } else {
            $sel = $('<select multiple><option value="red">red</option><option value="green">green</option><option value="blue">blue</option></select>');
        }
        ctx.$container.append($sel);
        try {
            if (ctx.isV3) {
                $sel.select2({ tags: ["red", "green", "blue"] });
            } else {
                $sel.select2({ tags: true });
            }
            var hasInstance = !!$sel.data("select2");
            ctx.log(this.name, hasInstance, hasInstance ? "Tags init OK" : "Failed");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: Event bridge - select2-open / select2-close
    // -------------------------------------------------------
    define("Event: select2-open fires on open", function (ctx) {
        var $sel = $('<select><option value="a">A</option><option value="b">B</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            var fired = false;
            $sel.on("select2-open", function () { fired = true; });
            $sel.select2("open");
            $sel.select2("close");

            ctx.log(this.name, fired, "select2-open fired=" + fired);
            $sel.off("select2-open");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: Event bridge - select2-close fires on close
    // -------------------------------------------------------
    define("Event: select2-close fires on close", function (ctx) {
        var $sel = $('<select><option value="a">A</option><option value="b">B</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            var fired = false;
            $sel.on("select2-close", function () { fired = true; });
            $sel.select2("open");
            $sel.select2("close");

            ctx.log(this.name, fired, "select2-close fired=" + fired);
            $sel.off("select2-close");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: Removed options do not crash
    // -------------------------------------------------------
    define("Removed options: openOnEnter, blurOnChange, loadMorePadding", function (ctx) {
        var $sel = $('<select><option value="a">A</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2({
                openOnEnter: true,
                blurOnChange: false,
                loadMorePadding: 10
            });
            var hasInstance = !!$sel.data("select2");
            ctx.log(this.name, hasInstance, hasInstance ? "Init OK, removed options ignored" : "Failed");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: No-op methods do not crash
    // -------------------------------------------------------
    define("No-op methods: onSortStart, onSortEnd, positionDropdown", function (ctx) {
        var $sel = $('<select><option value="a">A</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2();
            $sel.select2("onSortStart");
            $sel.select2("onSortEnd");
            $sel.select2("positionDropdown");
            ctx.log(this.name, true, "No crash");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: selectOnBlur option
    // -------------------------------------------------------
    define("Option: selectOnBlur", function (ctx) {
        var $sel = $('<select><option value="a">A</option></select>');
        ctx.$container.append($sel);
        try {
            $sel.select2({ selectOnBlur: true });
            var hasInstance = !!$sel.data("select2");
            ctx.log(this.name, hasInstance, hasInstance ? "Init OK with selectOnBlur" : "Failed");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // TEST: createSearchChoice option
    // -------------------------------------------------------
    define("Option: createSearchChoice", function (ctx) {
        var $sel;
        if (ctx.isV3) {
            $sel = $('<input type="hidden" />');
        } else {
            $sel = $('<select multiple></select>');
        }
        ctx.$container.append($sel);
        try {
            $sel.select2({
                tags: true,
                createSearchChoice: function (term) {
                    return { id: term, text: "Custom: " + term };
                }
            });
            var hasInstance = !!$sel.data("select2");
            ctx.log(this.name, hasInstance, hasInstance ? "Init OK with createSearchChoice" : "Failed");
            $sel.select2("destroy");
        } catch (e) {
            ctx.log(this.name, false, "Error: " + e.message);
        }
    });

    // -------------------------------------------------------
    // Expose
    // -------------------------------------------------------
    window.Select2CompatTests = {
        tests: tests,
        run: function ($container, isV3, logFn) {
            for (var i = 0; i < tests.length; i++) {
                var t = tests[i];
                var $section = $('<div class="test-section"></div>');
                $container.append($section);
                t.fn.call(t, {
                    $container: $section,
                    log: logFn,
                    isV3: isV3
                });
            }
        }
    };

})(window);
