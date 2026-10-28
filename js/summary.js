// まとめ：いまどこにいるか・どう進んできたか・次に何をするか を1ページで見る。
// すべて学習状態と学習ログから計算する（絞り込みは使わず、全単語が対象）
const SummaryView = (() => {
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  let el;
  const charts = {}; // グラフごとの棒の中身（押したときに説明欄へ出す）

  function show(container) {
    el = container;
    el.onclick = onClick;
    render();
  }

  // 2026-10-29 → 10/29（木）
  function dayLabel(key) {
    const [y, m, d] = key.split('-').map(Number);
    return `${m}/${d}（${WEEKDAYS[new Date(y, m - 1, d).getDay()]}）`;
  }

  const dayNum = key => String(Number(key.split('-')[2]));

  // ---- 集計 ----
  function collect() {
    const words = Store.wordList();
    const today = Review.today();
    const last14 = Array.from({ length: 14 }, (_, i) => Review.addDays(today, i - 13));
    const studied = new Map(last14.map(d => [d, new Set()]));
    const quiz = new Map(last14.map(d => [d, { correct: 0, total: 0 }]));
    const activeDays = new Set();

    for (const log of Store.logs()) {
      const d = Review.dayKey(log.at);
      activeDays.add(d);
      studied.get(d)?.add(log.id);
      if (log.type === 'quiz_answer' && quiz.has(d)) {
        quiz.get(d).total++;
        if (log.detail.correct) quiz.get(d).correct++;
      }
    }

    // 連続日数：今日（まだ今日やっていなければ昨日）から、さかのぼって途切れるまで
    let streak = 0;
    let d = activeDays.has(today) ? today : Review.addDays(today, -1);
    while (activeDays.has(d)) {
      streak++;
      d = Review.addDays(d, -1);
    }

    // 復習の予定：今日（過ぎた分も含む）と、この先7日
    const next8 = Array.from({ length: 8 }, (_, i) => Review.addDays(today, i));
    const upcoming = new Map(next8.map(k => [k, 0]));
    const memory = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const units = new Map();
    let unstudied = 0;
    let quizCorrect = 0;
    let quizTotal = 0;

    for (const w of words) {
      const s = Store.state(w.id);
      memory[s.memory]++;
      if (!s.lastStudied) unstudied++;
      if (!units.has(w.unit)) units.set(w.unit, { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 });
      const u = units.get(w.unit);
      u[s.memory]++;
      u.total++;
      quizCorrect += s.correct;
      quizTotal += s.correct + s.wrong;
      const due = Review.dueDay(w.id);
      if (due === null) continue;
      const key = due < today ? today : due;
      if (upcoming.has(key)) upcoming.set(key, upcoming.get(key) + 1);
    }

    // 苦手：四択でまちがえたことのある単語を、まちがえた割合 → 回数の順に
    const weak = words
      .map(w => ({ w, s: Store.state(w.id) }))
      .filter(({ s }) => s.wrong > 0)
      .sort((a, b) => b.s.wrong / (b.s.correct + b.s.wrong) - a.s.wrong / (a.s.correct + a.s.wrong) || b.s.wrong - a.s.wrong)
      .slice(0, 10);

    return {
      total: words.length, today, last14, studied, quiz, streak,
      upcoming, memory, unstudied, quizCorrect, quizTotal, weak,
      units: [...units.entries()].sort((a, b) => a[0] - b[0]),
    };
  }

  // ---- 部品 ----
  // 縦棒グラフ（1系列）。棒を押すと、その値を下の説明欄に出す
  // max を渡さなければ、いちばん大きい値を上端にする
  function columns(id, items, { caption, unit, max = Math.max(1, ...items.map(it => it.value ?? 0)) }) {
    charts[id] = items;
    return `
      <div class="chart" data-chart="${id}">
        <div class="chart-plot">
          <span class="chart-max">${max}${unit}</span>
          ${items.map((it, i) => `
            <button type="button" class="col${it.value == null ? ' empty' : ''}" data-chart="${id}" data-i="${i}" aria-label="${UI.esc(it.text)}">
              <span class="col-bar" style="height:${it.value ? (it.value / max) * 100 : 0}%"></span>
            </button>`).join('')}
        </div>
        <div class="chart-axis">${items.map(it => `<span>${UI.esc(it.short)}</span>`).join('')}</div>
        <p class="chart-caption" aria-live="polite">${UI.esc(caption)}</p>
        <details class="chart-table">
          <summary>表で見る</summary>
          <table>${items.map(it => `<tr><th>${UI.esc(it.label)}</th><td>${UI.esc(it.valueText)}</td></tr>`).join('')}</table>
        </details>
      </div>`;
  }

  // 記憶度1〜4の積み上げ帯
  function memoryStack(counts, cls = '') {
    return `<div class="stack ${cls}">${[1, 2, 3, 4].filter(m => counts[m]).map(m =>
      `<span class="seg mem-bg-${m}" style="flex:${counts[m]}"></span>`).join('')}</div>`;
  }

  function stat(label, value, unit) {
    return `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}<small>${unit}</small></span></div>`;
  }

  // ---- 画面 ----
  function render() {
    if (!Store.wordList().length) return UI.emptyWords(el);
    const c = collect();
    const due = c.upcoming.get(c.today);

    const upcomingItems = [...c.upcoming.entries()].map(([k, v], i) => ({
      label: i === 0 ? '今日（過ぎた分も含む）' : dayLabel(k),
      short: i === 0 ? '今日' : dayNum(k),
      value: v,
      valueText: `${v} 語`,
      text: `${i === 0 ? '今日' : dayLabel(k)}：${v} 語`,
    }));

    const studiedItems = c.last14.map(k => {
      const n = c.studied.get(k).size;
      return { label: dayLabel(k), short: dayNum(k), value: n, valueText: `${n} 語`, text: `${dayLabel(k)}：${n} 語` };
    });
    const studiedTotal = studiedItems.reduce((sum, it) => sum + it.value, 0);

    const quizItems = c.last14.map(k => {
      const q = c.quiz.get(k);
      const rate = q.total ? Math.round((q.correct / q.total) * 100) : null;
      const text = q.total ? `${dayLabel(k)}：${rate}%（${q.correct}/${q.total} 問）` : `${dayLabel(k)}：四択なし`;
      return { label: dayLabel(k), short: dayNum(k), value: rate, valueText: q.total ? `${rate}%（${q.correct}/${q.total}）` : '—', text };
    });

    const memoryLegend = [1, 2, 3, 4].map(m => `
      <li><i class="swatch mem-bg-${m}"></i>${m} ${UI.MEMORY_LABELS[m]}<b>${c.memory[m]}</b></li>`).join('');

    el.innerHTML = `
      <section class="panel">
        <h2>今日の復習</h2>
        <p class="hero-num">${due}<small> 語</small></p>
        <button type="button" class="btn primary block" data-action="review" ${due ? '' : 'disabled'}>カードで復習する</button>
        <p class="muted note">次の復習日＝最後に学んだ日 ＋ 記憶度ごとの日数（1→1日・2→3日・3→7日・4→14日）</p>
        <h3>この先の復習の予定</h3>
        ${columns('upcoming', upcomingItems, { caption: '棒を押すと、その日の語数が出ます', unit: ' 語' })}
      </section>

      <section class="panel">
        <h2>学習の記録</h2>
        <div class="stats">
          ${stat('連続', c.streak, ' 日')}
          ${stat('今日', c.studied.get(c.today).size, ' 語')}
          ${stat('直近14日', studiedTotal, ' 語')}
        </div>
        <h3>日別の学習数（その日に触れた単語の数）</h3>
        ${columns('studied', studiedItems, { caption: '棒を押すと、その日の語数が出ます', unit: ' 語' })}
      </section>

      <section class="panel">
        <h2>記憶度の分布</h2>
        ${memoryStack(c.memory)}
        <ul class="legend">${memoryLegend}</ul>
        <p class="muted note">全 ${c.total} 語のうち、まだ一度も学んでいない単語 ${c.unstudied} 語（記憶度1に含む）</p>
        <h3>Unit 別の進み具合</h3>
        <ul class="unit-rows">${c.units.map(([unit, u]) => `
          <li>
            <span class="unit-name">Unit ${UI.esc(unit)}</span>
            ${memoryStack(u, 'thin')}
            <span class="unit-done">覚えた ${u[4]}/${u.total}</span>
          </li>`).join('')}</ul>
      </section>

      <section class="panel">
        <h2>四択</h2>
        <div class="stats">
          ${stat('全体の正答率', c.quizTotal ? Math.round((c.quizCorrect / c.quizTotal) * 100) : '—', c.quizTotal ? '%' : '')}
          ${stat('答えた数', c.quizTotal, ' 問')}
        </div>
        <h3>日別の正答率</h3>
        ${columns('quiz', quizItems, { caption: '棒を押すと、その日の正答率が出ます', unit: '%', max: 100 })}
        <h3>苦手な単語</h3>
        ${c.weak.length ? `<ul class="weak-list">${c.weak.map(({ w, s }) => `
          <li><span class="weak-word"><b>${UI.esc(w.word)}</b><span>${UI.esc(w.ja)}</span></span><span class="word-score">${s.correct}/${s.correct + s.wrong}</span></li>`).join('')}</ul>`
          : '<p class="muted">まだ四択でまちがえた単語はありません</p>'}
      </section>`;
  }

  // ---- 操作 ----
  function onClick(e) {
    const col = e.target.closest('.col');
    if (col) {
      Sound.play('pon');
      const item = charts[col.dataset.chart][Number(col.dataset.i)];
      const chart = col.closest('.chart');
      chart.querySelectorAll('.col.selected').forEach(b => b.classList.remove('selected'));
      col.classList.add('selected');
      chart.querySelector('.chart-caption').textContent = item.text;
    } else if (e.target.closest('[data-action="review"]')) {
      Filter.preset({ due: true });
      UI.toast('絞り込みを「今日の復習だけ」にしました');
      App.go('card');
    }
  }

  return { show };
})();
