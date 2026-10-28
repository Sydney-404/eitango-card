// データ管理：Excel 取り込み
const ManageView = (() => {
  let el;
  let pending = null; // プレビュー中の取り込み結果

  function show(container) {
    el = container;
    render();
  }

  function render() {
    el.innerHTML = `
      <section class="panel">
        <h2>Excel / CSV から取り込む</h2>
        <p class="muted">1行目に見出し（ID・英単語・日本語の意味・英語の意味・分類タグ・品詞・Unit・語の形）、2行目から1行1単語。同じ ID は上書きし、学習状態は残ります。</p>
        <label class="btn primary file-btn">
          ファイルを選ぶ
          <input type="file" id="import-file" accept=".xlsx,.xls,.csv" hidden>
        </label>
        <div id="import-preview">${pending ? previewHtml(pending) : ''}</div>
      </section>

      <section class="panel">
        <h2>いまの記録</h2>
        <p>単語 <b>${Store.wordList().length}</b> 語 ／ 学習ログ <b>${Store.logCount()}</b> 件</p>
      </section>`;

    el.querySelector('#import-file').addEventListener('change', onFile);
    if (pending) {
      el.querySelector('#import-ok').addEventListener('click', confirmImport);
      el.querySelector('#import-cancel').addEventListener('click', () => { pending = null; render(); });
    }
  }

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = Importer.parse(await file.arrayBuffer(), file.name);
      pending = { fileName: file.name, ...Importer.analyze(rows) };
    } catch (err) {
      console.error(err);
      UI.toast(`読み込めませんでした：${err.message}`);
      pending = null;
    }
    render();
  }

  function previewHtml(p) {
    const changes = p.added.length + p.updated.length;
    const errors = p.errors.length ? `
      <details class="errors" open>
        <summary>エラー一覧（取り込まない行）</summary>
        <ul>${p.errors.map(e => `<li>${e.rowNo}行目：${UI.esc(e.message)}</li>`).join('')}</ul>
      </details>` : '';
    return `
      <div class="preview">
        <p class="muted">${UI.esc(p.fileName)}</p>
        <p class="preview-counts">
          新規 <b>${p.added.length}</b> 件・更新 <b>${p.updated.length}</b> 件・エラー <b>${p.errors.length}</b> 件
          <span class="muted">（変更なし ${p.unchanged} 件）</span>
        </p>
        ${errors}
        <div class="row">
          <button type="button" class="btn" id="import-cancel">やめる</button>
          <button type="button" class="btn primary" id="import-ok" ${changes ? '' : 'disabled'}>取り込む</button>
        </div>
      </div>`;
  }

  function confirmImport() {
    const n = pending.added.length + pending.updated.length;
    Importer.apply(pending);
    pending = null;
    UI.toast(`${n} 件を取り込みました`);
    App.dataChanged();
  }

  return { show };
})();
