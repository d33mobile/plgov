# plgov — static site

This branch is the published site: <https://d33tah.github.io/plgov/>

It lists 6115 edits to the Polish Wikipedia made from IP addresses whose rDNS
ended in `.gov.pl`, as collected in February 2015. The research method and its
caveats are documented on the `master` branch, in
[README-PL.md](https://github.com/d33tah/plgov/blob/master/README-PL.md).

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `app.js`, `style.css` | the table: sortable, filterable, client-side |
| `random.html` | shows a random edit, embedded from Wikipedia |
| `data/edits.json` | the dataset (`{"columns": [...], "rows": [...]}`) |
| `tools/extract_mirror.py` | regenerates `data/edits.json` from `mirror/index.html` |
| `mirror/index.html` | archived snapshot of the old PHP page — the data's provenance |
| `privacy.html`, `rules.html` | privacy policy and terms |

## Regenerating the data

    python3 tools/extract_mirror.py

The script refuses to write output unless the extraction still yields 6115
well-formed rows, so a silent regression is not possible.

## No backend

The site used to run on PHP and MySQL. That database is gone, and
`mirror/index.html` — a rendered snapshot of the old page — is the only
surviving copy of the data. Everything here is served as static files, with no
third-party assets: the page makes zero external requests until you click a
link to Wikipedia.

Two things were lost with the backend and cannot be restored:

- the per-edit view counter (its numbers were never captured in the snapshot),
- the redirect tracker; links now point straight at Wikipedia.

The row order in `data/edits.json` is the order the snapshot was rendered in,
which the old page sorted by view count — so it still roughly reflects what was
popular in 2015.
