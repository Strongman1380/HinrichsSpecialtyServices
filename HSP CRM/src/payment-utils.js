export const PAYMENT_METHODS = [
  { value: "venmo", label: "Venmo" },
  { value: "cash-app", label: "Cash App" },
  { value: "zelle", label: "Zelle" },
  { value: "check", label: "Check" },
  { value: "wire", label: "Wire" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export const PAYMENT_STATUSES = [
  { value: "received", label: "Received" },
  { value: "pending", label: "Pending" },
  { value: "reversed", label: "Reversed" },
];

export function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function calculateInvoicePaymentState(total, payments) {
  const invoiceTotal = Math.max(0, Number(total || 0));
  const amountPaid = Math.max(0, (payments || []).reduce((sum, payment) => sum + (payment.status && payment.status !== 'received' ? 0 : Math.round(Number(payment.amount || 0) * 100)), 0) / 100);
  const balanceDue = Math.max(0, Math.round((invoiceTotal - amountPaid) * 100) / 100);
  const paymentStatus = amountPaid <= 0 ? "unpaid" : balanceDue <= 0 ? "paid" : "partially_paid";
  return { amountPaid: Math.round(amountPaid * 100) / 100, balanceDue, paymentStatus };
}

export function paymentMethodLabel(method) {
  return PAYMENT_METHODS.find((entry) => entry.value === method)?.label || "Other";
}

export function paymentStatusLabel(status) {
  return PAYMENT_STATUSES.find((entry) => entry.value === status)?.label || "Received";
}

export function filterPayments(payments, filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  return (payments || []).filter((payment) => {
    if (filters.contactId && payment.contactId !== filters.contactId) return false;
    if (filters.invoiceId === "linked" && !payment.invoiceId) return false;
    if (filters.invoiceId === "unlinked" && payment.invoiceId) return false;
    if (filters.invoiceId && !["linked", "unlinked"].includes(filters.invoiceId) && payment.invoiceId !== filters.invoiceId) return false;
    if (filters.method && payment.method !== filters.method) return false;
    if (filters.status && payment.status !== filters.status) return false;
    if (filters.dateFrom && payment.paymentDate < filters.dateFrom) return false;
    if (filters.dateTo && payment.paymentDate > filters.dateTo) return false;
    if (search) {
      const haystack = `${payment.contactName || ""} ${payment.reference || ""} ${payment.notes || ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
