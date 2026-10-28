// データ管理：Excel 取り込み
const ManageView = (() => {
  let el;
  let pending = null; // プレビュー中の取り込み結果
  const THEMES = { auto: '自動（端末に合わせる）', light: 'ライト', dark: 'ダーク' };

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
        <h2>表示</h2>
        <div class="chips">${Object.entries(THEMES).map(([k, v]) =>
          `<button type="button" class="chip" data-theme-choice="${k}" aria-pressed="${k === App.theme()}">${v}</button>`).join('')}</div>
      </section>

      <section class="panel">
        <h2>バックアップ</h2>
        <p class="muted">学習状態とログを JSON ファイルにします。機種変更やデータ消去に備えて、ときどき書き出してください。</p>
        <div class="row">
          <button type="button" class="btn" id="export-json">書き出す</button>
          <label class="btn file-btn">
            読み込む
            <input type="file" id="import-json" accept=".json,application/json" hidden>
          </label>
        </div>
      </section>

      <section class="panel">
        <h2>いまの記録</h2>
        <p>単語 <b>${Store.wordList().length}</b> 語 ／ 学習ログ <b>${Store.logCount()}</b> 件<br>
          <span class="muted">保存量 約 ${Math.ceil(Store.usageBytes() / 1024)} KB（ブラウザの上限はおよそ 5 MB）</span></p>
        <div class="row">
          <button type="button" class="btn" id="rebuild">ログから学習状態を作り直す</button>
        </div>
      </section>

      <section class="panel">
        <h2>全リセット</h2>
        <p class="muted">単語・学習状態・ログ・設定をすべて消します。元に戻せません。（リポジトリの単語ファイルは、次の起動で読み直されます）</p>
        <button type="button" class="btn danger block" id="reset-all">すべて消す</button>
      </section>`;

    el.querySelector('#import-file').addEventListener('change', onFile);
    el.querySelector('#export-json').addEventListener('click', exportJson);
    el.querySelector('#import-json').addEventListener('change', importJson);
    el.querySelector('#rebuild').addEventListener('click', rebuild);
    el.querySelector('#reset-all').addEventListener('click', resetAll);
    el.querySelectorAll('[data-theme-choice]').forEach(b => b.addEventListener('click', () => {
      App.setTheme(b.dataset.themeChoice);
      render();
    }));
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

  // ---- バックアップ ----
  function exportJson() {
    const blob = new Blob([JSON.stringify(Store.exportData())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eitango-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm(`いまの学習状態とログを、このファイルの内容（ログ ${data.logs?.length ?? 0} 件）で置き換えます。よろしいですか？`)) return;
      const skipped = Store.importData(data);
      UI.toast(skipped ? `バックアップを読み込みました（形の正しくない記録 ${skipped} 件は除外）` : 'バックアップを読み込みました');
      App.dataChanged();
    } catch (err) {
      UI.toast(`読み込めませんでした：${err.message}`);
    } finally {
      e.target.value = '';
    }
  }

  function rebuild() {
    Store.rebuildStates();
    UI.toast('ログから学習状態を作り直しました');
    App.dataChanged();
  }

  // 確認を2回はさむ
  function resetAll() {
    if (!confirm('単語・学習状態・ログ・設定をすべて消します。よろしいですか？')) return;
    if (!confirm('本当に消しますか？ この操作は元に戻せません。')) return;
    Store.resetAll();
    location.reload();
  }

  return { show };
})();
