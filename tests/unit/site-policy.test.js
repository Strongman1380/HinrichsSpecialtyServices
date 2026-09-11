import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getChatbotFallback } from "../../src/scripts/utils/chatbot-fallback.js";
import { PUBLIC_PAGES, renderSitemap } from "../../src/scripts/site-pages.js";
import { renderPublicPage } from "../../src/components/public-pages-plugin.js";

const root = resolve(process.cwd());
const pagePaths = PUBLIC_PAGES.map(page => page.file);
const indexablePages = PUBLIC_PAGES.filter(page => page.indexable !== false).map(page => page.file);
const read = (path) => {
  const content = readFileSync(resolve(root, path), "utf8");
  return pagePaths.includes(path) ? renderPublicPage(content, path) : content;
};

describe("production content policy", () => {
  it("keeps the website Firebase environment out of the CRM build", () => {
    const deployScript = read("scripts/deploy-hostinger.sh");

    expect(deployScript).toContain("source .env");
    expect(deployScript).not.toMatch(/set\s+-a[\s\S]*source\s+\.env/);
  });

  it("publishes only the approved pricing and service rules", () => {
    const content = [
      ...pagePaths.map(read),
      read("js/main-public.js"),
      read("js/chatbot.js"),
      read("HSP CRM/functions/data/service-info.json"),
    ].join("\n");

    for (const forbidden of [
      /\$1,?500/i,
      /buy\.stripe\.com/i,
      /\bstripe\b/i,
      /free bid/i,
      /custom build fee/i,
      /subscription-free/i,
      /per-project-only/i,
      /membership\.html/i,
      /AI Art Portfolio/i,
      /digital prints?/i,
      /100\+ businesses/i,
      /300%/i,
      /24\/7 support/i,
      /\bmembership\b/i,
      /domestic violence/i,
      /probation/i,
      /justice reform/i,
      /gumroad/i,
    ]) expect(content).not.toMatch(forbidden);

    expect(content).toContain("$150 per month");
    expect(content).toContain("five hours");
    expect(content).toContain("$30-$65 per hour");
    expect(content).toContain("$50 per month");
    expect(content).toContain("advance approval");
  });

  it("uses the canonical www host, favicon, logo hook, and same-origin CRM route", () => {
    for (const page of indexablePages) {
      const html = read(page);
      expect(html).toMatch(/<link rel="canonical" href="https:\/\/www\.hinrichsspecialtyservices\.com\//);
      expect(html).toContain('href="/favicon.svg"');
      expect(html).toContain('class="nav-logo-link"');
      expect(html).toContain('href="/crm/login"');
      expect(html).not.toMatch(/href="\/crm\/login"[^>]*target="_blank"/s);
    }
    expect(existsSync(resolve(root, "images/hinrichs-specialty-services-logo.png"))).toBe(true);
  });

  it("has no broken local links in production pages", () => {
    const missing = [];
    for (const page of pagePaths) {
      for (const [, href] of read(page).matchAll(/href=["']([^"']+)["']/g)) {
        const clean = href.split(/[?#]/)[0];
        if (!clean || clean.startsWith("#") || clean.startsWith("/") || /^(https?:|mailto:|tel:)/.test(clean)) continue;
        if (!existsSync(resolve(root, dirname(page), decodeURIComponent(clean)))) missing.push(`${page} -> ${href}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps the sitemap and robots policy aligned", () => {
    const sitemap = read("sitemap.xml");
    const robots = read("robots.txt");
    for (const page of indexablePages) {
      const path = page === "index.html" ? "/" : `/${page}`;
      expect(sitemap).toContain(`<loc>https://www.hinrichsspecialtyservices.com${path}</loc>`);
    }
    expect(sitemap).not.toContain("/crm/");
    expect(sitemap).not.toContain("membership.html");
    expect(sitemap).toBe(renderSitemap());
    expect(robots).not.toMatch(/^Disallow:\s*\/crm\/?\s*$/m);
    expect(robots).toContain("Allow: /crm/");
    expect(read("public/.htaccess")).toContain('Header always set X-Robots-Tag "noindex, nofollow" "expr=%{REQUEST_URI} =~ m#^/crm(?:/|$)#"');
    expect(robots).toContain("Sitemap: https://www.hinrichsspecialtyservices.com/sitemap.xml");
  });

  it("uses one maintained chatbot knowledge source", () => {
    const info = JSON.parse(read("HSP CRM/functions/data/service-info.json"));
    expect(info.websitePlan.price).toBe("$150 per month");
    expect(info.websitePlan.includedHours).toBe(5);
    expect(info.additionalWork.range).toBe("$30-$65 per hour");
    expect(info.socialMedia.startingPrice).toContain("$50 per month");
    expect(info.paymentMethods).toEqual(expect.arrayContaining(["Venmo", "Cash App", "Zelle", "check", "wire", "cash"]));

    expect(getChatbotFallback("How much does a website cost?", info)).toContain("$150 per month");
    expect(getChatbotFallback("Do hours roll over?", info)).toContain("$30-$65 per hour");
    expect(getChatbotFallback("Can you manage Instagram?", info)).toContain("$50 per month");
    expect(getChatbotFallback("Can I pay with Zelle?", info)).toContain("Zelle");
    expect(getChatbotFallback("Tell me something not listed", info)).toContain(businessPhone(info));
  });
});

function businessPhone(info) {
  return info.business.phone;
}
