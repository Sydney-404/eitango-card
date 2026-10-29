#!/usr/bin/env bash
# 自動テストを Edge のヘッドレス起動で流し、OK と FAIL の数を数える。
# 使い方（リポジトリのフォルダで、Git Bash から）：bash tests/run.sh
# FAIL かエラーが1つでもあれば、終了コード 1 で終わる。
set -u
cd "$(dirname "$0")/.."

PAGE="file:///$(cygpath -m "$PWD/tests/app-test.html")"
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE" 2>/dev/null' EXIT

# Bash から Edge を直接呼ぶと出力が受け取れないので、PowerShell 経由で起動する
OUT="$(powershell.exe -NoProfile -Command "& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' \
  --headless=new --disable-gpu --no-first-run --user-data-dir='$(cygpath -w "$PROFILE")' \
  --allow-file-access-from-files --virtual-time-budget=10000 --dump-dom '$PAGE' 2>\$null" | tr -d '\r')"

# 結果は <pre id="out">RESULT 〜 ERRORS: [...]</pre> の行
RESULT="$(printf '%s\n' "$OUT" | sed -n '/<pre id="out">RESULT/,/^ERRORS:/p')"
if [ -z "$RESULT" ]; then
  echo "結果が取れなかった（テストページが最後まで動かなかった可能性）"
  exit 1
fi

ok=$(printf '%s\n' "$RESULT" | grep -c '^OK ')
fail=$(printf '%s\n' "$RESULT" | grep -c '^FAIL ')
errors=$(printf '%s\n' "$RESULT" | grep -o '^ERRORS: .*' | sed 's#</pre>##')

printf '%s\n' "$RESULT" | grep '^FAIL '
echo "OK: $ok / FAIL: $fail / $errors"
[ "$fail" -eq 0 ] && [ "$errors" = "ERRORS: []" ]
