// 保存層。辞書（words）・学習状態（states）・学習ログ（logs）を localStorage に置く。
// 学習状態は「ログを古い順に当てはめた結果」なので、いつでもログから作り直せる。
const Store = (() => {
  const KEY = { words: 'ewc.words', states: 'ewc.states', logs: 'ewc.logs', prefs: 'ewc.prefs' };

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
  let logs = load(KEY.logs, []);     // [{ at, id, type, detail }]
  let states = load(KEY.states, null) || rebuild(logs); // { [ID]: 学習状態 }
  let prefs = load(KEY.prefs, {});   // 並び順・最後に開いたタブなどの好み

  function emptyState() {
    return { seen: 0, memory: 1, lastStudied: null, correct: 0, wrong: 0 };
  }

  // ログ1件を学習状態に当てはめる。記録するときも作り直すときも、ここだけを通る
  function applyLog(target, log) {
    const s = target[log.id] || (target[log.id] = emptyState());
    s.lastStudied = log.at;
    switch (log.type) {
      case 'card_view':
        s.seen = 1;
        break;
      case 'memory_change':
        s.memory = log.detail.to;
        break;
      case 'quiz_answer':
        s.seen = 1;
        if (log.detail.correct) s.correct++;
        else s.wrong++;
        break;
    }
  }

  function rebuild(list) {
    const target = {};
    list.forEach(log => applyLog(target, log));
    return target;
  }

  function record(id, type, detail = null) {
    const log = { at: new Date().toISOString(), id, type, detail };
    logs.push(log);
    applyLog(states, log);
    save(KEY.logs, logs);
    save(KEY.states, states);
  }

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
    record(id, 'card_view');
  }

  // rated: カード・四択で「覚え具合をつけた」とき。同じ段階の押し直しも記録する
  // （「確かめ直して、まだ覚えていた」は復習間隔の計算に使える。あとからは取り戻せない）
  function setMemory(id, to, { rated = false } = {}) {
    const from = state(id).memory;
    if (from !== to || rated) record(id, 'memory_change', { from, to });
  }

  // 四択に答えた
  function answerQuiz(id, correct, chosen) {
    record(id, 'quiz_answer', { correct, chosen });
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
  // 書き出すのは学習状態とログ。辞書は Excel から入れ直せる
  function exportData() {
    return { app: 'eitango-card', version: 1, exportedAt: new Date().toISOString(), states, logs };
  }

  // 読み込むファイルは外から来るので、形の正しいログだけを受け入れる
  // （記憶度などは画面の HTML に差し込まれるため、想定外の値を通さない）
  function isValidLog(log) {
    if (!log || typeof log.id !== 'string' || typeof log.at !== 'string') return false;
    switch (log.type) {
      case 'card_view': return true;
      case 'memory_change': return [1, 2, 3, 4].includes(log.detail?.to);
      case 'quiz_answer': return typeof log.detail?.correct === 'boolean';
      default: return false;
    }
  }

  // 学習状態はファイルの states を使わず、ログから作り直す。戻り値は除外したログの件数
  function importData(data) {
    if (!data || !Array.isArray(data.logs)) {
      throw new Error('このアプリのバックアップファイルではありません');
    }
    logs = data.logs.filter(isValidLog);
    states = rebuild(logs);
    save(KEY.logs, logs);
    save(KEY.states, states);
    return data.logs.length - logs.length;
  }

  // 学習状態が壊れたときの修復：ログから作り直す
  function rebuildStates() {
    states = rebuild(logs);
    save(KEY.states, states);
  }

  function resetAll() {
    Object.values(KEY).forEach(k => localStorage.removeItem(k));
  }

  // 保存量のおおよそ（localStorage は1文字2バイトで数える）
  function usageBytes() {
    return Object.values(KEY).reduce((sum, k) => sum + (localStorage.getItem(k) || '').length * 2, 0);
  }

  return {
    wordList, word, upsertWords,
    state, viewCard, setMemory, answerQuiz,
    logCount: () => logs.length,
    pref, setPref,
    exportData, importData, rebuildStates, resetAll, usageBytes,
  };
})();
