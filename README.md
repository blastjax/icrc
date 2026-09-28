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

## Deploying (Lightsail + GitHub Actions)

`.github/workflows/deploy-ec2.yml` runs on every push to `main`, or on a manual dispatch. It builds
the image on GitHub Actions and pushes it to GHCR as `ghcr.io/blastjax/icrc-web`, then SSHes into the
Lightsail host to `git pull`, write `.env` from the repo secrets, pull the image and
`docker compose up -d`. It fails the job if the app doesn't report healthy.

The host is the Lightsail instance shared with the `blastjax` and `portfolio-film` sites. That instance
runs one shared Caddy, the **edge proxy**, which the `blastjax` repo owns (see its
`docker/edge/README.md`, which also covers the one-time move). The proxy terminates TLS for every site
there, so on that host:

- `docker-compose.edge.yml` attaches `web` to the shared `edge` network as `icrc-web`, and keeps this
  stack's own `caddy` off.
- `Caddyfile` is this site's block. The deploy installs it into the edge proxy as
  `/srv/edge/caddy/sites/icrc.caddy` and hot-reloads it.

The deploy picks the mode by itself. If the host has the edge proxy (`/srv/edge/bin/edge-install`
exists), it uses edge mode. Otherwise it falls back to the standalone stack with its own Caddy, as before.
If `APP_DIR` doesn't exist on the host yet, the first deploy checks the repo out there itself.

Secrets: `DEPLOY_HOST`, `DEPLOY_SSH_KEY` (the `ubuntu` user's key, the same as the `blastjax`
repo's on the shared host), `APP_USERNAME`, `APP_PASSWORD`, `APP_SECRET_KEY` and `DATABASE_URL`.
Variable: `APP_DIR` (e.g. `/home/ubuntu/icrc`).

## Building the standalone Windows executable

```
venv\Scripts\pyinstaller ICRC_Contract_Generator.spec
```

The bundled exe (`build/`, then `dist/`) embeds `templates/`, `static/`,
and `docx_templates/`; `data/` and `output/` are created next to the exe
at runtime.
