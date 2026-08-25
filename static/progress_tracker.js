/* Progress Tracker page: a spreadsheet-style table of BOQ items. Each row has
   a level: 0 = category ("A GENERAL"), 1 = subcategory tied to the category
   above it ("BS1 Conduits"), 2 = leaf item carrying real Unit / Suggested
   Quantity / % Project Cost / weekly progress data ("A1 Mobilization and
   Demobilization"). Category and subcategory rows only ever show Item +
   Item Description; every other column stays blank for them. Rows are kept
   in natural order by Item code (so "A" sorts before "A1"/"A2"/"A9"/"A10"/
   "A20", which sort before "B", which sorts before "BS1"/"BS2" — a code is
   always a prefix of its children's, and numeric runs sort by value rather
   than as text).

   As many "Week N Progress %" columns as needed can be added, each labeled
   with its own date range. A "Total" column sums, per row, (Week n / 100 *
   % Project Cost) across every week. The footer totals % Project Cost and
   the same weighted computation per week (not the raw entered percentages).
   Persisted server-side via /api/progress/* (SQLite-backed, see pm_db.py).

   Rows and week columns are read-only text until double-clicked; double-click
   turns them into inputs (to edit) and reveals a Delete control (to remove
   them). Clicking anywhere outside the row/header being edited commits;
   Escape cancels. (Clicks elsewhere *inside* the same row/header — including
   on cells with no input, like the blank cells on a category row — must NOT
   count as "outside", or double-clicking would flicker in and out of edit
   mode; that's why this uses an explicit outside-click listener rather than
   focus/blur, which can't tell the two apart.)

   Scoped to a single project (window.PT_PROJECT_ID, injected by
   progress_tracker_detail.html) — each project is a fully separate tracker;
   see progress_tracker_projects.js for the project list page. */
(function () {
  const LEVEL_CATEGORY = 0;
  const LEVEL_SUBCATEGORY = 1;
  const LEVEL_ITEM = 2;

  const PROJECT_ID = window.PT_PROJECT_ID;
  const headRow = document.getElementById("pt-table-head-row");
  const body = document.getElementById("pt-table-body");
  const footRow = document.getElementById("pt-table-foot-row");
  const overallEl = document.getElementById("pt-overall");
  const cardsEl = document.getElementById("pt-cards");
  const subcatModalOverlay = document.getElementById("pt-subcat-modal-overlay");
  const subcatModalTitle = document.getElementById("pt-subcat-modal-title");
  const subcatModalBody = document.getElementById("pt-subcat-modal-body");
  const subcatModalClose = document.getElementById("pt-subcat-modal-close");
  const addCategoryBtn = document.getElementById("pt-add-category-btn");
  const addSubcategoryBtn = document.getElementById("pt-add-subcategory-btn");
  const addItemBtn = document.getElementById("pt-add-item-btn");
  const addWeekBtn = document.getElementById("pt-add-week-btn");
  const importBtn = document.getElementById("pt-import-btn");
  const importInput = document.getElementById("pt-import-input");
  const deleteProjectBtn = document.getElementById("pt-delete-project-btn");
  const projectTitleEl = document.getElementById("pt-project-title");

  let weeks = [];
  let items = [];

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

  function parseNumber(value) {
    const num = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(num) ? num : 0;
  }

  function formatNumber(value) {
    const num = Number(value) || 0;
    return num ? String(num) : "";
  }

  function formatTotal(value) {
    return (Number(value) || 0).toFixed(2);
  }

  function makeInput(value, placeholder, numeric) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = numeric ? "pt-input pt-input-number" : "pt-input";
    if (numeric) input.inputMode = "decimal";
    input.value = value || "";
    if (placeholder) input.placeholder = placeholder;
    return input;
  }

  function wrapTd(el) {
    const td = document.createElement("td");
    td.appendChild(el);
    return td;
  }

  // A week cell holds the raw value/input on the left and, to its right,
  // the computed (Week n / 100 * % Project Cost) figure — no separate
  // column, just packed into the same cell. Returns the wrapper (append it
  // to a <td>); the computed span is exposed as `wrap.computedEl` so
  // callers can keep it live-updated while editing.
  function buildWeekCell(rawEl, computedValue) {
    const wrap = document.createElement("div");
    wrap.className = "pt-week-cell";
    wrap.appendChild(rawEl);
    const computedEl = document.createElement("span");
    computedEl.className = "pt-computed-value";
    computedEl.textContent = `(${formatTotal(computedValue)})`;
    wrap.appendChild(computedEl);
    wrap.computedEl = computedEl;
    return wrap;
  }

  function rowClassFor(item) {
    if (item.level === LEVEL_CATEGORY) return "pt-row-category";
    if (item.level === LEVEL_SUBCATEGORY) return "pt-row-subcategory";
    return "pt-row-item";
  }

  function codePlaceholderFor(level) {
    if (level === LEVEL_CATEGORY) return "A";
    if (level === LEVEL_SUBCATEGORY) return "BS1";
    return "A1";
  }

  function descPlaceholderFor(level) {
    if (level === LEVEL_CATEGORY) return "GENERAL";
    if (level === LEVEL_SUBCATEGORY) return "Conduits";
    return "Description";
  }

  // Attaches a capture-phase listener on `document` for the duration of an
  // edit session; fires `onOutside()` only when the mousedown target is
  // truly outside `container`. Returns a detach function to call on exit.
  function watchOutsideClick(container, onOutside) {
    const handler = (e) => {
      if (container.contains(e.target)) return;
      onOutside();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }

  // ---- Weighted totals ----

  function computeWeekTotal(week) {
    return items.reduce((sum, item) => sum + computeWeekContribution(item, week), 0);
  }

  function computeWeekContribution(item, week) {
    if (item.level !== LEVEL_ITEM) return 0;
    const percent = (item.entries && item.entries[week.id]) || 0;
    return (percent / 100) * (item.project_cost_percent || 0);
  }

  function computeCostTotal() {
    return items.reduce((sum, item) => sum + (item.level === LEVEL_ITEM ? (item.project_cost_percent || 0) : 0), 0);
  }

  function renderFoot() {
    footRow.innerHTML = "";

    const labelTd = document.createElement("td");
    labelTd.colSpan = 4;
    labelTd.className = "pt-total-label";
    labelTd.textContent = "TOTAL";
    footRow.appendChild(labelTd);

    const costTd = document.createElement("td");
    costTd.className = "pt-total-value";
    costTd.textContent = formatTotal(computeCostTotal());
    footRow.appendChild(costTd);

    weeks.forEach((week) => {
      const td = document.createElement("td");
      td.className = "pt-total-value";
      td.textContent = formatTotal(computeWeekTotal(week));
      footRow.appendChild(td);
    });

    footRow.appendChild(document.createElement("td")); // actions column spacer

    renderOverall();
    renderCards();
  }

  // ---- Category cards (+ subcategory breakdown modal) ----
  // Each category row plus every leaf item that follows it (up to the next
  // category row) forms a group, regardless of any subcategory rows in
  // between — that's the category's own card. Each subcategory row
  // additionally forms its own group from just its direct leaf items, up to
  // the next subcategory or category row; rather than a card of its own,
  // that breakdown shows up in a modal opened by clicking the category card
  // (categories with no subcategories just jump to their table row instead,
  // since there'd be nothing to show). A group's progress is as of the
  // latest week: (Sum of the latest week's Progress %/100 * % Project Cost
  // across its leaf items), divided by the group's total % Project Cost —
  // not summed across every week, since each week's entry is already
  // cumulative-to-date, not a delta.

  function computeCardGroups() {
    const categoryGroups = [];
    let currentCategory = null;
    let currentSub = null;
    items.forEach((item) => {
      if (item.level === LEVEL_CATEGORY) {
        currentCategory = { header: item, children: [], subgroups: [] };
        categoryGroups.push(currentCategory);
        currentSub = null;
      } else if (item.level === LEVEL_SUBCATEGORY) {
        currentSub = { header: item, children: [] };
        if (currentCategory) currentCategory.subgroups.push(currentSub);
      } else if (item.level === LEVEL_ITEM) {
        if (currentCategory) currentCategory.children.push(item);
        if (currentSub) currentSub.children.push(item);
      }
    });
    return categoryGroups;
  }

  function latestWeek() {
    return weeks.length ? weeks[weeks.length - 1] : null;
  }

  function computeGroupProgress(children) {
    const week = latestWeek();
    const totalCost = children.reduce((sum, child) => sum + (child.project_cost_percent || 0), 0);
    const weightedDone = week
      ? children.reduce((sum, child) => sum + computeWeekContribution(child, week), 0)
      : 0;
    const percent = totalCost > 0 ? (weightedDone / totalCost) * 100 : 0;
    return { percent, totalCost, itemCount: children.length };
  }

  function severityFor(percent) {
    if (percent >= 80) return { tone: "good", label: "Nearly complete" };
    if (percent >= 40) return { tone: "warning", label: "In progress" };
    if (percent > 0) return { tone: "critical", label: "Just started" };
    return { tone: "none", label: "Not started" };
  }

  function groupLabel(headerItem, fallback) {
    return [headerItem.code, headerItem.description].filter(Boolean).join(" — ") || fallback;
  }

  function buildMeter(severity, clamped) {
    const meter = document.createElement("div");
    meter.className = "pt-card-meter";
    const meterFill = document.createElement("div");
    meterFill.className = `pt-card-meter-fill pt-card-meter-fill-${severity.tone}`;
    meterFill.style.width = `${clamped}%`;
    meter.appendChild(meterFill);
    return meter;
  }

  function buildCategoryCard(group) {
    const { percent, totalCost, itemCount } = computeGroupProgress(group.children);
    const clamped = Math.min(100, Math.max(0, percent));
    const severity = severityFor(percent);
    const hasSubgroups = group.subgroups.length > 0;

    const card = document.createElement("button");
    card.type = "button";
    card.className = `pt-card pt-card-${severity.tone}`;
    card.title = hasSubgroups ? "Click to view the subcategory breakdown" : "Click to jump to this section";
    card.addEventListener("click", () => {
      if (hasSubgroups) {
        openSubcategoryModal(group);
      } else {
        jumpToRow(group.header.id);
      }
    });

    const header = document.createElement("div");
    header.className = "pt-card-header";
    header.textContent = groupLabel(group.header, "Untitled category");

    const value = document.createElement("div");
    value.className = "pt-card-value";
    value.textContent = `${Math.round(clamped)}%`;

    const meta = document.createElement("div");
    meta.className = "pt-card-meta";
    const statusEl = document.createElement("span");
    statusEl.className = `pt-card-status pt-card-status-${severity.tone}`;
    statusEl.textContent = severity.label;
    const countEl = document.createElement("span");
    countEl.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"} · ${formatTotal(totalCost)}% of cost`;
    meta.appendChild(statusEl);
    meta.appendChild(countEl);

    card.appendChild(header);
    card.appendChild(value);
    card.appendChild(buildMeter(severity, clamped));
    card.appendChild(meta);
    return card;
  }

  function renderCards() {
    cardsEl.innerHTML = "";
    computeCardGroups().forEach((group) => {
      cardsEl.appendChild(buildCategoryCard(group));
    });
  }

  function openSubcategoryModal(group) {
    subcatModalTitle.textContent = groupLabel(group.header, "Untitled category");
    subcatModalBody.innerHTML = "";

    group.subgroups.forEach((sub) => {
      const { percent, totalCost, itemCount } = computeGroupProgress(sub.children);
      const clamped = Math.min(100, Math.max(0, percent));
      const severity = severityFor(percent);

      const row = document.createElement("button");
      row.type = "button";
      row.className = "pt-subcat-row";
      row.title = "Click to jump to this section";
      row.addEventListener("click", () => {
        closeSubcategoryModal();
        jumpToRow(sub.header.id);
      });

      const top = document.createElement("div");
      top.className = "pt-subcat-row-top";
      const name = document.createElement("span");
      name.className = "pt-subcat-name";
      name.textContent = groupLabel(sub.header, "Untitled subcategory");
      const value = document.createElement("span");
      value.className = `pt-subcat-value pt-card-status-${severity.tone}`;
      value.textContent = `${Math.round(clamped)}%`;
      top.appendChild(name);
      top.appendChild(value);

      const meta = document.createElement("div");
      meta.className = "pt-subcat-meta";
      meta.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"} · ${formatTotal(totalCost)}% of cost`;

      row.appendChild(top);
      row.appendChild(buildMeter(severity, clamped));
      row.appendChild(meta);
      subcatModalBody.appendChild(row);
    });

    subcatModalOverlay.classList.add("open");
  }

  function closeSubcategoryModal() {
    subcatModalOverlay.classList.remove("open");
  }

  subcatModalClose.addEventListener("click", closeSubcategoryModal);
  subcatModalOverlay.addEventListener("click", (e) => {
    if (e.target === subcatModalOverlay) closeSubcategoryModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSubcategoryModal();
  });

  // ---- Overall project completion ----
  // The same latest-week weighted computation, but across every leaf item
  // in the project — the single headline figure the page leads with.

  function renderOverall() {
    const leafItems = items.filter((item) => item.level === LEVEL_ITEM);
    if (leafItems.length === 0) {
      overallEl.style.display = "none";
      return;
    }
    overallEl.style.display = "";

    const { percent } = computeGroupProgress(leafItems);
    const clamped = Math.min(100, Math.max(0, percent));
    const severity = severityFor(percent);

    overallEl.innerHTML = "";
    overallEl.className = `pt-overall pt-overall-${severity.tone}`;

    const label = document.createElement("div");
    label.className = "pt-overall-label";
    label.textContent = "Overall Project Completion";

    const value = document.createElement("div");
    value.className = "pt-overall-value";
    value.textContent = `${Math.round(clamped)}%`;

    const meter = buildMeter(severity, clamped);
    meter.classList.add("pt-overall-meter");

    const statusEl = document.createElement("span");
    statusEl.className = `pt-card-status pt-card-status-${severity.tone}`;
    statusEl.textContent = severity.label;

    overallEl.appendChild(label);
    overallEl.appendChild(value);
    overallEl.appendChild(meter);
    overallEl.appendChild(statusEl);
  }

  function jumpToRow(itemId) {
    const tr = body.querySelector(`tr[data-item-id="${itemId}"]`);
    if (!tr) return;
    tr.scrollIntoView({ behavior: "smooth", block: "center" });
    tr.classList.remove("pt-row-highlight");
    // restart the animation even if the same row was just highlighted
    requestAnimationFrame(() => {
      tr.classList.add("pt-row-highlight");
      setTimeout(() => tr.classList.remove("pt-row-highlight"), 1500);
    });
  }

  // ---- Weeks (header columns) ----

  function weekIndex(week) {
    return weeks.indexOf(week);
  }

  function renderHead() {
    headRow.innerHTML = `
      <th class="pt-col-item">Item</th>
      <th class="pt-col-description">Item Description</th>
      <th class="pt-col-unit">Unit</th>
      <th class="pt-col-qty">Suggested Quantity</th>
      <th class="pt-col-cost">% Project Cost</th>
    `;
    weeks.forEach((week) => {
      const th = document.createElement("th");
      th.className = "pt-col-week";
      renderWeekHead(th, week);
      headRow.appendChild(th);
    });
    const actionsTh = document.createElement("th");
    actionsTh.className = "pt-col-actions";
    headRow.appendChild(actionsTh);
  }

  function renderWeekHead(th, week) {
    th.innerHTML = "";
    th.classList.remove("pt-editing");

    const titleEl = document.createElement("div");
    titleEl.className = "pt-week-title";
    titleEl.textContent = `Week ${weekIndex(week) + 1} Progress %`;

    const labelEl = document.createElement("div");
    labelEl.className = "pt-week-label";
    labelEl.textContent = week.label || "";

    th.appendChild(titleEl);
    th.appendChild(labelEl);
    th.ondblclick = () => startEditWeek(th, week);
  }

  function startEditWeek(th, week) {
    if (th.classList.contains("pt-editing")) return;
    th.innerHTML = "";
    th.classList.add("pt-editing");

    const titleEl = document.createElement("div");
    titleEl.className = "pt-week-title";
    titleEl.textContent = `Week ${weekIndex(week) + 1} Progress %`;

    const input = makeInput(week.label, "e.g. 17 Jul - 23 Jul");
    input.className = "pt-week-label-input";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "pt-week-delete";
    deleteBtn.textContent = "Delete week";

    th.appendChild(titleEl);
    th.appendChild(input);
    th.appendChild(deleteBtn);

    let settled = false;
    const stopWatching = watchOutsideClick(th, () => commit());

    const exit = () => {
      stopWatching();
      renderWeekHead(th, week);
    };

    const commit = async () => {
      if (settled) return;
      settled = true;
      const value = input.value.trim();
      if (value !== (week.label || "")) {
        try {
          const updated = await api(`/api/progress/weeks/${week.id}`, {
            method: "PUT",
            body: JSON.stringify({ label: value }),
          });
          week.label = updated.label;
        } catch (err) {
          console.error(err);
        }
      }
      exit();
    };

    const cancel = () => {
      if (settled) return;
      settled = true;
      exit();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        cancel();
      }
    });

    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Delete "Week ${weekIndex(week) + 1}"? This removes progress entries for this week on every item.`)) return;
      settled = true;
      stopWatching();
      try {
        await api(`/api/progress/weeks/${week.id}`, { method: "DELETE" });
        weeks = weeks.filter((w) => w.id !== week.id);
        renderHead();
        renderBody();
        renderFoot();
      } catch (err) {
        console.error(err);
      }
    });

    input.focus();
    input.select();
  }

  async function addWeek() {
    try {
      const week = await api(`/api/progress/projects/${PROJECT_ID}/weeks`, {
        method: "POST",
        body: JSON.stringify({ label: "" }),
      });
      weeks.push(week);
      renderHead();
      renderBody();
      renderFoot();
      const th = headRow.children[weekIndex(week) + 5];
      if (th) startEditWeek(th, week);
    } catch (err) {
      console.error(err);
    }
  }

  // ---- Items (body rows) ----

  function renderReadRow(tr, item) {
    tr.innerHTML = "";
    tr.className = rowClassFor(item);

    const codeTd = document.createElement("td");
    codeTd.textContent = item.code || "";
    tr.appendChild(codeTd);

    const descTd = document.createElement("td");
    descTd.textContent = item.description || "";
    tr.appendChild(descTd);

    if (item.level === LEVEL_ITEM) {
      const unitTd = document.createElement("td");
      unitTd.textContent = item.unit || "";
      tr.appendChild(unitTd);

      const qtyTd = document.createElement("td");
      qtyTd.textContent = formatNumber(item.suggested_quantity);
      tr.appendChild(qtyTd);

      const costTd = document.createElement("td");
      costTd.textContent = formatNumber(item.project_cost_percent);
      tr.appendChild(costTd);

      weeks.forEach((week) => {
        const td = document.createElement("td");
        const rawEl = document.createElement("span");
        rawEl.className = "pt-week-raw";
        rawEl.textContent = formatNumber(item.entries ? item.entries[week.id] : 0);
        td.appendChild(buildWeekCell(rawEl, computeWeekContribution(item, week)));
        tr.appendChild(td);
      });
    } else {
      tr.appendChild(document.createElement("td"));
      tr.appendChild(document.createElement("td"));
      tr.appendChild(document.createElement("td"));
      weeks.forEach(() => tr.appendChild(document.createElement("td")));
    }

    tr.appendChild(document.createElement("td")); // actions placeholder (empty until editing)
    tr.ondblclick = () => startEditItem(tr, item);
  }

  // Moves `tr` to `item`'s current alphabetical slot among the other rows,
  // without touching any other row's DOM node (a full tbody rebuild would
  // destroy the element a user might be mid-click on, e.g. double-clicking
  // straight into another row right after this one commits).
  function repositionRow(tr, item) {
    sortItems();
    const idx = items.indexOf(item);
    const referenceNode = body.children[idx] || null;
    if (referenceNode !== tr) {
      body.insertBefore(tr, referenceNode);
    }
  }

  function startEditItem(tr, item) {
    if (tr.classList.contains("pt-editing")) return;
    tr.innerHTML = "";
    tr.classList.add("pt-editing");

    const codeInput = makeInput(item.code, codePlaceholderFor(item.level));
    const descInput = makeInput(item.description, descPlaceholderFor(item.level));
    tr.appendChild(wrapTd(codeInput));
    tr.appendChild(wrapTd(descInput));

    let unitInput = null;
    let qtyInput = null;
    let costInput = null;
    const weekInputs = {};

    if (item.level === LEVEL_ITEM) {
      unitInput = makeInput(item.unit, "unit");
      qtyInput = makeInput(formatNumber(item.suggested_quantity), "0", true);
      costInput = makeInput(formatNumber(item.project_cost_percent), "0", true);
      tr.appendChild(wrapTd(unitInput));
      tr.appendChild(wrapTd(qtyInput));
      tr.appendChild(wrapTd(costInput));

      const weekCellWraps = {};
      weeks.forEach((week) => {
        const input = makeInput(formatNumber(item.entries ? item.entries[week.id] : 0), "0", true);
        weekInputs[week.id] = input;
        const wrap = buildWeekCell(input, computeWeekContribution(item, week));
        weekCellWraps[week.id] = wrap;
        const td = document.createElement("td");
        td.appendChild(wrap);
        tr.appendChild(td);
      });

      const recomputeWeighted = () => {
        const cost = parseNumber(costInput.value);
        weeks.forEach((week) => {
          const input = weekInputs[week.id];
          const percent = input ? parseNumber(input.value) : 0;
          const weighted = (percent / 100) * cost;
          weekCellWraps[week.id].computedEl.textContent = `(${formatTotal(weighted)})`;
        });
        renderFoot();
      };

      costInput.addEventListener("input", recomputeWeighted);
      Object.values(weekInputs).forEach((input) => input.addEventListener("input", recomputeWeighted));
      recomputeWeighted();
    } else {
      tr.appendChild(document.createElement("td"));
      tr.appendChild(document.createElement("td"));
      tr.appendChild(document.createElement("td"));
      weeks.forEach(() => tr.appendChild(document.createElement("td")));
    }

    const actionsTd = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "pt-row-delete";
    deleteBtn.textContent = "Delete";
    actionsTd.appendChild(deleteBtn);
    tr.appendChild(actionsTd);

    const allInputs = [codeInput, descInput, unitInput, qtyInput, costInput, ...Object.values(weekInputs)].filter(Boolean);
    let settled = false;
    const stopWatching = watchOutsideClick(tr, () => commit());

    const exitReadOnly = () => {
      stopWatching();
      renderReadRow(tr, item);
      // Editing the code can change its alphabetical position.
      repositionRow(tr, item);
      renderFoot();
    };

    const commit = async () => {
      if (settled) return;
      settled = true;
      const payload = { code: codeInput.value, description: descInput.value };
      if (item.level === LEVEL_ITEM) {
        payload.unit = unitInput.value;
        payload.suggested_quantity = parseNumber(qtyInput.value);
        payload.project_cost_percent = parseNumber(costInput.value);
      }
      try {
        const updated = await api(`/api/progress/items/${item.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        Object.assign(item, updated);
      } catch (err) {
        console.error(err);
      }
      if (item.level === LEVEL_ITEM) {
        for (const week of weeks) {
          const input = weekInputs[week.id];
          if (!input) continue;
          const percent = parseNumber(input.value);
          try {
            await api("/api/progress/entries", {
              method: "PUT",
              body: JSON.stringify({ item_id: item.id, week_id: week.id, progress_percent: percent }),
            });
            item.entries[week.id] = percent;
          } catch (err) {
            console.error(err);
          }
        }
      }
      exitReadOnly();
    };

    const cancel = () => {
      if (settled) return;
      settled = true;
      exitReadOnly();
    };

    allInputs.forEach((input) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          cancel();
        }
      });
    });

    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this row?")) return;
      settled = true;
      stopWatching();
      try {
        await api(`/api/progress/items/${item.id}`, { method: "DELETE" });
        items = items.filter((i) => i.id !== item.id);
        tr.remove();
        renderFoot();
      } catch (err) {
        console.error(err);
      }
    });

    codeInput.focus();
    codeInput.select();
  }

  function createItemRow(item) {
    const tr = document.createElement("tr");
    tr.dataset.itemId = item.id;
    renderReadRow(tr, item);
    return tr;
  }

  function renderBody() {
    body.innerHTML = "";
    items.forEach((item) => body.appendChild(createItemRow(item)));
  }

  // Compares codes the way the server does: split into text/number runs so
  // numbers sort by value (A9 < A10 < A20, A1.9 < A1.10 < A1.20) instead of
  // as plain text, while a category's code ("A") still sorts right before
  // its children ("A1", "A2") and right after the previous group ("B"
  // before "BS1", "BS2").
  function compareCodes(a, b) {
    const pa = String(a || "").trim().toLowerCase().split(/(\d+)/);
    const pb = String(b || "").trim().toLowerCase().split(/(\d+)/);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const x = pa[i] ?? "";
      const y = pb[i] ?? "";
      if (x === y) continue;
      if (i % 2 === 1) {
        const diff = parseInt(x || "0", 10) - parseInt(y || "0", 10);
        if (diff !== 0) return diff;
        continue;
      }
      return x < y ? -1 : 1;
    }
    return 0;
  }

  function sortItems() {
    items.sort((a, b) => compareCodes(a.code, b.code));
  }

  async function addItem(level) {
    try {
      const item = await api(`/api/progress/projects/${PROJECT_ID}/items`, {
        method: "POST",
        body: JSON.stringify({ level }),
      });
      items.push(item);
      const tr = document.createElement("tr");
      tr.dataset.itemId = item.id;
      body.appendChild(tr);
      startEditItem(tr, item);
      renderFoot();
    } catch (err) {
      console.error(err);
    }
  }

  addCategoryBtn.addEventListener("click", () => addItem(LEVEL_CATEGORY));
  addSubcategoryBtn.addEventListener("click", () => addItem(LEVEL_SUBCATEGORY));
  addItemBtn.addEventListener("click", () => addItem(LEVEL_ITEM));
  addWeekBtn.addEventListener("click", addWeek);

  // ---- Upload BOQ file ----
  // Replaces this project's entire tracker (categories, subcategories,
  // items, weeks, and progress entries) with what's parsed from the file —
  // see boq_import.py for the expected tab-separated format.

  importBtn.addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    importInput.value = "";
    if (!file) return;

    if (!confirm(`Import "${file.name}"? This replaces every category, subcategory, item, week, and progress entry currently in this project.`)) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/progress/projects/${PROJECT_ID}/import`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Import failed: ${res.status}`);
      }
      await init();
    } catch (err) {
      console.error(err);
      alert(`Import failed: ${err.message}`);
    }
  });

  // ---- Project title (rename) and delete ----

  function startEditProjectTitle() {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "pt-project-title-input";
    input.value = projectTitleEl.textContent;
    projectTitleEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      if (value) {
        try {
          await api(`/api/progress/projects/${PROJECT_ID}`, {
            method: "PUT",
            body: JSON.stringify({ name: value }),
          });
          projectTitleEl.textContent = value;
          document.title = value;
        } catch (err) {
          console.error(err);
        }
      }
      input.replaceWith(projectTitleEl);
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        done = true;
        input.replaceWith(projectTitleEl);
      }
    });
  }

  projectTitleEl.addEventListener("dblclick", startEditProjectTitle);

  deleteProjectBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${projectTitleEl.textContent}"? This removes its entire tracker — every category, item, week, and progress entry.`)) return;
    try {
      await api(`/api/progress/projects/${PROJECT_ID}`, { method: "DELETE" });
      window.location.href = "/progress-tracker";
    } catch (err) {
      console.error(err);
    }
  });

  async function init() {
    try {
      [weeks, items] = await Promise.all([
        api(`/api/progress/projects/${PROJECT_ID}/weeks`),
        api(`/api/progress/projects/${PROJECT_ID}/items`),
      ]);
    } catch (err) {
      console.error(err);
      weeks = [];
      items = [];
    }
    renderHead();
    renderBody();
    renderFoot();
  }

  init();
})();
