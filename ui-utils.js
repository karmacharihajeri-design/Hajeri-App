// ==========================================================
// ui-utils.js — छोट्या सूचना (toast notifications) दाखवण्यासाठी सामायिक मदत-फंक्शन
// ==========================================================

/** स्क्रीनच्या वर थोडा वेळ दिसणारी सूचना दाखवते (उदा. "कोन कॅप्चर झाला ✓") */
function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = "toast" + (type === "err" ? " toast-err" : "");
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}
