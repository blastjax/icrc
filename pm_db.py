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
                created_at TEXT NOT NULL
            )"""
        )
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
    task = {
        "id": uuid.uuid4().hex,
        "title": title,
        "description": description,
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    conn.execute(
        "INSERT INTO tasks (id, title, description, status, created_at) VALUES (?, ?, ?, ?, ?)",
        (task["id"], task["title"], task["description"], task["status"], task["created_at"]),
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
        rows = conn.execute("SELECT * FROM tasks ORDER BY created_at").fetchall()
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
        if status is not None:
            task["status"] = status
        conn.execute(
            "UPDATE tasks SET title = ?, description = ?, status = ? WHERE id = ?",
            (task["title"], task["description"], task["status"], task_id),
        )
        return _attach_custom_fields(conn, task)


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
