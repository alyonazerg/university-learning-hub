(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const courses = window.MoonCourses;
  const lists = [{id: 'seed-list', title: 'Expressions · card format', source: 'Sample presentation', courseId: 'speech', kind: 'target', status: 'approved', words: [{term: 'searing pain', transcription: '[ˈsɪərɪŋ peɪn]', definition: 'Sharp, intense burning sensation that causes acute physical suffering.', synonyms: ['burning pain', 'scorching pain', 'acute pain'], antonyms: ['dull ache', 'mild discomfort'], collocations: ['searing pain in the chest'], meaning: 'жгучая боль', example: 'She felt a searing pain shoot through her lower back when she lifted the box.'}, {term: 'enjoy', meaning: 'получать удовольствие', example: 'I enjoy reading.'}, {term: 'would you like', meaning: 'хотели бы вы', example: 'Would you like some tea?'}]}];
  const editorByGroup = new Map();
  let assignmentGroup = 'demo-group-1';
  let boardPhoto = null, recognizing = false, boardVersion = 0;
  const mayFormat = () => role === 'teacher' || editorByGroup.get('demo-group-1') === 'demo-student-1';
  const state = {words: {}, events: []};
  let role = 'teacher', flipped = false, optedIn = false, selectedWord = null;
  function node(tag, text, className) {const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element;}
  function button(text, action) {const element = node('button', text, 'secondary'); element.type = 'button'; element.addEventListener('click', action); return element;}
  function available() {return lists.filter(list => list.status === 'approved' && list.courseId === 'speech').flatMap(list => list.words.map((word, index) => ({...word, id: list.id + ':' + index})));}
  function render() {
    const teacher = role === 'teacher';
    renderEditorAssignment();
    $('vocab-viewer').textContent = teacher ? '✦ Lunar Thyme' : 'Silver Fern';
    $('vocab-teacher').setAttribute('aria-pressed', String(teacher)); $('vocab-student').setAttribute('aria-pressed', String(!teacher));
    $('editor-title').textContent = teacher ? 'Prepare target vocabulary' : 'Suggest emergent vocabulary';
    $('save-list').textContent = teacher ? 'Save target list' : 'Submit for review';
    $('list-course').disabled = !teacher; if (!teacher) $('list-course').value = 'speech';
    $('vocab-lists').replaceChildren(node('h2', teacher ? 'Lists and student suggestions' : 'Your group’s vocabulary'));
    for (const list of lists.filter(list => teacher || list.courseId === 'speech')) {
      const card = node('article', undefined, 'word-list-card');
      card.append(node('h3', list.title), node('p', `${list.kind === 'target' ? 'Target vocabulary' : 'Emergent vocabulary'} · ${list.status === 'approved' ? 'Approved' : 'Pending review'} · ${courses.find(course => course.id === list.courseId).name}`), node('p', list.source || 'No source specified', 'muted'));
      const words = node('ul'); for (const word of list.words) words.append(node('li', `${word.term}${word.meaning ? ' — ' + word.meaning : ''}${word.example ? ' · ' + word.example : ''}`)); card.append(words);
      if (teacher && list.status === 'pending') card.append(button('Approve for group flashcards', () => {list.status = 'approved'; render(); $('vocab-status').textContent = 'List approved.';}));
      $('vocab-lists').append(card);
    }
    renderTraining(); renderRanking();
  }
  function renderEditorAssignment() {
    const area = $('editor-assignment'); area.replaceChildren();
    if (role === 'teacher') {
      const groupLabel = node('label', 'Group', 'input-label'); groupLabel.htmlFor = 'card-editor-group';
      const group = node('select'); group.id = 'card-editor-group';
      for (let index = 1; index <= 8; index++) {const option = node('option', `English · group ${String(index).padStart(2, '0')}`); option.value = 'demo-group-' + index; group.append(option);}
      group.value = assignmentGroup; group.addEventListener('change', () => {assignmentGroup = group.value; renderEditorAssignment();});
      const label = node('label', 'One vocabulary editor', 'input-label'); label.htmlFor = 'card-editor-student';
      const select = node('select'); select.id = 'card-editor-student';
      const prefix = ['Silver', 'Amber', 'Misty', 'Violet', 'Golden', 'Crystal', 'Moon', 'Velvet'][Number(assignmentGroup.split('-').at(-1)) - 1];
      const options = [{id: '', name: 'Teacher only'}, {id: assignmentGroup === 'demo-group-1' ? 'demo-student-1' : assignmentGroup + '-fern', name: prefix + ' Fern'}, {id: assignmentGroup === 'demo-group-1' ? 'demo-student-2' : assignmentGroup + '-willow', name: prefix + ' Willow'}];
      for (const item of options) {const option = node('option', item.name); option.value = item.id; select.append(option);}
      select.value = editorByGroup.get(assignmentGroup) || '';
      select.addEventListener('change', () => {if (select.value) editorByGroup.set(assignmentGroup, select.value); else editorByGroup.delete(assignmentGroup); boardVersion++; renderEditorAssignment(); $('vocab-status').textContent = 'Group editor updated in the demo.';});
      area.append(groupLabel, group, label, select);
    }
    $('editor-access').textContent = role === 'teacher' ? 'You can prepare cards for every group. Assigning a new editor replaces the previous one.' : mayFormat() ? 'You are the vocabulary editor for group 01. Your teacher reviews drafts before publishing.' : 'Teachers and assigned editors can prepare cards from photos. You can suggest emergent vocabulary as text.';
    $('board-workspace').hidden = !mayFormat();
    $('rich-card-help').hidden = !mayFormat();
    $('board-photo').disabled = !mayFormat() || recognizing;
    $('recognize-board').disabled = !mayFormat() || !boardPhoto || recognizing;
    $('apply-board').disabled = !mayFormat() || recognizing;
    $('board-text').readOnly = !mayFormat();
  }
  $('board-photo').addEventListener('change', async () => {
    const version = ++boardVersion; boardPhoto = null; $('board-preview').replaceChildren(); $('board-status').textContent = ''; renderEditorAssignment();
    const file = $('board-photo').files[0]; if (!file || !mayFormat()) return;
    try {const photo = await MoonPhotos.prepare(file); if (version !== boardVersion || !mayFormat()) return; boardPhoto = photo; $('board-preview').append(MoonPhotos.gallery([photo])); $('board-status').textContent = 'Photo ready. Recognize the text and check each line.';}
    catch (error) {$('board-status').textContent = error.message || 'Could not read the photo.';}
    renderEditorAssignment();
  });
  $('recognize-board').addEventListener('click', async () => {
    if (!mayFormat() || !boardPhoto || recognizing) return;
    const version = boardVersion, initiatingRole = role;
    let worker = null, timeout, aborted = false;
    recognizing = true; renderEditorAssignment(); $('board-status').textContent = 'Loading local text recognition models…';
    try {
      if (!window.Tesseract) throw new Error('Text recognition is unavailable. Ask your administrator to build the frontend assets.');
      const operation = (async () => {
        worker = await Tesseract.createWorker(['eng', 'rus'], 1, {workerPath: new URL('ocr/worker.min.js', location.href).href, corePath: new URL('ocr/core/', location.href).href, langPath: new URL('ocr/lang/', location.href).href, workerBlobURL: false, logger: message => {if (message.status === 'recognizing text') $('board-status').textContent = `Recognizing text: ${Math.round((message.progress || 0) * 100)}%`;}});
        if (aborted) {await worker.terminate(); throw new Error('Text recognition cancelled.');}
        await worker.setParameters({tessedit_pageseg_mode: '6'});
        return worker.recognize(boardPhoto.src);
      })();
      const {data} = await Promise.race([operation, new Promise((_, reject) => {timeout = setTimeout(() => reject(new Error('Text recognition timed out. Try a smaller photo with clearer text.')), 90000);})]);
      if (version !== boardVersion || initiatingRole !== role || !mayFormat()) throw new Error('Access or mode changed. The result was not applied.');
      const text = data.text.trim(); if (!text) throw new Error('No text found. Try a clearer photo.');
      if (text.length > 15000) throw new Error('Too much text. Use a photo of one part of the board.');
      $('board-text').value = text; $('board-status').textContent = 'Text recognized. Correct any errors, use one entry per line, then transfer it to the list.';
    } catch (error) {$('board-status').textContent = error.message || 'Text recognition failed.';}
    finally {aborted = true; clearTimeout(timeout); if (worker) {try {await worker.terminate();} catch { /* Worker already terminated. */ }} recognizing = false; renderEditorAssignment();}
  });
  $('apply-board').addEventListener('click', () => {
    if (!mayFormat() || recognizing) return;
    const text = $('board-text').value.trim(); if (!text) {$('board-status').textContent = 'Add reviewed text.'; return;}
    $('word-list').value = text; if (!$('list-source').value) $('list-source').value = 'Board photo · reviewed draft';
    $('board-status').textContent = 'Draft transferred. Add a title, meanings and examples before saving.';
    $('word-list').focus();
  });
  function renderTraining() {
    const section = $('vocab-training'); section.hidden = role === 'teacher'; section.replaceChildren();
    if (role === 'teacher') return;
    const words = available(), now = Date.now();
    const learned = words.filter(word => (state.words[word.id]?.level || 0) >= 3).length;
    section.append(node('h2', 'Your progress'), node('p', `Mastered: ${learned} of ${words.length} · reviews: ${state.events.length} · streak: ${MoonLearning.streak(state.events.map(event => event.date))} days`, 'learning-progress'), node('p', 'Streaks use Moscow review dates. “Mastered” means three successful reviews at separate intervals. Activity XP is not a grade.', 'muted'));
    const due = words.filter(word => !state.words[word.id] || state.words[word.id].due <= now);
    const word = due.find(word => word.id === selectedWord) || due[0];
    if (!word) {section.append(node('p', 'No more cards due today. Come back for your next review.'), button('Check review queue', renderTraining)); return;}
    selectedWord = word.id;
    section.append(node('p', `📚 Remaining: ${due.length}`));
    const card = node('article', undefined, 'flashcard');
    card.append(node('blockquote', word.definition || 'Recall the meaning of this expression: ' + word.term, 'card-definition'));
    if (flipped) {
      card.append(node('h3', word.term), node('p', word.transcription || '', 'card-transcription'));
      for (const [field, label] of [['synonyms', 'Syn'], ['antonyms', 'Ant'], ['collocations', 'Coll']]) {
        if (word[field]?.length) {const line = node('p'); line.append(node('em', label + ': '), document.createTextNode(word[field].join(', '))); card.append(line);}
      }
      if (word.example) {
        const example = node('p', undefined, 'card-example'); example.append(node('em', 'Ex: '));
        const index = word.example.toLowerCase().indexOf(word.term.toLowerCase());
        if (index >= 0) example.append(document.createTextNode(word.example.slice(0, index)), node('strong', word.example.slice(index, index + word.term.length)), document.createTextNode(word.example.slice(index + word.term.length)));
        else example.append(document.createTextNode(word.example));
        card.append(example);
      }
      const translation = node('p', word.meaning || 'No meaning specified'); translation.hidden = true; translation.id = 'card-translation';
      const reveal = button('🇷🇺 Show meaning', () => {translation.hidden = !translation.hidden; reveal.setAttribute('aria-expanded', String(!translation.hidden)); reveal.textContent = translation.hidden ? '🇷🇺 Show meaning' : '🇷🇺 Hide meaning';});
      reveal.setAttribute('aria-expanded', 'false'); reveal.setAttribute('aria-controls', translation.id); card.append(reveal, translation);
    }
    section.append(card);
    const actions = node('div', undefined, 'training-actions');
    if (!flipped) actions.append(button('👀 Show', () => {flipped = true; renderTraining();}));
    else {
      const options = MoonLearning.reviewOptions(state, word.id);
      for (const [label, rating] of [['❌ Again', 'again'], ['🙁 Hard', 'hard'], ['🙂 Good', 'good'], ['😎 Easy', 'easy']]) {
        const delay = options[rating], interval = delay < 86400000 ? `${delay / 60000} min` : `${delay / 86400000} days`;
        actions.append(button(label + ' · ' + interval, () => {
          if (!MoonLearning.review(state, word.id, rating)) return;
          flipped = false; selectedWord = null; renderTraining(); renderRanking(); $('vocab-status').textContent = 'Review recorded in the demo.';
        }));
      }
    }
    section.append(actions);
  }
  function renderRanking() {
    const section = $('vocab-ranking'); section.replaceChildren(node('h2', 'Leaderboards · all-time demo'));
    section.append(node('p', 'Group rankings show aliases of participants who opt in. Rankings between groups show teams only, without other students or grades.', 'muted'));
    if (role === 'student') {
      const label = node('label'); const input = node('input'); input.type = 'checkbox'; input.checked = optedIn; input.id = 'rank-opt-in'; input.addEventListener('change', () => {optedIn = input.checked; renderRanking();}); label.append(input, document.createTextNode('Include me in the group leaderboard')); section.append(label);
      section.append(node('h3', 'Your group'));
      const rows = [{alias: 'Silver Willow', xp: 5}, {alias: 'Silver Clover', xp: 3}];
      if (optedIn) rows.push({alias: 'Silver Fern', xp: state.events.reduce((sum, event) => sum + event.xp, 0)});
      for (const row of rows.sort((a, b) => b.xp - a.xp || a.alias.localeCompare(b.alias))) {const line = node('div', undefined, 'rank-row own-group-rank'); line.append(node('span', row.alias), node('span', row.xp + ' XP')); section.append(line);}
      if (!optedIn) section.append(node('p', 'You are hidden from the leaderboard; your personal progress is shown above.'));
    }
    section.append(node('h3', 'Between groups · team rankings'));
    const teams = [{name: 'English · group 01', total: 8 + state.events.length, members: 15, participants: 2 + (state.events.length ? 1 : 0)}, {name: 'English · group 03', total: 9, members: 15, participants: 3}, {name: 'English · group 05', total: 2, members: 15, participants: 1}];
    const eligible = teams.filter(team => team.participants >= 3).sort((a, b) => b.total / b.members - a.total / a.members);
    for (const team of eligible) {const row = node('div', undefined, 'rank-row team-rank'); row.append(node('span', team.name), node('span', (team.total / team.members).toFixed(2) + ' XP / place')); section.append(row);}
    section.append(node('p', 'Demo rules: 1 XP for the first daily review of each word; at least 3 participants per team, normalized to 15 learning places. Repeated clicks do not add XP. Other participants’ histories are sample data.', 'muted'));
  }
  for (const course of courses) {const option = node('option', course.name); option.value = course.id; $('list-course').append(option);}
  function clearBoard() {boardVersion++; boardPhoto = null; $('board-photo').value = ''; $('board-text').value = ''; $('board-preview').replaceChildren(); $('board-status').textContent = '';}
  $('vocab-teacher').addEventListener('click', () => {if (role !== 'teacher') clearBoard(); role = 'teacher'; render();});
  $('vocab-student').addEventListener('click', () => {if (role !== 'student') clearBoard(); role = 'student'; render();});
  $('word-list-form').addEventListener('submit', event => {
    event.preventDefault(); $('word-error').textContent = '';
    try {
      const title = $('list-title').value.trim(), text = $('word-list').value;
      if (text.trim().startsWith('[') && !mayFormat()) throw new Error('Full cards are prepared by the teacher or assigned editor.');
      const words = MoonLearning.parseList(text);
      if (!title || !words.length || words.length > 100) throw new Error('Add a title and 1–100 words.');
      if (role === 'student' && words.some(word => !word.meaning)) throw new Error('Add a meaning for each suggested word.');
      lists.push({id: 'demo-list-' + crypto.randomUUID(), title, words, source: $('list-source').value.trim(), courseId: role === 'student' ? 'speech' : $('list-course').value, kind: role === 'teacher' ? 'target' : 'emergent', status: role === 'teacher' ? 'approved' : 'pending'});
      $('word-list-form').reset(); render(); $('vocab-status').textContent = role === 'teacher' ? 'Target list saved in the demo.' : 'Your words are awaiting your teacher’s review.';
    } catch (error) {$('word-error').textContent = error.message;}
  });
  $('word-file').addEventListener('change', async () => {
    const file = $('word-file').files[0]; if (!file) return;
    if (!/\.(txt|csv|json)$/i.test(file.name) || file.size > 100000) {$('word-error').textContent = 'Choose a TXT, CSV or JSON file up to 100 KB.'; return;}
    const text = await file.text();
    if (text.length > 15000) {$('word-error').textContent = 'The list must not exceed 15,000 characters.'; return;}
    $('word-list').value = text; $('word-error').textContent = '';
  });
  $('vocab-homework').addEventListener('click', () => {
    if (role !== 'teacher') return;
    try {sessionStorage.setItem('moon-demo-word-lists', JSON.stringify(lists.filter(list => list.kind === 'target' && list.status === 'approved')));} catch { /* Optional catalog handoff. */ }
  });
  $('card-template').addEventListener('click', () => {
    if (!mayFormat()) return;
    $('word-list').value = JSON.stringify(lists[0].words.filter(word => word.definition), null, 2);
    $('word-list').focus();
  });
  render();
})();
