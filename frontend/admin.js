(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const first = ['Silver', 'Amber', 'Misty', 'Violet', 'Golden', 'Crystal', 'Moon', 'Velvet'];
  const second = ['Fern', 'Willow', 'Clover', 'Lilac', 'Bloom', 'Sage', 'Fox', 'Rose', 'Comet', 'Iris', 'Owl', 'Wren', 'Maple', 'Moss', 'Lotus'];
  const groups = first.map((word, index) => ({
    id: `demo-group-${index + 1}`,
    name: `Английский · группа ${String(index + 1).padStart(2, '0')}`,
    members: second.map((ending, i) => ({alias: i % 5 === 4 ? null : `${word} ${ending}`, invitation: null})),
  }));
  let selected = groups[0].id;
  const invitations = new Map();
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function current() { return groups.find(group => group.id === selected); }
  function counts(group) {
    const registered = group.members.filter(member => member.alias).length;
    return {registered, pending: group.members.length - registered};
  }
  function announce(message) { $('announcement').textContent = message; }
  function revealSelection() {
    if (window.matchMedia('(max-width:850px)').matches) {
      $('selected-group-title').focus({preventScroll: true});
      document.querySelector('.members-panel').scrollIntoView({block: 'start'});
    } else {
      document.querySelector('.group-card[aria-pressed=true]')?.focus({preventScroll: true});
    }
  }
  function renderGroups() {
    $('group-count').textContent = groups.length;
    $('registered-count').textContent = groups.reduce((sum, group) => sum + counts(group).registered, 0);
    $('pending-count').textContent = groups.reduce((sum, group) => sum + counts(group).pending, 0);
    const query = $('group-search').value.trim().toLocaleLowerCase('ru');
    const matching = groups.filter(group => group.name.toLocaleLowerCase('ru').includes(query));
    $('group-result-count').textContent = `${matching.length} из ${groups.length}`;
    $('group-list').replaceChildren();
    for (const group of matching) {
      const button = node('button', undefined, 'group-card');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(group.id === selected));
      const {registered, pending} = counts(group);
      button.append(node('strong', group.name), node('span', `${registered} с профилем · ${pending} ожидают`));
      button.addEventListener('click', () => {
        selected = group.id;
        $('member-search').value = '';
        $('status-filter').value = 'all';
        render();
        revealSelection();
        announce(`Выбрана ${group.name}`);
      });
      $('group-list').append(button);
    }
    if (!matching.length) $('group-list').append(node('p', 'Групп с таким названием нет.', 'empty'));
  }
  function renderMembers() {
    const group = current();
    const {registered, pending} = counts(group);
    $('selected-group-title').textContent = group.name;
    $('group-summary').textContent = `${group.members.length} учебных мест · ${registered} с профилем · ${pending} ожидают`;
    const percent = group.members.length ? Math.round(registered / group.members.length * 100) : 0;
    $('registration-percent').textContent = `${percent}%`;
    $('registration-progress').value = percent;
    const query = $('member-search').value.trim().toLocaleLowerCase('en');
    const filter = $('status-filter').value;
    const members = group.members.filter(member =>
      (!query || (member.alias || '').toLocaleLowerCase('en').includes(query)) &&
      (filter === 'all' || (filter === 'registered' ? Boolean(member.alias) : !member.alias)));
    $('member-list').replaceChildren();
    for (const member of members) {
      const row = node('li', undefined, 'member-row');
      row.append(node('span', member.alias || 'Место для нового студента', 'member-alias'));
      row.append(node('span', member.alias ? 'Профиль создан' : member.invitation ? 'Приглашение создано' : 'Ожидает приглашения', `member-status${member.alias ? '' : ' pending'}`));
      $('member-list').append(row);
    }
    if (!members.length) $('member-list').append(node('li', group.members.length ? 'Нет студентов с выбранными условиями.' : 'В новой группе пока нет студентов. Попробуй создать демо-приглашение.', 'empty'));
    const invitation = invitations.get(group.id);
    $('invite-result').hidden = !invitation;
    $('invite-code').textContent = invitation || '';
    $('copy-invite').textContent = 'Скопировать код';
  }
  function render() { renderGroups(); renderMembers(); }
  $('group-search').addEventListener('input', renderGroups);
  $('member-search').addEventListener('input', renderMembers);
  $('status-filter').addEventListener('change', renderMembers);
  $('add-group').addEventListener('click', () => {
    $('group-form').reset();
    $('group-error').textContent = '';
    $('group-dialog').showModal();
    $('group-name').focus();
  });
  $('cancel-group').addEventListener('click', () => $('group-dialog').close());
  $('group-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('group-name').value.trim();
    if (!name) { $('group-error').textContent = 'Введи название группы.'; return; }
    if (groups.some(group => group.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
      $('group-error').textContent = 'Группа с таким названием уже есть.';
      return;
    }
    const group = {id: `demo-group-${crypto.randomUUID()}`, name, members: []};
    groups.push(group);
    selected = group.id;
    $('group-search').value = '';
    $('member-search').value = '';
    $('status-filter').value = 'all';
    $('group-dialog').close();
    render();
    revealSelection();
    announce(`Демонстрационная группа «${name}» создана.`);
  });
  $('create-invite').addEventListener('click', () => {
    const group = current();
    let member = group.members.find(member => !member.alias && !member.invitation);
    if (!member) { member = {alias: null, invitation: null}; group.members.push(member); }
    member.invitation = `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    invitations.set(group.id, member.invitation);
    render();
    announce('Демо-приглашение создано. Этот учебный код не открывает настоящую регистрацию.');
  });
  $('copy-invite').addEventListener('click', async () => {
    const code = invitations.get(current().id);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      $('copy-invite').textContent = 'Скопировано';
      announce('Демонстрационный код скопирован.');
    } catch {
      announce('Не удалось скопировать автоматически. Выдели демонстрационный код и скопируй вручную.');
    }
  });
  render();
})();
