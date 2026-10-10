(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const courses = window.MoonCourses;
  const courseName = id => courses.find(course => course.id === id).name;
  let editing = null;
  const first = ['Silver', 'Amber', 'Misty', 'Violet', 'Golden', 'Crystal', 'Moon', 'Velvet'];
  const second = ['Fern', 'Willow', 'Clover', 'Lilac', 'Bloom', 'Sage', 'Fox', 'Rose', 'Comet', 'Iris', 'Owl', 'Wren', 'Maple', 'Moss', 'Lotus'];
  const groups = first.map((word, index) => ({
    id: `demo-group-${index + 1}`,
    name: `English · group ${String(index + 1).padStart(2, '0')}`,
    courseId: index % 2 ? 'grammar' : 'speech',
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
    const matching = groups.filter(group => group.name.toLocaleLowerCase('ru').includes(query) && ($('course-filter').value === 'all' || group.courseId === $('course-filter').value));
    $('group-result-count').textContent = `${matching.length} of ${groups.length}`;
    $('group-list').replaceChildren();
    for (const group of matching) {
      const button = node('button', undefined, 'group-card');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(group.id === selected));
      const {registered, pending} = counts(group);
      button.append(node('strong', group.name), node('span', courseName(group.courseId)), node('span', `${registered} with profiles · ${pending} pending`));
      button.addEventListener('click', () => {
        selected = group.id;
        $('member-search').value = '';
        $('status-filter').value = 'all';
        render();
        revealSelection();
        announce(`Selected ${group.name}`);
      });
      $('group-list').append(button);
    }
    if (!matching.length) $('group-list').append(node('p', 'No groups with this name.', 'empty'));
  }
  function renderMembers() {
    const group = current();
    const {registered, pending} = counts(group);
    $('selected-group-title').textContent = group.name;
    $('group-summary').textContent = `${courseName(group.courseId)} · ${group.members.length} learning places · ${registered} with profiles · ${pending} pending`;
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
      row.append(node('span', member.alias || 'Place for a new student', 'member-alias'));
      row.append(node('span', member.alias ? 'Profile created' : member.invitation ? 'Invitation created' : 'Awaiting invitation', `member-status${member.alias ? '' : ' pending'}`));
      $('member-list').append(row);
    }
    if (!members.length) $('member-list').append(node('li', group.members.length ? 'No students match the selected filters.' : 'No students in this new group yet. Try creating a demo invitation.', 'empty'));
    const invitation = invitations.get(group.id);
    $('invite-result').hidden = !invitation;
    $('invite-code').textContent = invitation || '';
    $('copy-invite').textContent = 'Copy code';
  }
  function render() { renderGroups(); renderMembers(); }
  for (const course of courses) {
    for (const id of ['course-filter', 'group-course']) {const option = node('option', course.name); option.value = course.id; $(id).append(option);}
  }
  $('course-filter').addEventListener('change', renderGroups);
  $('edit-group').addEventListener('click', () => {
    const group = current(); editing = group.id;
    $('dialog-title').textContent = 'Group name and course';
    $('group-form').querySelector('button[type=submit]').textContent = 'Save';
    $('group-name').value = group.name; $('group-course').value = group.courseId;
    $('group-error').textContent = ''; $('group-dialog').showModal(); $('group-name').focus();
  });
  $('group-search').addEventListener('input', renderGroups);
  $('member-search').addEventListener('input', renderMembers);
  $('status-filter').addEventListener('change', renderMembers);
  $('add-group').addEventListener('click', () => {
    editing = null; $('dialog-title').textContent = 'New learning group';
    $('group-form').querySelector('button[type=submit]').textContent = 'Create';
    $('group-form').reset();
    $('group-error').textContent = '';
    $('group-dialog').showModal();
    $('group-name').focus();
  });
  $('cancel-group').addEventListener('click', () => $('group-dialog').close());
  $('group-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('group-name').value.trim();
    if (!name) { $('group-error').textContent = 'Enter a group name.'; return; }
    if (groups.some(group => group.id !== editing && group.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
      $('group-error').textContent = 'A group with this name already exists.';
      return;
    }
    const group = editing ? current() : {id: `demo-group-${crypto.randomUUID()}`, members: []};
    group.name = name; group.courseId = $('group-course').value;
    if (!editing) groups.push(group);
    $('course-filter').value = 'all';
    selected = group.id;
    $('group-search').value = '';
    $('member-search').value = '';
    $('status-filter').value = 'all';
    $('group-dialog').close();
    render();
    revealSelection();
    announce(`Demo group “${name}” saved.`);
  });
  $('create-invite').addEventListener('click', () => {
    const group = current();
    let member = group.members.find(member => !member.alias && !member.invitation);
    if (!member) { member = {alias: null, invitation: null}; group.members.push(member); }
    member.invitation = `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    invitations.set(group.id, member.invitation);
    render();
    announce('Demo invitation created. This sample code does not enable real registration.');
  });
  $('copy-invite').addEventListener('click', async () => {
    const code = invitations.get(current().id);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      $('copy-invite').textContent = 'Copied';
      announce('Demo code copied.');
    } catch {
      announce('Could not copy automatically. Select the demo code and copy it manually.');
    }
  });
  document.querySelector('.dashboard-links a').addEventListener('click', () => {
    try {sessionStorage.setItem('moon-demo-catalog', JSON.stringify(groups.map(({id, name, courseId}) => ({id, name, courseId}))));}
    catch {announce('Could not transfer demo groups. Assignments will use the default set.');}
  });
  render();
})();
