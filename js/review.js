// 忘却曲線：次の復習日を「最後に学んだ日 ＋ 記憶度に応じた日数」で決める（SPEC 5.1）
const Review = (() => {
  const INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7, 4: 14 };

  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    return UI.dayKey(new Date(y, m - 1, d + n));
  }

  function today() {
    return UI.dayKey(new Date());
  }

  // 次の復習日。まだ一度も学んでいない単語は復習の対象ではないので null
  function dueDay(id) {
    const s = Store.state(id);
    if (!s.lastStudied) return null;
    return addDays(UI.dayKey(s.lastStudied), INTERVAL_DAYS[s.memory]);
  }

  // 復習日が今日か、もう過ぎている
  function isDue(id) {
    const d = dueDay(id);
    return d !== null && d <= today();
  }

  return { INTERVAL_DAYS, addDays, today, dueDay, isDue };
})();
