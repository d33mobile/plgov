"use strict";

// Renders data/edits.json as a sortable, filterable table. No dependencies:
// the original page pulled jQuery and tablesorter off a third-party host, which
// is both a privacy leak and a single point of failure for a static archive.
//
// Wrapped in an IIFE so nothing lands on `window`: a top-level `var status`
// silently aliases the legacy `window.status` string and every assignment to
// it throws under strict mode.
(function () {

// The default link shows the visual diff: diffmode=visual renders the change as
// it appears in the article, with the edit highlighted, instead of as wikitext.
// useformat=mobile drops the desktop sidebar and tabs around it. Note this is
// not the pl.m. host -- pl.m.wikipedia.org redirects /w/index.php to the desktop
// site even for a phone, so the host alone selects nothing.
var VISUAL_DIFF =
    "https://pl.wikipedia.org/w/index.php?useformat=mobile&diffmode=visual&diff=prev&oldid=";
// The wikitext diff stays one click away, for edits where the markup is the point.
var SOURCE_DIFF = "https://pl.wikipedia.org/w/index.php?diffmode=source&diff=prev&oldid=";
var WHOIS = "https://apps.db.ripe.net/db-web-ui/query?searchtext=";

var body = document.getElementById("edits-body");
var statusEl = document.getElementById("status");
var filterInput = document.getElementById("filter");
var sortSelect = document.getElementById("sort");

var rows = [];
var view = [];
var sortColumn = null;
var sortDescending = false;

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// IPv4 sorts numerically, not lexicographically: 9.x must come before 145.x.
function ipKey(ip) {
    var parts = ip.split(".");
    var key = 0;
    for (var i = 0; i < 4; i++) {
        key = key * 256 + (parseInt(parts[i], 10) || 0);
    }
    return key;
}

// 1 edycja, 2-4 edycje, 5+ edycji -- and 12-14 go with the "many" form.
function plural(n, one, few, many) {
    if (n === 1) {
        return one;
    }
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return few;
    }
    return many;
}

// "2015-02-10T06:20:00Z" -> "2015-02-10 06:20". Sorting still uses the raw
// value, so dropping the seconds here is purely cosmetic.
function shortTimestamp(timestamp) {
    return timestamp.slice(0, 16).replace("T", " ");
}

// Title and links come first, then the metadata. On a narrow screen the .e-meta
// wrapper becomes a second line of its own; on a wide one it is display:contents
// so its children line up as ordinary grid columns. Either way nothing has to
// scroll sideways.
function renderRow(row) {
    var ip = row[0], rdns = row[1], title = row[2], timestamp = row[3], oldid = row[4];
    return "<div class=\"edit\" role=\"row\">" +
        "<span class=\"e-title\" role=\"cell\">" + escapeHtml(title) + "</span>" +
        "<span class=\"e-links\" role=\"cell\">" +
            "<a href=\"" + VISUAL_DIFF + oldid +
            "\" title=\"zmiana pokazana tak, jak wygląda w artykule\">LINK</a> " +
            "<a href=\"" + SOURCE_DIFF + oldid +
            "\" title=\"zmiana w kodzie źródłowym, dwie kolumny\">[kod]</a></span>" +
        "<span class=\"e-meta\">" +
            "<span class=\"e-ip\" role=\"cell\">" + escapeHtml(ip) +
                " <a class=\"whois\" href=\"" + WHOIS + encodeURIComponent(ip) +
                "\" title=\"Sprawdź w rejestrze RIPE, do kogo należy ten adres\">[W]</a></span>" +
            "<span class=\"e-rdns\" role=\"cell\">" + escapeHtml(rdns) + "</span>" +
            "<span class=\"e-date\" role=\"cell\" title=\"" + escapeHtml(timestamp) + "\">" +
                escapeHtml(shortTimestamp(timestamp)) + "</span>" +
        "</span>" +
        "</div>";
}

function render() {
    var html = new Array(view.length);
    for (var i = 0; i < view.length; i++) {
        html[i] = renderRow(view[i]);
    }
    body.innerHTML = html.join("");

    if (view.length === rows.length) {
        statusEl.textContent = rows.length + " " +
            plural(rows.length, "edycja", "edycje", "edycji");
    } else {
        statusEl.textContent = view.length + " z " + rows.length + " edycji";
    }
}

function applyFilter() {
    var needle = filterInput.value.trim().toLowerCase();
    if (needle === "") {
        view = rows.slice();
    } else {
        view = rows.filter(function (row) {
            return row[0].toLowerCase().indexOf(needle) !== -1 ||
                row[1].toLowerCase().indexOf(needle) !== -1 ||
                row[2].toLowerCase().indexOf(needle) !== -1;
        });
    }
    if (sortColumn !== null) {
        sortView();
    }
    render();
}

function sortView() {
    var column = sortColumn;
    var direction = sortDescending ? -1 : 1;
    view.sort(function (a, b) {
        var left = a[column], right = b[column];
        if (column === 0) {
            left = ipKey(left);
            right = ipKey(right);
            return left === right ? 0 : (left < right ? -direction : direction);
        }
        // Timestamps are ISO 8601 in UTC, so plain string order is chronological.
        return direction * left.localeCompare(right, "pl");
    });
}

// The header is hidden on narrow screens, where the two-line layout leaves
// nowhere to click, so the same sort is also driven by a <select>. Both entry
// points funnel through here and keep each other in sync.
function applySort(column, descending) {
    sortColumn = column;
    sortDescending = descending;

    var headers = document.querySelectorAll(".edits-head [data-column]");
    for (var i = 0; i < headers.length; i++) {
        var isActive = parseInt(headers[i].dataset.column, 10) === column;
        headers[i].classList.toggle("asc", isActive && !descending);
        headers[i].classList.toggle("desc", isActive && descending);
    }
    sortSelect.value = column === null
        ? ""
        : column + ":" + (descending ? "desc" : "asc");

    if (column === null) {
        applyFilter();
        return;
    }
    sortView();
    render();
}

function onHeaderClick(event) {
    var header = event.target.closest("[data-column]");
    if (!header) {
        return;
    }
    var column = parseInt(header.dataset.column, 10);
    applySort(column, column === sortColumn ? !sortDescending : false);
}

function onSortSelect() {
    if (sortSelect.value === "") {
        applySort(null, false);
        return;
    }
    var parts = sortSelect.value.split(":");
    applySort(parseInt(parts[0], 10), parts[1] === "desc");
}

function debounce(fn, delay) {
    var timer = null;
    return function () {
        clearTimeout(timer);
        timer = setTimeout(fn, delay);
    };
}

fetch("data/edits.json").then(function (response) {
    if (!response.ok) {
        throw new Error("HTTP " + response.status);
    }
    return response.json();
}).then(function (data) {
    rows = data.rows;
    view = rows.slice();
    // top.html links here as index.html?q=<title> to show one article's edits.
    var query = new URLSearchParams(location.search).get("q");
    if (query) {
        filterInput.value = query;
        applyFilter();
    } else {
        render();
    }
    filterInput.addEventListener("input", debounce(applyFilter, 150));
    sortSelect.addEventListener("change", onSortSelect);
    document.querySelector(".edits-head").addEventListener("click", onHeaderClick);
}).catch(function (error) {
    statusEl.textContent = "Nie udało się wczytać danych: " + error.message;
});

})();
