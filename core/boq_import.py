"""Parses a tab-separated BOQ progress-tracker export (Item / Item
Description / Unit / Suggested Quantity / % Project Cost / Week N Progress %
...) into the rows and week labels needed to populate a project's tracker.

Real exports like this tend to have quirks this has to tolerate:
  - An extra blank column trails each "Week N Progress %" header (a merged-
    cell leftover from the spreadsheet) — every other week column is ignored.
  - The date-range sub-header ("17 July to 23 July") isn't in its own row;
    it's crammed into the week columns of what is otherwise the first
    category's data row. That row is scanned for wherever its week-column
    cells look like text rather than a number, and those become the week
    labels; the row itself is still parsed normally (its Item/Description
    still becomes a category).
  - Category/subcategory header rows leave Unit, Suggested Quantity, and
    % Project Cost blank — that blank-ness is what marks a row as a header
    rather than a leaf item (not the code's shape).
  - A leaf item can have a blank code (seen when it's nested under a
    sub-subcategory the source sheet didn't give its own column for); it's
    given a synthetic code derived from the nearest preceding header so it
    still sorts next to its siblings.
"""

from __future__ import annotations

import re

LEVEL_CATEGORY = 0
LEVEL_SUBCATEGORY = 1
LEVEL_ITEM = 2

_WEEK_HEADER_RE = re.compile(r"week\s*\d+", re.I)
_BARE_LETTER_CODE_RE = re.compile(r"^[A-Za-z]+$")


def _to_float(value: str) -> float | None:
    value = value.strip().replace(",", "")
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse(text: str) -> tuple[list[str], list[dict]]:
    """Returns (week_labels, rows). Raises ValueError if the file doesn't
    look like a BOQ export at all (no recognizable header)."""
    lines = [ln for ln in text.splitlines() if ln.strip() != ""]
    if not lines:
        raise ValueError("File is empty")

    header = lines[0].split("\t")
    week_cols = [i for i, cell in enumerate(header) if _WEEK_HEADER_RE.search(cell)]
    if not week_cols:
        raise ValueError('No "Week N Progress %" columns found in the header row')

    week_labels = ["" for _ in week_cols]
    raw_rows = []

    def field(fields: list[str], i: int) -> str:
        return fields[i].strip() if i < len(fields) else ""

    for line in lines[1:]:
        fields = line.split("\t")
        code = field(fields, 0)
        description = field(fields, 1)
        unit = field(fields, 2)
        quantity_str = field(fields, 3)
        cost_str = field(fields, 4)
        week_values = [field(fields, i) for i in week_cols]

        non_empty = [v for v in week_values if v]
        looks_like_date_row = bool(non_empty) and all(_to_float(v) is None for v in non_empty)
        if looks_like_date_row:
            for idx, v in enumerate(week_values):
                if v:
                    week_labels[idx] = v
            week_values = ["" for _ in week_values]

        if not any([code, description, unit, quantity_str, cost_str] + week_values):
            continue

        raw_rows.append(
            {
                "code": code,
                "description": description,
                "unit": unit,
                "quantity_str": quantity_str,
                "cost_str": cost_str,
                "week_values": week_values,
            }
        )

    rows = []
    last_header_code = ""
    blank_code_counter = 0
    for raw in raw_rows:
        is_leaf = bool(raw["unit"]) or bool(raw["quantity_str"]) or bool(raw["cost_str"])
        code = raw["code"]

        if not is_leaf:
            level = LEVEL_CATEGORY if _BARE_LETTER_CODE_RE.match(code) else LEVEL_SUBCATEGORY
            if code:
                last_header_code = code
            blank_code_counter = 0
        else:
            level = LEVEL_ITEM
            if not code:
                blank_code_counter += 1
                code = f"{last_header_code}.{blank_code_counter}" if last_header_code else f"item-{blank_code_counter}"

        rows.append(
            {
                "code": code,
                "description": raw["description"],
                "unit": raw["unit"] if is_leaf else "",
                "suggested_quantity": _to_float(raw["quantity_str"]) or 0,
                "project_cost_percent": _to_float(raw["cost_str"]) or 0,
                "level": level,
                "week_values": [_to_float(v) or 0 for v in raw["week_values"]] if is_leaf else [0] * len(week_cols),
            }
        )

    return week_labels, rows
