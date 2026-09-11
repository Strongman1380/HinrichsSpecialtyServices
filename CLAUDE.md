# Hinrichs Specialty Services & Technology (HSS) Website

## Project Identity
- **Client**: HSS / HSST — Brandon's digital agency
- **Live URL**: `https://hinrichsspecialtyservices.com`
- **Phone**: (402) 759-2210
- **Deployment**: Hostinger static hosting

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Firebase (Hosting + optional Firestore)
- **Multi-page**: HTML pages + React app hybrid
- **Database**: Firebase Firestore + PostgreSQL (referrals — see `.sql` files)

## Key Commands
```bash
npm run dev      # Vite dev server
npm run build    # Production build
# Build then upload dist/ to Hostinger public_html
```

## Architecture
- `src/` — React components
- `api/` — API route handlers
- `css/` — global CSS (split strategy — see CSS_SPLITTING_REPORT.md)
- `*.html` — standalone pages (blog.html, contact.html, digital-solutions.html, etc.)
- `database-*.sql` — PostgreSQL schema migrations (referrals, DV payments)

## Brand
- **Colors**: Navy #132e54 + Blue #1a78e6 + Orange #f58220
- **Font**: Inter
- **Tagline**: "Empowering People. Elevating Business. Creating Impact."
- **Services**: Website design, SEO, AI automation, digital marketing

## Key Features
- DV weekly payment tracking (see `dv-weekly-payment.html`)
- Referral program with database backend
- Enrollment form
- Blog / digital solutions pages

## Referral Database
- Tables in `database-referrals.sql` and `database-setup.sql`
- DV payment updates in `database-update-dv-payments.sql`
- See `DV_PAYMENT_*.md` files for implementation notes

## Hostinger Deploy

- Read the shared runbook in [notes/hostinger-deployment-runbook.md](/Volumes/Seagate%20Portable%20Drive/Local%20Repositories/Websites/Hinrichs%20Specialty%20Services%20and%20Technology/notes/hostinger-deployment-runbook.md) before pushing site changes.
- Hostinger FTP host: `ftp://82.29.154.56`
- Hostinger FTP username: `u855082584.hinrichsspecialtyservices.com`
- Hostinger upload folder: `public_html`
- FTP password is stored locally in `.env` as `HOSTINGER_FTP_PASSWORD` and must not be logged or committed.
