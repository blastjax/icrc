# Graph Report - icrc  (2026-10-06)

## Corpus Check
- 16 files · ~21,288 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .spec 1, .bat 1)

## Summary
- 335 nodes · 707 edges · 28 communities (20 shown, 7 thin omitted)
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
- _Conn
- _Cursor
- wad.js
- parse
- ICRC Contract Generator
- number-to-words.js
- progress_tracker_projects.js
- _invalidate_cache_on_write
- docx_filler.py
- create_progress_item
- route
- list_progress_items
- create_column
- api_delete_column
- api_delete_custom_field
- api_delete_task
- api_rename_column
- api_list_payment_rows
- api_rename_progress_week
- api_update_payment_row
- app_dir

## God Nodes (most connected - your core abstractions)
1. `_connect()` - 39 edges
2. `api()` - 17 edges
3. `renderBoard()` - 16 edges
4. `startEditItem()` - 14 edges
5. `_Conn` - 12 edges
6. `_Cursor` - 10 edges
7. `startEditWeek()` - 10 edges
8. `prepare_wad_data()` - 9 edges
9. `fill_placeholders()` - 9 edges
10. `_build_category_card()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `api_import_progress()` --calls--> `parse()`  [EXTRACTED]
  app.py → core/boq_import.py
- `api_import_progress()` --calls--> `replace_progress_data()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_export_progress_excel()` --calls--> `list_progress_items()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_export_progress_excel()` --calls--> `build_excel()`  [EXTRACTED]
  app.py → core/progress_export.py
- `api_export_progress_pdf()` --calls--> `list_progress_items()`  [EXTRACTED]
  app.py → core/pm_db.py

## Import Cycles
- None detected.

## Communities (28 total, 7 thin omitted)

### Community 0 - "progress_tracker.js"
Cohesion: 0.10
Nodes (49): addItem(), addWeek(), api(), buildCategoryCard(), buildMeter(), buildWeekCell(), closeSubcategoryModal(), codePlaceholderFor() (+41 more)

### Community 1 - "pm_db.py"
Cohesion: 0.09
Nodes (32): api_create_field_row(), api_create_payment_row(), api_create_progress_project(), api_create_progress_week(), api_delete_field_row(), api_delete_payment_row(), api_delete_progress_project(), api_delete_progress_week() (+24 more)

### Community 2 - "project.js"
Cohesion: 0.14
Nodes (34): addPaymentRow(), addTask(), api(), closeModal(), computePaymentTotals(), createColumn(), createFieldEl(), createFieldRowEl() (+26 more)

### Community 3 - "docx_filler_wad.py"
Cohesion: 0.14
Nodes (22): _fill_extra_swa_rows(), fill_template_wad(), _is_staff_per_diem(), _parse_amount(), prepare_wad_data(), _formatted_row(), Document, Fills bracketed placeholders in the WAD (Working Advance) template. The… (+14 more)

### Community 4 - "app.py"
Cohesion: 0.18
Nodes (16): api_export_progress_excel(), api_export_progress_pdf(), api_import_progress(), api_list_progress_weeks(), _check_credentials(), generate(), generate_wad(), login() (+8 more)

### Community 5 - "progress_export.py"
Cohesion: 0.23
Nodes (19): BytesIO, _build_category_card(), _build_category_cards_grid(), build_excel(), _build_meter(), _build_overall_card(), build_pdf(), _build_subcategory_row() (+11 more)

### Community 6 - "_Conn"
Cohesion: 0.10
Nodes (20): api_create_task(), api_duplicate_task(), api_move_task(), api_update_task(), _attach_custom_fields(), _Conn, create_task(), duplicate_task() (+12 more)

### Community 7 - "_Cursor"
Cohesion: 0.17
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
Cohesion: 0.29
Nodes (6): after_request, _invalidate_cache_on_write(), Any write under /api/ can change what the cached list endpoints below would…, invalidate_all(), Redis-backed cache for read-heavy board/tracker queries (columns, tasks,…, Flushes every cached key. Called after any write.

### Community 15 - "docx_filler.py"
Cohesion: 0.27
Nodes (9): fill_template(), prepare_replacements(), Fills bracketed placeholders (e.g. ``[Contractor Name]``) in the Contract for…, Normalizes raw request data into the final placeholder -> text map used for…, Fills the Contract for Works template with the given data and writes the result…, format_date(), format_money(), Accepts an ISO date (YYYY-MM-DD) or a plain string and returns a human readable… (+1 more)

### Community 16 - "create_progress_item"
Cohesion: 0.67
Nodes (3): api_create_progress_item(), create_progress_item(), level: 0 = category, 1 = subcategory (tied to the category above it), 2 = leaf…

### Community 17 - "route"
Cohesion: 0.12
Nodes (18): api_create_custom_field(), api_delete_progress_item(), api_list_columns(), api_list_progress_projects(), api_list_tasks(), api_rename_custom_field(), api_update_field_row(), index() (+10 more)

### Community 18 - "list_progress_items"
Cohesion: 0.40
Nodes (5): api_list_progress_items(), list_progress_items(), _natural_code_key(), Splits a code like 'A1.10' into ('a', 1, '.', 10, '') so numeric runs sort by…, Alphabetical by Item code (e.g. A, A1, A2, B, BS1, BS2 — a category's code is…

### Community 19 - "create_column"
Cohesion: 0.67
Nodes (3): api_create_column(), create_column(), _slugify()

### Community 27 - "app_dir"
Cohesion: 0.33
Nodes (4): app_dir(), _load_dotenv(), Writable directory next to the running script/executable, used for generated…, Minimal .env loader for local dev (`python app.py`); in Docker these vars…

## Knowledge Gaps
- **12 isolated node(s):** `ONES`, `TENS`, `entriesContainer`, `entryTemplate`, `addEntryBtn` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 74 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_Cursor` connect `_Cursor` to `pm_db.py`, `_Conn`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `_Row` connect `_Cursor` to `pm_db.py`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `_connect()` connect `pm_db.py` to `app.py`, `_Conn`, `create_progress_item`, `route`, `list_progress_items`, `create_column`, `api_delete_column`, `api_delete_custom_field`, `api_delete_task`, `api_rename_column`, `api_list_payment_rows`, `api_rename_progress_week`, `api_update_payment_row`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `ONES`, `TENS`, `entriesContainer` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `progress_tracker.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10431372549019607 - nodes in this community are weakly interconnected._
- **Should `pm_db.py` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `project.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14114114114114115 - nodes in this community are weakly interconnected._