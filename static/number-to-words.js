const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function chunkToWords(n) {
  let words = "";
  if (n >= 100) {
    words += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    const tens = TENS[Math.floor(n / 10)];
    const ones = n % 10;
    words += ones > 0 ? `${tens}-${ONES[ones].toLowerCase()} ` : `${tens} `;
  } else if (n > 0) {
    words += ONES[n] + " ";
  }
  return words.trim();
}

function formatWithApostrophes(wholePart) {
  return wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// Strips thousands separators so an already-formatted amount (e.g. "15'000.00") can be parsed.
function parseAmount(value) {
  return parseFloat(String(value).replace(/[,']/g, ""));
}

// Formats a raw numeric string as n'nnn'nnn.nn. Returns "" if not a valid number.
function formatMoneyInput(value) {
  const amount = parseAmount(value);
  if (Number.isNaN(amount)) return "";
  const [whole, decimals] = amount.toFixed(2).split(".");
  return `${formatWithApostrophes(whole)}.${decimals}`;
}

// Produces "PHP n'nnn'nnn.nn (Words Pesos cc/100)".
function numberToWords(value) {
  const amount = parseFloat(String(value).replace(/[,']/g, ""));
  if (Number.isNaN(amount)) return "";

  const wholePart = Math.floor(amount);
  const centavos = Math.round((amount - wholePart) * 100);
  const centavosStr = String(centavos).padStart(2, "0");
  const formattedNumber = `${formatWithApostrophes(wholePart)}.${centavosStr}`;

  const scales = ["", "Thousand", "Million", "Billion"];
  let remaining = wholePart;
  const groups = [];
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  let words = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    words += `${chunkToWords(groups[i])} ${scales[i]} `;
  }
  words = words.trim().replace(/\s+/g, " ") || "Zero";

  return `PHP ${formattedNumber} (${words} Pesos ${centavosStr}/100)`;
}
