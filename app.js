"use strict";

// Renders data/edits.json as a sortable, filterable table. No dependencies:
// the original page pulled jQuery and tablesorter off a third-party host, which
// is both a privacy leak and a single point of failure for a static archive.
//
// Wrapped in an IIFE so nothing lands on `window`: a top-level `var status`
// silently aliases the legacy `window.status` string and every assignment to
// it throws under strict mode.
(function () {

var DESKTOP_DIFF = "https://pl.wikipedia.org/w/index.php?diff=prev&oldid=";
// useformat=mobile, not the pl.m. host: pl.m.wikipedia.org redirects /w/index.php
// straight to the desktop site even for a phone, which would make this link a
// duplicate of the one next to it. The mobile skin renders the diff inline and
// highlighted, which is the readable view the project's README points people at.
var MOBILE_DIFF = "https://pl.wikipedia.org/w/index.php?useformat=mobile&diff=prev&oldid=";
var WHOIS = "https://apps.db.ripe.net/db-web-ui/query?searchtext=";

var tbody = document.querySelector("#edits tbody");
var statusEl = document.getElementById("status");
var filterInput = document.getElementById("filter");

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

// "2015-02-10T06:20:00Z" -> "2015-02-10 06:20". Sorting still uses the raw
// value, so dropping the seconds here is purely cosmetic.
function shortTimestamp(timestamp) {
    return timestamp.slice(0, 16).replace("T", " ");
}

function renderRow(row) {
    var ip = row[0], rdns = row[1], title = row[2], timestamp = row[3], oldid = row[4];
    return "<tr>" +
        "<td>" + escapeHtml(ip) +
            " <a class=\"whois\" href=\"" + WHOIS + encodeURIComponent(ip) +
            "\" title=\"Sprawdź w rejestrze RIPE, do kogo należy ten adres\">[W]</a></td>" +
        "<td>" + escapeHtml(rdns) + "</td>" +
        "<td>" + escapeHtml(title) + "</td>" +
        "<td title=\"" + escapeHtml(timestamp) + "\">" +
            escapeHtml(shortTimestamp(timestamp)) + "</td>" +
        "<td><a href=\"" + MOBILE_DIFF + oldid +
            "\" title=\"czytelniejszy widok zmian\">LINK</a> " +
            "<a href=\"" + DESKTOP_DIFF + oldid + "\" title=\"wersja dwukolumnowa\">[2]</a></td>" +
        "</tr>";
}

function render() {
    var html = new Array(view.length);
    for (var i = 0; i < view.length; i++) {
        html[i] = renderRow(view[i]);
    }
    tbody.innerHTML = html.join("");

    if (view.length === rows.length) {
        statusEl.textContent = rows.length + " edycji";
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

function onHeaderClick(event) {
    var header = event.target.closest("th[data-column]");
    if (!header) {
        return;
    }
    var column = parseInt(header.dataset.column, 10);
    sortDescending = (column === sortColumn) ? !sortDescending : false;
    sortColumn = column;

    var headers = document.querySelectorAll("#edits th[data-column]");
    for (var i = 0; i < headers.length; i++) {
        headers[i].classList.remove("asc", "desc");
    }
    header.classList.add(sortDescending ? "desc" : "asc");

    sortView();
    render();
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
    render();
    filterInput.addEventListener("input", debounce(applyFilter, 150));
    document.querySelector("#edits thead").addEventListener("click", onHeaderClick);
}).catch(function (error) {
    statusEl.textContent = "Nie udało się wczytać danych: " + error.message;
});

})();
