import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let environment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "hsp-crm-rules-test",
    firestore: {
      rules: readFileSync(resolve("HSP CRM/firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterEach(async () => environment.clearFirestore());
afterAll(async () => environment.cleanup());

describe("payment access rules", () => {
  it("protects all operations collections and rejects an unverified administrator", async () => {
    const publicDb = environment.unauthenticatedContext().firestore();
    const adminDb = environment.authenticatedContext("UJjwxRbDcBTt2zukR9fl3MjkKur2", { email: "bhinrichs1380@gmail.com", email_verified: true }).firestore();
    const unverifiedDb = environment.authenticatedContext("UJjwxRbDcBTt2zukR9fl3MjkKur2", { email: "bhinrichs1380@gmail.com", email_verified: false }).firestore();
    for (const collection of ["tasks", "timeEntries", "servicePlans", "activity", "campaigns", "contacts", "payments"]) {
      await assertFails(getDoc(doc(publicDb, collection, "test")));
      await assertFails(getDoc(doc(unverifiedDb, collection, "test")));
      await assertSucceeds(getDoc(doc(adminDb, collection, "test")));
      await assertFails(setDoc(doc(adminDb, collection, "test"), { bypass: true }));
    }
  });
  it("blocks public payment reads and writes", async () => {
    const publicDb = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(publicDb, "payments", "public-test")));
    await assertFails(setDoc(doc(publicDb, "payments", "public-test"), { amount: 150 }));
    const wrongAccount = environment.authenticatedContext("different-account", { email: "bhinrichs1380@gmail.com", email_verified: true }).firestore();
    await assertFails(getDoc(doc(wrongAccount, "payments", "public-test")));
  });

  it("allows administrator reads but requires server financial writes", async () => {
    const adminDb = environment.authenticatedContext("UJjwxRbDcBTt2zukR9fl3MjkKur2", { email: "bhinrichs1380@gmail.com", email_verified: true }).firestore();
    const payment = doc(adminDb, "payments", "admin-test");
    await assertFails(setDoc(payment, { amount: 150, method: "check", status: "received" }));
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "payments", "admin-test"), { amount: 150 }));
    const snapshot = await assertSucceeds(getDoc(payment));
    expect(snapshot.data().amount).toBe(150);
  });

  it("prevents direct invoice writes even for the administrator", async () => {
    const publicDb = environment.unauthenticatedContext().firestore();
    const adminDb = environment.authenticatedContext("UJjwxRbDcBTt2zukR9fl3MjkKur2", { email: "bhinrichs1380@gmail.com", email_verified: true }).firestore();
    const publicInvoice = doc(publicDb, "invoices", "managed-invoice");
    const adminInvoice = doc(adminDb, "invoices", "managed-invoice");

    await assertFails(setDoc(publicInvoice, { invoiceNumber: "INV-TEST", status: "draft" }));
    await assertFails(setDoc(adminInvoice, { invoiceNumber: "INV-TEST", status: "draft" }));
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "invoices", "managed-invoice"), { invoiceNumber: "INV-TEST", status: "draft" }));
    await assertFails(updateDoc(adminInvoice, { status: "sent", notes: "Bypass attempt" }));
    expect((await assertSucceeds(getDoc(adminInvoice))).data().status).toBe("draft");
    await assertFails(updateDoc(publicInvoice, { status: "paid" }));
    await assertFails(deleteDoc(adminInvoice));
    expect((await assertSucceeds(getDoc(adminInvoice))).exists()).toBe(true);
  });

  it("keeps legacy nested payments read-only", async () => {
    const adminDb = environment.authenticatedContext("UJjwxRbDcBTt2zukR9fl3MjkKur2", { email: "bhinrichs1380@gmail.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(adminDb, "contacts", "client", "payments", "legacy"), { amount: 50 }));
  });

  it("allows public reads only for active surveys", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "surveys", "active"), { id: "active", active: true });
      await setDoc(doc(adminDb, "surveys", "closed"), { id: "closed", active: false });
    });
    const publicDb = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, "surveys", "active")));
    await assertFails(getDoc(doc(publicDb, "surveys", "closed")));
  });
});
