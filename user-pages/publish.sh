#!/usr/bin/env bash
#
# Publishes this folder as the GitHub user site that serves
# https://<user>.github.io/app-ads.txt — the root URL AdMob crawls to verify
# authorized sellers. See README.md for why a subdirectory cannot work.
#
# Run it from a machine logged into the `gh` CLI as the account that owns the
# app. It is safe to re-run: an existing repo is updated, not recreated.
#
#   ./publish.sh
#
set -euo pipefail

cd "$(dirname "$0")"

command -v gh >/dev/null 2>&1 || {
  echo "error: the GitHub CLI (gh) is not installed — see https://cli.github.com" >&2
  echo "       or follow the browser steps in README.md instead." >&2
  exit 1
}

gh auth status >/dev/null 2>&1 || {
  echo "error: gh is not logged in. Run: gh auth login" >&2
  exit 1
}

# The repo name is not a choice. GitHub serves the domain root ONLY from a repo
# named exactly <login>.github.io, so derive it rather than trusting a constant
# that would silently 404 if the account were ever different.
# (lower-cased via tr, not ${VAR,,} — macOS still ships bash 3.2, where that is
# a syntax error and this script would die before printing anything useful.)
LOGIN="$(gh api user --jq .login)"
REPO="$(printf '%s' "${LOGIN}" | tr '[:upper:]' '[:lower:]').github.io"
REMOTE="https://github.com/${LOGIN}/${REPO}.git"

echo "==> Target: https://${REPO}/app-ads.txt (repo ${LOGIN}/${REPO})"

if gh repo view "${LOGIN}/${REPO}" >/dev/null 2>&1; then
  echo "==> Repo already exists — updating it."
else
  echo "==> Creating ${LOGIN}/${REPO} (public)."
  gh repo create "${LOGIN}/${REPO}" --public --disable-issues --disable-wiki
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

# Clone rather than push a fresh history: re-running must not clobber whatever
# else the user site has grown since.
if git clone --quiet "${REMOTE}" "${WORKDIR}" 2>/dev/null && [ -n "$(ls -A "${WORKDIR}" | grep -v '^\.git$' || true)" ]; then
  cp app-ads.txt "${WORKDIR}/app-ads.txt"
  [ -f "${WORKDIR}/index.html" ] || cp index.html "${WORKDIR}/index.html"
else
  rm -rf "${WORKDIR}"
  mkdir -p "${WORKDIR}"
  git -C "${WORKDIR}" init --quiet -b main
  git -C "${WORKDIR}" remote add origin "${REMOTE}"
  cp app-ads.txt index.html "${WORKDIR}/"
fi

git -C "${WORKDIR}" add app-ads.txt index.html

if git -C "${WORKDIR}" diff --cached --quiet; then
  echo "==> Already up to date — nothing to push."
else
  git -C "${WORKDIR}" commit --quiet -m "User Pages site: app-ads.txt for AdMob"
  BRANCH="$(git -C "${WORKDIR}" rev-parse --abbrev-ref HEAD)"
  git -C "${WORKDIR}" push --quiet -u origin "${BRANCH}"
  echo "==> Pushed to ${BRANCH}."
fi

echo "==> Waiting for GitHub Pages to serve the file (up to ~2 min)…"
for _ in $(seq 1 24); do
  if curl -fsS "https://${REPO}/app-ads.txt" 2>/dev/null | grep -q '^google\.com,'; then
    echo
    echo "LIVE: https://${REPO}/app-ads.txt"
    curl -fsS "https://${REPO}/app-ads.txt"
    echo
    echo "Now open AdMob → Apps → app-ads.txt and click \"Check for updates\""
    echo "(\"Sök efter uppdateringar\"). Verification usually clears within 24h."
    exit 0
  fi
  sleep 5
done

echo
echo "warning: the file is pushed but https://${REPO}/app-ads.txt is not serving yet." >&2
echo "         First-time Pages builds can take a few minutes. Check the repo's" >&2
echo "         Actions tab, then retry:  curl https://${REPO}/app-ads.txt" >&2
exit 1
