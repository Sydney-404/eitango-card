// 画面づくりの小道具（どの機能からも使う）
const UI = (() => {
  const MEMORY_LABELS = ['', 'まだ', 'うろ覚え', 'だいたい', '覚えた'];

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function memoryBadge(m) {
    return `<span class="mem mem-${m}">${m} ${MEMORY_LABELS[m]}</span>`;
  }

  // 品詞・Unit・分類タグを、タグの見た目で1行に並べる
  function wordTags(w) {
    return `<div class="tags">
      <span class="tag tag-pos">${esc(w.pos)}</span>
      <span class="tag tag-unit">Unit ${esc(w.unit)}</span>
      ${w.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}
    </div>`;
  }

  // 単語の全要素（英単語そのものは呼び出し側で見出しにする）
  function wordDetail(w) {
    const rows = [
      ['日本語の意味', w.ja],
      ['英語の意味', w.en],
      ['語の形', w.forms],
    ].filter(([, v]) => v !== '' && v != null);
    return `
      <dl class="detail">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${wordTags(w)}`;
  }

  // 記憶度ボタン。押したときの処理は呼び出し側が data-memory を見て行う
  function memoryButtons(current) {
    return `<div class="mem-buttons">${[1, 2, 3, 4].map(m => `
      <button type="button" class="mem-btn mem-${m}${m === current ? ' current' : ''}" data-memory="${m}">
        <b>${m}</b><small>${MEMORY_LABELS[m]}</small>
      </button>`).join('')}</div>`;
  }

  // 単語が1つもないときの案内
  function emptyWords(el) {
    el.innerHTML = `
      <div class="empty">
        <p>単語がまだありません。</p>
        <p>データ管理から Excel / CSV を取り込んでください。</p>
        <button type="button" class="btn primary" data-goto="manage">データ管理を開く</button>
      </div>`;
    el.querySelector('[data-goto]').addEventListener('click', () => App.show('manage'));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ID や Unit を「1, 2, 10」の順に並べる比較
  function naturalCompare(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  }

  return { MEMORY_LABELS, esc, toast, memoryBadge, wordDetail, memoryButtons, emptyWords, shuffle, naturalCompare };
})();
