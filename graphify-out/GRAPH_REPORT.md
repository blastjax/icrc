# Graph Report - icrc  (2026-10-07)

## Corpus Check
- 18 files · ~24,230 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .spec 1, .bat 1)

## Summary
- 385 nodes · 852 edges · 32 communities (19 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `776d38ce`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- progress_tracker.js
- pm_db.py
- project.js
- docx_filler_wad.py
- app.py
- progress_export.py
- html-to-image.js
- _Cursor
- wad.js
- api_import_progress
- ICRC Contract Generator
- number-to-words.js
- progress_tracker_projects.js
- _invalidate_cache_on_write
- _connect
- route
- job_order.js
- _PooledConnection
- list_progress_items
- api_create_custom_field
- api_create_field_row
- api_delete_column
- api_delete_field_row
- api_delete_task
- api_list_payment_rows
- api_rename_column
- api_rename_progress_project
- api_rename_progress_week
- api_reorder_columns
- api_update_field_row
- api_update_payment_row

## God Nodes (most connected - your core abstractions)
1. `_connect()` - 40 edges
2. `e()` - 25 edges
3. `n()` - 25 edges
4. `api()` - 17 edges
5. `renderBoard()` - 16 edges
6. `startEditItem()` - 14 edges
7. `o()` - 13 edges
8. `_Cursor` - 10 edges
9. `_Conn` - 10 edges
10. `startEditWeek()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `api_create_task()` --calls--> `create_task()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_update_task()` --calls--> `update_task()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_move_task()` --calls--> `reorder_task()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_duplicate_task()` --calls--> `duplicate_task()`  [EXTRACTED]
  app.py → core/pm_db.py
- `api_import_progress()` --calls--> `get_progress_project()`  [EXTRACTED]
  app.py → core/pm_db.py

## Import Cycles
- None detected.

## Communities (32 total, 12 thin omitted)

### Community 0 - "progress_tracker.js"
Cohesion: 0.10
Nodes (49): addItem(), addWeek(), api(), buildCategoryCard(), buildMeter(), buildWeekCell(), closeSubcategoryModal(), codePlaceholderFor() (+41 more)

### Community 1 - "pm_db.py"
Cohesion: 0.15
Nodes (20): api_create_column(), api_update_progress_item(), _attach_custom_fields(), _attach_progress_entries(), _Conn, create_column(), create_task(), duplicate_task() (+12 more)

### Community 2 - "project.js"
Cohesion: 0.14
Nodes (34): addPaymentRow(), addTask(), api(), closeModal(), computePaymentTotals(), createColumn(), createFieldEl(), createFieldRowEl() (+26 more)

### Community 3 - "docx_filler_wad.py"
Cohesion: 0.14
Nodes (24): _fill_extra_swa_rows(), fill_template_wad(), _is_staff_per_diem(), _parse_amount(), prepare_wad_data(), _formatted_row(), Document, Fills bracketed placeholders in the WAD (Working Advance) template. The… (+16 more)

### Community 4 - "app.py"
Cohesion: 0.10
Nodes (26): api_export_progress_excel(), api_export_progress_pdf(), api_list_progress_weeks(), app_dir(), _check_credentials(), generate(), generate_wad(), _load_dotenv() (+18 more)

### Community 5 - "progress_export.py"
Cohesion: 0.23
Nodes (19): BytesIO, _build_category_card(), _build_category_cards_grid(), build_excel(), _build_meter(), _build_overall_card(), build_pdf(), _build_subcategory_row() (+11 more)

### Community 6 - "html-to-image.js"
Cohesion: 0.27
Nodes (29): a(), B(), c(), d(), e(), a(), c(), u() (+21 more)

### Community 7 - "_Cursor"
Cohesion: 0.17
Nodes (5): _Cursor, Mimics sqlite3.Row: supports both row[0] and row["col"], and dict(row) (via the…, Wraps a psycopg2 cursor: translates sqlite's `?` placeholders to `%s`, and…, _Row, tuple

### Community 8 - "wad.js"
Cohesion: 0.23
Nodes (9): addEntryBtn, addEntryRow(), applyPerDiemRule(), entriesContainer, entryRows(), entryTemplate, limitNote, updateAddButtonState() (+1 more)

### Community 9 - "api_import_progress"
Cohesion: 0.25
Nodes (7): api_import_progress(), parse(), Parses a tab-separated BOQ progress-tracker export (Item / Item Description /…, Returns (week_labels, rows). Raises ValueError if the file doesn't look like a…, _to_float(), Wipes a project's tracker (categories, subcategories, items, weeks, and…, replace_progress_data()

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

### Community 15 - "_connect"
Cohesion: 0.09
Nodes (23): api_create_payment_row(), api_create_progress_item(), api_create_progress_project(), api_delete_custom_field(), api_delete_payment_row(), api_delete_progress_item(), api_delete_progress_project(), api_delete_progress_week() (+15 more)

### Community 16 - "route"
Cohesion: 0.10
Nodes (21): api_create_progress_week(), api_create_task(), api_duplicate_task(), api_list_columns(), api_list_progress_projects(), api_list_tasks(), api_move_task(), api_rename_custom_field() (+13 more)

### Community 17 - "job_order.js"
Cohesion: 0.22
Nodes (10): el(), exec(), fileIcon(), recipients(), render(), renderAttachments(), renderRecipients(), showMessage() (+2 more)

### Community 18 - "_PooledConnection"
Cohesion: 0.29
Nodes (5): _checkout(), _PooledConnection, Takes a connection from the pool, swapping out any that died while idle. Fresh…, psycopg2 connection that remembers when it was last used, so _checkout() only…, PgConnection

### Community 19 - "list_progress_items"
Cohesion: 0.40
Nodes (5): api_list_progress_items(), list_progress_items(), _natural_code_key(), Splits a code like 'A1.10' into ('a', 1, '.', 10, '') so numeric runs sort by…, Alphabetical by Item code (e.g. A, A1, A2, B, BS1, BS2 — a category's code is…

## Knowledge Gaps
- **12 isolated node(s):** `ONES`, `TENS`, `entriesContainer`, `entryTemplate`, `addEntryBtn` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 79 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_Cursor` connect `_Cursor` to `pm_db.py`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `_Row` connect `_Cursor` to `pm_db.py`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `_connect()` connect `_connect` to `pm_db.py`, `app.py`, `api_import_progress`, `route`, `_PooledConnection`, `list_progress_items`, `api_create_custom_field`, `api_create_field_row`, `api_delete_column`, `api_delete_field_row`, `api_delete_task`, `api_list_payment_rows`, `api_rename_column`, `api_rename_progress_project`, `api_rename_progress_week`, `api_reorder_columns`, `api_update_field_row`, `api_update_payment_row`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `e()` (e.g. with `g()` and `x()`) actually correct?**
  _`e()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `n()` (e.g. with `g()` and `s()`) actually correct?**
  _`n()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ONES`, `TENS`, `entriesContainer` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `progress_tracker.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10431372549019607 - nodes in this community are weakly interconnected._