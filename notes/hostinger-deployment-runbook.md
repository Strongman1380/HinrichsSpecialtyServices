# Hostinger release runbook

Public website and CRM frontend belong on `https://www.hinrichsspecialtyservices.com`; CRM uses `/crm/`. Firebase project `hsp-crm` provides APIs and storage, not a second public website.

## Approval and preflight

Do not publish or migrate production records without explicit approval. Review both independent Git worktrees; preserve unrelated existing changes.

- `npm run deploy:check` builds without uploading. Run `node scripts/check-release.mjs` afterward.
- Configure `HOSTINGER_FTP_HOST`, `HOSTINGER_FTP_USER`, and `HOSTINGER_FTP_PASSWORD` locally. The hostname must match the FTP server's TLS certificate. Never disable certificate or hostname verification.
- The existing FTP account contains an older site copy at `/`; the domain actually serves `/public_html`. The uploader scopes every operation to `/public_html` and proves the mapping with a unique uploaded probe fetched through the public domain. Matching a shared favicon does not prove the destination.
- Verified connection: TLS hostname `hostinger.com`, connection IP `82.29.154.56`, port 21, username `u855082584.hinrichsspecialtyservices.com`. The required FTP destination is `/public_html`.
- Never export the public site's `VITE_*` configuration into the nested CRM build. Emulator builds are prohibited in release assets.
- Verify the administrator against `HSP CRM/functions/data/admin-identity.json`. Server, browser, and rules require that UID, email, and verified-email claim.
- Confirm Firebase authorized domains, production origins, Search Console access, and GA4 configuration. Do not activate paid AI or email sending during release.

## Data preparation

1. Schedule an administrator editing pause; public pages may remain available.
2. Create an approved full Firestore backup with a tested restoration procedure, outside both repositories.
3. Run `node scripts/finance-maintenance.cjs --backup /absolute/new/private-directory` for a read-only financial snapshot/report. This does not change balances or legacy records.
4. Review missing links, duplicate sources, individual mismatches, and complete count/cent totals. Never guess discrepancies.
5. Only after migration approval, run the tool with `HSST_RECONCILIATION_APPROVED=yes`, `--apply`, and a new backup directory. Imports are deterministic and transactional; legacy records remain read-only. Linked invoices are locked for reconciliation.
6. Reconcile flagged invoices using verified received amounts and documented correction reasons. Import first, reconcile second; legacy adjustments may represent the same imported payments. Re-run the read-only report and compare counts, totals, and samples.

The financial JSON snapshot is an audit artifact, not an automatic Firestore restore format. Do not blindly import it into production.

## Publishing

The release repository is `Strongman1380/HinrichsSpecialtyServices`. Active CRM source is included under `HSP CRM/`; the original `Strongman1380/HSP-CRM` repository/history is retained. The clean local release checkout is `/Users/brandonhinrichs/Developer/hsst-release`. The original dirty working copy has not been reset.

Pull requests run locked Node 22 installs, unit/emulator tests, mocked authenticated CRM workflows, build validation, and mobile/WebKit checks. Approved changes merged to `main` run the serialized Hostinger release. GitHub Pages is no longer the release target. The Production environment permits only `main`.

GitHub Production secrets contain the existing FTPS credentials, backend environment, and a backup encryption key. Firebase deployment uses repository-ID/main-branch restricted Workload Identity Federation, not a long-lived service-account key. Never log these values. The Firebase web configuration in source is public and does not grant administrator access.

The checked build is archived once with a commit/file-hash manifest. Before publishing, the workflow downloads a complete site snapshot and persists an AES-256-GCM encrypted rollback artifact. Files are staged and read back over verified FTPS; assets are promoted before documents. HTTP content hashes and CRM refresh routes must then pass. Hostinger optimizes raster images: a changed CDN image must match the exact original hash over verified origin HTTPS, preserve image dimensions, and pass decoded visual-equivalence checks. HTML and JavaScript still require exact public hashes. A failed promotion triggers restoration and quarantines newly introduced files.

After approval, deploy Firebase functions, rules, and indexes from `HSP CRM`, wait for indexes to finish building, and publish the matching Hostinger build with `npm run deploy:hostinger`. Keep administrative editing paused while versions transition. Check public lead compatibility immediately; automated tests must never submit real client data.

The uploader forces encrypted verified transport, downloads a private previous-release backup, uploads assets before HTML, uses temporary uploads, and retains old hashed assets. It never uses a deleting mirror. Retired paths remain blocked by `.htaccess` even if old files remain remotely.

## Verification and rollback

- Verify redirects, sitemap pages, favicon, public forms, FAQ fallback, same-origin CRM navigation, administrator login, route refresh, and logout.
- Verify billing, archive/restore, tasks, hours, and drafts using approved non-client test records.
- Confirm Search Console ownership/sitemap status, one GA4 page view per navigation, and confirmed-lead events separately from attempts. Field INP requires real-user data.
- Keep the backup path printed by the uploader. Approved static rollback: `bash scripts/deploy-hostinger.sh --rollback /absolute/previous-release-directory`.
- Automatic workflow recovery: run **Restore Hostinger snapshot** on `main`, supplying the release run ID. It decrypts that run's rollback artifact using the Production secret. Full-snapshot checks use FTPS because snapshots can include intentionally forbidden or retired HTTP paths.
- Local upload of an already checked artifact: `bash scripts/deploy-hostinger.sh --artifact /absolute/artifact`. `--verify` repeats public hash/route checks without uploading. A prepared backup may be reused only with `HSST_PREPARED_BACKUP=true` and the validated `HSST_BACKUP_DIR`.
- Static rollback does not undo database migrations, APIs, or rules. Never restore permissive old rules. Reopen editing only after matching frontend/backend and reconciliation checks succeed.
- Retain old remote assets until an approved retention window passes and active old-browser sessions are no longer a concern.
