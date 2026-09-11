const { applyCors } = require("./cors");
const { verifyAdmin } = require("./auth");
const admin = require("firebase-admin");

const PAYMENT_METHODS = "Venmo, Cash App, Zelle, check, wire, cash, or another agreed method";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function itemAmount(item) {
  const rate = Number(item?.rate || 0);
  if (item?.isHourly) return (Number(item.hours || 0) + Number(item.minutes || 0) / 60) * rate;
  return Number(item?.qty || 1) * rate;
}

function quantityLabel(item) {
  if (!item?.isHourly) return String(Number(item?.qty || 1));
  const hours = Number(item.hours || 0);
  const minutes = Number(item.minutes || 0);
  return `${hours ? `${hours}h ` : ""}${minutes ? `${minutes}m` : ""}`.trim() || "0h";
}

module.exports = async (req, res) => {
  const corsAllowed = applyCors(req, res);
  if (req.method === "OPTIONS") return corsAllowed ? res.status(204).end() : res.status(403).end();
  if (!corsAllowed) return res.status(403).json({ error: "Origin not allowed" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const administrator = await verifyAdmin(req);
  if (!administrator.ok) return res.status(administrator.status).json({ error: administrator.error });

  const invoiceId = String(req.body?.invoiceId || "").trim();
  if (!/^[\w-]{1,200}$/.test(invoiceId)) return res.status(400).json({ error: "Invoice ID required" });
  const invoiceSnapshot = await admin.firestore().collection("invoices").doc(invoiceId).get();
  if (!invoiceSnapshot.exists) return res.status(404).json({ error: "Invoice not found" });
  const invoice = { id: invoiceSnapshot.id, ...invoiceSnapshot.data() };
  if (!Array.isArray(invoice.items)) return res.status(400).json({ error: "Invoice items are invalid" });

  if (invoice.accountingVersion !== 2) return res.status(409).json({ error: "Reconcile the legacy invoice before preparing an email." });
  const subtotal = Number(invoice.subtotal);
  const tax = Number(invoice.tax);
  const total = Number(invoice.total);
  const amountPaid = Math.max(0, Number(invoice.amountPaid || 0));
  const balanceDue = Math.max(0, Math.round((total - amountPaid) * 100) / 100);
  if (!Number.isFinite(total) || total <= 0) {
    return res.status(400).json({ error: "Invoice total must be greater than $0" });
  }

  const rows = invoice.items
    .slice(0, 100)
    .map(
      (item) => `<tr>
        <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#334155">${escapeHtml(String(item.description || "Invoice item").slice(0, 300))}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;text-align:right;white-space:nowrap">${escapeHtml(quantityLabel(item))}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;text-align:right;white-space:nowrap">${money(itemAmount(item))}</td>
      </tr>`,
    )
    .join("");

  const emailHtml = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 14px;background:#f1f5f9">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <tr><td style="padding:28px 34px;background:#132e54;color:#f8fafc">
          <p style="margin:0;font-size:22px;font-weight:800">Hinrichs Specialty Services and Technology</p>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:13px">(402) 759-2210 | bhinrichs1380@gmail.com</p>
        </td></tr>
        <tr><td style="padding:26px 34px 16px">
          <table width="100%"><tr>
            <td><p style="margin:0;font-size:25px;font-weight:800">Invoice</p><p style="margin:4px 0 0;color:#64748b">${escapeHtml(invoice.invoiceNumber)}</p></td>
            <td align="right"><p style="margin:0;color:#64748b;font-size:12px">Due date</p><p style="margin:4px 0 0;font-weight:700">${escapeHtml(invoice.dueDate || "On receipt")}</p></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 34px 22px">
          <p style="margin:0 0 4px;color:#64748b;font-size:12px">Bill to</p>
          <p style="margin:0;font-size:18px;font-weight:700">${escapeHtml(invoice.clientName)}</p>
          <p style="margin:4px 0 0;color:#64748b">${escapeHtml(invoice.clientEmail)}</p>
        </td></tr>
        <tr><td style="padding:0 34px">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
            <thead><tr style="background:#f8fafc"><th align="left" style="padding:10px 14px">Description</th><th align="right" style="padding:10px 14px">Quantity</th><th align="right" style="padding:10px 14px">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </td></tr>
        <tr><td style="padding:20px 34px">
          <table align="right" width="280" cellpadding="4"><tr><td>Subtotal</td><td align="right">${money(subtotal)}</td></tr><tr><td>Tax (${Number(invoice.taxPct || 0).toFixed(2)}%)</td><td align="right">${money(tax)}</td></tr><tr><td>Invoice total</td><td align="right">${money(total)}</td></tr><tr><td>Amount paid</td><td align="right">${money(amountPaid)}</td></tr><tr><td style="font-size:18px;font-weight:800">Balance due</td><td align="right" style="font-size:18px;font-weight:800;color:#d97706">${money(balanceDue)}</td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 34px;background:#fff7ed;border-top:1px solid #fed7aa">
          <p style="margin:0 0 8px;font-weight:800;color:#9a3412">Payment options</p>
          <p style="margin:0;color:#7c2d12;line-height:1.6">HSST accepts ${PAYMENT_METHODS}. Reply to this invoice or call (402) 759-2210 to confirm the method and receive the correct payment instructions. Do not send sensitive banking information by email.</p>
        </td></tr>
        ${invoice.notes ? `<tr><td style="padding:22px 34px"><p style="margin:0 0 6px;font-weight:700">Notes</p><p style="margin:0;color:#64748b;line-height:1.6">${escapeHtml(String(invoice.notes).slice(0, 3000))}</p></td></tr>` : ""}
        <tr><td style="padding:18px 34px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center">Questions? Reply to this message or call (402) 759-2210.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return res.json({
    success: true,
    emailHtml,
    emailText: `Hi ${invoice.clientName || ""},\n\nInvoice ${invoice.invoiceNumber} is ready.\nBalance due: ${money(balanceDue)}\nOverpayment credit: ${money(invoice.creditAmount)}\nDue date: ${invoice.dueDate}\n\nHSST accepts ${PAYMENT_METHODS}. Reply to confirm your preferred method and receive the correct payment instructions.\n\nThank you,\nHinrichs Specialty Services and Technology\n(402) 759-2210`,
    subject: `Invoice ${String(invoice.invoiceNumber || "").slice(0, 80)} from HSST`,
    balanceDue,
    paymentMethods: PAYMENT_METHODS,
    warning: "Confirm the client's preferred payment method before sending account instructions.",
  });
};
