// Excel / CSV の取り込み。読む → 調べる（プレビュー）→ 確定、の3段に分ける
const Importer = (() => {
  // 見出し → 内部の項目名
  const COLUMNS = {
    'id': 'id',
    '英単語': 'word',
    '日本語の意味': 'ja',
    '英語の意味': 'en',
    '分類タグ': 'tags',
    '品詞': 'pos',
    'unit': 'unit',
    '語の形': 'forms',
  };
  const REQUIRED = { id: 'ID', word: '英単語', ja: '日本語の意味', pos: '品詞', unit: 'Unit' };

  // CSV は UTF-8 を試し、だめなら Shift_JIS（日本語版 Excel の既定）として読む
  function decodeText(buf) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      return new TextDecoder('shift_jis').decode(buf);
    }
  }

  // ファイルの中身 → 行の配列（1行目の見出しをキーにしたオブジェクト）
  function parse(buf, fileName) {
    if (typeof XLSX === 'undefined') throw new Error('Excel 読み込み部品（SheetJS）を読み込めませんでした。通信を確認してください');
    const book = /\.csv$/i.test(fileName)
      ? XLSX.read(decodeText(buf).replace(/^﻿/, ''), { type: 'string' })
      : XLSX.read(buf, { type: 'array' });
    const sheet = book.Sheets[book.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  }

  function normalizeRow(raw) {
    const r = {};
    for (const [header, value] of Object.entries(raw)) {
      const field = COLUMNS[header.trim().toLowerCase()];
      if (field) r[field] = String(value).trim();
    }
    return r;
  }

  function sameWord(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // 行を調べて、新規・更新・変更なし・エラーに分ける（まだ保存しない）
  function analyze(rows) {
    const result = { added: [], updated: [], unchanged: 0, errors: [] };
    const idsInFile = new Set();

    rows.forEach((raw, i) => {
      const rowNo = i + 2; // 1行目は見出し
      const r = normalizeRow(raw);
      if (Object.values(r).every(v => v === '')) return; // 空行は黙って飛ばす

      const missing = Object.keys(REQUIRED).filter(k => !r[k]);
      if (missing.length) {
        result.errors.push({ rowNo, message: `必須項目が空です：${missing.map(k => REQUIRED[k]).join('、')}` });
        return;
      }
      const unit = Number(r.unit);
      if (!Number.isFinite(unit)) {
        result.errors.push({ rowNo, message: `Unit が数値ではありません：${r.unit}` });
        return;
      }
      if (idsInFile.has(r.id)) {
        result.errors.push({ rowNo, message: `ID が重複しています：${r.id}` });
        return;
      }
      idsInFile.add(r.id);

      const word = {
        id: r.id,
        word: r.word,
        ja: r.ja,
        en: r.en || '',
        tags: (r.tags || '').split(/[;；]/).map(t => t.trim()).filter(Boolean),
        pos: r.pos,
        unit,
        forms: r.forms || '',
      };
      const existing = Store.word(word.id);
      if (!existing) result.added.push(word);
      else if (!sameWord(existing, word)) result.updated.push(word);
      else result.unchanged++;
    });
    return result;
  }

  // 確定：追加と更新だけ行う。Excel にない単語は消さない。学習状態には触れない
  function apply(result) {
    Store.upsertWords([...result.added, ...result.updated]);
  }

  return { parse, analyze, apply };
})();
