// 定義四択：覚えたかを試す
const QuizView = (() => {
  const DIRS = { en: '英単語 → 英語の意味', forward: '英単語 → 日本語の意味', reverse: '英語の意味 → 英単語' };
  const COUNTS = [5, 10, 20, 0]; // 0 は「全部」
  let el;
  let phase = 'setup'; // setup → question → result
  let questions = [];
  let qi = 0;
  let chosen = null;   // いまの問題で選んだ番号（未回答なら null）
  let answeredAt = 0;  // 答えた時刻（記憶度ボタンの押し間違い防止に使う）
  let results = [];    // [{ id, correct }]

  function reset() {
    phase = 'setup';
  }

  function show(container) {
    el = container;
    el.onclick = onClick;
    render();
  }

  function render() {
    if (!Store.wordList().length) return UI.emptyWords(el);
    if (phase === 'setup') renderSetup();
    else if (phase === 'question') renderQuestion();
    else renderResult();
  }

  // ---- 出題の準備 ----
  const dir = () => Store.pref('quizDir', 'en');

  // 出題できる単語（英語の意味を使う向きでは、英語の意味がある単語だけ）
  function pool() {
    const words = App.targetWords();
    return dir() === 'forward' ? words : words.filter(w => w.en);
  }

  // 選択肢に出す文字列
  function optionText(w) {
    return { en: w.en, forward: w.ja, reverse: w.word }[dir()];
  }

  // 誤答は全単語から選び、できるだけ同じ品詞にそろえる。同じ文字列は重ねない
  function makeQuestion(w, all) {
    const used = new Set([optionText(w)]);
    const others = UI.shuffle(all.filter(x => x.id !== w.id));
    const ordered = [...others.filter(x => x.pos === w.pos), ...others.filter(x => x.pos !== w.pos)];
    const wrongs = [];
    for (const x of ordered) {
      if (wrongs.length === 3) break;
      if (!optionText(x) || used.has(optionText(x))) continue; // 英語の意味がない単語は誤答にも使わない
      used.add(optionText(x));
      wrongs.push(x);
    }
    if (wrongs.length < 3) return null;
    const options = UI.shuffle([w, ...wrongs]).map(x => ({ id: x.id, text: optionText(x) }));
    return { id: w.id, options, answer: options.findIndex(o => o.id === w.id) };
  }

  function start() {
    const all = Store.wordList();
    const count = Store.pref('quizCount', 10);
    const picked = UI.shuffle(pool());
    questions = picked.map(w => makeQuestion(w, all)).filter(Boolean);
    if (count) questions = questions.slice(0, count);
    if (!questions.length) return UI.toast('選択肢を4つ作れる単語がありません');
    phase = 'question';
    qi = 0;
    chosen = null;
    results = [];
    render();
  }

  // ---- 画面 ----
  function renderSetup() {
    const total = Store.wordList().length;
    if (total < 4) {
      el.innerHTML = `<div class="empty"><p>単語が全部で4語未満のため、四択は使えません（いま ${total} 語）。</p></div>`;
      return;
    }
    const n = pool().length;
    const count = Store.pref('quizCount', 10);
    el.innerHTML = `
      <section class="panel">
        <h2>出題の向き</h2>
        <div class="chips">${Object.entries(DIRS).map(([k, v]) =>
          `<button type="button" class="chip" data-dir="${k}" aria-pressed="${k === dir()}">${v}</button>`).join('')}</div>
        ${dir() !== 'forward' ? '<p class="muted">英語の意味がない単語は出題しません。</p>' : ''}
        <h2 class="gap">1回の出題数</h2>
        <div class="chips">${COUNTS.map(c =>
          `<button type="button" class="chip" data-count="${c}" aria-pressed="${c === count}">${c ? `${c}問` : '全部'}</button>`).join('')}</div>
        <p class="gap">出題できる単語：<b>${n}</b> 語</p>
        <button type="button" class="btn primary block" data-action="start" ${n ? '' : 'disabled'}>はじめる</button>
      </section>`;
  }

  function renderQuestion() {
    const q = questions[qi];
    const w = Store.word(q.id);
    const answered = chosen !== null;
    const prompt = dir() === 'reverse'
      ? `<p class="muted">この意味の英単語は？</p><p class="quiz-en">${UI.esc(w.en)}</p>`
      : `<div class="card-word">${UI.esc(w.word)}</div>`;

    const options = q.options.map((o, i) => {
      let cls = '';
      if (answered && i === q.answer) cls = ' correct';
      else if (answered && i === chosen) cls = ' wrong';
      return `<button type="button" class="option${cls}" data-option="${i}" ${answered ? 'disabled' : ''}>${UI.esc(o.text)}</button>`;
    }).join('');

    const verdict = answered
      ? `<span class="verdict ${chosen === q.answer ? 'good' : 'bad'}">${chosen === q.answer ? '正解！' : '不正解'}</span>`
      : '';

    // 回答前は選択肢を下側（親指の届く位置）に。回答後は上に詰め、詳細と記憶度ボタンを1画面に収める。
    // 詳細では、問題文や選択肢にすでに出ている意味を繰り返さない
    const shown = { en: ['en'], forward: ['ja'], reverse: ['en'] }[dir()];
    el.innerHTML = `
      <div class="quiz-stage${answered ? ' answered' : ''}">
        <div class="list-head">
          <button type="button" class="btn small" data-action="quit">やめる</button>
          <span class="progress-text">${qi + 1} ／ ${questions.length}</span>
        </div>
        <div class="progress"><span style="width:${(qi / questions.length) * 100}%"></span></div>
        <div class="quiz-prompt">${verdict}${prompt}</div>
        <div class="options">${options}</div>
      </div>
      ${answered ? `
        <div class="panel">${UI.wordDetail(w, { omit: shown })}</div>
        <p class="muted center">覚え具合を押すと${qi + 1 < questions.length ? '次へ進みます' : '結果を表示します'}</p>
        ${UI.memoryButtons(Store.state(w.id).memory)}` : ''}`;
  }

  function renderResult() {
    const ok = results.filter(r => r.correct).length;
    const misses = results.filter(r => !r.correct).map(r => Store.word(r.id));
    el.innerHTML = `
      <section class="panel center">
        <h2>結果</h2>
        <p class="score"><b>${ok}</b> ／ ${results.length} 問正解（${Math.round((ok / results.length) * 100)}%）</p>
      </section>
      ${misses.length ? `
        <section class="panel">
          <h2>まちがえた単語</h2>
          <ul class="miss-list">${misses.map(w => `<li><b>${UI.esc(w.word)}</b> — ${UI.esc(w.ja)}</li>`).join('')}</ul>
        </section>` : ''}
      <div class="row">
        <button type="button" class="btn" data-action="setup">設定に戻る</button>
        <button type="button" class="btn primary" data-action="start">もう一度</button>
      </div>`;
  }

  // ---- 操作 ----
  function onClick(e) {
    const t = e.target.closest('button');
    if (!t || t.dataset.goto) return; // data-goto は「データ管理を開く」（音は App.go が鳴らす）
    // 選択肢は正誤の音、記憶度は受け付けたときだけ鳴らす。それ以外のボタンはここで鳴らす
    if (!t.dataset.option && !t.dataset.memory) Sound.play('kachi');

    if (t.dataset.dir) {
      Store.setPref('quizDir', t.dataset.dir);
      render();
    } else if (t.dataset.count) {
      Store.setPref('quizCount', Number(t.dataset.count));
      render();
    } else if (t.dataset.option && chosen === null) {
      const q = questions[qi];
      chosen = Number(t.dataset.option);
      answeredAt = Date.now();
      const correct = chosen === q.answer;
      Sound.play(correct ? 'maru' : 'batsu');
      Store.answerQuiz(q.id, correct, q.options[chosen].text);
      results.push({ id: q.id, correct });
      render();
    } else if (t.dataset.memory) {
      // 回答直後は配置が詰まってボタンが指の下に来ることがあるので、少しのあいだ受け付けない
      if (Date.now() - answeredAt < 400) return;
      Sound.play('kachi');
      Store.setMemory(questions[qi].id, Number(t.dataset.memory), { rated: true });
      qi++;
      chosen = null;
      if (qi >= questions.length) phase = 'result';
      render();
      window.scrollTo(0, 0);
    } else if (t.dataset.action === 'quit') {
      if (!confirm('この回をやめて設定に戻りますか？（答えた分の記録は残ります）')) return;
      phase = 'setup';
      render();
    } else if (t.dataset.action === 'start') {
      start();
    } else if (t.dataset.action === 'setup') {
      phase = 'setup';
      render();
    }
  }

  return { show, reset };
})();
