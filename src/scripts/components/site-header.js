/**
 * Site Header Web Component
 * Reusable header/navigation component
 */

class SiteHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    const currentPage = this.getAttribute("current-page") || "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .header {
          background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(10, 10, 15, 0.95) 100%);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.055);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(59, 130, 246, 0.08);
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
        }

        .nav-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 4rem;
        }

        .nav-logo h2 {
          background: linear-gradient(135deg, var(--blue-light, #60a5fa) 0%, var(--blue, #3b82f6) 40%, var(--orange, #f97316) 80%, var(--orange-light, #fb923c) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
          font-size: 1.5rem;
          margin: 0;
        }

        .nav-menu {
          display: flex;
          list-style: none;
          gap: 2rem;
          margin: 0;
          padding: 0;
        }

        .nav-link {
          text-decoration: none;
          color: var(--muted, rgba(240, 244, 255, 0.6));
          font-weight: 500;
          transition: all 0.3s ease;
          position: relative;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          display: block;
        }

        .nav-link:hover {
          color: var(--foreground, #f0f4ff);
          background: rgba(255, 255, 255, 0.055);
          transform: translateY(-2px);
        }

        .nav-link.active {
          color: var(--blue-light, #60a5fa);
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .ai-art-link {
          border: 1px solid rgba(245, 130, 32, 0.35);
          color: #f5c07a !important;
          background: rgba(245, 130, 32, 0.06);
        }

        .ai-art-link:hover {
          background: rgba(245, 130, 32, 0.14) !important;
          border-color: rgba(245, 130, 32, 0.8) !important;
          color: #f58220 !important;
          text-shadow: 0 0 16px rgba(245, 130, 32, 0.5) !important;
        }

        .ai-art-link.active {
          background: rgba(245, 130, 32, 0.12) !important;
          border-color: rgba(245, 130, 32, 0.6) !important;
          color: #f58220 !important;
        }

        .admin-crm-btn {
          border: 1px solid rgba(59, 130, 246, 0.18) !important;
          color: var(--blue-light, #60a5fa) !important;
          background: rgba(59, 130, 246, 0.07) !important;
        }

        .admin-crm-btn:hover {
          background: rgba(59, 130, 246, 0.14) !important;
          border-color: rgba(59, 130, 246, 0.35) !important;
          color: var(--foreground, #f0f4ff) !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 0 14px rgba(59, 130, 246, 0.3) !important;
          transform: translateY(-1px) scale(1.03);
        }

        .nav-toggle {
          display: none;
          flex-direction: column;
          cursor: pointer;
          gap: 4px;
          background: none;
          border: none;
          padding: 0.5rem;
        }

        .nav-toggle span {
          width: 25px;
          height: 3px;
          background-color: var(--muted, rgba(240, 244, 255, 0.6));
          transition: 0.3s;
          border-radius: 2px;
        }

        .nav-toggle.active span:nth-child(1) {
          transform: rotate(45deg) translate(5px, 5px);
        }

        .nav-toggle.active span:nth-child(2) {
          opacity: 0;
        }

        .nav-toggle.active span:nth-child(3) {
          transform: rotate(-45deg) translate(7px, -6px);
        }

        @media (max-width: 768px) {
          .nav-menu {
            position: fixed;
            top: 4rem;
            left: -100%;
            flex-direction: column;
            background: linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(10, 10, 15, 0.98) 100%);
            width: 100%;
            padding: 2rem;
            gap: 1rem;
            transition: left 0.3s ease;
            border-bottom: 1px solid rgba(59, 130, 246, 0.2);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }

          .nav-menu.active {
            left: 0;
          }

          .nav-toggle {
            display: flex;
          }

          .nav-link {
            padding: 1rem;
            border: 1px solid rgba(59, 130, 246, 0.1);
            width: 100%;
            text-align: center;
          }
        }
      </style>

      <header class="header">
        <nav>
          <div class="nav-container">
            <div class="nav-logo">
              <h2>Hinrichs Specialty Services and Technology</h2>
            </div>
            <ul class="nav-menu">
              <li><a href="/index.html" class="nav-link ${currentPage === "home" ? "active" : ""}">Home</a></li>
              <li><a href="/our-story.html" class="nav-link ${currentPage === "our-story" ? "active" : ""}">Our Story</a></li>
              <li><a href="/digital-solutions.html" class="nav-link ${currentPage === "digital-solutions" ? "active" : ""}">Digital Solutions</a></li>
              <li><a href="virtual-assistance.html" class="nav-link">Virtual Assistance</a></li>
              <li><a href="/portfolio.html" class="nav-link ${currentPage === "portfolio" ? "active" : ""}">Portfolio</a></li>
              <li><a href="/contact.html" class="nav-link ${currentPage === "contact" ? "active" : ""}">Contact</a></li>
              <li><a href="/crm/login" class="nav-link admin-crm-btn" target="_blank" rel="noopener noreferrer">&#x1F512; Admin CRM</a></li>
            </ul>
            <button class="nav-toggle" aria-label="Toggle navigation menu">
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </nav>
      </header>
    `;
  }

  setupEventListeners() {
    const navToggle = this.shadowRoot.querySelector(".nav-toggle");
    const navMenu = this.shadowRoot.querySelector(".nav-menu");
    const navLinks = this.shadowRoot.querySelectorAll(".nav-link");

    if (navToggle && navMenu) {
      navToggle.addEventListener("click", () => {
        navMenu.classList.toggle("active");
        navToggle.classList.toggle("active");
      });

      // Close menu when clicking on a link
      navLinks.forEach((link) => {
        link.addEventListener("click", () => {
          navMenu.classList.remove("active");
          navToggle.classList.remove("active");
        });
      });

      // Close menu when clicking outside
      document.addEventListener("click", (event) => {
        if (!this.shadowRoot.contains(event.target)) {
          navMenu.classList.remove("active");
          navToggle.classList.remove("active");
        }
      });
    }
  }
}

customElements.define("site-header", SiteHeader);

export default SiteHeader;
