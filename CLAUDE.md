# 英単語カード：作業のきまり

スマホのブラウザで使う英単語暗記アプリ。HTML／CSS／JavaScript だけで動き、GitHub Pages で公開している（main ブランチ＝公開中の版）。設計は [SPEC.md](SPEC.md)、ファイルの役割は [README.md](README.md)。

## 変更の進め方（1項目ごとにこの順で回す）
1. 直す
2. `bash tests/run.sh` を流す。`FAIL: 0` かつ `ERRORS: []` になるまで直す
   - FAIL が出たら、アプリの不具合かテストの書き間違いかを見分けてから直す。テストを通すためだけにテストを変えない
   - 機能を足したら、`tests/app-test.html` に確認の行を足す。画面の部品（index.html の body）を変えたら、テストページの部品もそろえる
3. 見た目に関わる変更は、スマホ幅（390px）で撮って確かめる（mobile-screenshot スキル）
4. コミットする（1項目1コミット）
5. 公開するなら release スキルの手順で push する

## 公開（push）のきまり
- アプリの部品（`index.html`・`css/`・`js/`・`sound/`・`icons/`・`manifest.webmanifest`）を変えて push するときは、`sw.js` の `CACHE` の番号を1つ上げる。上げないと、ホーム画面に追加したアプリに新しい版が届かない
  - push の前にフックが確かめ、上げ忘れていたら止める（`.claude/hooks/check-cache-bump.sh`）
- 部品のファイルを増やしたら `sw.js` の `APP_FILES` にも足す
- push してよいのは main だけ。ほかのブランチは手元用

## 学習記録の形を変えるとき
- 記録はブラウザの localStorage（キーは `ewc.*`）にだけある。キーや保存の形を変える改修では、古い記録を新しい形に移す処理を必ず一緒に作る
