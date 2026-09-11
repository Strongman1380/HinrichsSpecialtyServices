import { describe, expect, it } from "vitest";
import { calculateInvoicePaymentState, filterPayments } from "../../HSP CRM/src/payment-utils.js";

describe("payment utilities", () => {
  it("calculates unpaid, partial, and paid invoice states", () => {
    expect(calculateInvoicePaymentState(150, [])).toEqual({ amountPaid: 0, balanceDue: 150, paymentStatus: "unpaid" });
    expect(calculateInvoicePaymentState(150, [{ amount: 50 }])).toEqual({
      amountPaid: 50,
      balanceDue: 100,
      paymentStatus: "partially_paid",
    });
    expect(calculateInvoicePaymentState(150, [{ amount: 75 }, { amount: 75 }])).toEqual({
      amountPaid: 150,
      balanceDue: 0,
      paymentStatus: "paid",
    });
  });

  it("never creates a negative balance from an overpayment", () => {
    expect(calculateInvoicePaymentState(150, [{ amount: 200 }])).toEqual({
      amountPaid: 200,
      balanceDue: 0,
      paymentStatus: "paid",
    });
  });

  it("filters by method, link state, date, and search", () => {
    const payments = [
      { id: "one", contactName: "River County", method: "check", status: "received", paymentDate: "2026-09-01", invoiceId: "inv-1" },
      { id: "two", contactName: "Prairie Clinic", method: "zelle", status: "pending", paymentDate: "2026-08-01", reference: "Fall work" },
    ];
    expect(filterPayments(payments, { method: "check", invoiceId: "linked" }).map((item) => item.id)).toEqual(["one"]);
    expect(filterPayments(payments, { dateFrom: "2026-08-15", search: "river" }).map((item) => item.id)).toEqual(["one"]);
    expect(filterPayments(payments, { status: "pending" }).map((item) => item.id)).toEqual(["two"]);
  });
});
