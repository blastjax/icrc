// numberToWords() is defined in number-to-words.js

const MAX_ENTRIES = 13;
const entriesContainer = document.getElementById("swa-entries");
const entryTemplate = document.getElementById("swa-entry-template");
const addEntryBtn = document.getElementById("swa-add-btn");
const limitNote = document.getElementById("swa-limit-note");

function entryRows() {
  return Array.from(entriesContainer.querySelectorAll(".swa-entry"));
}

function updateAddButtonState() {
  const atLimit = entryRows().length >= MAX_ENTRIES;
  addEntryBtn.disabled = atLimit;
  limitNote.style.display = atLimit ? "block" : "none";
}

function updateRemoveButtons() {
  const rows = entryRows();
  rows.forEach((row) => {
    row.querySelector(".swa-remove-btn").disabled = rows.length <= 1;
  });
}

function applyPerDiemRule(row) {
  const detailInput = row.querySelector(".swa-detail");
  const dateInput = row.querySelector(".swa-date");
  const receiptInput = row.querySelector(".swa-receipt");
  const isPerDiem = detailInput.value.trim().startsWith("Staff Per Diem");
  dateInput.required = !isPerDiem;
  receiptInput.required = !isPerDiem;
  dateInput.closest(".field").classList.toggle("optional", isPerDiem);
  receiptInput.closest(".field").classList.toggle("optional", isPerDiem);
}

function addEntryRow() {
  if (entryRows().length >= MAX_ENTRIES) return;
  entriesContainer.appendChild(entryTemplate.content.cloneNode(true));
  const row = entriesContainer.lastElementChild;

  row.querySelector(".swa-detail").addEventListener("input", () => applyPerDiemRule(row));
  row.querySelector(".swa-remove-btn").addEventListener("click", () => {
    row.remove();
    updateAddButtonState();
    updateRemoveButtons();
  });

  applyPerDiemRule(row);
  updateAddButtonState();
  updateRemoveButtons();
}

addEntryBtn.addEventListener("click", addEntryRow);
addEntryRow();

document.getElementById("wad-form").addEventListener("reset", () => {
  entriesContainer.innerHTML = "";
  addEntryRow();
});

function updateWordsFromWadAmount() {
  const amountInput = document.getElementById("wad_amount");
  const wordsInput = document.getElementById("wad_amount_words");
  const value = amountInput.value.trim();
  if (!value) {
    wordsInput.value = "";
    return;
  }
  const formatted = numberToWords(value);
  if (formatted) {
    wordsInput.value = formatted;
  }
}

function reformatOnBlur(event) {
  const formatted = formatMoneyInput(event.target.value);
  if (formatted) {
    event.target.value = formatted;
  }
}

document.getElementById("wad_amount").addEventListener("input", updateWordsFromWadAmount);
document.getElementById("wad_amount").addEventListener("blur", reformatOnBlur);

function showMessage(text, type) {
  const el = document.getElementById("wad-form-message");
  el.textContent = text;
  el.className = `message ${type}`;
}

document.getElementById("wad-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const submitBtn = document.getElementById("wad-submit-btn");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = value;
  });

  payload["SWA Entries"] = entryRows().map((row) => ({
    "SWA Date": row.querySelector(".swa-date").value,
    "SWA Receipt Number": row.querySelector(".swa-receipt").value.trim(),
    "SWA Detail": row.querySelector(".swa-detail").value.trim(),
    "SWA Expenses": row.querySelector(".swa-expenses").value.trim(),
  }));

  submitBtn.disabled = true;
  submitBtn.textContent = "Generating...";
  showMessage("", "");
  document.getElementById("wad-form-message").className = "message";

  try {
    const response = await fetch("/generate-wad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      showMessage(err.error || "Something went wrong generating the Working Advance document.", "error");
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    const filename = match ? match[1] : "WAD_MANGUIAT.docx";

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showMessage("Working Advance document generated successfully. Download started.", "success");
  } catch (error) {
    showMessage("Network error while generating the Working Advance document.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Generate Working Advance";
  }
});
