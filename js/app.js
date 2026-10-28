// 画面の切り替えと起動
const App = (() => {
  const TITLES = { list: '単語一覧', card: 'カード', quiz: '四択', manage: 'データ管理' };
  const views = { list: ListView, card: CardView, quiz: QuizView, manage: ManageView };
  let current = 'list';

  function show(name) {
    current = name;
    for (const key of Object.keys(views)) {
      document.getElementById(`view-${key}`).hidden = key !== name;
    }
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.getElementById('title').textContent = TITLES[name];
    if (name !== 'manage') Store.setPref('tab', name);
    views[name].show(document.getElementById(`view-${name}`));
    window.scrollTo(0, 0);
  }

  // 3機能が対象にする単語（Unit → ID の順）
  function targetWords() {
    return Store.wordList()
      .filter(w => Filter.matches(w))
      .sort((a, b) => a.unit - b.unit || UI.naturalCompare(a.id, b.id));
  }

  // 辞書や絞り込みが変わったら、各機能の作業途中の状態を捨てて描き直す
  function dataChanged() {
    Object.values(views).forEach(v => v.reset && v.reset());
    show(current);
  }

  // リポジトリに置いた単語ファイルを、起動時に自動で取り込む（方法B）。
  // 取り込みは追加と更新だけなので、学習状態は残る
  const AUTO_FILES = ['words.xlsx', 'word/TSL_単語リスト.csv'];

  async function autoLoad() {
    let total = 0;
    for (const name of AUTO_FILES) {
      try {
        const res = await fetch(encodeURI(name), { cache: 'no-cache' });
        if (!res.ok) continue;
        const result = Importer.analyze(Importer.parse(await res.arrayBuffer(), name));
        const n = result.added.length + result.updated.length;
        if (!n) continue;
        Importer.apply(result);
        total += n;
      } catch {
        // ファイルがない・ファイルを直接開いている場合は何もしない
      }
    }
    if (total) {
      UI.toast(`単語ファイルから ${total} 件を取り込みました`);
      dataChanged();
    }
  }

  function boot() {
    document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
    document.getElementById('btn-manage').addEventListener('click', () => show('manage'));
    Filter.init();
    show(Store.pref('tab', 'list'));
    autoLoad();
    setupOffline();
  }

  // オフラインで使えるようにする（ファイルを直接開いているときは動かない）
  function setupOffline() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(err => console.error(err));
    }
    // 容量が苦しくなっても、ブラウザが学習記録を勝手に消さないよう頼んでおく
    navigator.storage?.persist?.();
  }

  return { boot, show, targetWords, dataChanged };
})();

App.boot();
