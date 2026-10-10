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
    if (missing.length) suggestions.push(`Try using these in an appropriate context: ${missing.join(', ')}. This check looks for exact forms; other forms may have been missed.`);
    if (/\b(?:i|i'm|i've|i'll|i'd)\b/.test(text)) suggestions.push('Check the pronoun I: it needs a capital letter (for example, i → I).');
    if (/[^\n]\s{2,}[^\n]/.test(text)) suggestions.push('Check repeated spaces: one space between words is usually enough.');
    if (/\s+[,.!?;:]/.test(text)) suggestions.push('Check spaces before punctuation: for example, friend ! → friend!');
    if (text.trim() && !/[.!?…]["'”’)]?$/.test(text.trim())) suggestions.push('Check the end of your text: you may need final punctuation.');
    return {found, missing, suggestions, wordCount: words.length};
  }
  function analyseConstructions(text, constructions = []) {
    const found = [], missing = [];
    const chunks = normalize(text).split(/[^\p{L}\p{N}'\s]+/u).map(tokens);
    for (const construction of constructions) {
      const parts = normalize(construction).split(/\.\.\.|…/);
      const pattern = [];
      parts.forEach((part, index) => {if (index) pattern.push(null); pattern.push(...tokens(part));});
      // Bounded state matching avoids evaluating user regex or backtracking through repeated gaps.
      const matches = pattern.some(item => item !== null) && chunks.some(words => {
        let positions = new Set(words.map((_, index) => index));
        for (const item of pattern) {
          const next = new Set();
          for (const position of positions) {
            if (item === null) {
              for (let gap = 1; gap <= 12 && position + gap <= words.length; gap++) next.add(position + gap);
            } else if (words[position] === item) next.add(position + 1);
          }
          positions = next;
          if (!positions.size) return false;
        }
        return positions.size > 0;
      });
      (matches ? found : missing).push(construction);
    }
    return {found, missing};
  }
  const api = Object.freeze({parseVocabulary, analyse, analyseConstructions});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MoonTextReview = api;
})(typeof window === 'undefined' ? globalThis : window);
