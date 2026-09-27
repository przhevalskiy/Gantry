#!/usr/bin/env bash
# Publish the standalone ReplyKit branch to a dedicated GitHub repo.
# Prerequisites: `gh` authenticated as a user who can create repos.
set -euo pipefail
OWNER="${GITHUB_OWNER:-przhevalskiy}"
REPO="${REPLYKIT_REPO:-replykit}"
FULL="$OWNER/$REPO"
ROOT="$(git rev-parse --show-toplevel)"
BRANCH="cursor/replykit-standalone-cfb0"

cd "$ROOT"
git fetch origin "$BRANCH"

if ! gh repo view "$FULL" >/dev/null 2>&1; then
  echo "Creating public repo $FULL ..."
  gh repo create "$FULL" \
    --public \
    --description "ReplyKit — niche snippet manager Chrome extension for freelancers" \
    --disable-wiki
else
  echo "Repo $FULL already exists — pushing main ..."
fi

git push "https://github.com/$FULL.git" "origin/$BRANCH:main"
echo "Shipped: https://github.com/$FULL"
