---
name: release
description: 英単語カードアプリの変更を公開する（GitHub Pages に反映させる）。テストを流し、必要なら sw.js の CACHE の番号を上げてコミットし、main を push して、公開ページに新しい版が出たことまで確かめる。「公開して」「push して」「反映して」と言われたとき、または変更をコミットし終えて公開する段になったときに使う。
---

# 英単語カードの公開

## 目的
手元のコミットを、スマホで開く公開ページとホーム画面のアプリまで届ける。「送った」で終わらせず「届いた」まで確かめる。

## 手順
1. 冒頭に場所を示す：📍 GitHub：Sydney-404/eitango-card（main）
2. `git status --short` で、コミットし忘れた変更がないか見る。あればユーザーに聞く
3. `bash tests/run.sh` を流す。`FAIL: 0` かつ `ERRORS: []` でなければ公開しない
4. 送る中身を見る：`git log --oneline origin/main..HEAD` と `git diff --name-only origin/main..HEAD`
5. アプリの部品（`index.html`・`css/`・`js/`・`sound/`・`icons/`・`manifest.webmanifest`）が含まれるなら、`sw.js` の `CACHE` の番号を1つ上げて、それだけでコミットする（例：「公開用にオフライン保存の番号を v9 に上げる」）
   - 上げ忘れて push しようとすると、フック（`.claude/hooks/check-cache-bump.sh`）が止める。止められたらこの手順に戻る
6. `git push origin main`。main 以外のブランチは押さない
7. 反映を待つ：`"/c/Program Files/GitHub CLI/gh.exe" api repos/Sydney-404/eitango-card/pages/builds/latest --jq .status` が `built` になるまで10秒おきに確かめる
8. 届いたか確かめる：`curl -s https://sydney-404.github.io/eitango-card/sw.js | grep "const CACHE"` が新しい番号を返すこと。見た目に関わる変更なら、公開 URL をスマホ幅で撮る（mobile-screenshot スキル）

## 報告のしかた
- 送ったコミットの一覧、上げた CACHE の番号、テストの結果、公開ページで確かめたことを表にする
- ホーム画面のアプリは、次に開いたとき（または一度閉じて開き直したとき）に新しい版になると伝える
