// numberToWords() is defined in number-to-words.js

function updateWordsFromTotalAmountPH() {
  const phInput = document.getElementById("total_amount_ph");
  const wordsInput = document.getElementById("total_amount_words");
  const value = phInput.value.trim();
  if (!value) {
    wordsInput.value = "";
    return;
  }
  const formatted = numberToWords(value);
  if (formatted) {
    wordsInput.value = formatted;
  }
}

function updateTotalAmountCHFFromExchange() {
  const exchange = parseAmount(document.getElementById("currency_exchange").value);
  const php = parseAmount(document.getElementById("total_amount_ph").value);
  if (Number.isNaN(exchange) || Number.isNaN(php) || exchange === 0) {
    return;
  }
  document.getElementById("total_amount_chf").value = formatMoneyInput(php / exchange);
}

function reformatOnBlur(event) {
  const formatted = formatMoneyInput(event.target.value);
  if (formatted) {
    event.target.value = formatted;
  }
}

document.getElementById("currency_exchange").addEventListener("input", updateTotalAmountCHFFromExchange);
document.getElementById("total_amount_ph").addEventListener("input", updateTotalAmountCHFFromExchange);
document.getElementById("total_amount_chf").addEventListener("blur", reformatOnBlur);
document.getElementById("total_amount_ph").addEventListener("input", updateWordsFromTotalAmountPH);
document.getElementById("total_amount_ph").addEventListener("blur", reformatOnBlur);

function showMessage(text, type) {
  const el = document.getElementById("form-message");
  el.textContent = text;
  el.className = `message ${type}`;
}

document.getElementById("contract-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const submitBtn = document.getElementById("submit-btn");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = value;
  });

  submitBtn.disabled = true;
  submitBtn.textContent = "Generating...";
  showMessage("", "");
  document.getElementById("form-message").className = "message";

  try {
    const response = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      showMessage(err.error || "Something went wrong generating the contract.", "error");
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    const filename = match ? match[1] : "Contract Form for ITB.docx";

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showMessage("Contract generated successfully. Download started.", "success");
  } catch (error) {
    showMessage("Network error while generating the contract.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Generate Contract";
  }
});
