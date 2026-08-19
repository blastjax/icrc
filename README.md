# ICRC Contract Generator

A local Flask app for generating ICRC contract documents from Word
templates, plus a project management board and a BOQ progress tracker.

## Features

- **Contract for Works** and **WAD (Working Advance Document)** generation
  — fills bracketed placeholders in the source `.docx` templates while
  preserving their original formatting.
- **Project management board** — a Kanban-style task board with custom
  fields and payment tracking, backed by a local SQLite database.
- **Progress tracker** — import a tab-separated BOQ export, track weekly
  completion per item, and export the result to Excel or PDF.

## Project layout

```
app.py                 Flask entry point and routes
core/                  Application logic (importable package)
  docx_utils.py          Shared placeholder-filling helpers
  docx_filler.py          Contract for Works template filler
  docx_filler_wad.py       WAD template filler
  boq_import.py          BOQ export parser
  pm_db.py               SQLite persistence for the PM board / tracker
  progress_export.py     Excel / PDF export for the progress tracker
docx_templates/        Source .docx templates (Contract, WAD)
templates/             Flask/Jinja HTML templates
static/                CSS/JS assets
data/                  SQLite database (created at runtime, not tracked)
output/                Generated documents (created at runtime, not tracked)
```

## Running locally

```
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python app.py
```

Then open http://127.0.0.1:5000/.

On Windows, `Run ICRC Contract Generator.bat` does the same (creating the
venv and installing dependencies on first run, then pulling the latest
version via `git pull` before starting).

## Running with Docker

```
docker compose up --build
```

The app is served on http://localhost:3001/ (mapped to container port
5000). `data/` and `output/` are mounted as volumes so the database and
generated documents persist across container restarts.

## Building the standalone Windows executable

```
venv\Scripts\pyinstaller ICRC_Contract_Generator.spec
```

The bundled exe (`build/`, then `dist/`) embeds `templates/`, `static/`,
and `docx_templates/`; `data/` and `output/` are created next to the exe
at runtime.
