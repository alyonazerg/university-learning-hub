(function (root) {
  'use strict';
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('en').replace(/[’‘]/g, "'");
  const tokens = value => normalize(value).match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) || [];
  function parseVocabulary(value) {
    const seen = new Set();
    return value.split(/[,;\n]/).map(term => term.trim()).filter(term => {
      const key = tokens(term).join(' ');
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function analyse(text, vocabulary) {
    const words = tokens(text);
    const found = [], missing = [];
    for (const term of vocabulary) {
      const target = tokens(term);
      // Only whitespace may separate phrase words: punctuation cannot join unrelated clauses.
      const escaped = target.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = escaped.join('\\s+');
      const match = target.length && new RegExp(`(?:^|[^\\p{L}\\p{N}'])${pattern}(?![\\p{L}\\p{N}'])`, 'u').test(normalize(text));
      (match ? found : missing).push(term);
    }
    const suggestions = [];
    if (missing.length) suggestions.push(`Попробуй употребить в подходящем контексте: ${missing.join(', ')}. Проверка ищет точные формы; другие формы могли остаться незамеченными.`);
    if (/\b(?:i|i'm|i've|i'll|i'd)\b/.test(text)) suggestions.push('Проверь английское местоимение I: его пишут с заглавной буквы (например, i → I).');
    if (/[^\n]\s{2,}[^\n]/.test(text)) suggestions.push('Проверь повторяющиеся пробелы: между словами обычно достаточно одного.');
    if (/\s+[,.!?;:]/.test(text)) suggestions.push('Проверь пробел перед знаком препинания: например, friend ! → friend!');
    if (text.trim() && !/[.!?…]["'”’)]?$/.test(text.trim())) suggestions.push('Проверь завершение текста: возможно, нужен конечный знак препинания.');
    return {found, missing, suggestions, wordCount: words.length};
  }
  const api = Object.freeze({parseVocabulary, analyse});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MoonTextReview = api;
})(typeof window === 'undefined' ? globalThis : window);
