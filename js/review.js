// 忘却曲線：次の復習日を「最後に学んだ日 ＋ 記憶度に応じた日数」で決める（SPEC 5.1）
const Review = (() => {
  const INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7, 4: 14 };

  // 端末の時刻での日付（例：2026-10-29）。文字列のまま大小を比べられる
  function dayKey(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d + n));
  }

  function today() {
    return dayKey(new Date());
  }

  // 次の復習日。まだ一度も学んでいない単語は復習の対象ではないので null
  function dueDay(id) {
    const s = Store.state(id);
    if (!s.lastStudied) return null;
    return addDays(dayKey(s.lastStudied), INTERVAL_DAYS[s.memory]);
  }

  // 復習日が今日か、もう過ぎている
  function isDue(id) {
    const d = dueDay(id);
    return d !== null && d <= today();
  }

  return { INTERVAL_DAYS, dayKey, addDays, today, dueDay, isDue };
})();
