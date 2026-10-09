(() => {
  'use strict';
  const items = Object.freeze([{id: 'moon', name: 'Лунная улыбка'}, {id: 'sprout', name: 'Росточек'}, {id: 'spark', name: 'Звёздная поддержка'}]);
  const namespace = 'http://www.w3.org/2000/svg';
  function shape(tag, attributes) {const element = document.createElementNS(namespace, tag); for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value); return element;}
  function icon(id) {
    const svg = shape('svg', {viewBox: '0 0 32 32', width: '28', height: '28', role: 'img', 'aria-label': items.find(item => item.id === id).name, class: 'campus-emote'});
    svg.append(shape('circle', {cx: 16, cy: 16, r: 15, fill: '#f0e6fb'}));
    if (id === 'moon') {
      svg.append(shape('path', {d: 'M23 7A11 11 0 1 0 25 24A10 10 0 0 1 23 7Z', fill: '#b39cdb'}));
      svg.append(shape('circle', {cx: 10, cy: 14, r: 1.2, fill: '#403259'}), shape('path', {d: 'M9 19Q12 23 16 19', stroke: '#403259', fill: 'none', 'stroke-width': 1.5}));
    } else if (id === 'sprout') {
      svg.append(shape('path', {d: 'M16 26V15M16 18C4 18 6 7 6 7C15 7 17 12 16 18ZM16 15C16 5 26 6 26 6C26 16 20 17 16 15Z', fill: '#88b8a1', stroke: '#416958', 'stroke-width': 1.3}));
    } else {
      svg.append(shape('path', {d: 'M16 5L19 12L27 15L20 19L17 27L13 20L5 17L12 13Z', fill: '#e8bb73', stroke: '#a87f42', 'stroke-width': 1}));
      svg.append(shape('circle', {cx: 14, cy: 16, r: 1, fill: '#624326'}), shape('circle', {cx: 19, cy: 16, r: 1, fill: '#624326'}));
    }
    return svg;
  }
  function text(value) {
    const fragment = document.createDocumentFragment();
    for (const part of value.split(/(:moon:|:sprout:|:spark:)/g)) {
      const item = items.find(item => ':' + item.id + ':' === part);
      fragment.append(item ? icon(item.id) : document.createTextNode(part));
    }
    return fragment;
  }
  function picker(field) {
    const bar = document.createElement('div'); bar.className = 'emote-picker'; bar.setAttribute('aria-label', 'Смайлики Moon Campus');
    for (const item of items) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.setAttribute('aria-label', 'Вставить: ' + item.name); button.append(icon(item.id));
      button.addEventListener('click', () => {
        const token = ':' + item.id + ':';
        const start = field.selectionStart ?? field.value.length, end = field.selectionEnd ?? start;
        if (field.value.length - (end - start) + token.length > field.maxLength) return;
        field.setRangeText(token, start, end, 'end'); field.dispatchEvent(new Event('input', {bubbles: true})); field.focus();
      });
      bar.append(button);
    }
    return bar;
  }
  window.MoonEmotes = Object.freeze({items, icon, text, picker});
})();
