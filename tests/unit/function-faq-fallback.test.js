import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { getFaqResponse, getEscalationResponse } = require("../../HSP CRM/functions/handlers/faq-fallback.js");
const serviceInfo = JSON.parse(
  readFileSync(resolve("HSP CRM/functions/data/service-info.json"), "utf8"),
);

describe("Firebase FAQ fallback", () => {
  it("answers current website pricing and monthly hours", () => {
    const response = getFaqResponse("What does the website plan cost and how many hours do I get?", serviceInfo);
    expect(response).toContain("$150 per month");
    expect(response).toContain("5 hours");
    expect(response).toContain("$30-$65");
  });

  it("answers social pricing and payment questions from shared business data", () => {
    expect(getFaqResponse("How much is social media?", serviceInfo)).toContain("$50 per month");
    expect(getFaqResponse("Can I pay with Zelle?", serviceInfo)).toContain("Zelle");
  });

  it("escalates unknown questions without inventing an answer", () => {
    expect(getFaqResponse("Can you guarantee I will rank first next week?", serviceInfo)).toBeNull();
    expect(getEscalationResponse(serviceInfo)).toContain(serviceInfo.business.email);
  });
});
