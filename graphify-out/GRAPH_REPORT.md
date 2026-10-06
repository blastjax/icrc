# Graph Report - icrc  (2026-10-06)

## Corpus Check
- 16 files · ~21,592 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .spec 1, .bat 1)

## Summary
- 339 nodes · 711 edges · 14 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e6dbb798`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- progress_tracker.js
- pm_db.py
- project.js
- docx_filler_wad.py
- app.py
- progress_export.py
- _Cursor
- wad.js
- parse
- ICRC Contract Generator
- number-to-words.js
- progress_tracker_projects.js
- _invalidate_cache_on_write

## God Nodes (most connected - your core abstractions)
1. `_connect()` - 40 edges
2. `api()` - 17 edges
3. `renderBoard()` - 16 edges
4. `startEditItem()` - 14 edges
5. `_Cursor` - 10 edges
6. `_Conn` - 10 edges
7. `startEditWeek()` - 10 edges
8. `prepare_wad_data()` - 9 edges
9. `fill_placeholders()` - 9 edges
10. `_build_category_card()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `api_create_column()` --calls--> `create_column()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_reorder_columns()` --calls--> `reorder_columns()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_rename_column()` --calls--> `rename_column()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_delete_column()` --calls--> `delete_column()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_create_task()` --calls--> `create_task()`  [EXTRACTED]
  app.py → core/pm_db.py

## Import Cycles
- None detected.

## Communities (14 total, 0 thin omitted)

### Community 0 - "progress_tracker.js"
Cohesion: 0.10
Nodes (49): addItem(), addWeek(), api(), buildCategoryCard(), buildMeter(), buildWeekCell(), closeSubcategoryModal(), codePlaceholderFor() (+41 more)

### Community 1 - "pm_db.py"
Cohesion: 0.06
Nodes (57): _attach_custom_fields(), _attach_progress_entries(), _checkout(), _Conn, _connect(), create_column(), create_custom_field(), create_field_row() (+49 more)

### Community 2 - "project.js"
Cohesion: 0.14
Nodes (34): addPaymentRow(), addTask(), api(), closeModal(), computePaymentTotals(), createColumn(), createFieldEl(), createFieldRowEl() (+26 more)

### Community 3 - "docx_filler_wad.py"
Cohesion: 0.11
Nodes (31): fill_template(), prepare_replacements(), Fills bracketed placeholders (e.g. ``[Contractor Name]``) in the Contract for…, Normalizes raw request data into the final placeholder -> text map used for…, Fills the Contract for Works template with the given data and writes the result…, _fill_extra_swa_rows(), fill_template_wad(), _is_staff_per_diem() (+23 more)

### Community 4 - "app.py"
Cohesion: 0.06
Nodes (63): api_create_column(), api_create_custom_field(), api_create_field_row(), api_create_payment_row(), api_create_progress_item(), api_create_progress_project(), api_create_progress_week(), api_create_task() (+55 more)

### Community 5 - "progress_export.py"
Cohesion: 0.23
Nodes (19): BytesIO, _build_category_card(), _build_category_cards_grid(), build_excel(), _build_meter(), _build_overall_card(), build_pdf(), _build_subcategory_row() (+11 more)

### Community 7 - "_Cursor"
Cohesion: 0.16
Nodes (5): _Cursor, Mimics sqlite3.Row: supports both row[0] and row["col"], and dict(row) (via the…, Wraps a psycopg2 cursor: translates sqlite's `?` placeholders to `%s`, and…, _Row, tuple

### Community 8 - "wad.js"
Cohesion: 0.23
Nodes (9): addEntryBtn, addEntryRow(), applyPerDiemRule(), entriesContainer, entryRows(), entryTemplate, limitNote, updateAddButtonState() (+1 more)

### Community 9 - "parse"
Cohesion: 0.40
Nodes (4): parse(), Parses a tab-separated BOQ progress-tracker export (Item / Item Description /…, Returns (week_labels, rows). Raises ValueError if the file doesn't look like a…, _to_float()

### Community 10 - "ICRC Contract Generator"
Cohesion: 0.25
Nodes (7): Building the standalone Windows executable, Deploying (Lightsail + GitHub Actions), Features, ICRC Contract Generator, Project layout, Running locally, Running with Docker

### Community 11 - "number-to-words.js"
Cohesion: 0.39
Nodes (7): chunkToWords(), formatMoneyInput(), formatWithApostrophes(), numberToWords(), ONES, parseAmount(), TENS

### Community 12 - "progress_tracker_projects.js"
Cohesion: 0.50
Nodes (7): api(), buildMeter(), buildProjectCard(), init(), renderAddProjectControl(), renderProjects(), severityFor()

### Community 13 - "_invalidate_cache_on_write"
Cohesion: 0.40
Nodes (5): after_request, _invalidate_cache_on_write(), Any write under /api/ can change what the cached list endpoints below would…, invalidate_all(), Flushes every cached key. Called after any write.

## Knowledge Gaps
- **12 isolated node(s):** `ONES`, `TENS`, `entriesContainer`, `entryTemplate`, `addEntryBtn` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 75 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_Cursor` connect `_Cursor` to `pm_db.py`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `_Row` connect `_Cursor` to `pm_db.py`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `_connect()` connect `pm_db.py` to `app.py`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `ONES`, `TENS`, `entriesContainer` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `progress_tracker.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10431372549019607 - nodes in this community are weakly interconnected._
- **Should `pm_db.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06174863387978142 - nodes in this community are weakly interconnected._
- **Should `project.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14114114114114115 - nodes in this community are weakly interconnected._