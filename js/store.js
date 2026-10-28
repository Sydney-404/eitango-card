// 保存層。辞書（words）・学習状態（states）・日別の集計（daily）を localStorage に置く。
// 学習状態は単語ごとに最新だけを上書きし、学びの推移は1日1行の集計で残す（操作の1件ずつは残さない）。
const Store = (() => {
  const KEY = { words: 'ewc.words', states: 'ewc.states', daily: 'ewc.daily', prefs: 'ewc.prefs' };
  const LEGACY_LOGS = 'ewc.logs'; // 以前の形式（操作1件ずつのログ）。見つけたら日別の集計に変えて消す

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(e);
      UI.toast('保存できませんでした（容量不足の可能性があります）');
    }
  }

  let words = load(KEY.words, {});   // { [ID]: 単語 }
  let states = load(KEY.states, {}); // { [ID]: 学習状態 }
  let daily = load(KEY.daily, {});   // { 'YYYY-MM-DD': { studied, correct, total } }
  let prefs = load(KEY.prefs, {});   // 並び順・最後に開いたタブなどの好み

  function emptyState() {
    return { seen: 0, memory: 1, lastStudied: null, correct: 0, wrong: 0 };
  }

  function emptyDay() {
    return { studied: 0, correct: 0, total: 0 };
  }

  // 1回の学習を当てはめる。ふだんの記録も、以前のログの変換も、ここだけを通る
  // change：{ seen: true }（見た）／{ memory: 1〜4 }（記憶度）／{ correct: true/false }（四択）
  function apply(stateMap, dayMap, id, at, change) {
    const s = stateMap[id] || (stateMap[id] = emptyState());
    const day = UI.dayKey(at);
    const d = dayMap[day] || (dayMap[day] = emptyDay());
    // その日に初めて触れた単語だけ数える（最終学習日が別の日なら、この日はまだ数えていない）
    if (!s.lastStudied || UI.dayKey(s.lastStudied) !== day) d.studied++;
    s.lastStudied = at;
    if (change.seen) s.seen = 1;
    if (change.memory) s.memory = change.memory;
    if (typeof change.correct === 'boolean') {
      if (change.correct) s.correct++;
      else s.wrong++;
      d.total++;
      if (change.correct) d.correct++;
    }
  }

  function record(id, change) {
    apply(states, daily, id, new Date().toISOString(), change);
    save(KEY.states, states);
    save(KEY.daily, daily);
  }

  // ---- 以前の形式（操作1件ずつのログ）からの変換 ----
  // 読み込むログは外から来ることもあるので、形の正しいものだけを使う
  function isValidLog(log) {
    if (!log || typeof log.id !== 'string' || typeof log.at !== 'string' || Number.isNaN(Date.parse(log.at))) return false;
    switch (log.type) {
      case 'card_view': return true;
      case 'memory_change': return [1, 2, 3, 4].includes(log.detail?.to);
      case 'quiz_answer': return typeof log.detail?.correct === 'boolean';
      default: return false;
    }
  }

  const LEGACY_CHANGE = {
    card_view: () => ({ seen: true }),
    memory_change: log => ({ memory: log.detail.to }),
    quiz_answer: log => ({ seen: true, correct: log.detail.correct }),
  };

  function fromLogs(list) {
    const result = { states: {}, daily: {}, skipped: 0 };
    for (const log of list) {
      if (!isValidLog(log)) { result.skipped++; continue; }
      apply(result.states, result.daily, log.id, log.at, LEGACY_CHANGE[log.type](log));
    }
    return result;
  }

  // この端末に以前のログが残っていたら、日別の集計に変えて消す（学習状態はそのまま使う）
  (function migrateLegacyLogs() {
    const logs = load(LEGACY_LOGS, null);
    if (!Array.isArray(logs)) return;
    const converted = fromLogs(logs);
    if (!Object.keys(states).length) states = converted.states;
    if (!Object.keys(daily).length) daily = converted.daily;
    save(KEY.states, states);
    save(KEY.daily, daily);
    localStorage.removeItem(LEGACY_LOGS);
  })();

  // ---- 辞書 ----
  function wordList() {
    return Object.values(words);
  }

  function word(id) {
    return words[id];
  }

  function upsertWords(list) {
    list.forEach(w => { words[w.id] = w; });
    save(KEY.words, words);
  }

  // ---- 学習状態 ----
  function state(id) {
    return states[id] || emptyState();
  }

  // カードで「確認する」を押した
  function viewCard(id) {
    record(id, { seen: true });
  }

  // rated: カード・四択で「覚え具合をつけた」とき。同じ段階の押し直しも、学んだ日として記録する
  // （「確かめ直して、まだ覚えていた」も最終学習日を更新し、次の復習日を先に延ばす）
  function setMemory(id, to, { rated = false } = {}) {
    const from = state(id).memory;
    if (from !== to || rated) record(id, { memory: to });
  }

  // 四択に答えた
  function answerQuiz(id, correct) {
    record(id, { seen: true, correct });
  }

  // ---- 好み ----
  function pref(key, fallback) {
    return key in prefs ? prefs[key] : fallback;
  }

  function setPref(key, value) {
    prefs[key] = value;
    save(KEY.prefs, prefs);
  }

  // ---- バックアップ ----
  // 書き出すのは学習状態と日別の集計。辞書は Excel から入れ直せる
  function exportData() {
    return { app: 'eitango-card', version: 2, exportedAt: new Date().toISOString(), states, daily };
  }

  const isCount = n => Number.isInteger(n) && n >= 0;

  // 読み込むファイルは外から来るので、形の正しい行だけを受け入れる
  // （記憶度などは画面の HTML に差し込まれるため、想定外の値を通さない）
  function cleanStates(raw) {
    const clean = {};
    let skipped = 0;
    for (const [id, s] of Object.entries(raw)) {
      const ok = s && [0, 1].includes(s.seen) && [1, 2, 3, 4].includes(s.memory)
        && isCount(s.correct) && isCount(s.wrong)
        && (s.lastStudied === null || (typeof s.lastStudied === 'string' && !Number.isNaN(Date.parse(s.lastStudied))));
      if (ok) clean[id] = { seen: s.seen, memory: s.memory, lastStudied: s.lastStudied, correct: s.correct, wrong: s.wrong };
      else skipped++;
    }
    return { clean, skipped };
  }

  function cleanDaily(raw) {
    const clean = {};
    let skipped = 0;
    for (const [day, d] of Object.entries(raw)) {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(day) && d && isCount(d.studied) && isCount(d.correct) && isCount(d.total) && d.correct <= d.total;
      if (ok) clean[day] = { studied: d.studied, correct: d.correct, total: d.total };
      else skipped++;
    }
    return { clean, skipped };
  }

  // いまの学習状態と日別の集計を、ファイルの中身で置き換える。戻り値は除外した行の件数
  function importData(data) {
    let skipped;
    if (data && Array.isArray(data.logs)) {
      // 以前の形式のバックアップ（ログ）
      const converted = fromLogs(data.logs);
      states = converted.states;
      daily = converted.daily;
      skipped = converted.skipped;
    } else if (data && typeof data.states === 'object' && data.states && typeof data.daily === 'object' && data.daily) {
      const s = cleanStates(data.states);
      const d = cleanDaily(data.daily);
      states = s.clean;
      daily = d.clean;
      skipped = s.skipped + d.skipped;
    } else {
      throw new Error('このアプリのバックアップファイルではありません');
    }
    save(KEY.states, states);
    save(KEY.daily, daily);
    return skipped;
  }

  function resetAll() {
    [...Object.values(KEY), LEGACY_LOGS].forEach(k => localStorage.removeItem(k));
  }

  // 保存量のおおよそ（localStorage は1文字2バイトで数える）
  function usageBytes() {
    return Object.values(KEY).reduce((sum, k) => sum + (localStorage.getItem(k) || '').length * 2, 0);
  }

  return {
    wordList, word, upsertWords,
    state, viewCard, setMemory, answerQuiz,
    daily: () => daily, // 読むだけに使う（書き換えない）
    dayCount: () => Object.keys(daily).length,
    pref, setPref,
    exportData, importData, resetAll, usageBytes,
  };
})();
