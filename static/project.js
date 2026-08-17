/* Simple Jira-style Kanban board for the Project Management page.
   Columns and tasks are persisted server-side via /api/columns and
   /api/tasks (SQLite-backed, see pm_db.py). */
(function () {
  const board = document.getElementById("pm-board");
  const overlay = document.getElementById("pm-modal-overlay");
  const titleInput = document.getElementById("pm-detail-title");
  const statusSelect = document.getElementById("pm-detail-status");
  const descriptionInput = document.getElementById("pm-detail-description");
  const metaEl = document.getElementById("pm-detail-meta");
  const fieldsContainer = document.getElementById("pm-detail-fields");
  const addFieldBtn = document.getElementById("pm-add-field-btn");
  const openPaymentTrackerBtn = document.getElementById("pm-open-payment-tracker-btn");
  const paymentOverlay = document.getElementById("pm-payment-modal-overlay");
  const paymentModalClose = document.getElementById("pm-payment-modal-close");
  const paymentRowsBody = document.getElementById("pm-payment-rows");
  const addPaymentRowBtn = document.getElementById("pm-add-payment-row-btn");
  const totalCdpEl = document.getElementById("pm-payment-total-cdp");
  const totalInvoiceEl = document.getElementById("pm-payment-total-invoice");

  let COLUMNS = [];
  let tasks = [];
  let activeTaskId = null;
  let dragTaskId = null;
  let paymentTaskId = null;
  let paymentRows = [];

  async function api(url, options) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`Request to ${url} failed: ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function renderBoard() {
    board.innerHTML = "";
    COLUMNS.forEach((col) => {
      const colEl = document.createElement("div");
      colEl.className = "pm-column";
      colEl.dataset.status = col.key;

      const colTasks = tasks.filter((t) => t.status === col.key);

      colEl.innerHTML = `
        <div class="pm-column-header">
          <span class="pm-column-title" title="Double-click to rename">${escapeHtml(col.title)}</span>
          <span class="pm-column-header-right">
            <span class="pm-column-count">${colTasks.length}</span>
            <button type="button" class="pm-column-delete" title="Delete column">×</button>
          </span>
        </div>
        <div class="pm-task-list" data-status="${col.key}"></div>
        <button type="button" class="pm-add-in-column" data-status="${col.key}">+ Add task</button>
      `;

      colEl.querySelector(".pm-column-title").addEventListener("dblclick", (e) => startRenameColumn(e.target, col));
      colEl.querySelector(".pm-column-delete").addEventListener("click", () => deleteColumn(col));

      const list = colEl.querySelector(".pm-task-list");
      colTasks.forEach((task) => list.appendChild(createTaskCard(task)));

      list.addEventListener("dragover", (e) => {
        e.preventDefault();
        list.classList.add("drag-over");
      });
      list.addEventListener("dragleave", () => list.classList.remove("drag-over"));
      list.addEventListener("drop", (e) => {
        e.preventDefault();
        list.classList.remove("drag-over");
        if (!dragTaskId) return;
        moveTask(dragTaskId, col.key);
      });

      colEl.querySelector(".pm-add-in-column").addEventListener("click", () => addTask(col.key));

      board.appendChild(colEl);
    });

    board.appendChild(createAddColumnControl());
  }

  function createAddColumnControl() {
    const wrap = document.createElement("div");
    wrap.className = "pm-add-column";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pm-add-column-btn";
    btn.textContent = "+ Add column";
    btn.addEventListener("click", () => {
      wrap.innerHTML = "";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "pm-add-column-input";
      input.placeholder = "Column name";
      wrap.appendChild(input);
      input.focus();

      let done = false;
      const commit = async () => {
        if (done) return;
        done = true;
        const title = input.value.trim();
        if (title) {
          await createColumn(title);
        } else {
          renderBoard();
        }
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        } else if (e.key === "Escape") {
          done = true;
          renderBoard();
        }
      });
    });

    wrap.appendChild(btn);
    return wrap;
  }

  function createTaskCard(task) {
    const card = document.createElement("div");
    card.className = "pm-task-card";
    card.draggable = true;
    card.dataset.id = task.id;
    card.innerHTML = `<div class="pm-task-title">${escapeHtml(task.title)}</div>`;

    card.addEventListener("dragstart", () => {
      dragTaskId = task.id;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      dragTaskId = null;
      card.classList.remove("dragging");
    });
    card.addEventListener("click", () => openTaskDetail(task.id));

    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function startRenameColumn(titleEl, col) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "pm-column-title-input";
    input.value = col.title;
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      if (value && value !== col.title) {
        try {
          const updated = await api(`/api/columns/${encodeURIComponent(col.key)}`, {
            method: "PUT",
            body: JSON.stringify({ title: value }),
          });
          col.title = updated.title;
        } catch (err) {
          console.error(err);
        }
      }
      renderBoard();
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        done = true;
        renderBoard();
      }
    });
  }

  async function deleteColumn(col) {
    const colTasks = tasks.filter((t) => t.status === col.key);
    if (colTasks.length > 0) {
      alert(`"${col.title}" still has ${colTasks.length} task(s). Move or delete them first.`);
      return;
    }
    if (!confirm(`Delete the "${col.title}" column?`)) return;
    try {
      await api(`/api/columns/${encodeURIComponent(col.key)}`, { method: "DELETE" });
      COLUMNS = COLUMNS.filter((c) => c.key !== col.key);
      renderBoard();
    } catch (err) {
      console.error(err);
    }
  }

  async function createColumn(title) {
    try {
      const column = await api("/api/columns", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      COLUMNS.push(column);
    } catch (err) {
      console.error(err);
    }
    renderBoard();
  }

  async function moveTask(taskId, status) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    const previousStatus = task.status;
    task.status = status;
    renderBoard();
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      console.error(err);
      task.status = previousStatus;
      renderBoard();
    }
  }

  async function addTask(status) {
    try {
      const task = await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "New Task", status: status || COLUMNS[0].key }),
      });
      tasks.push(task);
      renderBoard();
      openTaskDetail(task.id);
    } catch (err) {
      console.error(err);
    }
  }

  function openTaskDetail(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    activeTaskId = id;

    statusSelect.innerHTML = COLUMNS.map(
      (c) => `<option value="${c.key}">${escapeHtml(c.title)}</option>`
    ).join("");

    titleInput.value = task.title;
    statusSelect.value = task.status;
    descriptionInput.value = task.description || "";
    metaEl.textContent = `Created ${new Date(task.created_at).toLocaleString()}`;
    renderCustomFields(task);

    overlay.classList.add("open");
    titleInput.focus();
  }

  function renderCustomFields(task) {
    fieldsContainer.innerHTML = "";
    (task.custom_fields || []).forEach((field) => {
      fieldsContainer.appendChild(createFieldEl(task, field));
    });
  }

  function createFieldEl(task, field) {
    const wrap = document.createElement("div");
    wrap.className = "pm-field";

    const header = document.createElement("div");
    header.className = "pm-field-header";

    const nameSpan = document.createElement("span");
    nameSpan.className = "pm-field-name";
    nameSpan.title = "Double-click to rename";
    nameSpan.textContent = field.name;
    nameSpan.addEventListener("dblclick", () => startRenameField(nameSpan, task, field));

    const deleteFieldBtn = document.createElement("button");
    deleteFieldBtn.type = "button";
    deleteFieldBtn.className = "pm-field-delete";
    deleteFieldBtn.title = "Delete field";
    deleteFieldBtn.textContent = "×";
    deleteFieldBtn.addEventListener("click", async () => {
      try {
        await api(`/api/fields/${field.id}`, { method: "DELETE" });
        task.custom_fields = task.custom_fields.filter((f) => f.id !== field.id);
        renderCustomFields(task);
      } catch (err) {
        console.error(err);
      }
    });

    header.appendChild(nameSpan);
    header.appendChild(deleteFieldBtn);
    wrap.appendChild(header);

    const rowsEl = document.createElement("div");
    rowsEl.className = "pm-field-rows";
    field.rows.forEach((row) => rowsEl.appendChild(createFieldRowEl(field, row)));
    wrap.appendChild(rowsEl);

    const addRowBtn = document.createElement("button");
    addRowBtn.type = "button";
    addRowBtn.className = "pm-field-add-row";
    addRowBtn.textContent = "+ Add row";
    addRowBtn.addEventListener("click", async () => {
      try {
        const row = await api(`/api/fields/${field.id}/rows`, {
          method: "POST",
          body: JSON.stringify({ name: "New row", note: "", url: "" }),
        });
        field.rows.push(row);
        rowsEl.appendChild(createFieldRowEl(field, row));
      } catch (err) {
        console.error(err);
      }
    });
    wrap.appendChild(addRowBtn);

    return wrap;
  }

  function isLinksField(field) {
    return (field.name || "").trim().toLowerCase() === "links";
  }

  function createFieldRowEl(field, row) {
    const rowEl = document.createElement("div");
    rowEl.className = "pm-field-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "pm-field-row-name";
    nameInput.value = row.name;
    nameInput.placeholder = "Row name";

    const showUrl = isLinksField(field);
    let urlInput = null;
    if (showUrl) {
      urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.className = "pm-field-row-url";
      urlInput.value = row.url || "";
      urlInput.placeholder = "URL";
    }

    const noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.className = "pm-field-row-note";
    noteInput.value = row.note;
    noteInput.placeholder = "Note";

    const commit = async () => {
      const name = nameInput.value.trim() || "Row";
      const note = noteInput.value;
      const url = urlInput ? urlInput.value.trim() : row.url || "";
      if (name === row.name && note === row.note && url === (row.url || "")) return;
      try {
        const updated = await api(`/api/rows/${row.id}`, {
          method: "PUT",
          body: JSON.stringify({ name, note, url }),
        });
        row.name = updated.name;
        row.note = updated.note;
        row.url = updated.url;
      } catch (err) {
        console.error(err);
      }
    };
    nameInput.addEventListener("blur", commit);
    noteInput.addEventListener("blur", commit);
    if (urlInput) urlInput.addEventListener("blur", commit);

    const deleteRowBtn = document.createElement("button");
    deleteRowBtn.type = "button";
    deleteRowBtn.className = "pm-field-row-delete";
    deleteRowBtn.title = "Delete row";
    deleteRowBtn.textContent = "×";
    deleteRowBtn.addEventListener("click", async () => {
      try {
        await api(`/api/rows/${row.id}`, { method: "DELETE" });
        field.rows = field.rows.filter((r) => r.id !== row.id);
        rowEl.remove();
      } catch (err) {
        console.error(err);
      }
    });

    rowEl.appendChild(nameInput);
    if (urlInput) rowEl.appendChild(urlInput);
    rowEl.appendChild(noteInput);
    rowEl.appendChild(deleteRowBtn);
    return rowEl;
  }

  function startRenameField(nameEl, task, field) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "pm-field-name-input";
    input.value = field.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      if (value && value !== field.name) {
        try {
          const updated = await api(`/api/fields/${field.id}`, {
            method: "PUT",
            body: JSON.stringify({ name: value }),
          });
          field.name = updated.name;
        } catch (err) {
          console.error(err);
        }
      }
      renderCustomFields(task);
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        done = true;
        renderCustomFields(task);
      }
    });
  }

  function closeModal() {
    overlay.classList.remove("open");
    activeTaskId = null;
  }

  function formatMoney(value) {
    const num = Number(value) || 0;
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Small recursive-descent evaluator for +, -, *, /, and parentheses,
  // so amount fields can accept expressions like "1000*0.3" (no eval()).
  function evaluateExpression(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (/\s/.test(ch)) {
        i++;
      } else if (/[0-9.]/.test(ch)) {
        let start = i;
        while (i < expr.length && /[0-9.]/.test(expr[i])) i++;
        tokens.push({ type: "num", value: parseFloat(expr.slice(start, i)) });
      } else if ("+-*/()".includes(ch)) {
        tokens.push({ type: ch });
        i++;
      } else {
        throw new Error(`Unexpected character: ${ch}`);
      }
    }

    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function parseExpr() {
      let value = parseTerm();
      while (peek() && (peek().type === "+" || peek().type === "-")) {
        const op = next().type;
        const rhs = parseTerm();
        value = op === "+" ? value + rhs : value - rhs;
      }
      return value;
    }

    function parseTerm() {
      let value = parseFactor();
      while (peek() && (peek().type === "*" || peek().type === "/")) {
        const op = next().type;
        const rhs = parseFactor();
        value = op === "*" ? value * rhs : value / rhs;
      }
      return value;
    }

    function parseFactor() {
      const token = peek();
      if (!token) throw new Error("Unexpected end of expression");
      if (token.type === "-") {
        next();
        return -parseFactor();
      }
      if (token.type === "+") {
        next();
        return parseFactor();
      }
      if (token.type === "(") {
        next();
        const value = parseExpr();
        if (!peek() || peek().type !== ")") throw new Error("Expected )");
        next();
        return value;
      }
      if (token.type === "num") {
        next();
        return token.value;
      }
      throw new Error("Unexpected token");
    }

    if (!tokens.length) throw new Error("Empty expression");
    const result = parseExpr();
    if (pos !== tokens.length) throw new Error("Unexpected trailing input");
    return result;
  }

  function parseAmount(value) {
    const cleaned = String(value).replace(/,/g, "").trim();
    if (!cleaned) return 0;
    try {
      const result = evaluateExpression(cleaned);
      return Number.isFinite(result) ? result : 0;
    } catch (err) {
      return 0;
    }
  }

  function computePaymentTotals() {
    const totalCdp = paymentRows.reduce((sum, row) => sum + (Number(row.cdp_chf) || 0), 0);
    const totalInvoice = paymentRows.reduce((sum, row) => sum + (Number(row.invoice_amount) || 0), 0);
    totalCdpEl.textContent = formatMoney(totalCdp);
    totalInvoiceEl.textContent = formatMoney(totalInvoice);
  }

  function createPaymentRowEl(row) {
    const tr = document.createElement("tr");

    const paymentNoInput = document.createElement("input");
    paymentNoInput.type = "text";
    paymentNoInput.value = row.payment_no || "";
    paymentNoInput.placeholder = "Payment No.";

    const descInput = document.createElement("input");
    descInput.type = "text";
    descInput.value = row.description || "";
    descInput.placeholder = "Description";

    const pamIrisInput = document.createElement("input");
    pamIrisInput.type = "text";
    pamIrisInput.inputMode = "decimal";
    pamIrisInput.className = "pm-payment-amount-input";
    pamIrisInput.value = row.pam_iris ? formatMoney(row.pam_iris) : "";
    pamIrisInput.placeholder = "0.00";

    const cdpInput = document.createElement("input");
    cdpInput.type = "text";
    cdpInput.inputMode = "decimal";
    cdpInput.className = "pm-payment-amount-input";
    cdpInput.value = row.cdp_chf ? formatMoney(row.cdp_chf) : "";
    cdpInput.placeholder = "0.00";

    const invoiceInput = document.createElement("input");
    invoiceInput.type = "text";
    invoiceInput.inputMode = "decimal";
    invoiceInput.className = "pm-payment-amount-input";
    invoiceInput.value = row.invoice_amount ? formatMoney(row.invoice_amount) : "";
    invoiceInput.placeholder = "0.00";

    const expectedDateInput = document.createElement("input");
    expectedDateInput.type = "date";
    expectedDateInput.value = row.expected_date || "";

    const statusInput = document.createElement("input");
    statusInput.type = "text";
    statusInput.value = row.payment_status || "";
    statusInput.placeholder = "Status";

    const invoiceLinkInput = document.createElement("input");
    invoiceLinkInput.type = "text";
    invoiceLinkInput.value = row.invoice_link || "";
    invoiceLinkInput.placeholder = "Optional";

    const commit = async () => {
      const payload = {
        payment_no: paymentNoInput.value,
        description: descInput.value,
        pam_iris: parseAmount(pamIrisInput.value),
        cdp_chf: parseAmount(cdpInput.value),
        invoice_amount: parseAmount(invoiceInput.value),
        expected_date: expectedDateInput.value,
        payment_status: statusInput.value,
        invoice_link: invoiceLinkInput.value,
      };
      try {
        const updated = await api(`/api/payments/${row.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        Object.assign(row, updated);
        pamIrisInput.value = row.pam_iris ? formatMoney(row.pam_iris) : "";
        cdpInput.value = row.cdp_chf ? formatMoney(row.cdp_chf) : "";
        invoiceInput.value = row.invoice_amount ? formatMoney(row.invoice_amount) : "";
        computePaymentTotals();
      } catch (err) {
        console.error(err);
      }
    };
    [paymentNoInput, descInput, pamIrisInput, cdpInput, invoiceInput, expectedDateInput, statusInput, invoiceLinkInput]
      .forEach((input) => input.addEventListener("blur", commit));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "pm-field-row-delete";
    deleteBtn.title = "Delete row";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", async () => {
      try {
        await api(`/api/payments/${row.id}`, { method: "DELETE" });
        paymentRows = paymentRows.filter((r) => r.id !== row.id);
        tr.remove();
        computePaymentTotals();
      } catch (err) {
        console.error(err);
      }
    });

    [paymentNoInput, descInput, pamIrisInput, cdpInput, invoiceInput, expectedDateInput, statusInput, invoiceLinkInput, deleteBtn]
      .forEach((cell) => {
        const td = document.createElement("td");
        td.appendChild(cell);
        tr.appendChild(td);
      });

    return tr;
  }

  function renderPaymentRows() {
    paymentRowsBody.innerHTML = "";
    paymentRows.forEach((row) => paymentRowsBody.appendChild(createPaymentRowEl(row)));
    computePaymentTotals();
  }

  async function openPaymentTracker(taskId) {
    paymentTaskId = taskId;
    try {
      paymentRows = await api(`/api/tasks/${taskId}/payments`);
      renderPaymentRows();
      paymentOverlay.classList.add("open");
    } catch (err) {
      console.error(err);
    }
  }

  function closePaymentModal() {
    paymentOverlay.classList.remove("open");
    paymentTaskId = null;
  }

  async function addPaymentRow() {
    if (!paymentTaskId) return;
    try {
      const row = await api(`/api/tasks/${paymentTaskId}/payments`, { method: "POST" });
      paymentRows.push(row);
      paymentRowsBody.appendChild(createPaymentRowEl(row));
      computePaymentTotals();
    } catch (err) {
      console.error(err);
    }
  }

  async function saveActiveTask() {
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;
    const payload = {
      title: titleInput.value.trim() || "Untitled task",
      status: statusSelect.value,
      description: descriptionInput.value,
    };
    try {
      const updated = await api(`/api/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      Object.assign(task, updated);
      renderBoard();
      closeModal();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteActiveTask() {
    const id = activeTaskId;
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      tasks = tasks.filter((t) => t.id !== id);
      renderBoard();
      closeModal();
    } catch (err) {
      console.error(err);
    }
  }

  async function duplicateActiveTask() {
    const id = activeTaskId;
    try {
      const copy = await api(`/api/tasks/${id}/duplicate`, { method: "POST" });
      tasks.push(copy);
      renderBoard();
      openTaskDetail(copy.id);
    } catch (err) {
      console.error(err);
    }
  }

  addFieldBtn.addEventListener("click", () => {
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;

    const wrap = document.createElement("div");
    wrap.className = "pm-field-add-input-wrap";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "pm-add-field-input";
    input.placeholder = "Field name";
    wrap.appendChild(input);
    fieldsContainer.appendChild(wrap);
    input.focus();

    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (!name) {
        wrap.remove();
        return;
      }
      try {
        const field = await api(`/api/tasks/${task.id}/fields`, {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        task.custom_fields = task.custom_fields || [];
        task.custom_fields.push(field);
        renderCustomFields(task);
      } catch (err) {
        console.error(err);
        wrap.remove();
      }
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        done = true;
        wrap.remove();
      }
    });
  });

  document.getElementById("pm-add-task-btn").addEventListener("click", () => addTask());
  document.getElementById("pm-modal-close").addEventListener("click", closeModal);
  document.getElementById("pm-save-task-btn").addEventListener("click", saveActiveTask);
  document.getElementById("pm-delete-task-btn").addEventListener("click", deleteActiveTask);
  document.getElementById("pm-duplicate-task-btn").addEventListener("click", duplicateActiveTask);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  openPaymentTrackerBtn.addEventListener("click", () => {
    if (activeTaskId) openPaymentTracker(activeTaskId);
  });
  addPaymentRowBtn.addEventListener("click", addPaymentRow);
  paymentModalClose.addEventListener("click", closePaymentModal);
  paymentOverlay.addEventListener("click", (e) => {
    if (e.target === paymentOverlay) closePaymentModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (paymentOverlay.classList.contains("open")) {
      closePaymentModal();
    } else if (overlay.classList.contains("open")) {
      closeModal();
    }
  });

  async function init() {
    try {
      [COLUMNS, tasks] = await Promise.all([api("/api/columns"), api("/api/tasks")]);
      renderBoard();
    } catch (err) {
      console.error(err);
      board.innerHTML = '<p class="section-hint">Could not load the board. Is the server running?</p>';
    }
  }

  init();
})();
