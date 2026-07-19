#!/usr/bin/env python3
"""Extract the edit list from mirror/index.html into data/edits.json.

mirror/index.html is a static snapshot of the old PHP+MySQL frontend and is the
only surviving copy of the dataset (the database is gone). This script turns it
into a compact JSON file consumed by the static site.

Output format (compact on purpose -- 6k records):

    {"columns": ["ip", "rdns", "title", "timestamp", "oldid"],
     "rows": [["145.237.2.210", "pro1.mf.gov.pl", "Tytul", "2015-02-10T06:20:00Z", 41759424], ...]}

Usage: python3 tools/extract_mirror.py [mirror/index.html] [data/edits.json]
"""

import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ROW_RE = re.compile(r"<tr>(.*?)</tr>", re.DOTALL)
TD_RE = re.compile(r"<td>(.*?)</td>", re.DOTALL)
IP_RE = re.compile(r"^\s*([0-9.]+)\s*<abbr")
OLDID_RE = re.compile(r"\?m=1&id=(\d+)")
IPV4_RE = re.compile(r"^(?:\d{1,3}\.){3}\d{1,3}$")
TIMESTAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def text(cell):
    """Strip tags and unescape HTML entities in a table cell."""
    return html.unescape(re.sub(r"<[^>]+>", "", cell)).strip()


def parse(source):
    rows = []
    for row in ROW_RE.findall(source):
        cells = TD_RE.findall(row)
        if len(cells) < 5:
            continue  # <thead> row: it only has <th>
        ip_match = IP_RE.search(cells[0])
        oldid_match = OLDID_RE.search(cells[4])
        if not ip_match or not oldid_match:
            raise ValueError("unparseable row: %r" % row[:200])
        rows.append([
            ip_match.group(1),
            text(cells[1]),
            text(cells[2]),
            text(cells[3]),
            int(oldid_match.group(1)),
        ])
    return rows


def verify(rows, expected_count=6115):
    problems = []
    if len(rows) != expected_count:
        problems.append("expected %d rows, got %d" % (expected_count, len(rows)))
    for i, (ip, rdns, title, timestamp, oldid) in enumerate(rows):
        if not IPV4_RE.match(ip):
            problems.append("row %d: bad ip %r" % (i, ip))
        if not title:
            problems.append("row %d: empty title" % i)
        if not TIMESTAMP_RE.match(timestamp):
            problems.append("row %d: bad timestamp %r" % (i, timestamp))
        if not isinstance(oldid, int) or oldid <= 0:
            problems.append("row %d: bad oldid %r" % (i, oldid))
    titles = {r[2] for r in rows}
    for expected_title in ("Czesław Miłosz", "Richard Dawkins"):
        if expected_title not in titles:
            problems.append("missing expected title %r (encoding broken?)" % expected_title)
    return problems


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "mirror", "index.html")
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "data", "edits.json")

    with open(src, encoding="utf-8") as fp:
        rows = parse(fp.read())

    problems = verify(rows)
    if problems:
        for problem in problems[:20]:
            sys.stderr.write("ERROR: %s\n" % problem)
        sys.stderr.write("%d problem(s) total, refusing to write output\n" % len(problems))
        return 1

    payload = {"columns": ["ip", "rdns", "title", "timestamp", "oldid"], "rows": rows}
    with open(dst, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, separators=(",", ":"))
        fp.write("\n")

    sys.stderr.write("wrote %d rows to %s (%d bytes)\n"
                     % (len(rows), dst, os.path.getsize(dst)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
