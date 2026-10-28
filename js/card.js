// カード閲覧：表で思い出し、裏で確かめて記憶度をつける
const CardView = (() => {
  const ORDERS = { normal: 'そのまま', shuffle: 'シャッフル' };
  let el;
  let deck = null; // 出す順に並べた単語ID
  let index = 0;
  let flipped = false;

  function reset() {
    deck = null;
  }

  function buildDeck() {
    const ids = App.targetWords().map(w => w.id);
    deck = Store.pref('cardOrder', 'normal') === 'shuffle' ? UI.shuffle(ids) : ids;
    index = 0;
    flipped = false;
  }

  function show(container) {
    el = container;
    render();
  }

  function render() {
    if (!Store.wordList().length) return UI.emptyWords(el);
    if (!deck) buildDeck();

    const order = Store.pref('cardOrder', 'normal');
    const head = `
      <div class="list-head">
        <span class="progress-text">${Math.min(index + 1, deck.length)} ／ ${deck.length}</span>
        <select id="card-order" aria-label="出す順番">
          ${Object.entries(ORDERS).map(([k, v]) => `<option value="${k}"${k === order ? ' selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="progress"><span style="width:${deck.length ? (index / deck.length) * 100 : 0}%"></span></div>`;

    if (!deck.length) {
      el.innerHTML = head + '<p class="empty">条件に合う単語がありません</p>';
    } else if (index >= deck.length) {
      el.innerHTML = head + `
        <div class="empty">
          <p>最後まで見ました（${deck.length} 語）</p>
          <button type="button" class="btn primary" data-action="restart">もう一度</button>
        </div>`;
    } else {
      el.innerHTML = head + cardHtml(Store.word(deck[index]));
    }

    el.querySelector('#card-order').addEventListener('change', e => {
      Store.setPref('cardOrder', e.target.value);
      buildDeck();
      render();
    });
    el.onclick = onClick;
    const card = el.querySelector('.flashcard');
    if (card) bindSwipe(card);
  }

  function cardHtml(w) {
    const s = Store.state(w.id);
    if (!flipped) {
      return `
        <div class="flashcard">
          <div class="card-word">${UI.esc(w.word)}</div>
          <p class="muted card-hint">← スワイプで前後へ →</p>
        </div>
        <div class="card-nav">
          <button type="button" class="btn" data-action="prev" ${index === 0 ? 'disabled' : ''}>‹ 前へ</button>
          <button type="button" class="btn primary" data-action="flip">確認する</button>
          <button type="button" class="btn" data-action="next">次へ ›</button>
        </div>`;
    }
    return `
      <div class="flashcard back">
        <div class="card-word small">${UI.esc(w.word)}</div>
        ${UI.wordDetail(w)}
      </div>
      <p class="muted center">覚え具合を押すと次へ進みます</p>
      ${UI.memoryButtons(s.memory)}`;
  }

  function go(delta) {
    const next = index + delta;
    if (next < 0 || next > deck.length) return;
    index = next;
    flipped = false;
    render();
  }

  function onClick(e) {
    const memBtn = e.target.closest('[data-memory]');
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (memBtn) {
      Store.setMemory(deck[index], Number(memBtn.dataset.memory));
      go(1);
    } else if (action === 'flip') {
      flipped = true;
      Store.viewCard(deck[index]);
      render();
    } else if (action === 'prev') {
      go(-1);
    } else if (action === 'next') {
      go(1);
    } else if (action === 'restart') {
      buildDeck();
      render();
    }
  }

  // 左へスワイプで次、右へで前
  function bindSwipe(card) {
    let x0 = null;
    let y0 = null;
    card.addEventListener('touchstart', e => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    card.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    });
  }

  return { show, reset };
})();
