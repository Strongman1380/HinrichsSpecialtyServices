import { defineConfig, loadEnv } from "vite";
import compression from "vite-plugin-compression";
import legacy from "@vitejs/plugin-legacy";
import { createHtmlPlugin } from "vite-plugin-html";
import path from "node:path";
import { existsSync, cpSync, readFileSync } from "node:fs";
import { publicPagesPlugin } from "./src/components/public-pages-plugin.js";
import { publicPageInputs } from "./src/scripts/site-pages.js";

const serviceInfo = JSON.parse(readFileSync(new URL("./HSP CRM/functions/data/service-info.json", import.meta.url), "utf8"));

// Inline development API middleware so `npm run dev` works end-to-end.
function devApiPlugin() {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith("/api/")) return next();

        // Parse body
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        let body = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {}

        // ── /api/chat ──────────────────────────────────────────
        if (req.url === "/api/chat" && req.method === "POST") {
          const apiKey = process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY not set in .env" }));
          }

          const history = Array.isArray(body.history)
            ? body.history.slice(-10)
            : Array.isArray(body.messages)
              ? body.messages.slice(-10)
              : [];
          const message = String(body.message || history.at(-1)?.content || "").trim().slice(0, 600);
          if (!message) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "A message is required" }));
          }
          const messages = history.length ? history : [{ role: "user", content: message }];
          if (messages.at(-1)?.content !== message) messages.push({ role: "user", content: message });

          const SYSTEM_PROMPT = `You are the website assistant for HSST. Use only the business information below. Never invent a price, guarantee, delivery date, discount, or account detail. If the answer is not present, offer to connect the visitor with Brandon. When a visitor asks to be contacted and provides a name, email, and need, append [LEAD:{"name":"THEIR NAME","email":"THEIR EMAIL","interest":"WHAT THEY NEED"}] to the response.\n\n${JSON.stringify(serviceInfo)}`;

          try {
            const upstream = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 512,
                system: SYSTEM_PROMPT,
                messages: messages.slice(-12),
              }),
            });
            const data = await upstream.json();
            res.writeHead(upstream.status, { "Content-Type": "application/json" });
            if (!upstream.ok) return res.end(JSON.stringify({ error: data.error?.message || "AI error" }));
            return res.end(JSON.stringify({ content: data.content?.[0]?.text || "" }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Internal error" }));
          }
        }

        // Unknown /api/* route
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      });
    },
  };
}

const repoBase = "/";

// Match Hostinger's CRM SPA fallback during local release verification.
const crmPreviewPlugin = () => ({
  name: 'crm-preview-routes',
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      const pathname = req.url?.split('?')[0] || '';
      if (/^\/crm(?:\/|$)/.test(pathname) && !path.extname(pathname)) req.url = '/crm/index.html';
      next();
    });
  },
});

const copyStaticFoldersPlugin = () => ({
  name: "copy-static-folders",
  closeBundle() {
    const staticFolders = ["js", "images"];
    const publishedStaticAssets = new Set([
      "js/database.js",
      "js/main-public.js",
      "js/toast.js",
      "js/validation.js",
      "images/hero-banner.jpg",
      "images/hero-banner.webp",
      "images/hero-banner-480.webp",
      "images/hero-banner-768.webp",
      "images/hinrichs-specialty-services-logo.png",
      "images/hsst-logo-96.webp",
      "images/va-hero.webp",
      "images/portfolio",
      "images/portfolio/general-exteriors.webp",
    ]);
    const staticFiles = [
      "robots.txt",
      "favicon.svg",
      "favicon.ico",
      "apple-touch-icon.png",
    ];

    for (const folderName of staticFolders) {
      const sourcePath = path.resolve(folderName);
      const targetPath = path.resolve("dist", folderName);

      if (existsSync(sourcePath)) {
        cpSync(sourcePath, targetPath, {
          recursive: true,
          filter: (source) => {
            const relative = path.relative(process.cwd(), source).split(path.sep).join("/");
            return relative === folderName || publishedStaticAssets.has(relative);
          },
        });
      }
    }

    for (const fileName of staticFiles) {
      const sourcePath = path.resolve(fileName);
      const targetPath = path.resolve("dist", fileName);

      if (existsSync(sourcePath)) {
        cpSync(sourcePath, targetPath);
      }
    }

    cpSync(path.resolve("HSP CRM/functions/data/service-info.json"), path.resolve("dist/service-info.json"));
  },
});

const makeClientEnv = () => ({
  CRM_API_BASE_URL: process.env.VITE_CRM_API_BASE_URL || "https://hsp-crm.web.app",
});

const adSensePlugin = () => ({
  name: "adsense",
  transformIndexHtml() {
    return [
      {
        tag: "script",
        attrs: {
          async: true,
          src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7946657496151275",
          crossorigin: "anonymous",
        },
        injectTo: "head",
      },
    ];
  },
});

const runtimeEnvPlugin = () => ({
  name: "runtime-env",
  transformIndexHtml() {
    return [
      {
        tag: "script",
        children: `window.HSST_ENV = ${JSON.stringify(makeClientEnv())};window.HSST_SERVICE_INFO = ${JSON.stringify(serviceInfo)};`,
        injectTo: "head",
      },
    ];
  },
});

const siteRuntimePlugin = () => ({
  name: "site-runtime",
  transformIndexHtml: {
    order: "pre",
    handler(html) {
      return html.replace(
        "</body>",
        '<script type="module" src="/src/scripts/site-runtime.js"></script></body>',
      );
    },
  },
});

const localFontPlugin = () => ({
  name: "local-font-stack",
  transformIndexHtml: {
    order: "pre",
    handler(html) {
      return html
        .replace(/\s*<link[^>]+href=["']https:\/\/fonts\.googleapis\.com[^>]*>/gi, "")
        .replace(/\s*<link[^>]+href=["']https:\/\/fonts\.gstatic\.com[^>]*>/gi, "");
    },
  },
});

const staticAssetVersionPlugin = (buildVersion) => ({
  name: "static-asset-versioning",
  transformIndexHtml(html) {
    return html.replace(/((?:src|href)=["'])((?:js|images)\/[^"']+)(["'])/g, (_, prefix, url, suffix) => {
      if (url.includes("?")) return `${prefix}${url}${suffix}`;
      return `${prefix}${url}?v=${buildVersion}${suffix}`;
    });
  },
});

const unregisterServiceWorkersPlugin = () => ({
  name: "unregister-service-workers",
  transformIndexHtml() {
    return [
      {
        tag: "script",
        injectTo: "head",
        children: `(function(){if(!('serviceWorker' in navigator))return;window.addEventListener('load',function(){navigator.serviceWorker.getRegistrations().then(function(registrations){return Promise.all(registrations.map(function(registration){return registration.unregister();}));}).then(function(){if(!('caches' in window))return;return caches.keys().then(function(keys){return Promise.all(keys.map(function(key){return caches.delete(key);}));});}).catch(function(error){console.warn('Service worker cleanup failed', error);});});})();`,
      },
    ];
  },
});

export default defineConfig(({ mode }) => {
  // Load ALL env vars (not just VITE_ prefixed) so server-side middleware
  // like devApiPlugin() can access ANTHROPIC_API_KEY at dev time.
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);
  const buildVersion = new Date().toISOString().replace(/[-:.TZ]/g, "");

  return {
    root: ".",
    base: repoBase,
    publicDir: "public",
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        input: publicPageInputs,
      },
    },
    plugins: [
      publicPagesPlugin(),
      crmPreviewPlugin(),
      adSensePlugin(),
      runtimeEnvPlugin(),
      localFontPlugin(),
      siteRuntimePlugin(),
      unregisterServiceWorkersPlugin(),
      staticAssetVersionPlugin(buildVersion),
      devApiPlugin(),
      copyStaticFoldersPlugin(),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            year: new Date().getFullYear(),
          },
        },
      }),
      legacy({
        targets: ["defaults", "not IE 11"],
      }),
      compression({
        algorithm: "gzip",
        ext: ".gz",
      }),
      compression({
        algorithm: "brotliCompress",
        ext: ".br",
      }),
    ],
    server: {
      port: 3000,
      open: true,
    },
    css: {
      postcss: "./postcss.config.js",
    },
  };
});
