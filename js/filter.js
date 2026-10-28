// 絞り込み（≡）。3機能すべての対象範囲を決める。次回起動時も残す
const Filter = (() => {
  const DEFAULT = { tags: [], seen: 'all', memory: [], pos: [], units: [] };
  const POS_ORDER = ['名詞', '動詞', '形容詞', '副詞'];
  const SEEN = { all: 'すべて', yes: '見た', no: 'まだ' };

  let current = { ...DEFAULT, ...Store.pref('filter', {}) };
  let draft = null; // パネルを開いている間だけ使う下書き

  function test(w, f) {
    const s = Store.state(w.id);
    if (f.tags.length && !w.tags.some(t => f.tags.includes(t))) return false;
    if (f.seen === 'yes' && !s.seen) return false;
    if (f.seen === 'no' && s.seen) return false;
    if (f.memory.length && !f.memory.includes(s.memory)) return false;
    if (f.pos.length && !f.pos.includes(w.pos)) return false;
    if (f.units.length && !f.units.includes(w.unit)) return false;
    return true;
  }

  function matches(w) {
    return test(w, current);
  }

  function isActive() {
    return JSON.stringify(current) !== JSON.stringify(DEFAULT);
  }

  // 選択肢は、取り込んだ辞書の中身からその都度つくる
  function options() {
    const words = Store.wordList();
    const uniq = list => [...new Set(list)];
    const posRank = p => (POS_ORDER.includes(p) ? POS_ORDER.indexOf(p) : POS_ORDER.length);
    return {
      tags: uniq(words.flatMap(w => w.tags)).sort((a, b) => a.localeCompare(b, 'ja')),
      memory: [1, 2, 3, 4],
      pos: uniq(words.map(w => w.pos)).sort((a, b) => posRank(a) - posRank(b) || a.localeCompare(b, 'ja')),
      units: uniq(words.map(w => w.unit)).sort((a, b) => a - b),
    };
  }

  // ---- パネル ----
  const sheet = () => document.getElementById('filter-sheet');

  function open() {
    const opts = options();
    draft = structuredClone(current);
    // 辞書から消えた選択肢が残って、見えない条件にならないようにする
    for (const key of ['tags', 'pos', 'units']) draft[key] = draft[key].filter(v => opts[key].includes(v));
    sheet().hidden = false;
    render();
  }

  function close() {
    sheet().hidden = true;
    draft = null;
  }

  function chips(group, values, label = v => v) {
    if (!values.length) return '<p class="muted">（なし）</p>';
    return `<div class="chips">${values.map(v => {
      const on = group === 'seen' ? draft.seen === v : draft[group].includes(v);
      return `<button type="button" class="chip" data-group="${group}" data-value="${UI.esc(v)}" aria-pressed="${on}">${UI.esc(label(v))}</button>`;
    }).join('')}</div>`;
  }

  function render() {
    const opts = options();
    const count = Store.wordList().filter(w => test(w, draft)).length;
    sheet().querySelector('.sheet-body').innerHTML = `
      <div class="sheet-head">
        <h2>絞り込み</h2>
        <button type="button" class="icon-btn" data-action="close" aria-label="閉じる">×</button>
      </div>
      <div class="sheet-scroll">
        <h3>分類タグ</h3>${chips('tags', opts.tags)}
        <h3>既見</h3>${chips('seen', Object.keys(SEEN), v => SEEN[v])}
        <h3>記憶度</h3>${chips('memory', opts.memory, m => `${m} ${UI.MEMORY_LABELS[m]}`)}
        <h3>品詞</h3>${chips('pos', opts.pos)}
        <h3>Unit</h3>${chips('units', opts.units, u => `Unit ${u}`)}
      </div>
      <div class="sheet-foot">
        <span>該当 <b>${count}</b> 語</span>
        <button type="button" class="btn" data-action="reset">リセット</button>
        <button type="button" class="btn primary" data-action="apply">適用</button>
      </div>`;
  }

  function onClick(e) {
    if (e.target.classList.contains('sheet-backdrop')) return close();
    const chip = e.target.closest('.chip');
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (chip) {
      const group = chip.dataset.group;
      if (group === 'seen') {
        draft.seen = chip.dataset.value;
      } else {
        const value = ['memory', 'units'].includes(group) ? Number(chip.dataset.value) : chip.dataset.value;
        const list = draft[group];
        draft[group] = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
      }
      render();
    } else if (action === 'close') {
      close();
    } else if (action === 'reset') {
      draft = structuredClone(DEFAULT);
      render();
    } else if (action === 'apply') {
      current = draft;
      Store.setPref('filter', current);
      close();
      updateIndicator();
      App.dataChanged();
    }
  }

  // 絞り込み中は ≡ に印をつける
  function updateIndicator() {
    document.getElementById('btn-filter').classList.toggle('active', isActive());
  }

  function init() {
    document.getElementById('btn-filter').addEventListener('click', open);
    sheet().addEventListener('click', onClick);
    updateIndicator();
  }

  return { init, matches };
})();
