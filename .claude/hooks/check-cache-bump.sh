#!/usr/bin/env bash
# Claude が git push を実行する直前に走るフック。
# まだ push していない変更にアプリの部品が含まれるのに、sw.js の CACHE の番号が
# 上がっていなければ push を止める（終了コード 2 で止め、理由を Claude に返す）。
input="$(cat)"
printf '%s' "$input" | grep -q 'git push' || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --verify -q origin/main >/dev/null || exit 0

changed="$(git diff --name-only origin/main..HEAD)"
printf '%s\n' "$changed" | grep -qE '^(index\.html|css/|js/|sound/|icons/|manifest\.webmanifest)' || exit 0

if git diff origin/main..HEAD -- sw.js | grep -qE "^\+const CACHE = "; then
  exit 0
fi

echo "アプリの部品を変えたのに sw.js の CACHE の番号が上がっていないので push を止めた。番号を1つ上げてコミットしてから push する（ホーム画面のアプリに新しい版を届けるため）" >&2
exit 2
