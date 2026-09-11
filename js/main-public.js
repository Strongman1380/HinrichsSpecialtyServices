// Focused public-site behavior. Legacy enrollment and checkout code is intentionally excluded.
(function () {
  "use strict";

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.addEventListener("DOMContentLoaded", () => {
    initMobileNavigation();
    initScrollReveal();
    initBlogSearch();
    initContactForm();
    const requested = new URLSearchParams(window.location.search).get("service");
    const interest = document.querySelector("#contactForm [name=interest]");
    if (requested && interest && [...interest.options].some(o => o.value === requested)) interest.value = requested;
    initNewsletterForms();
    initSmoothAnchors();
    initLoadMore();
    const choice = document.getElementById('service-choice');
    const explanation = document.getElementById('service-explanation');
    const descriptions = { 'website-care': 'Website Care + Build is $150/month with up to five hours. New sites are developed progressively.', 'virtual-assistance': 'A custom VA for administration, organization, communication, and follow-through. We agree the scope before starting.', 'social-media': 'Social media management starts at an additional $50/month. Platforms, frequency, and workload determine the final fee.', 'technology-support': 'We help simplify your technology and workflows. Additional approved work is $30–$65/hour based on complexity.', consultation: 'We can help prioritize your needs and explain the options. No invented quote or delivery promise.' };
    choice?.addEventListener('change', () => { explanation.textContent = descriptions[choice.value]; });
  });

  function announce(message, type) {
    if (window.Toast && typeof window.Toast[type] === "function") window.Toast[type](message);
    else if (typeof window.showMessage === "function") window.showMessage(message, type);
    else if (type === "error") console.error(message);
  }

  function initMobileNavigation() {
    const toggle = document.querySelector(".nav-toggle");
    const menu = document.querySelector(".nav-menu");
    if (!toggle || !menu) return;

    toggle.setAttribute("aria-label", "Toggle navigation menu");
    toggle.setAttribute("aria-expanded", "false");

    const setOpen = (open) => {
      menu.classList.toggle("active", open);
      toggle.classList.toggle("active", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    const toggleMenu = () => setOpen(!menu.classList.contains("active"));

    toggle.addEventListener("click", toggleMenu);
    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu.classList.contains("active")) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!toggle.contains(event.target) && !menu.contains(event.target)) setOpen(false);
    });
    document.addEventListener("focusin", (event) => {
      if (!toggle.contains(event.target) && !menu.contains(event.target)) setOpen(false);
    });
    window.matchMedia("(max-width: 1100px)").addEventListener("change", () => setOpen(false));
  }

  function initScrollReveal() {
    const elements = document.querySelectorAll([
      ".panel",
      ".service-card",
      ".method-card",
      ".action-card",
      ".story-card",
      ".faq-item",
      ".article-card",
      ".benefit-item",
      ".feature-item",
      ".form-container",
    ].join(","));

    if (motionPreference.matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px 64px 0px" });

    elements.forEach((element, index) => {
      element.classList.add("reveal");
      element.style.transitionDelay = `${Math.min((index % 4) * 60, 180)}ms`;
      observer.observe(element);
    });
    motionPreference.addEventListener("change", () => {
      if (!motionPreference.matches) return;
      observer.disconnect();
      elements.forEach(element => element.classList.add("visible"));
    });
  }

  function initBlogSearch() {
    const search = document.getElementById("search-input");
    if (!search) return;
    const filters = [...document.querySelectorAll(".filter-btn")];
    const cards = [...document.querySelectorAll(".article-card")];

    const update = () => {
      const term = search.value.trim().toLowerCase();
      const category = document.querySelector(".filter-btn.active")?.dataset.category || "all";
      cards.forEach((card) => {
        const matchesText = !term || card.textContent.toLowerCase().includes(term);
        const matchesCategory = category === "all" || card.dataset.category === category;
        card.hidden = !(matchesText && matchesCategory);
      });
    };

    search.addEventListener("input", update);
    document.getElementById("search-button")?.addEventListener("click", update);
    filters.forEach((button) => button.addEventListener("click", () => {
      filters.forEach((item) => item.classList.toggle("active", item === button));
      update();
    }));
  }

  function initContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]');
      if (button.disabled) return;
      const label = button.textContent;
      button.disabled = true;
      button.textContent = "Sending...";

      try {
        if (!window.Database?.submitLeadToCRM) throw new Error("Lead service is unavailable");
        const result = await window.Database.submitLeadToCRM({
          firstName: form.firstName.value,
          lastName: form.lastName.value,
          email: form.email.value,
          phone: form.phone.value,
          organization: form.organization.value,
          interest: form.interest.value || "Contact Form",
          message: form.message.value,
          serviceRange: form.budget?.value || "",
          timeline: form.timeline?.value || "",
          privacyConsent: form.privacy?.checked === true,
          newsletterConsent: form.newsletter?.checked === true,
          website: form.website?.value || "",
          source: "contact-form",
        });
        if (!result.success) throw new Error(result.error || "Submission failed");
        window.dispatchEvent(new CustomEvent("hsst:analytics", { detail: { name: "lead_creation", params: { source: "contact-form" } } }));
        form.reset();
        announce("Thank you for your message. We'll respond as soon as possible.", "success");
        window.setTimeout(() => { window.location.href = "/success.html"; }, 900);
      } catch (error) {
        console.error("Contact submission failed", error);
        announce("Your message could not be sent. Please try again or contact us directly.", "error");
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  }

  function initNewsletterForms() {
    document.querySelectorAll(".newsletter-form").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = form.querySelector('input[type="email"]');
        const button = form.querySelector('button[type="submit"]');
        if (!email?.value || !email.checkValidity()) return email?.reportValidity();
        const label = button.textContent;
        button.disabled = true;
        button.textContent = "Submitting...";
        try {
          if (!window.Database?.submitLeadToCRM) throw new Error("Lead service is unavailable");
          const result = await window.Database.submitLeadToCRM({
            firstName: form.querySelector('input[name="firstName"]')?.value || form.querySelector('#newsletter-name')?.value || "Newsletter",
            newsletterConsent: form.querySelector('input[type="checkbox"]')?.checked === true,
            email: email.value,
            interest: "Newsletter Subscription",
            message: "Requested website newsletter updates.",
            source: "newsletter-form",
          });
          if (!result.success) throw new Error(result.error || "Subscription failed");
          window.dispatchEvent(new CustomEvent("hsst:analytics", { detail: { name: "lead_creation", params: { source: "newsletter-form" } } }));
          form.reset();
          announce("Your request was received.", "success");
        } catch (error) {
          console.error("Newsletter request failed", error);
          announce("Your request could not be sent. Please try again.", "error");
        } finally {
          button.disabled = false;
          button.textContent = label;
        }
      });
    });
  }

  function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener("click", (event) => {
      const selector = link.getAttribute("href");
      if (!selector || selector === "#") return;
      const target = document.querySelector(selector);
      if (!target) return;
      event.preventDefault();
      if (link.classList.contains("skip-link")) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
      target.scrollIntoView({ behavior: motionPreference.matches ? "auto" : "smooth", block: "start" });
    }));
  }

  function initLoadMore() {
    const button = document.getElementById("load-more-btn");
    if (!button) return;
    button.addEventListener("click", () => {
      announce("All current articles are already shown.", "info");
      button.hidden = true;
    });
  }
})();
