// 単語一覧：見渡して、その場で記憶度を調整する
const ListView = (() => {
  const SORTS = {
    unit: { label: 'Unit順', compare: null }, // App.targetWords() の並びのまま
    abc: { label: 'ABC順', compare: (a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }) },
    memory: { label: '記憶度の低い順', compare: (a, b) => Store.state(a.id).memory - Store.state(b.id).memory },
  };
  let el;
  let openId = null; // 展開中の単語

  function show(container) {
    el = container;
    render();
  }

  function render() {
    if (!Store.wordList().length) return UI.emptyWords(el);

    const sort = Store.pref('listSort', 'unit');
    const words = App.targetWords();
    if (SORTS[sort].compare) words.sort(SORTS[sort].compare); // 同点は Unit 順のまま残る

    el.innerHTML = `
      <div class="list-head">
        <span><b>${words.length}</b> 語</span>
        <select id="list-sort" aria-label="並び替え">
          ${Object.entries(SORTS).map(([key, s]) =>
            `<option value="${key}"${key === sort ? ' selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      ${words.length
        ? `<ul class="word-list">${words.map(itemHtml).join('')}</ul>`
        : '<p class="empty">条件に合う単語がありません</p>'}`;

    el.querySelector('#list-sort').addEventListener('change', e => {
      Store.setPref('listSort', e.target.value);
      render();
    });
    el.querySelector('.word-list')?.addEventListener('click', onClick);
  }

  function itemHtml(w) {
    const s = Store.state(w.id);
    const open = w.id === openId;
    const last = s.lastStudied ? new Date(s.lastStudied).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    return `
      <li class="word-item${open ? ' open' : ''}" data-id="${UI.esc(w.id)}">
        <button type="button" class="word-row" aria-expanded="${open}">
          <span class="seen-mark${s.seen ? ' seen' : ''}" title="${s.seen ? '見た' : 'まだ'}"></span>
          <span class="word-main">
            <span class="word-en">${UI.esc(w.word)}</span>
            <span class="word-ja">${UI.esc(w.ja)}</span>
            ${w.en ? `<span class="word-def">${UI.esc(w.en)}</span>` : ''}
          </span>
          ${UI.memoryBadge(s.memory)}
        </button>
        ${open ? `
          <div class="word-body">
            ${UI.wordDetail(w)}
            <p class="muted">四択 正解 ${s.correct}・不正解 ${s.wrong} ／ 最終学習 ${last}</p>
            ${UI.memoryButtons(s.memory)}
          </div>` : ''}
      </li>`;
  }

  function onClick(e) {
    const li = e.target.closest('.word-item');
    if (!li) return;
    const id = li.dataset.id;
    const memBtn = e.target.closest('[data-memory]');

    if (memBtn) {
      // 並びは変えずに、その行だけ描き直す（押した行が動かないように）
      Store.setMemory(id, Number(memBtn.dataset.memory));
      redrawItem(li);
    } else if (e.target.closest('.word-row')) {
      const prev = openId && el.querySelector(`.word-item.open`);
      openId = openId === id ? null : id;
      if (prev && prev !== li) redrawItem(prev);
      redrawItem(li);
    }
  }

  function redrawItem(li) {
    li.outerHTML = itemHtml(Store.word(li.dataset.id));
  }

  return { show };
})();
