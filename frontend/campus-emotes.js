(() => {
  'use strict';
  const items = Object.freeze([{id: 'moon', name: 'Лунная улыбка'}, {id: 'sprout', name: 'Росточек'}, {id: 'spark', name: 'Звёздная поддержка'}, {id: 'happy', name: 'Радуюсь'}, {id: 'sad', name: 'Грущу'}, {id: 'anxious', name: 'Волнуюсь'}, {id: 'tired', name: 'Устал'}, {id: 'curious', name: 'Любопытно'}, {id: 'proud', name: 'Горжусь собой'}]);
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
    } else if (id === 'spark') {
      svg.append(shape('path', {d: 'M16 5L19 12L27 15L20 19L17 27L13 20L5 17L12 13Z', fill: '#e8bb73', stroke: '#a87f42', 'stroke-width': 1}));
      svg.append(shape('circle', {cx: 14, cy: 16, r: 1, fill: '#624326'}), shape('circle', {cx: 19, cy: 16, r: 1, fill: '#624326'}));
    }
    if (!['moon', 'sprout', 'spark'].includes(id)) {
      svg.append(shape('circle', {cx: 16, cy: 16, r: 12, fill: id === 'sad' ? '#b7c8df' : id === 'anxious' ? '#d4bee8' : '#f1d29c'}));
      if (id === 'tired') svg.append(shape('path', {d: 'M8 13H12M20 13H24', stroke: '#594863', 'stroke-width': 2}));
      else svg.append(shape('circle', {cx: 11, cy: 13, r: id === 'curious' ? 2.5 : 1.5, fill: '#594863'}), shape('circle', {cx: 21, cy: 13, r: 1.5, fill: '#594863'}));
      const mouths = {happy: 'M10 19Q16 27 23 18', sad: 'M10 24Q16 17 22 24', anxious: 'M11 22L14 20L17 22L20 20L23 22', tired: 'M12 22H20', curious: 'M14 21Q16 18 19 21Q20 25 16 25Q13 24 14 21', proud: 'M10 20Q16 25 22 20'};
      svg.append(shape('path', {d: mouths[id], stroke: '#594863', fill: 'none', 'stroke-width': 1.7, 'stroke-linecap': 'round'}));
      if (id === 'sad') svg.append(shape('path', {d: 'M23 16Q19 22 23 22Q27 22 23 16', fill: '#7fa9d3'}));
      if (id === 'anxious') svg.append(shape('path', {d: 'M8 9L12 10M20 10L24 9', stroke: '#594863', 'stroke-width': 1.5}));
    }
    return svg;
  }
  function text(value) {
    const fragment = document.createDocumentFragment();
    for (const part of value.split(/(:moon:|:sprout:|:spark:|:happy:|:sad:|:anxious:|:tired:|:curious:|:proud:)/g)) {
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
