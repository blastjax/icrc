"""Builds Excel (.xlsx) and PDF exports of a Progress Tracker project: the
plain table only (Item / Item Description / Unit / Suggested Quantity /
% Project Cost / Week N Progress % / Week N Weighted % / ... / a TOTAL row)
— no completion cards. Each "Week N Progress %" header spans two columns
(the raw entered % and the computed Week n/100 * % Project Cost), mirroring
the pair shown inline in the web table. Colors: column headers dark grey,
category rows dark gray, subcategory rows light gray — all bold, along with
the TOTAL row.
"""

from __future__ import annotations

import io

from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle

LEVEL_CATEGORY = 0
LEVEL_SUBCATEGORY = 1
LEVEL_ITEM = 2

STATIC_HEADERS = ["Item", "Item Description", "Unit", "Suggested Quantity", "% Project Cost"]

HEADER_BG = "333333"
HEADER_FONT_COLOR = "FFFFFF"
CATEGORY_BG = "595959"
CATEGORY_FONT_COLOR = "FFFFFF"
SUBCATEGORY_BG = "D9D9D9"
SUBCATEGORY_FONT_COLOR = "000000"


def _week_title(index: int, week: dict) -> str:
    title = f"Week {index:02d} Progress %"
    if week.get("label"):
        title += f"\n{week['label']}"
    return title


def _weighted(item: dict, week_id: str) -> float:
    percent = (item.get("entries") or {}).get(week_id, 0) or 0
    return (percent / 100) * (item.get("project_cost_percent") or 0)


def build_excel(project: dict, weeks: list[dict], items: list[dict]) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Progress Tracker"

    n_static = len(STATIC_HEADERS)
    header_fill = PatternFill(start_color=HEADER_BG, end_color=HEADER_BG, fill_type="solid")
    header_font = Font(bold=True, color=HEADER_FONT_COLOR)
    category_fill = PatternFill(start_color=CATEGORY_BG, end_color=CATEGORY_BG, fill_type="solid")
    category_font = Font(bold=True, color=CATEGORY_FONT_COLOR)
    subcategory_fill = PatternFill(start_color=SUBCATEGORY_BG, end_color=SUBCATEGORY_BG, fill_type="solid")
    subcategory_font = Font(bold=True, color=SUBCATEGORY_FONT_COLOR)
    wrap_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    wrap_left = Alignment(horizontal="left", vertical="center", wrap_text=True)

    for col, title in enumerate(STATIC_HEADERS, start=1):
        cell = ws.cell(row=1, column=col, value=title)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = wrap_center
        ws.merge_cells(start_row=1, start_column=col, end_row=2, end_column=col)

    col = n_static + 1
    for idx, week in enumerate(weeks, start=1):
        title_cell = ws.cell(row=1, column=col, value=_week_title(idx, week))
        title_cell.font = header_font
        title_cell.fill = header_fill
        title_cell.alignment = wrap_center
        ws.merge_cells(start_row=1, start_column=col, end_row=1, end_column=col + 1)
        ws.cell(row=1, column=col + 1).fill = header_fill

        for offset, label in enumerate(("Progress %", "Weighted %")):
            sub_cell = ws.cell(row=2, column=col + offset, value=label)
            sub_cell.font = header_font
            sub_cell.fill = header_fill
            sub_cell.alignment = wrap_center
        col += 2

    row = 3
    cost_total = 0.0
    week_totals = [0.0] * len(weeks)

    for item in items:
        is_leaf = item.get("level") == LEVEL_ITEM
        code_cell = ws.cell(row=row, column=1, value=item.get("code") or "")
        code_cell.alignment = wrap_center
        desc_cell = ws.cell(row=row, column=2, value=item.get("description") or "")
        desc_cell.alignment = wrap_left

        if is_leaf:
            unit_cell = ws.cell(row=row, column=3, value=item.get("unit") or "")
            unit_cell.alignment = wrap_center
            ws.cell(row=row, column=4, value=item.get("suggested_quantity") or 0).alignment = wrap_center
            cost = item.get("project_cost_percent") or 0
            ws.cell(row=row, column=5, value=cost).alignment = wrap_center
            cost_total += cost

            col = n_static + 1
            for w_idx, week in enumerate(weeks):
                percent = (item.get("entries") or {}).get(week["id"], 0) or 0
                weighted = _weighted(item, week["id"])
                week_totals[w_idx] += weighted
                ws.cell(row=row, column=col, value=percent).alignment = wrap_center
                ws.cell(row=row, column=col + 1, value=round(weighted, 2)).alignment = wrap_center
                col += 2
        else:
            fill = category_fill if item.get("level") == LEVEL_CATEGORY else subcategory_fill
            font = category_font if item.get("level") == LEVEL_CATEGORY else subcategory_font
            desc_cell.font = font
            desc_cell.alignment = wrap_left
            code_cell.font = font
            last_col = n_static + len(weeks) * 2
            for c in range(1, last_col + 1):
                cell = ws.cell(row=row, column=c)
                cell.fill = fill
        row += 1

    total_row = row
    label_cell = ws.cell(row=total_row, column=1, value="TOTAL")
    label_cell.font = Font(bold=True)
    ws.merge_cells(start_row=total_row, start_column=1, end_row=total_row, end_column=4)
    ws.cell(row=total_row, column=5, value=round(cost_total, 2)).font = Font(bold=True)

    col = n_static + 1
    for w_idx in range(len(weeks)):
        ws.cell(row=total_row, column=col + 1, value=round(week_totals[w_idx], 2)).font = Font(bold=True)
        col += 2

    ws.column_dimensions["A"].width = 10
    ws.column_dimensions["B"].width = 45
    ws.column_dimensions["C"].width = 10
    ws.column_dimensions["D"].width = 14
    ws.column_dimensions["E"].width = 12
    col = n_static + 1
    for _ in weeks:
        ws.column_dimensions[get_column_letter(col)].width = 12
        ws.column_dimensions[get_column_letter(col + 1)].width = 12
        col += 2
    ws.row_dimensions[1].height = 32

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def build_pdf(project: dict, weeks: list[dict], items: list[dict]) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4), leftMargin=18, rightMargin=18, topMargin=18, bottomMargin=18
    )
    styles = getSampleStyleSheet()
    title = Paragraph(f"<b>{escape(project.get('name', ''))} — Progress Tracker</b>", styles["Title"])

    header_style = ParagraphStyle(
        "header",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        alignment=1,
        textColor=colors.HexColor(f"#{HEADER_FONT_COLOR}"),
    )
    desc_style = ParagraphStyle(
        "desc", parent=styles["Normal"], fontName="Helvetica", fontSize=7, leading=9
    )
    desc_category_style = ParagraphStyle(
        "desc_category",
        parent=desc_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor(f"#{CATEGORY_FONT_COLOR}"),
    )
    desc_subcategory_style = ParagraphStyle(
        "desc_subcategory",
        parent=desc_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor(f"#{SUBCATEGORY_FONT_COLOR}"),
    )

    def header_paragraph(text: str) -> Paragraph:
        return Paragraph(escape(text).replace("\n", "<br/>"), header_style)

    n_static = len(STATIC_HEADERS)
    header_row1 = [header_paragraph(h) for h in STATIC_HEADERS]
    header_row2 = [""] * n_static
    for idx, week in enumerate(weeks, start=1):
        header_row1.extend([header_paragraph(_week_title(idx, week)), ""])
        header_row2.extend([header_paragraph("Progress %"), header_paragraph("Weighted %")])

    data = [header_row1, header_row2]
    span_commands = [("SPAN", (c, 0), (c, 1)) for c in range(n_static)]
    col = n_static
    for _ in weeks:
        span_commands.append(("SPAN", (col, 0), (col + 1, 0)))
        col += 2

    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 1), colors.HexColor(f"#{HEADER_BG}")),
        ("TEXTCOLOR", (0, 0), (-1, 1), colors.HexColor(f"#{HEADER_FONT_COLOR}")),
        ("FONTNAME", (0, 0), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dde3ea")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (2, 0), (-1, -1), "CENTER"),
    ]
    style_commands.extend(span_commands)

    cost_total = 0.0
    week_totals = [0.0] * len(weeks)

    for r, item in enumerate(items, start=2):
        is_leaf = item.get("level") == LEVEL_ITEM
        description = escape(item.get("description") or "")

        if is_leaf:
            row = [item.get("code") or "", Paragraph(description, desc_style)]
            cost = item.get("project_cost_percent") or 0
            row += [item.get("unit") or "", item.get("suggested_quantity") or 0, cost]
            cost_total += cost
            for w_idx, week in enumerate(weeks):
                percent = (item.get("entries") or {}).get(week["id"], 0) or 0
                weighted = _weighted(item, week["id"])
                week_totals[w_idx] += weighted
                row += [percent, round(weighted, 2)]
        else:
            if item.get("level") == LEVEL_CATEGORY:
                bg = colors.HexColor(f"#{CATEGORY_BG}")
                desc_para = Paragraph(description, desc_category_style)
            else:
                bg = colors.HexColor(f"#{SUBCATEGORY_BG}")
                desc_para = Paragraph(description, desc_subcategory_style)
            row = [item.get("code") or "", desc_para] + ["", "", ""] + ["", ""] * len(weeks)
            fg = desc_para.style.textColor
            style_commands.append(("BACKGROUND", (0, r), (-1, r), bg))
            style_commands.append(("TEXTCOLOR", (0, r), (0, r), fg))
            style_commands.append(("FONTNAME", (0, r), (0, r), "Helvetica-Bold"))

        data.append(row)

    total_row_idx = len(data)
    total_row = ["TOTAL", "", "", "", round(cost_total, 2)]
    for w_idx in range(len(weeks)):
        total_row += ["", round(week_totals[w_idx], 2)]
    data.append(total_row)
    style_commands.append(("SPAN", (0, total_row_idx), (3, total_row_idx)))
    style_commands.append(("FONTNAME", (0, total_row_idx), (-1, total_row_idx), "Helvetica-Bold"))

    page_width = landscape(A4)[0] - doc.leftMargin - doc.rightMargin
    fixed_widths = [page_width * f for f in (0.05, 0.28, 0.05, 0.07, 0.07)]
    remaining = page_width - sum(fixed_widths)
    week_col_count = max(1, len(weeks) * 2)
    col_widths = fixed_widths + [remaining / week_col_count] * (len(weeks) * 2)

    table = Table(data, repeatRows=2, colWidths=col_widths)
    table.setStyle(TableStyle(style_commands))

    doc.build([title, table])
    buf.seek(0)
    return buf
