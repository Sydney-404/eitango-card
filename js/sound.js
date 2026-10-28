// 効果音。Web Audio で鳴らす（スマホでも遅れにくく、続けて押しても重ねて鳴らせる）
const Sound = (() => {
  const FILES = {
    shu: 'sound/shu.mp3',     // 画面が変わる
    maru: 'sound/maru.wav',   // 正解
    batsu: 'sound/batsu.wav', // 不正解
    pon: 'sound/pon.mp3',     // 絞り込み・設定・一覧の操作
    kachi: 'sound/kachi.wav', // カード・四択のボタン
  };
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  const buffers = {};

  function enabled() {
    return Store.pref('sound', true);
  }

  function setEnabled(on) {
    Store.setPref('sound', on);
  }

  // 音のデータは、最初に画面に触れたときにまとめて読み込む
  function init() {
    if (ctx || !AudioCtx) return;
    ctx = new AudioCtx();
    for (const [name, url] of Object.entries(FILES)) {
      fetch(url)
        .then(res => res.arrayBuffer())
        .then(data => ctx.decodeAudioData(data))
        .then(buf => { buffers[name] = buf; })
        .catch(() => {}); // ファイルを直接開いているときは fetch できない。下の Audio で鳴らす
    }
  }

  function play(name) {
    if (!enabled()) return;
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume(); // スマホは、触れたときにしか音を出させてくれない
    const buf = buffers[name];
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
    } else {
      new Audio(FILES[name]).play().catch(() => {});
    }
  }

  document.addEventListener('pointerdown', init, { once: true });

  return { play, enabled, setEnabled };
})();
