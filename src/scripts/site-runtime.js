import { initAnalytics, trackButtonClick, trackEvent } from "./utils/analytics.js";

initAnalytics();

document.addEventListener("click", (event) => {
  const action = event.target.closest("a, button");
  if (!action) return;
  const label = action.dataset.analytics || action.textContent?.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!label) return;
  if (action.matches(".btn, .panel-cta, .nav-link, .admin-portal-fab, [data-analytics]")) {
    trackButtonClick(label, { destination: action.getAttribute("href") || "button" });
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  trackEvent("form_attempt", { form_name: form.id || form.getAttribute("name") || "website_form" });
});

window.addEventListener("hsst:analytics", (event) => {
  if (!event.detail?.name) return;
  trackEvent(event.detail.name, event.detail.params || {});
});
