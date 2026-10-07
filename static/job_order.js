// Job Order: an Outlook-style email (header + formatted body) rendered from
// the form, captured as a PNG with html-to-image (static/html-to-image.js).
(function () {
  const $ = (id) => document.getElementById(id);

  const form = $("jo-form");
  const editor = $("jo-editor");
  const toolbar = $("jo-toolbar");
  const email = $("jo-email");
  const message = $("jo-message");

  const DEFAULT_TO = [
    ["unknown", "MAN Ops Room Mailbox"],
    ["unknown", "man logistics services"],
  ];
  const DEFAULT_CC = [
    ["available", "Althea Manguiat"],
    ["available", "Jelly VALDEZ"],
    ["busy", "Chardy Jay ILAGAN"],
    ["unknown", "Christopher G_ Mardo"],
    ["unknown", "Antonia REY"],
  ];
  const DEFAULT_ATTACHMENTS = [
    ["image002.png", "12 KB"],
    ["FTR_WatHab_Week 34_POCC_Electrical.xlsx", "40 KB"],
  ];

  // Office-style file tile per extension: [light, mid, dark, badge letter].
  const EXCEL = ["#33c481", "#21a366", "#107c41", "X"];
  const WORD = ["#41a5ee", "#2b7cd3", "#185abd", "W"];
  const POWERPOINT = ["#ff8f6b", "#ed6c47", "#c43e1c", "P"];
  const FILE_ICONS = {
    xls: EXCEL, xlsx: EXCEL, xlsm: EXCEL, csv: EXCEL,
    doc: WORD, docx: WORD,
    ppt: POWERPOINT, pptx: POWERPOINT,
    pdf: ["#f07d7f", "#e5484d", "#c4262e", "PDF"],
  };
  const GENERIC_ICON = ["#d6d6d6", "#b3b3b3", "#8a8a8a", ""];

  const CHEVRON =
    '<svg class="ol-att-chevron" viewBox="0 0 14 8" width="14" height="8" fill="none" stroke="#242424" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l6 6 6-6"/></svg>';

  function fileIcon(name) {
    const ext = name.split(".").pop().toLowerCase();
    const [light, mid, dark, letter] = FILE_ICONS[ext] || GENERIC_ICON;
    const badge = letter
      ? `<rect x="1" y="28" width="20" height="19" rx="3" fill="${dark}"/>` +
        `<text x="11" y="${letter.length > 1 ? 40.5 : 42.5}" text-anchor="middle" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="${letter.length > 1 ? 7.5 : 14}">${letter}</text>`
      : "";
    return (
      '<svg viewBox="0 0 48 48" width="48" height="48">' +
      '<rect x="2" y="8" width="44" height="34" rx="4" fill="#fff"/>' +
      `<path d="M16 15a3 3 0 0 1 3-3h6v13h-9z" fill="${light}"/>` +
      `<path d="M25 12h6a3 3 0 0 1 3 3v10h-9z" fill="${mid}"/>` +
      `<path d="M16 25h9v13h-6a3 3 0 0 1-3-3z" fill="${mid}"/>` +
      `<path d="M25 25h9v10a3 3 0 0 1-3 3h-6z" fill="${dark}"/>` +
      badge +
      "</svg>"
    );
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // "2026-08-13" -> "13/08/2026", the way Outlook shows it.
  const formatDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
  }

  // ---- Repeating rows (recipients, attachments) ----

  function addRow(list, values = []) {
    const row = $(list.dataset.template).content.firstElementChild.cloneNode(true);
    row.querySelectorAll('select, input[type="text"]').forEach((input, i) => {
      if (values[i] !== undefined) input.value = values[i];
    });
    list.append(row);
    return row;
  }

  function recipients(listId) {
    return [...$(listId).children]
      .map((row) => ({
        status: row.querySelector(".jo-status").value,
        name: row.querySelector(".jo-name").value.trim(),
      }))
      .filter((r) => r.name);
  }

  // ---- Preview ----

  function renderRecipients(target, list) {
    target.replaceChildren();
    list.forEach((r, i) => {
      // Text-node spaces between recipients are where long lists wrap.
      if (i) target.append(" ");
      const item = el("span", "ol-recip");
      if (r.status !== "none") item.append(el("i", `ol-dot ol-dot-${r.status}`));
      item.append(r.name + (i < list.length - 1 ? ";" : ""));
      target.append(item);
    });
  }

  function renderAttachments() {
    const cards = [...$("jo-attachments").children].flatMap((row) => {
      const name = row.querySelector(".jo-att-name").value.trim();
      if (!name) return [];
      const icon = el("div", "ol-att-icon");
      if (row.dataset.thumb) {
        const img = el("img");
        img.src = row.dataset.thumb;
        img.alt = "";
        icon.append(img);
      } else {
        icon.innerHTML = fileIcon(name);
      }
      const text = el("div", "ol-att-text");
      text.append(el("div", "ol-att-name", name), el("div", "ol-att-size", row.querySelector(".jo-att-size").value));
      const card = el("div", "ol-att");
      card.append(icon, text);
      card.insertAdjacentHTML("beforeend", CHEVRON);
      return [card];
    });
    $("ol-attachments").replaceChildren(...cards);
  }

  function render() {
    $("ol-subject").textContent = $("jo-subject").value;
    $("ol-from").textContent = $("jo-sender").value;
    $("ol-initials").textContent = $("jo-initials").value;
    $("ol-avatar").style.background = $("jo-avatar-color").value;
    renderRecipients($("ol-to"), recipients("jo-to"));
    const cc = recipients("jo-cc");
    $("ol-cc-line").hidden = !cc.length;
    renderRecipients($("ol-cc"), cc);
    $("ol-date").textContent = formatDate($("jo-date").value);
    $("ol-replied").hidden = !$("jo-replied").checked;
    $("ol-replied-text").textContent =
      `You replied to this message on ${formatDate($("jo-replied-date").value)} ${$("jo-replied-time").value}.`;
    renderAttachments();
    $("ol-body").innerHTML = editor.innerHTML;
  }

  // ---- Form events ----

  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", render);

  form.addEventListener("change", (e) => {
    if (e.target.matches(".jo-att-file")) {
      const file = e.target.files[0];
      if (!file) return;
      const row = e.target.closest(".jo-row");
      row.querySelector(".jo-att-name").value = file.name;
      row.querySelector(".jo-att-size").value = formatSize(file.size);
      delete row.dataset.thumb;
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          row.dataset.thumb = reader.result;
          render();
        };
        reader.readAsDataURL(file);
      }
    }
    render();
  });

  form.addEventListener("click", (e) => {
    const add = e.target.closest(".jo-add");
    if (add) {
      addRow($(add.dataset.list)).querySelector('input[type="text"]').focus();
      render();
    }
    const remove = e.target.closest(".jo-remove");
    if (remove) {
      remove.closest(".jo-row").remove();
      render();
    }
  });

  // ---- Rich text toolbar ----

  // Clicking a toolbar control moves focus out of the editor, so remember the
  // last selection inside it and restore it before running a command.
  let savedRange = null;

  function updateToolbarState() {
    toolbar.querySelectorAll("[data-cmd]").forEach((btn) => {
      btn.classList.toggle("active", document.queryCommandState(btn.dataset.cmd));
    });
  }

  document.addEventListener("selectionchange", () => {
    const sel = document.getSelection();
    if (sel.rangeCount && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0);
      updateToolbarState();
    }
  });

  function exec(command, value) {
    editor.focus();
    if (savedRange) {
      const sel = document.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(command, false, value);
    updateToolbarState();
    render();
  }

  toolbar.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) e.preventDefault(); // keep the editor selection
  });

  toolbar.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.cmd) exec(btn.dataset.cmd);
    else exec(btn.dataset.colorCmd, $(btn.dataset.input).value);
  });

  [["jo-fore-color", "jo-fore-swatch", "foreColor"], ["jo-back-color", "jo-back-swatch", "hiliteColor"]].forEach(
    ([inputId, swatchId, command]) => {
      const input = $(inputId);
      const paintSwatch = () => ($(swatchId).style.background = input.value);
      paintSwatch();
      input.addEventListener("input", paintSwatch);
      input.addEventListener("change", () => exec(command, input.value));
    }
  );

  // execCommand only knows sizes 1-7, so apply 7 and swap it for the real size.
  $("jo-font-size").addEventListener("change", (e) => {
    const size = e.target.value;
    if (!size) return;
    exec("fontSize", 7);
    editor.querySelectorAll('font[size="7"], [style*="xxx-large"]').forEach((node) => {
      node.removeAttribute("size");
      node.style.fontSize = size;
    });
    e.target.value = "";
    render();
  });

  // ---- Export ----

  function showMessage(text, kind) {
    message.textContent = text;
    message.className = `message ${kind}`;
  }

  function capture() {
    // The email only uses system fonts (Segoe UI, Arial), so skip embedding
    // web fonts - that would try to read the cross-origin Google Fonts CSS.
    return htmlToImage.toBlob(email, { skipFonts: true });
  }

  function fileName() {
    const subject = $("jo-subject").value.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 100);
    return `${subject || "Job Order"}.png`;
  }

  async function withButton(btn, action) {
    btn.disabled = true;
    try {
      await action();
    } catch (err) {
      showMessage(`Could not create the image: ${(err && err.message) || err}`, "error");
    } finally {
      btn.disabled = false;
    }
  }

  $("jo-download-btn").addEventListener("click", (e) =>
    withButton(e.currentTarget, async () => {
      const url = URL.createObjectURL(await capture());
      const link = el("a");
      link.href = url;
      link.download = fileName();
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showMessage("Image downloaded.", "success");
    })
  );

  $("jo-copy-btn").addEventListener("click", (e) =>
    withButton(e.currentTarget, async () => {
      if (!navigator.clipboard || !window.ClipboardItem) {
        throw new Error("this browser blocks copying images here - use Download PNG instead.");
      }
      // Passing the promise (not the blob) keeps Safari's user-gesture check happy.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": capture() })]);
      showMessage("Image copied - paste it anywhere.", "success");
    })
  );

  DEFAULT_TO.forEach((values) => addRow($("jo-to"), values));
  DEFAULT_CC.forEach((values) => addRow($("jo-cc"), values));
  DEFAULT_ATTACHMENTS.forEach((values) => addRow($("jo-attachments"), values));
  render();
})();
