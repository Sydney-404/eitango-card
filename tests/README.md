# 自動テスト

`app-test.html` は、サンプルの単語を取り込んで 一覧 → 絞り込み → カード → 四択 → バックアップ を自動で操作し、結果を `OK` / `FAIL` の行で表示する。

## 流し方
- 手で：`app-test.html` をブラウザで開く。いちばん下に結果が出る
- コマンド一つで（Git Bash、リポジトリのフォルダで実行）：`bash tests/run.sh`
  - `OK: 41 / FAIL: 0 / ERRORS: []` のように数をまとめて出す。FAIL があればその行も出し、終了コード 1 で終わる
- PowerShell で直接（結果の HTML がそのまま出る）：
  ```powershell
  $page = "file:///" + ((Resolve-Path tests\app-test.html).Path -replace '\\', '/')
  & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-first-run `
    --user-data-dir="$env:TEMP\eitango-test" --allow-file-access-from-files --virtual-time-budget=10000 `
    --dump-dom $page
  ```

## 注意
- 開くと、このページと同じ場所（ファイルを直接開いたとき）の学習記録を消してから始める。公開ページ（github.io）の記録には影響しない
- 画面の部品（index.html の body）を変えたら、このページの部品もそろえる
- 機能を足したら、確認の行を足す
