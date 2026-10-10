(() => {
  'use strict';
  const types = {regular: 'Regular assignment', imt: 'IMT', checkpoint: 'Checkpoint', extra: 'Extra task', compensation: 'Make-up assignment'};
  const statuses = {unmarked: 'Unmarked', present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused'};
  const format = value => new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Moscow', dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value));
  function node(tag, text, className) {const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element;}
  function field(form, title, id, type = 'text', max = 200) {
    const label = node('label', title, 'input-label'); label.htmlFor = id;
    const input = node(type === 'textarea' ? 'textarea' : 'input'); input.id = id; input.required = true;
    if (type !== 'textarea') input.type = type; else input.rows = 4;
    input.maxLength = max; const wrapper = node('div', undefined, 'form-field'); wrapper.append(label, input); form.append(wrapper); return input;
  }
  function select(form, title, id, options) {
    const label = node('label', title, 'input-label'); label.htmlFor = id;
    const input = node('select'); input.id = id;
    for (const [value, text] of options) {const option = node('option', text); option.value = value; input.append(option);}
    const wrapper = node('div', undefined, 'form-field'); wrapper.append(label, input); form.append(wrapper); return input;
  }
  function submit(form, title) {const button = node('button', title, 'primary'); button.type = 'submit'; form.append(button); return button;}
  function button(title, action, run) {const element = node('button', title, 'secondary'); element.type = 'button'; element.addEventListener('click', () => run(action)); return element;}
  function moscowInput(offset = 0) {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(Date.now() + offset);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  }
  function dateValue(value) {return new Date(value + ':00+03:00').toISOString();}
  const lines = value => value.split(/\n/).map(item => item.trim()).filter(Boolean);
  async function load(request, profile) {
    const [tasks, attendance] = await Promise.all([request('/tasks'), request('/attendance')]);
    const details = await Promise.all(tasks.map(async task => ({task,
      submissions: await request('/tasks/' + task.id + '/submissions'),
      access: profile.role === 'admin' && task.kind === 'checkpoint' ? await request('/tasks/' + task.id + '/access') : []})));
    return {tasks, details, attendance};
  }
  function render(data, {profile, groups, request, run, refresh}) {
    const area = document.getElementById('connected-coursework');
    area.replaceChildren(node('h2', 'Assignments and submissions'));
    const done = async message => {await refresh(); document.getElementById('account-status').textContent = message;};
    if (profile.role === 'admin') renderTaskForm(area, data, groups, request, run, done);
    if (!data.tasks.length) area.append(node('p', 'No assignments yet.'));
    for (const detail of data.details) {
      const task = detail.task, article = node('article', undefined, 'word-list-card');
      article.dataset.taskId = task.id;
      article.append(node('h3', task.title), node('p', types[task.kind] + ' · ' + (window.MoonCourses.find(course => course.id === task.course_id)?.name || task.course_id)),
        node('p', 'Period: ' + format(task.starts_at) + ' — ' + format(task.ends_at) + ' · Moscow'));
      if (profile.role === 'admin') article.append(node('p', 'Groups: ' + groups.filter(group => task.group_ids.includes(group.id)).map(group => group.name).join(', ')));
      if (task.test_at) article.append(node('p', 'Test: ' + format(task.test_at)));
      if (!task.allowed) article.append(node('p', 'Access will open after your teacher checks your certificate.', 'muted'));
      else {
        article.append(node('p', task.description, 'coursework-text'));
        if (task.vocabulary.length) article.append(node('p', 'Target vocabulary: ' + task.vocabulary.join('; ')));
        if (task.constructions.length) article.append(node('p', 'Target structures: ' + task.constructions.join('; ')));
        if (task.criteria) article.append(node('p', 'Criteria: ' + task.criteria));
      }
      if (detail.access.length) {
        const form = node('form'), title = node('h4', 'Make-up approval · this checkpoint'); form.append(title, node('p', 'Tick only after checking the certificate. The certificate file and diagnosis are not stored here.', 'muted'));
        for (const learner of detail.access) {
          const label = node('label', undefined, 'attendance-choice'), checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = learner.certificate_checked;
          checkbox.setAttribute('aria-label', 'Certificate checked · ' + learner.pseudonym);
          // Save each explicit toggle; do not implicitly grant access to the whole roster.
          checkbox.addEventListener('change', () => {const checked = checkbox.checked; run(async () => {
            try {await request('/tasks/' + task.id + '/access', 'PUT', {student_id: learner.student_id, certificate_checked: checked});}
            catch (error) {checkbox.checked = !checked; throw error;}
            await done('Approval saved.');
          });});
          label.append(checkbox, document.createTextNode(' ' + learner.pseudonym + ' · certificate checked')); form.append(label);
        }
        article.append(form);
      }
      for (const work of detail.submissions) {
        const item = node('section', undefined, 'submission-card'); item.append(node('h4', work.pseudonym + ' · attempt ' + work.attempt), node('p', format(work.created_at) + (work.late ? ' · late submission' : '')));
        if (work.kind === 'link') {const link = node('a', work.content); link.href = work.content; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link);}
        else item.append(node('p', work.content, 'coursework-text'));
        item.append(MoonPhotos.gallery(work.photos));
        if (work.feedback) item.append(node('p', 'Teacher feedback: ' + work.feedback, 'coursework-text'));
        if (profile.role === 'admin') {
          if (work.kind === 'text') {
            const analysis = MoonTextReview.analyse(work.content, task.vocabulary);
            const constructions = MoonTextReview.analyseConstructions(work.content, task.constructions);
            item.append(node('p', 'Vocabulary found: ' + (analysis.found.join(', ') || '—')), node('p', 'Vocabulary not found: ' + (analysis.missing.join(', ') || '—')),
              node('p', 'Structures found: ' + (constructions.found.join(', ') || '—')), node('p', 'Structures not found: ' + (constructions.missing.join(', ') || '—')),
              node('p', 'This check finds forms and patterns; your teacher assesses accuracy and context.', 'muted'));
            for (const suggestion of analysis.suggestions) item.append(node('p', suggestion, 'muted'));
          }
          const form = node('form'), comment = field(form, 'Feedback on this attempt', 'feedback-' + work.id, 'textarea', 10000); comment.value = work.feedback;
          submit(form, 'Save feedback'); form.addEventListener('submit', event => {event.preventDefault(); run(async () => {
            await request('/submissions/' + work.id + '/feedback', 'PUT', {comment: comment.value.trim()}); await done('Feedback saved.');
          });}); item.append(form);
        }
        article.append(item);
      }
      if (profile.role === 'student') {
        const count = detail.submissions.length; article.append(node('p', `Attempts used: ${count} of 3. Previous versions are kept.`));
        if (task.allowed && count < 3) {
          if (Date.now() < new Date(task.starts_at).getTime()) article.append(node('p', 'Submissions open at the start of the period.'));
          else renderSubmission(article, task, request, run, done);
        }
      }
      area.append(article);
    }
    renderAttendance(data.attendance, {profile, groups, request, run, done});
  }
  function renderTaskForm(area, data, groups, request, run, done) {
    const details = node('details'); details.append(node('summary', 'Create assignment')); const form = node('form'); form.id = 'server-task-form';
    const title = field(form, 'Assignment title', 'server-task-title');
    const description = field(form, 'Description', 'server-task-description', 'textarea', 20000);
    const course = select(form, 'Course', 'server-task-course', window.MoonCourses.map(item => [item.id, item.name]));
    const roster = node('fieldset'); roster.append(node('legend', 'Groups · select one or more')); form.append(roster);
    function groupChoices() {roster.querySelectorAll('label, p').forEach(item => item.remove());
      const available = groups.filter(item => item.course_id === course.value);
      if (!available.length) roster.append(node('p', 'No groups for this course yet. Create one in Groups.', 'muted'));
      const save = form.querySelector('#server-task-save'); if (save) {save.disabled = !available.length; save.dataset.unavailable = String(!available.length);}
      for (const group of groups.filter(item => item.course_id === course.value)) {const label = node('label', undefined, 'attendance-choice'), input = node('input'); input.type = 'checkbox'; input.value = group.id; input.setAttribute('aria-label', 'Assignment for ' + group.name); label.append(input, document.createTextNode(' ' + group.name)); roster.append(label);}
    }
    const kind = select(form, 'Assignment type', 'server-task-kind', Object.entries(types));
    const start = field(form, 'Start date · Moscow', 'server-task-start', 'datetime-local'); start.value = moscowInput(-60000);
    const end = field(form, 'End date / deadline · Moscow', 'server-task-end', 'datetime-local'); end.value = moscowInput(7 * 86400000);
    const test = field(form, 'Test date · Moscow (optional)', 'server-task-test', 'datetime-local'); test.required = false;
    const checkpoint = select(form, 'Checkpoint for make-up work', 'server-task-checkpoint', [['', 'Choose a checkpoint'], ...data.tasks.filter(task => task.kind === 'checkpoint').map(task => [task.id, task.title])]);
    const vocabulary = field(form, 'Target vocabulary · one expression per line', 'server-task-vocabulary', 'textarea', 20000); vocabulary.required = false;
    const constructions = field(form, 'Target structures · one per line', 'server-task-constructions', 'textarea', 20000); constructions.required = false;
    const criteria = field(form, 'Criteria (optional)', 'server-task-criteria', 'textarea', 10000); criteria.required = false;
    function mode() {test.hidden = kind.value !== 'checkpoint'; test.parentElement.hidden = test.hidden; checkpoint.hidden = kind.value !== 'compensation'; checkpoint.parentElement.hidden = checkpoint.hidden; checkpoint.required = !checkpoint.hidden;}
    course.addEventListener('change', groupChoices); kind.addEventListener('change', mode); groupChoices(); mode();
    const save = submit(form, 'Save assignment'); save.id = 'server-task-save'; groupChoices();
    form.addEventListener('submit', event => {event.preventDefault(); run(async () => {
      const ids = [...roster.querySelectorAll('input:checked')].map(input => Number(input.value));
      if (!ids.length) throw new Error('Choose at least one group.');
      await request('/tasks', 'POST', {title: title.value.trim(), description: description.value.trim(), group_ids: ids, kind: kind.value,
        starts_at: dateValue(start.value), ends_at: dateValue(end.value), test_at: kind.value === 'checkpoint' && test.value ? dateValue(test.value) : null,
        checkpoint_id: kind.value === 'compensation' ? checkpoint.value : null, vocabulary: lines(vocabulary.value), constructions: lines(constructions.value), criteria: criteria.value.trim()});
      await done('Assignment saved for the selected groups.');
    });}); details.append(form); area.append(details);
  }
  function renderSubmission(article, task, request, run, done) {
    const form = node('form'); form.dataset.submissionFor = task.id;
    const kind = select(form, 'Response format', 'answer-kind-' + task.id, [['text', 'Text / photos'], ['link', 'Link']]);
    const content = field(form, 'Response or link', 'answer-' + task.id, 'textarea', 20000); content.required = false;
    const photos = MoonPhotos.picker('answer-photos-' + task.id); form.append(photos.element);
    const save = submit(form, 'Submit work');
    let pending = null;
    form.addEventListener('submit', event => {event.preventDefault(); run(async () => {
      if (photos.busy || photos.invalid) throw new Error('Wait for photo processing or fix the selected files.');
      const body = {kind: kind.value, content: content.value.trim(), photos: photos.photos};
      if (!body.content && !body.photos.length) throw new Error('Add text, a link or a photo.');
      const fingerprint = JSON.stringify(body);
      if (!pending || pending.fingerprint !== fingerprint) pending = {fingerprint, id: crypto.randomUUID()};
      await request('/tasks/' + task.id + '/submissions', 'POST', {...body, request_id: pending.id});
      // Keep the same request ID after a transport failure; do not spend another attempt.
      save.disabled = true; await done('Work saved.');
    });}); article.append(form);
  }
  function renderAttendance(lessons, {profile, groups, request, run, done}) {
    const area = document.getElementById('connected-attendance'); area.replaceChildren(node('h2', 'Attendance'));
    area.append(node('p', 'This register uses learning aliases only. Real names are not required. Dates and times use Moscow time.', 'muted'));
    if (profile.role === 'admin') {
      const form = node('form'); form.id = 'server-lesson-form';
      const group = select(form, 'Lesson group', 'server-lesson-group', groups.length ? groups.map(item => [item.id, item.name]) : [['', 'Create a group first']]);
      group.required = true; group.disabled = !groups.length; group.dataset.unavailable = String(!groups.length);
      if (!groups.length) form.append(node('p', 'Create a group in Groups before adding lessons.', 'muted'));
      const title = field(form, 'Lesson topic', 'server-lesson-title');
      const date = field(form, 'Date and time · Moscow', 'server-lesson-date', 'datetime-local'); date.value = moscowInput();
      const addLesson = submit(form, 'Add lesson'); addLesson.disabled = !groups.length; addLesson.dataset.unavailable = String(!groups.length); form.addEventListener('submit', event => {event.preventDefault(); run(async () => {
        await request('/attendance', 'POST', {group_id: Number(group.value), title: title.value.trim(), starts_at: dateValue(date.value)}); await done('Lesson saved.');
      });}); const details = node('details'); details.append(node('summary', 'Add lesson manually'), form); area.append(details);
    }
    if (!lessons.length) area.append(node('p', 'No lessons yet.'));
    if (profile.role === 'student' && lessons.length) {
      const marked = lessons.map(lesson => lesson.marks[0]?.status || 'unmarked');
      area.append(node('p', `Present: ${marked.filter(status => status === 'present').length} · Late: ${marked.filter(status => status === 'late').length} · Absent: ${marked.filter(status => status === 'absent').length} · Excused: ${marked.filter(status => status === 'excused').length}`));
    }
    for (const lesson of lessons) {
      const article = node('article', undefined, 'word-list-card'); article.dataset.lessonId = lesson.id;
      article.append(node('h3', lesson.title), node('p', format(lesson.starts_at) + (profile.role === 'admin' ? ' · ' + (groups.find(group => group.id === lesson.group_id)?.name || '') : '')));
      if (profile.role === 'admin') {
        const form = node('form'), inputs = [];
        for (const mark of lesson.marks) {const input = select(form, mark.pseudonym, 'attendance-' + lesson.id + '-' + mark.student_id, Object.entries(statuses)); input.value = mark.status; inputs.push({input, student_id: mark.student_id});}
        const all = node('button', 'Mark everyone present', 'secondary'); all.type = 'button'; all.addEventListener('click', () => inputs.forEach(({input}) => {input.value = 'present';})); form.append(all);
        if (inputs.length) submit(form, 'Save attendance'); else form.append(node('p', 'No active students in this group yet.'));
        form.addEventListener('submit', event => {event.preventDefault(); run(async () => {
          await request('/attendance/' + lesson.id, 'PUT', {marks: inputs.map(({input, student_id}) => ({student_id, status: input.value}))}); await done('Attendance saved.');
        });}); article.append(form);
      } else article.append(node('p', statuses[lesson.marks[0]?.status || 'unmarked']));
      area.append(article);
    }
  }
  window.MoonCoursework = Object.freeze({load, render, clear() {for (const id of ['connected-coursework', 'connected-attendance']) document.getElementById(id)?.replaceChildren();}});
})();
