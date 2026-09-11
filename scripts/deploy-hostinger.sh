#!/usr/bin/env bash
set -euo pipefail
hsst_repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$hsst_repo_dir"
hsst_mode="${1:---check}"
case "$hsst_mode" in
  --check|--publish)
    if [[ "${VITE_USE_EMULATORS:-false}" == true ]]; then echo 'Refusing an emulator production build.' >&2; exit 1; fi
    npm run build:hostinger
    node scripts/check-release.mjs
    node scripts/release-artifact.mjs
    if [[ "$hsst_mode" == --check ]]; then echo 'Release validated. Nothing uploaded.'; exit 0; fi
    ;;
  --artifact) hsst_mode=--publish ;;
  --preflight|--backup|--rollback|--verify) ;;
  *) echo 'Use --check, --publish, --artifact, --preflight, --backup, --verify, or --rollback [artifact directory].' >&2; exit 1 ;;
esac
# Existing local credentials use shell quoting. Do not dotenv-parse or print them.
# CI supplies these values directly; the build has already finished.
if [[ -f .env && "${CI:-false}" != true ]]; then source .env; fi
export HOSTINGER_FTP_HOST HOSTINGER_FTP_CONNECT_IP HOSTINGER_FTP_USER HOSTINGER_FTP_PASSWORD
node scripts/hostinger-release.mjs "$hsst_mode" "${2:-dist}"
