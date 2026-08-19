import os
import re
import sys
import threading
import webbrowser

from flask import Flask, render_template, request, send_file, jsonify

from core.docx_filler import fill_template, REQUIRED_FIELDS
from core.docx_filler_wad import fill_template_wad
from core import boq_import
from core import pm_db
from core import progress_export


def resource_path(*parts: str) -> str:
    """Path to a bundled resource (template.docx, templates/, static/).
    Works both running from source and packaged as a PyInstaller exe,
    where bundled files are extracted to sys._MEIPASS."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, *parts)


def app_dir() -> str:
    """Writable directory next to the running script/executable, used
    for generated output (the PyInstaller bundle dir is read-only/temp)."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


TEMPLATE_PATH = resource_path("docx_templates", "Contract for Works Template.docx")
TEMPLATE_PATH_WAD = resource_path("docx_templates", "WAD Template.docx")
OUTPUT_DIR = os.path.join(app_dir(), "output")
DATA_DIR = os.path.join(app_dir(), "data")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

pm_db.init_db(os.path.join(DATA_DIR, "project_management.db"))

app = Flask(
    __name__,
    template_folder=resource_path("templates"),
    static_folder=resource_path("static"),
)


def _safe_filename(name: str) -> str:
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_")
    return name or "contract"


@app.route("/")
def index():
    return render_template("index.html", current_page="contract")


@app.route("/working-advance")
def working_advance():
    return render_template("working_advance.html", current_page="working-advance")


@app.route("/project-management")
def project_management():
    return render_template("project_management.html", current_page="project-management")


@app.route("/progress-tracker")
def progress_tracker():
    return render_template("progress_tracker.html", current_page="progress-tracker")


@app.route("/progress-tracker/<project_id>")
def progress_tracker_detail(project_id):
    project = pm_db.get_progress_project(project_id)
    if project is None:
        return "Project not found", 404
    return render_template(
        "progress_tracker_detail.html", current_page="progress-tracker", project=project
    )


@app.route("/api/columns", methods=["GET"])
def api_list_columns():
    return jsonify(pm_db.list_columns())


@app.route("/api/columns", methods=["POST"])
def api_create_column():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    return jsonify(pm_db.create_column(title)), 201


@app.route("/api/columns/reorder", methods=["POST"])
def api_reorder_columns():
    data = request.get_json(silent=True) or {}
    order = data.get("order")
    if not isinstance(order, list) or not all(isinstance(k, str) for k in order):
        return jsonify({"error": "order must be a list of column keys"}), 400
    return jsonify(pm_db.reorder_columns(order))


@app.route("/api/columns/<key>", methods=["PUT"])
def api_rename_column(key):
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    column = pm_db.rename_column(key, title)
    if column is None:
        return jsonify({"error": "Column not found"}), 404
    return jsonify(column)


@app.route("/api/columns/<key>", methods=["DELETE"])
def api_delete_column(key):
    try:
        deleted = pm_db.delete_column(key)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if deleted is None:
        return jsonify({"error": "Column not found"}), 404
    return "", 204


@app.route("/api/tasks", methods=["GET"])
def api_list_tasks():
    return jsonify(pm_db.list_tasks())


@app.route("/api/tasks", methods=["POST"])
def api_create_task():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or "New Task").strip() or "New Task"
    status = str(data.get("status") or "todo")
    description = str(data.get("description") or "")
    return jsonify(pm_db.create_task(title, status, description)), 201


@app.route("/api/tasks/<task_id>", methods=["PUT"])
def api_update_task(task_id):
    data = request.get_json(silent=True) or {}
    task = pm_db.update_task(
        task_id,
        title=data.get("title"),
        description=data.get("description"),
        status=data.get("status"),
    )
    if task is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)


@app.route("/api/tasks/<task_id>/move", methods=["POST"])
def api_move_task(task_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    index = data.get("index")
    if not status or not isinstance(index, int):
        return jsonify({"error": "status and index are required"}), 400
    task = pm_db.reorder_task(task_id, status, index)
    if task is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)


@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def api_delete_task(task_id):
    pm_db.delete_task(task_id)
    return "", 204


@app.route("/api/tasks/<task_id>/duplicate", methods=["POST"])
def api_duplicate_task(task_id):
    task = pm_db.duplicate_task(task_id)
    if task is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task), 201


@app.route("/api/tasks/<task_id>/fields", methods=["POST"])
def api_create_custom_field(task_id):
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    field = pm_db.create_custom_field(task_id, name)
    if field is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(field), 201


@app.route("/api/fields/<field_id>", methods=["PUT"])
def api_rename_custom_field(field_id):
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    field = pm_db.rename_custom_field(field_id, name)
    if field is None:
        return jsonify({"error": "Field not found"}), 404
    return jsonify(field)


@app.route("/api/fields/<field_id>", methods=["DELETE"])
def api_delete_custom_field(field_id):
    pm_db.delete_custom_field(field_id)
    return "", 204


@app.route("/api/fields/<field_id>/rows", methods=["POST"])
def api_create_field_row(field_id):
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "New row").strip() or "New row"
    note = str(data.get("note") or "")
    url = str(data.get("url") or "")
    row = pm_db.create_field_row(field_id, name, note, url)
    if row is None:
        return jsonify({"error": "Field not found"}), 404
    return jsonify(row), 201


@app.route("/api/rows/<row_id>", methods=["PUT"])
def api_update_field_row(row_id):
    data = request.get_json(silent=True) or {}
    row = pm_db.update_field_row(row_id, name=data.get("name"), note=data.get("note"), url=data.get("url"))
    if row is None:
        return jsonify({"error": "Row not found"}), 404
    return jsonify(row)


@app.route("/api/rows/<row_id>", methods=["DELETE"])
def api_delete_field_row(row_id):
    pm_db.delete_field_row(row_id)
    return "", 204


@app.route("/api/tasks/<task_id>/payments", methods=["GET"])
def api_list_payment_rows(task_id):
    return jsonify(pm_db.list_payment_rows(task_id))


@app.route("/api/tasks/<task_id>/payments", methods=["POST"])
def api_create_payment_row(task_id):
    row = pm_db.create_payment_row(task_id)
    if row is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(row), 201


@app.route("/api/payments/<row_id>", methods=["PUT"])
def api_update_payment_row(row_id):
    data = request.get_json(silent=True) or {}
    row = pm_db.update_payment_row(
        row_id,
        payment_no=data.get("payment_no"),
        description=data.get("description"),
        pam_iris=data.get("pam_iris"),
        cdp_chf=data.get("cdp_chf"),
        invoice_amount=data.get("invoice_amount"),
        expected_date=data.get("expected_date"),
        payment_status=data.get("payment_status"),
        invoice_link=data.get("invoice_link"),
    )
    if row is None:
        return jsonify({"error": "Row not found"}), 404
    return jsonify(row)


@app.route("/api/payments/<row_id>", methods=["DELETE"])
def api_delete_payment_row(row_id):
    pm_db.delete_payment_row(row_id)
    return "", 204


@app.route("/api/progress/projects", methods=["GET"])
def api_list_progress_projects():
    return jsonify(pm_db.list_progress_projects())


@app.route("/api/progress/projects", methods=["POST"])
def api_create_progress_project():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    return jsonify(pm_db.create_progress_project(name)), 201


@app.route("/api/progress/projects/<project_id>", methods=["PUT"])
def api_rename_progress_project(project_id):
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    project = pm_db.rename_progress_project(project_id, name)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(project)


@app.route("/api/progress/projects/<project_id>", methods=["DELETE"])
def api_delete_progress_project(project_id):
    pm_db.delete_progress_project(project_id)
    return "", 204


@app.route("/api/progress/projects/<project_id>/import", methods=["POST"])
def api_import_progress(project_id):
    if pm_db.get_progress_project(project_id) is None:
        return jsonify({"error": "Project not found"}), 404

    file = request.files.get("file")
    if file is None or not file.filename:
        return jsonify({"error": "No file uploaded"}), 400

    try:
        text = file.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return jsonify({"error": "Could not read the file as text (expected a tab-separated export)"}), 400

    try:
        week_labels, rows = boq_import.parse(text)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    result = pm_db.replace_progress_data(project_id, week_labels, rows)
    return jsonify(result), 200


@app.route("/api/progress/projects/<project_id>/export/excel", methods=["GET"])
def api_export_progress_excel(project_id):
    project = pm_db.get_progress_project(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    weeks = pm_db.list_progress_weeks(project_id)
    items = pm_db.list_progress_items(project_id)
    buf = progress_export.build_excel(project, weeks, items)
    filename = f"{_safe_filename(project['name'])}_Progress_Tracker.xlsx"
    return send_file(
        buf,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route("/api/progress/projects/<project_id>/export/pdf", methods=["GET"])
def api_export_progress_pdf(project_id):
    project = pm_db.get_progress_project(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    weeks = pm_db.list_progress_weeks(project_id)
    items = pm_db.list_progress_items(project_id)
    buf = progress_export.build_pdf(project, weeks, items)
    filename = f"{_safe_filename(project['name'])}_Progress_Tracker.pdf"
    return send_file(
        buf,
        as_attachment=True,
        download_name=filename,
        mimetype="application/pdf",
    )


@app.route("/api/progress/projects/<project_id>/weeks", methods=["GET"])
def api_list_progress_weeks(project_id):
    return jsonify(pm_db.list_progress_weeks(project_id))


@app.route("/api/progress/projects/<project_id>/weeks", methods=["POST"])
def api_create_progress_week(project_id):
    data = request.get_json(silent=True) or {}
    label = str(data.get("label") or "").strip()
    return jsonify(pm_db.create_progress_week(project_id, label)), 201


@app.route("/api/progress/weeks/<week_id>", methods=["PUT"])
def api_rename_progress_week(week_id):
    data = request.get_json(silent=True) or {}
    label = str(data.get("label") or "").strip()
    week = pm_db.rename_progress_week(week_id, label)
    if week is None:
        return jsonify({"error": "Week not found"}), 404
    return jsonify(week)


@app.route("/api/progress/weeks/<week_id>", methods=["DELETE"])
def api_delete_progress_week(week_id):
    pm_db.delete_progress_week(week_id)
    return "", 204


@app.route("/api/progress/projects/<project_id>/items", methods=["GET"])
def api_list_progress_items(project_id):
    return jsonify(pm_db.list_progress_items(project_id))


@app.route("/api/progress/projects/<project_id>/items", methods=["POST"])
def api_create_progress_item(project_id):
    data = request.get_json(silent=True) or {}
    try:
        level = int(data.get("level", 2))
    except (TypeError, ValueError):
        level = 2
    return jsonify(pm_db.create_progress_item(project_id, level)), 201


@app.route("/api/progress/items/<item_id>", methods=["PUT"])
def api_update_progress_item(item_id):
    data = request.get_json(silent=True) or {}
    item = pm_db.update_progress_item(
        item_id,
        code=data.get("code"),
        description=data.get("description"),
        unit=data.get("unit"),
        suggested_quantity=data.get("suggested_quantity"),
        project_cost_percent=data.get("project_cost_percent"),
        level=data.get("level"),
    )
    if item is None:
        return jsonify({"error": "Item not found"}), 404
    return jsonify(item)


@app.route("/api/progress/items/<item_id>", methods=["DELETE"])
def api_delete_progress_item(item_id):
    pm_db.delete_progress_item(item_id)
    return "", 204


@app.route("/api/progress/entries", methods=["PUT"])
def api_set_progress_entry():
    data = request.get_json(silent=True) or {}
    item_id = str(data.get("item_id") or "")
    week_id = str(data.get("week_id") or "")
    try:
        progress_percent = float(data.get("progress_percent") or 0)
    except (TypeError, ValueError):
        progress_percent = 0
    entry = pm_db.set_progress_entry(item_id, week_id, progress_percent)
    if entry is None:
        return jsonify({"error": "Item or week not found"}), 404
    return jsonify(entry)


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True) or request.form.to_dict()

    missing = [f for f in REQUIRED_FIELDS if not str(data.get(f, "")).strip()]
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400

    project_name = _safe_filename(data.get("Project Name", "Contract"))
    filename = f"{project_name}_Contract Form for ITB.docx"
    output_path = os.path.join(OUTPUT_DIR, filename)

    try:
        fill_template(TEMPLATE_PATH, output_path, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # unexpected failure while filling the doc
        return jsonify({"error": f"Failed to generate document: {exc}"}), 500

    return send_file(
        output_path,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@app.route("/generate-wad", methods=["POST"])
def generate_wad():
    data = request.get_json(silent=True) or request.form.to_dict()

    wad_number = _safe_filename(data.get("WAD Number", "WAD"))
    filename = f"WAD_{wad_number}_MANGUIAT.docx"
    output_path = os.path.join(OUTPUT_DIR, filename)

    try:
        fill_template_wad(TEMPLATE_PATH_WAD, output_path, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # unexpected failure while filling the doc
        return jsonify({"error": f"Failed to generate document: {exc}"}), 500

    return send_file(
        output_path,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


if __name__ == "__main__":
    port = 5000
    host = os.environ.get("HOST", "127.0.0.1")
    if getattr(sys, "frozen", False):
        # Packaged exe: no reloader (it would try to respawn the exe),
        # and open the browser automatically since there's no console
        # workflow guiding the user to the URL.
        threading.Timer(1.0, lambda: webbrowser.open(f"http://127.0.0.1:{port}/")).start()
        app.run(host=host, debug=False, use_reloader=False, port=port)
    else:
        app.run(host=host, debug=True, port=port)
