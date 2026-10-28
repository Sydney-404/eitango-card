// 画面の切り替えと起動
const App = (() => {
  const TITLES = { list: '単語一覧', card: 'カード', quiz: '四択', manage: 'データ管理' };
  const Placeholder = { show(el) { el.innerHTML = '<p class="empty">この機能はこれから作ります</p>'; } };
  const views = { list: ListView, card: Placeholder, quiz: Placeholder, manage: ManageView };
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
      .sort((a, b) => a.unit - b.unit || UI.naturalCompare(a.id, b.id));
  }

  // 辞書や絞り込みが変わったら、各機能の作業途中の状態を捨てて描き直す
  function dataChanged() {
    Object.values(views).forEach(v => v.reset && v.reset());
    show(current);
  }

  // リポジトリに words.xlsx があれば、起動時に自動で取り込む（方法B）
  async function autoLoad() {
    try {
      const res = await fetch('words.xlsx', { cache: 'no-cache' });
      if (!res.ok) return;
      const result = Importer.analyze(Importer.parse(await res.arrayBuffer(), 'words.xlsx'));
      const n = result.added.length + result.updated.length;
      if (!n) return;
      Importer.apply(result);
      UI.toast(`words.xlsx から ${n} 件を取り込みました`);
      dataChanged();
    } catch {
      // words.xlsx がない・ファイルを直接開いている場合は何もしない
    }
  }

  function boot() {
    document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
    document.getElementById('btn-manage').addEventListener('click', () => show('manage'));
    show(Store.pref('tab', 'list'));
    autoLoad();
  }

  return { boot, show, targetWords, dataChanged };
})();

App.boot();
