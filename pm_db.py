"""SQLite-backed storage for the Project Management board (tasks, column
titles, and per-task custom fields), so board state survives app restarts
instead of living only in the browser's localStorage."""

from __future__ import annotations

import re
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

_db_path: str | None = None


def init_db(db_path: str) -> None:
    """Creates the tables (if needed). Must be called once, before any
    other function here."""
    global _db_path
    _db_path = db_path

    with _connect() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS columns (
                key TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                position INTEGER NOT NULL
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0
            )"""
        )

        task_columns = {row[1] for row in conn.execute("PRAGMA table_info(tasks)")}
        if "position" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0")
            for status_row in conn.execute("SELECT DISTINCT status FROM tasks"):
                task_ids = [
                    r[0]
                    for r in conn.execute(
                        "SELECT id FROM tasks WHERE status = ? ORDER BY created_at", (status_row[0],)
                    )
                ]
                for position, task_id in enumerate(task_ids):
                    conn.execute("UPDATE tasks SET position = ? WHERE id = ?", (position, task_id))
        conn.execute(
            """CREATE TABLE IF NOT EXISTS custom_fields (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                name TEXT NOT NULL,
                position INTEGER NOT NULL
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS custom_field_rows (
                id TEXT PRIMARY KEY,
                field_id TEXT NOT NULL,
                name TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                url TEXT NOT NULL DEFAULT '',
                position INTEGER NOT NULL
            )"""
        )

        row_columns = {row[1] for row in conn.execute("PRAGMA table_info(custom_field_rows)")}
        if "url" not in row_columns:
            conn.execute("ALTER TABLE custom_field_rows ADD COLUMN url TEXT NOT NULL DEFAULT ''")

        conn.execute(
            """CREATE TABLE IF NOT EXISTS payment_rows (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                payment_no TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                pam_iris REAL NOT NULL DEFAULT 0,
                cdp_chf REAL NOT NULL DEFAULT 0,
                invoice_amount REAL NOT NULL DEFAULT 0,
                expected_date TEXT NOT NULL DEFAULT '',
                payment_status TEXT NOT NULL DEFAULT '',
                invoice_link TEXT NOT NULL DEFAULT '',
                position INTEGER NOT NULL
            )"""
        )

        conn.execute(
            """CREATE TABLE IF NOT EXISTS progress_projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS progress_weeks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL DEFAULT '',
                label TEXT NOT NULL DEFAULT '',
                position INTEGER NOT NULL
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS progress_items (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL DEFAULT '',
                code TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                unit TEXT NOT NULL DEFAULT '',
                suggested_quantity REAL NOT NULL DEFAULT 0,
                project_cost_percent REAL NOT NULL DEFAULT 0,
                is_category INTEGER NOT NULL DEFAULT 0,
                position INTEGER NOT NULL
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS progress_entries (
                id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL,
                week_id TEXT NOT NULL,
                progress_percent REAL NOT NULL DEFAULT 0,
                UNIQUE(item_id, week_id)
            )"""
        )

        progress_week_columns = {row[1] for row in conn.execute("PRAGMA table_info(progress_weeks)")}
        if "project_id" not in progress_week_columns:
            conn.execute("ALTER TABLE progress_weeks ADD COLUMN project_id TEXT NOT NULL DEFAULT ''")

        progress_item_columns = {row[1] for row in conn.execute("PRAGMA table_info(progress_items)")}
        if "project_id" not in progress_item_columns:
            conn.execute("ALTER TABLE progress_items ADD COLUMN project_id TEXT NOT NULL DEFAULT ''")

        # level: 0 = category (e.g. "A GENERAL"), 1 = subcategory tied to a
        # category (e.g. "BS1 Conduits"), 2 = leaf item carrying real Unit /
        # Quantity / Cost / progress data. Backfill from the older
        # is_category flag (1 -> category, 0 -> item); it's left in the
        # table unused rather than dropped.
        if "level" not in progress_item_columns:
            conn.execute("ALTER TABLE progress_items ADD COLUMN level INTEGER NOT NULL DEFAULT 2")
            conn.execute("UPDATE progress_items SET level = 0 WHERE is_category = 1")
            conn.execute("UPDATE progress_items SET level = 2 WHERE is_category = 0")

        # Adopt any weeks/items created before projects existed into a
        # default project, so already-entered tracker data isn't orphaned.
        orphan_weeks = conn.execute("SELECT COUNT(*) FROM progress_weeks WHERE project_id = ''").fetchone()[0]
        orphan_items = conn.execute("SELECT COUNT(*) FROM progress_items WHERE project_id = ''").fetchone()[0]
        if orphan_weeks or orphan_items:
            default_project_id = uuid.uuid4().hex
            conn.execute(
                "INSERT INTO progress_projects (id, name) VALUES (?, ?)",
                (default_project_id, "Untitled Project"),
            )
            conn.execute("UPDATE progress_weeks SET project_id = ? WHERE project_id = ''", (default_project_id,))
            conn.execute("UPDATE progress_items SET project_id = ? WHERE project_id = ''", (default_project_id,))

        payment_columns = {row[1]: row[2] for row in conn.execute("PRAGMA table_info(payment_rows)")}
        if payment_columns.get("pam_iris") == "TEXT":
            conn.execute("ALTER TABLE payment_rows RENAME TO payment_rows_old")
            conn.execute(
                """CREATE TABLE payment_rows (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    payment_no TEXT NOT NULL DEFAULT '',
                    description TEXT NOT NULL DEFAULT '',
                    pam_iris REAL NOT NULL DEFAULT 0,
                    cdp_chf REAL NOT NULL DEFAULT 0,
                    invoice_amount REAL NOT NULL DEFAULT 0,
                    expected_date TEXT NOT NULL DEFAULT '',
                    payment_status TEXT NOT NULL DEFAULT '',
                    invoice_link TEXT NOT NULL DEFAULT '',
                    position INTEGER NOT NULL
                )"""
            )
            conn.execute(
                """INSERT INTO payment_rows
                    SELECT id, task_id, payment_no, description,
                           CAST(pam_iris AS REAL), cdp_chf, invoice_amount,
                           expected_date, payment_status, invoice_link, position
                    FROM payment_rows_old"""
            )
            conn.execute("DROP TABLE payment_rows_old")


@contextmanager
def _connect():
    conn = sqlite3.connect(_db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _insert_task(conn: sqlite3.Connection, title: str, status: str, description: str = "") -> dict:
    position = conn.execute(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM tasks WHERE status = ?", (status,)
    ).fetchone()[0]
    task = {
        "id": uuid.uuid4().hex,
        "title": title,
        "description": description,
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "position": position,
    }
    conn.execute(
        "INSERT INTO tasks (id, title, description, status, created_at, position) VALUES (?, ?, ?, ?, ?, ?)",
        (task["id"], task["title"], task["description"], task["status"], task["created_at"], task["position"]),
    )
    return task


def _attach_custom_fields(conn: sqlite3.Connection, task: dict) -> dict:
    field_rows = conn.execute(
        "SELECT * FROM custom_fields WHERE task_id = ? ORDER BY position", (task["id"],)
    ).fetchall()
    fields = []
    for field_row in field_rows:
        field = dict(field_row)
        row_rows = conn.execute(
            "SELECT * FROM custom_field_rows WHERE field_id = ? ORDER BY position", (field["id"],)
        ).fetchall()
        field["rows"] = [dict(r) for r in row_rows]
        fields.append(field)
    task["custom_fields"] = fields
    return task


def list_columns() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT key, title FROM columns ORDER BY position").fetchall()
        return [dict(row) for row in rows]


def rename_column(key: str, title: str) -> dict | None:
    with _connect() as conn:
        cur = conn.execute("UPDATE columns SET title = ? WHERE key = ?", (title, key))
        if cur.rowcount == 0:
            return None
        return {"key": key, "title": title}


def delete_column(key: str) -> bool | None:
    with _connect() as conn:
        if conn.execute("SELECT 1 FROM columns WHERE key = ?", (key,)).fetchone() is None:
            return None
        task_count = conn.execute("SELECT COUNT(*) FROM tasks WHERE status = ?", (key,)).fetchone()[0]
        if task_count > 0:
            raise ValueError(f"Column still has {task_count} task(s); move or delete them first")
        cur = conn.execute("DELETE FROM columns WHERE key = ?", (key,))
        return cur.rowcount > 0


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "column"


def reorder_columns(order: list[str]) -> list[dict]:
    with _connect() as conn:
        for position, key in enumerate(order):
            conn.execute("UPDATE columns SET position = ? WHERE key = ?", (position, key))
        rows = conn.execute("SELECT key, title FROM columns ORDER BY position").fetchall()
        return [dict(row) for row in rows]


def create_column(title: str) -> dict:
    with _connect() as conn:
        existing_keys = {row[0] for row in conn.execute("SELECT key FROM columns")}
        base_key = _slugify(title)
        key = base_key
        suffix = 2
        while key in existing_keys:
            key = f"{base_key}-{suffix}"
            suffix += 1

        next_position = conn.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM columns").fetchone()[0]
        conn.execute(
            "INSERT INTO columns (key, title, position) VALUES (?, ?, ?)",
            (key, title, next_position),
        )
        return {"key": key, "title": title}


def list_tasks() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM tasks ORDER BY status, position").fetchall()
        return [_attach_custom_fields(conn, dict(row)) for row in rows]


def create_task(title: str, status: str, description: str = "") -> dict:
    with _connect() as conn:
        task = _insert_task(conn, title, status, description)
        return _attach_custom_fields(conn, task)


def update_task(task_id: str, title: str | None = None, description: str | None = None, status: str | None = None) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            return None
        task = dict(row)
        if title is not None:
            task["title"] = title
        if description is not None:
            task["description"] = description
        if status is not None and status != task["status"]:
            _relocate_task(conn, task_id, task["status"], status, index=None)
            task["status"] = status
        conn.execute(
            "UPDATE tasks SET title = ?, description = ?, status = ? WHERE id = ?",
            (task["title"], task["description"], task["status"], task_id),
        )
        return _attach_custom_fields(conn, task)


def _relocate_task(conn: sqlite3.Connection, task_id: str, old_status: str, new_status: str, index: int | None) -> None:
    """Places `task_id` into `new_status` at `index` (end of column if
    None), then reassigns 0..n-1 positions for both the destination column
    and (if different) the now-vacated source column so positions stay
    contiguous."""
    dest_ids = [
        r[0]
        for r in conn.execute(
            "SELECT id FROM tasks WHERE status = ? AND id != ? ORDER BY position", (new_status, task_id)
        )
    ]
    if index is None:
        index = len(dest_ids)
    index = max(0, min(index, len(dest_ids)))
    dest_ids.insert(index, task_id)
    for position, tid in enumerate(dest_ids):
        conn.execute("UPDATE tasks SET position = ? WHERE id = ?", (position, tid))

    if new_status != old_status:
        source_ids = [
            r[0] for r in conn.execute("SELECT id FROM tasks WHERE status = ? ORDER BY position", (old_status,))
        ]
        for position, tid in enumerate(source_ids):
            conn.execute("UPDATE tasks SET position = ? WHERE id = ?", (position, tid))


def reorder_task(task_id: str, status: str, index: int) -> dict | None:
    """Moves a task to `status` column at `index` (0-based), used for
    drag-and-drop reordering within or across columns."""
    with _connect() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            return None
        old_status = row["status"]
        _relocate_task(conn, task_id, old_status, status, index)
        if status != old_status:
            conn.execute("UPDATE tasks SET status = ? WHERE id = ?", (status, task_id))
        updated = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return _attach_custom_fields(conn, dict(updated))


def duplicate_task(task_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            return None
        original = dict(row)

        new_task = _insert_task(
            conn,
            title=f"{original['title']} (Copy)",
            status=original["status"],
            description=original["description"],
        )

        field_rows = conn.execute(
            "SELECT * FROM custom_fields WHERE task_id = ? ORDER BY position", (task_id,)
        ).fetchall()
        for field_row in field_rows:
            field = dict(field_row)
            new_field_id = uuid.uuid4().hex
            conn.execute(
                "INSERT INTO custom_fields (id, task_id, name, position) VALUES (?, ?, ?, ?)",
                (new_field_id, new_task["id"], field["name"], field["position"]),
            )
            row_rows = conn.execute(
                "SELECT * FROM custom_field_rows WHERE field_id = ? ORDER BY position", (field["id"],)
            ).fetchall()
            for row_row in row_rows:
                copied_row = dict(row_row)
                conn.execute(
                    "INSERT INTO custom_field_rows (id, field_id, name, note, url, position) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        uuid.uuid4().hex,
                        new_field_id,
                        copied_row["name"],
                        copied_row["note"],
                        copied_row["url"],
                        copied_row["position"],
                    ),
                )

        payment_rows = conn.execute(
            "SELECT * FROM payment_rows WHERE task_id = ? ORDER BY position", (task_id,)
        ).fetchall()
        for payment_row in payment_rows:
            copied = dict(payment_row)
            conn.execute(
                """INSERT INTO payment_rows
                    (id, task_id, payment_no, description, pam_iris, cdp_chf, invoice_amount,
                     expected_date, payment_status, invoice_link, position)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    uuid.uuid4().hex, new_task["id"], copied["payment_no"], copied["description"],
                    copied["pam_iris"], copied["cdp_chf"], copied["invoice_amount"],
                    copied["expected_date"], copied["payment_status"], copied["invoice_link"],
                    copied["position"],
                ),
            )

        return _attach_custom_fields(conn, new_task)


def delete_task(task_id: str) -> bool:
    with _connect() as conn:
        field_ids = [r[0] for r in conn.execute("SELECT id FROM custom_fields WHERE task_id = ?", (task_id,))]
        for field_id in field_ids:
            conn.execute("DELETE FROM custom_field_rows WHERE field_id = ?", (field_id,))
        conn.execute("DELETE FROM custom_fields WHERE task_id = ?", (task_id,))
        conn.execute("DELETE FROM payment_rows WHERE task_id = ?", (task_id,))
        cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return cur.rowcount > 0


def create_custom_field(task_id: str, name: str) -> dict | None:
    with _connect() as conn:
        if conn.execute("SELECT 1 FROM tasks WHERE id = ?", (task_id,)).fetchone() is None:
            return None
        position = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM custom_fields WHERE task_id = ?", (task_id,)
        ).fetchone()[0]
        field_id = uuid.uuid4().hex
        conn.execute(
            "INSERT INTO custom_fields (id, task_id, name, position) VALUES (?, ?, ?, ?)",
            (field_id, task_id, name, position),
        )
        return {"id": field_id, "task_id": task_id, "name": name, "rows": []}


def rename_custom_field(field_id: str, name: str) -> dict | None:
    with _connect() as conn:
        cur = conn.execute("UPDATE custom_fields SET name = ? WHERE id = ?", (name, field_id))
        if cur.rowcount == 0:
            return None
        return {"id": field_id, "name": name}


def delete_custom_field(field_id: str) -> bool:
    with _connect() as conn:
        conn.execute("DELETE FROM custom_field_rows WHERE field_id = ?", (field_id,))
        cur = conn.execute("DELETE FROM custom_fields WHERE id = ?", (field_id,))
        return cur.rowcount > 0


def create_field_row(field_id: str, name: str, note: str = "", url: str = "") -> dict | None:
    with _connect() as conn:
        if conn.execute("SELECT 1 FROM custom_fields WHERE id = ?", (field_id,)).fetchone() is None:
            return None
        position = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM custom_field_rows WHERE field_id = ?", (field_id,)
        ).fetchone()[0]
        row_id = uuid.uuid4().hex
        conn.execute(
            "INSERT INTO custom_field_rows (id, field_id, name, note, url, position) VALUES (?, ?, ?, ?, ?, ?)",
            (row_id, field_id, name, note, url, position),
        )
        return {"id": row_id, "field_id": field_id, "name": name, "note": note, "url": url}


def update_field_row(row_id: str, name: str | None = None, note: str | None = None, url: str | None = None) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM custom_field_rows WHERE id = ?", (row_id,)).fetchone()
        if row is None:
            return None
        data = dict(row)
        if name is not None:
            data["name"] = name
        if note is not None:
            data["note"] = note
        if url is not None:
            data["url"] = url
        conn.execute(
            "UPDATE custom_field_rows SET name = ?, note = ?, url = ? WHERE id = ?",
            (data["name"], data["note"], data["url"], row_id),
        )
        return data


def delete_field_row(row_id: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM custom_field_rows WHERE id = ?", (row_id,))
        return cur.rowcount > 0


def list_payment_rows(task_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM payment_rows WHERE task_id = ? ORDER BY position", (task_id,)
        ).fetchall()
        return [dict(row) for row in rows]


def create_payment_row(task_id: str) -> dict | None:
    with _connect() as conn:
        if conn.execute("SELECT 1 FROM tasks WHERE id = ?", (task_id,)).fetchone() is None:
            return None
        position = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM payment_rows WHERE task_id = ?", (task_id,)
        ).fetchone()[0]
        row = {
            "id": uuid.uuid4().hex,
            "task_id": task_id,
            "payment_no": "",
            "description": "",
            "pam_iris": 0,
            "cdp_chf": 0,
            "invoice_amount": 0,
            "expected_date": "",
            "payment_status": "",
            "invoice_link": "",
            "position": position,
        }
        conn.execute(
            """INSERT INTO payment_rows
                (id, task_id, payment_no, description, pam_iris, cdp_chf, invoice_amount,
                 expected_date, payment_status, invoice_link, position)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                row["id"], row["task_id"], row["payment_no"], row["description"], row["pam_iris"],
                row["cdp_chf"], row["invoice_amount"], row["expected_date"], row["payment_status"],
                row["invoice_link"], row["position"],
            ),
        )
        return row


PAYMENT_ROW_FIELDS = (
    "payment_no", "description", "pam_iris", "cdp_chf",
    "invoice_amount", "expected_date", "payment_status", "invoice_link",
)


def update_payment_row(row_id: str, **fields) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM payment_rows WHERE id = ?", (row_id,)).fetchone()
        if row is None:
            return None
        data = dict(row)
        for key in PAYMENT_ROW_FIELDS:
            if fields.get(key) is not None:
                data[key] = fields[key]
        conn.execute(
            """UPDATE payment_rows
               SET payment_no = ?, description = ?, pam_iris = ?, cdp_chf = ?, invoice_amount = ?,
                   expected_date = ?, payment_status = ?, invoice_link = ?
               WHERE id = ?""",
            (
                data["payment_no"], data["description"], data["pam_iris"], data["cdp_chf"],
                data["invoice_amount"], data["expected_date"], data["payment_status"],
                data["invoice_link"], row_id,
            ),
        )
        return data


def delete_payment_row(row_id: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM payment_rows WHERE id = ?", (row_id,))
        return cur.rowcount > 0


def list_progress_projects() -> list[dict]:
    """Alphabetical by name — each project is a fully separate tracker
    (its own categories, items, weeks, and entries), so there's no manual
    ordering to preserve."""
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM progress_projects ORDER BY name COLLATE NOCASE").fetchall()
        return [dict(row) for row in rows]


def get_progress_project(project_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM progress_projects WHERE id = ?", (project_id,)).fetchone()
        return dict(row) if row else None


def create_progress_project(name: str) -> dict:
    with _connect() as conn:
        project = {"id": uuid.uuid4().hex, "name": name}
        conn.execute("INSERT INTO progress_projects (id, name) VALUES (?, ?)", (project["id"], project["name"]))
        return project


def rename_progress_project(project_id: str, name: str) -> dict | None:
    with _connect() as conn:
        cur = conn.execute("UPDATE progress_projects SET name = ? WHERE id = ?", (name, project_id))
        if cur.rowcount == 0:
            return None
        return {"id": project_id, "name": name}


def delete_progress_project(project_id: str) -> bool:
    with _connect() as conn:
        item_ids = [r[0] for r in conn.execute("SELECT id FROM progress_items WHERE project_id = ?", (project_id,))]
        for item_id in item_ids:
            conn.execute("DELETE FROM progress_entries WHERE item_id = ?", (item_id,))
        conn.execute("DELETE FROM progress_items WHERE project_id = ?", (project_id,))

        week_ids = [r[0] for r in conn.execute("SELECT id FROM progress_weeks WHERE project_id = ?", (project_id,))]
        for week_id in week_ids:
            conn.execute("DELETE FROM progress_entries WHERE week_id = ?", (week_id,))
        conn.execute("DELETE FROM progress_weeks WHERE project_id = ?", (project_id,))

        cur = conn.execute("DELETE FROM progress_projects WHERE id = ?", (project_id,))
        return cur.rowcount > 0


def replace_progress_data(project_id: str, week_labels: list[str], rows: list[dict]) -> dict:
    """Wipes a project's tracker (categories, subcategories, items, weeks,
    and progress entries) and repopulates it from an imported BOQ file —
    see boq_import.parse(). Each row needs code/description/unit/
    suggested_quantity/project_cost_percent/level/week_values (a list
    aligned to week_labels)."""
    with _connect() as conn:
        item_ids = [r[0] for r in conn.execute("SELECT id FROM progress_items WHERE project_id = ?", (project_id,))]
        for item_id in item_ids:
            conn.execute("DELETE FROM progress_entries WHERE item_id = ?", (item_id,))
        conn.execute("DELETE FROM progress_items WHERE project_id = ?", (project_id,))

        week_ids = [r[0] for r in conn.execute("SELECT id FROM progress_weeks WHERE project_id = ?", (project_id,))]
        for week_id in week_ids:
            conn.execute("DELETE FROM progress_entries WHERE week_id = ?", (week_id,))
        conn.execute("DELETE FROM progress_weeks WHERE project_id = ?", (project_id,))

        new_week_ids = []
        for position, label in enumerate(week_labels):
            week_id = uuid.uuid4().hex
            conn.execute(
                "INSERT INTO progress_weeks (id, project_id, label, position) VALUES (?, ?, ?, ?)",
                (week_id, project_id, label, position),
            )
            new_week_ids.append(week_id)

        for position, row in enumerate(rows):
            item_id = uuid.uuid4().hex
            conn.execute(
                """INSERT INTO progress_items
                    (id, project_id, code, description, unit, suggested_quantity, project_cost_percent, level, position)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    item_id, project_id, row["code"], row["description"], row["unit"],
                    row["suggested_quantity"], row["project_cost_percent"], row["level"], position,
                ),
            )
            for week_idx, percent in enumerate(row.get("week_values", [])):
                if week_idx >= len(new_week_ids) or not percent:
                    continue
                conn.execute(
                    "INSERT INTO progress_entries (id, item_id, week_id, progress_percent) VALUES (?, ?, ?, ?)",
                    (uuid.uuid4().hex, item_id, new_week_ids[week_idx], percent),
                )

        return {"weeks": len(new_week_ids), "items": len(rows)}


def list_progress_weeks(project_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM progress_weeks WHERE project_id = ? ORDER BY position", (project_id,)
        ).fetchall()
        return [dict(row) for row in rows]


def create_progress_week(project_id: str, label: str = "") -> dict:
    with _connect() as conn:
        position = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM progress_weeks WHERE project_id = ?", (project_id,)
        ).fetchone()[0]
        week = {"id": uuid.uuid4().hex, "project_id": project_id, "label": label, "position": position}
        conn.execute(
            "INSERT INTO progress_weeks (id, project_id, label, position) VALUES (?, ?, ?, ?)",
            (week["id"], week["project_id"], week["label"], week["position"]),
        )
        return week


def rename_progress_week(week_id: str, label: str) -> dict | None:
    with _connect() as conn:
        cur = conn.execute("UPDATE progress_weeks SET label = ? WHERE id = ?", (label, week_id))
        if cur.rowcount == 0:
            return None
        return {"id": week_id, "label": label}


def delete_progress_week(week_id: str) -> bool:
    with _connect() as conn:
        conn.execute("DELETE FROM progress_entries WHERE week_id = ?", (week_id,))
        cur = conn.execute("DELETE FROM progress_weeks WHERE id = ?", (week_id,))
        return cur.rowcount > 0


def _attach_progress_entries(conn: sqlite3.Connection, item: dict) -> dict:
    rows = conn.execute(
        "SELECT week_id, progress_percent FROM progress_entries WHERE item_id = ?", (item["id"],)
    ).fetchall()
    item["entries"] = {row["week_id"]: row["progress_percent"] for row in rows}
    return item


def list_progress_items(project_id: str) -> list[dict]:
    """Alphabetical by Item code (e.g. A, A1, A2, B, BS1, BS2 — a category's
    code is always a prefix of its children's, so this also reconstructs the
    right BOQ grouping). `position` is only a tiebreak for equal/blank codes."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM progress_items WHERE project_id = ? ORDER BY code COLLATE NOCASE, position",
            (project_id,),
        ).fetchall()
        return [_attach_progress_entries(conn, dict(row)) for row in rows]


def create_progress_item(project_id: str, level: int = 2) -> dict:
    """level: 0 = category, 1 = subcategory (tied to the category above it),
    2 = leaf item. See the schema comment in init_db."""
    with _connect() as conn:
        position = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM progress_items WHERE project_id = ?", (project_id,)
        ).fetchone()[0]
        item = {
            "id": uuid.uuid4().hex,
            "project_id": project_id,
            "code": "",
            "description": "",
            "unit": "",
            "suggested_quantity": 0,
            "project_cost_percent": 0,
            "level": level,
            "position": position,
        }
        conn.execute(
            """INSERT INTO progress_items
                (id, project_id, code, description, unit, suggested_quantity, project_cost_percent, level, position)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                item["id"], item["project_id"], item["code"], item["description"], item["unit"],
                item["suggested_quantity"], item["project_cost_percent"], item["level"], item["position"],
            ),
        )
        item["entries"] = {}
        return item


PROGRESS_ITEM_FIELDS = ("code", "description", "unit", "suggested_quantity", "project_cost_percent", "level")


def update_progress_item(item_id: str, **fields) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM progress_items WHERE id = ?", (item_id,)).fetchone()
        if row is None:
            return None
        data = dict(row)
        for key in PROGRESS_ITEM_FIELDS:
            if fields.get(key) is not None:
                data[key] = int(fields[key]) if key == "level" else fields[key]
        conn.execute(
            """UPDATE progress_items
               SET code = ?, description = ?, unit = ?, suggested_quantity = ?,
                   project_cost_percent = ?, level = ?
               WHERE id = ?""",
            (
                data["code"], data["description"], data["unit"], data["suggested_quantity"],
                data["project_cost_percent"], data["level"], item_id,
            ),
        )
        return _attach_progress_entries(conn, data)


def delete_progress_item(item_id: str) -> bool:
    with _connect() as conn:
        conn.execute("DELETE FROM progress_entries WHERE item_id = ?", (item_id,))
        cur = conn.execute("DELETE FROM progress_items WHERE id = ?", (item_id,))
        return cur.rowcount > 0


def set_progress_entry(item_id: str, week_id: str, progress_percent: float) -> dict | None:
    with _connect() as conn:
        if conn.execute("SELECT 1 FROM progress_items WHERE id = ?", (item_id,)).fetchone() is None:
            return None
        if conn.execute("SELECT 1 FROM progress_weeks WHERE id = ?", (week_id,)).fetchone() is None:
            return None
        existing = conn.execute(
            "SELECT id FROM progress_entries WHERE item_id = ? AND week_id = ?", (item_id, week_id)
        ).fetchone()
        if existing:
            entry_id = existing["id"]
            conn.execute(
                "UPDATE progress_entries SET progress_percent = ? WHERE id = ?",
                (progress_percent, entry_id),
            )
        else:
            entry_id = uuid.uuid4().hex
            conn.execute(
                "INSERT INTO progress_entries (id, item_id, week_id, progress_percent) VALUES (?, ?, ?, ?)",
                (entry_id, item_id, week_id, progress_percent),
            )
        return {"id": entry_id, "item_id": item_id, "week_id": week_id, "progress_percent": progress_percent}
