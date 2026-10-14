(() => {
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
  function parseList(text) {
    const first = text.split(/\r?\n/).find(x => x.trim()) || '';
    const delimiter = first.trim().startsWith('"') || /^expression,/i.test(first) ? ',' : first.includes('\t') ? '\t' : ';';
    const rows = []; let row = [], value = '', quoted = false;
    for (let i = 0; i < text.length; i++) { const char = text[i];
      if (char === '"' && (quoted || !value.trim())) { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
      else if (!quoted && char === delimiter) { row.push(value.trim()); value = ''; }
      else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
      else value += char;
    }
    if (quoted) throw Error('A quoted CSV field is not closed. Check the quotation marks.');
    row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
    if (/^(expression|idiom)$/i.test(rows[0]?.[0] || '')) rows.shift();
    if (!rows.length || rows.length > 200) throw Error('Enter between 1 and 200 expressions.');
    return rows.map(values => ({expression: values[0].replace(/^\*+|\*+$/g, '').replace(/^\d+[.)]\s*/, '').replace(/\\$/, '').trim(), meaning: values[1] || '', example: values.slice(2).join(delimiter)}));
  }
  window.MoonMyImt = {parseList, renderTeacherReport(container,row) {
    const report=row.result?.practice_report;if(!report)return;
    container.append(node('h3','Practice results'),node('p',report.summary));
    for(const [title,values] of [['Strengths',report.strengths],['Revision recommendations',report.next_steps]]){container.append(node('h4',title));const list=node('ul');(values||[]).forEach(value=>list.append(node('li',value)));container.append(list)}
    for(const item of report.items||[]){container.append(node('h4',`${item.stage==='recall'?'Retrieval':'Contextual use'} · ${item.expression}`),node('p',row.attempt.responses[String(item.index)]?.response||''),node('p',item.feedback));if(item.correction)container.append(node('p',`${item.original} → ${item.correction}`))}
  }, async render({request, audioRequest}) {
    let area = document.getElementById('connected-my-imt');
    if (!area) { area = node('section', undefined, 'members-panel'); area.id = 'connected-my-imt'; document.getElementById('workspace').append(area); }
    let busy = false;
    async function action(task) {
      if (busy) return; busy = true;
      const status = area.querySelector('[role=status]'); if (status) status.textContent = 'Saving…';
      area.querySelectorAll('button').forEach(b => b.disabled = true);
      try { const state = await task(); if (state) show(state); }
      catch (error) { (area.querySelector('[role=status]') || status).textContent = error.message; }
      finally { busy = false; area.querySelectorAll('button').forEach(b => b.disabled = false); }
    }
    const button = (text, task, primary = false) => { const b = node('button', text, primary ? 'primary' : 'secondary'); b.type = 'button'; b.onclick = () => action(task); return b; };
    async function beginPractice(state) {
      if (!state.result?.ai_review) await request('/imt/my/check-ai', 'POST');
      return request('/imt/my/start', 'POST');
    }
    function show(state) {
      area.replaceChildren(node('h2', 'My IMT'));
      const status = node('p', '', 'imt-status'); status.setAttribute('role', 'status');
      const checked=state.attempt?.last_feedback;
      if(checked?.question_index!==undefined){
        const q=state.attempt.questions[checked.question_index],response=state.attempt.responses[String(checked.question_index)];
        area.append(node('p',`Answer checked · ${checked.question_index+1}`,'muted'),node('p',q.prompt));
        if(q.options){const options=node('div',undefined,'imt-choices');for(const option of q.options){const line=node('p',option,option===checked.answer?'imt-correct':option===response.response?'imt-incorrect':'muted');if(option===response.response)line.append(node('span',' · Your answer'));options.append(line)}area.append(options)}else area.append(node('p',response.response));
        area.append(node('p',checked.correct?'Correct!':checked.stage==='recall'?`Not quite. The correct expression is: ${checked.answer}`:'Almost — here is a small adjustment.',checked.correct?'imt-correct':'imt-incorrect'));
        if(checked.feedback)area.append(node('p',checked.feedback));if(checked.correction)area.append(node('p',checked.correction));
        area.append(button(state.status==='submitted'?'Get your results':state.attempt.index===state.attempt.recall_count?'Continue to sentence practice':'Next question',async()=>{const next=await request('/imt/my/continue','POST');if(next.status==='submitted')return request('/imt/my/results','POST');return next},true),status);
        return;
      }
      const editable = ['not_started', 'draft', 'changes_requested'].includes(state.status);
      if (editable) {
        if (!state.entries?.length) {
          area.append(node('p', 'Add your idioms. You can paste a list or choose a file.', 'muted'));
          const methods = node('div', undefined, 'imt-methods'); const tabs = node('div', undefined, 'imt-method-tabs'); tabs.setAttribute('role', 'tablist');
          const pastePanel = node('div'), filePanel = node('div'); filePanel.hidden = true;
          const pasteTab = node('button', 'Paste a list'), fileTab = node('button', 'Upload a file');
          for (const tab of [pasteTab, fileTab]) { tab.type = 'button'; tab.setAttribute('role', 'tab'); }
          const select = paste => { pastePanel.hidden = !paste; filePanel.hidden = paste; pasteTab.setAttribute('aria-selected', String(paste)); fileTab.setAttribute('aria-selected', String(!paste)); };
          pasteTab.onclick = () => select(true); fileTab.onclick = () => select(false); select(true); tabs.append(pasteTab, fileTab);
          const label = node('label', 'Your idioms', 'imt-paste-label'), input = node('textarea'); input.rows = 7;
          input.placeholder = 'One expression per line, or expression; meaning; example. CSV from a spreadsheet also works.'; label.append(input);
          pastePanel.append(label, node('p', 'Meanings and examples can be added on the next screen.', 'muted'), button('Continue', () => request('/imt/my/list', 'PUT', {entries: parseList(input.value)}), true));
          const fileLabel = node('label', 'Choose your IMT file', 'imt-paste-label'), file = node('input'); file.type = 'file'; file.accept = '.pdf,.csv,.xlsx,.xlsm,.png,.jpg,.jpeg,.webp'; fileLabel.append(file);
          filePanel.append(fileLabel, node('p', 'PDF, CSV, Excel or a clear photo. Maximum 10 MB.', 'muted'), button('Continue', async () => { if (!file.files[0]) throw Error('Choose a file first.'); const data = new FormData(); data.append('file', file.files[0]); return audioRequest('/learning/imt/my/upload', {method: 'POST', body: data}); }, true));
          methods.append(tabs, pastePanel, filePanel); area.append(methods);
        } else {
          area.append(node('p', 'Check your expressions, add meanings and examples, then submit.', 'muted'));
          const form = node('form', undefined, 'my-imt-preview'); const table = node('table'), head = node('tr'); ['Expression', 'Meaning', 'Example'].forEach(x => head.append(node('th', x))); table.append(head);
          const fields = state.entries.map(entry => { const tr = node('tr'); const row = {}; for (const key of ['expression', 'meaning', 'example']) { const cell = node('td'), input = node('textarea'); input.value = entry[key] || ''; input.rows = 3; input.required = key === 'expression'; input.setAttribute('aria-label', key); row[key] = input; cell.append(input); tr.append(cell); } table.append(tr); return row; });
          const scroll = node('div', undefined, 'imt-table-scroll'); scroll.append(table); form.append(scroll);
          const actions = node('div', undefined, 'imt-actions'), submit = node('button', 'Submit material', 'primary'); submit.type = 'submit';
          actions.append(submit, button('Replace list', async () => { if (!confirm('Replace this draft with a new file or list?')) return null; return request('/imt/my/reset', 'POST'); })); form.append(actions);
          form.onsubmit = event => { event.preventDefault(); action(async () => {
            const saved = await request('/imt/my/confirm', 'PUT', {entries: fields.map(row => Object.fromEntries(Object.entries(row).map(([key, input]) => [key, input.value])))});
            try { return await beginPractice(saved); } catch (error) { show(saved); throw error; }
          }); }; area.append(form);
        }
      } else if (state.status === 'assessment') {
        const {index, questions, recall_count} = state.attempt, question = questions[index];
        const reuse = question.stage === 'reuse', multiple = question.type === 'multiple_choice';
        if (index === 0) area.append(node('p', 'Your material is ready. Let’s practise!', 'imt-ready'));
        area.append(node('p', `${reuse ? 'Use in context' : multiple ? 'Choose the expression' : 'Retrieve from memory'} · ${reuse ? index - recall_count + 1 : index + 1} of ${reuse ? questions.length-recall_count : recall_count || questions.length}`, 'muted'));
        if (reuse) {area.append(node('h3',question.expression),node('p','Read the situation. Write a comment of 2–3 sentences using this expression.','muted'));}
        else area.append(node('p',multiple?'Read the situation and choose the expression that fits best.':'Read the situation and recall the expression from your list. Write it from memory.','muted'));
        area.append(node('p', question.prompt));
        const form = node('form'), label = node('label', 'Your answer'), answer = node('textarea'), key = `moon-imt:${state.id}:${index}`; answer.required = true; answer.rows = 6; answer.value = localStorage.getItem(key) ?? state.attempt.responses?.[String(index)]?.response ?? ''; answer.oninput = () => localStorage.setItem(key, answer.value);
        if(multiple){const choices=node('fieldset',undefined,'imt-choices');choices.append(node('legend','Choose one answer'));for(const option of question.options){const l=node('label'),radio=node('input');radio.type='radio';radio.name='choice';radio.value=option;radio.required=true;radio.onchange=()=>answer.value=option;l.append(radio,node('span',option));choices.append(l)}form.append(choices)}else label.append(answer);
        const save = node('button', index + 1 === questions.length ? 'Submit answers' : 'Next task', 'primary'); save.type = 'submit';
        const actions=node('div',undefined,'imt-actions');
        if(index>0&&state.attempt.version!=='adaptive_mcq_1')actions.append(button('Back',()=>{localStorage.setItem(key,answer.value);return request('/imt/my/back','POST')}));
        else if(!Object.keys(state.attempt.responses||{}).length)actions.append(button('Back to material',()=>request('/imt/my/revise','POST')));
        save.textContent=multiple?'Check answer':save.textContent;actions.append(save);if(!multiple)form.append(label);form.append(actions);
        form.onsubmit = e => { e.preventDefault(); action(async () => {
          const next = await request('/imt/my/answer', 'PUT', {response: answer.value}); localStorage.removeItem(key);
          if (next.status === 'submitted' && next.attempt.last_feedback?.question_index===undefined) { try { return await request('/imt/my/results', 'POST'); } catch (error) { show(next); throw error; } }
          return next;
        }); }; area.append(form);
      } else {
        if (['submitted','approved'].includes(state.status) && !Object.keys(state.attempt || {}).length) area.append(node('p', 'Your material is saved. Continue to practice.'), button('Continue to Recall', () => beginPractice(state), true));
        else {
          area.append(node('h3', 'Your results'));
          const report=state.result?.practice_report;
          if (report) {
            area.append(node('p',report.summary));
            for (const [title,values] of [['What went well',report.strengths],['What to practise next',report.next_steps]]) { area.append(node('h4',title)); const list=node('ul'); (values||[]).forEach(value=>list.append(node('li',value))); area.append(list); }
            const details=node('details');details.append(node('summary','See your answers and tips'));
            for (const item of report.items||[]) { details.append(node('h4',`${item.stage==='recall'?'Retrieve from memory':'Use in context'} · ${item.expression}`),node('p',state.attempt.responses[String(item.index)]?.response||''),node('p',item.feedback)); if(item.correction)details.append(node('p',`${item.original} → ${item.correction}`)); }
            area.append(details);
          } else area.append(node('p','Your answers are saved.'),button('Get your results',()=>request('/imt/my/results','POST'),true));
        }
        if (['submitted', 'approved'].includes(state.status) && !Object.keys(state.attempt || {}).length) area.append(button('Edit material', () => request('/imt/my/revise', 'POST')));
        if (state.result?.approved_grade !== undefined) area.append(node('h3', `Result: ${state.result.approved_grade} / 3`));
        if (state.result?.teacher_feedback) area.append(node('p', state.result.teacher_feedback));
      }
      area.append(status);
    }
    area.replaceChildren(node('h2', 'My IMT'), node('p', 'Loading your material…'));
    try {
      let state = await request('/imt/my');
      if(state.status==='assessment'&&state.attempt.questions?.some((q,i)=>i>=state.attempt.index&&q.stage==='reuse'&&q.prompt==='Write an original sentence using this expression. Make its meaning clear through the context.')){
        try{state=await request('/imt/my/context-tasks','POST')}catch(error){show(state);area.querySelector('[role=status]').textContent=error.message;return}
      }
      const oldPrompts=['What does this expression mean? Explain it in your own words.','Explain this expression in your own words and give a new example.'];
      if(state.status==='assessment'&&state.attempt.version!=='adaptive_mcq_1') {
        try {state=await request('/imt/my/refresh-tasks','POST');}catch(error){show(state);area.querySelector('[role=status]').textContent=error.message;return;}
      }
      if (['submitted','approved'].includes(state.status) && !Object.keys(state.attempt || {}).length) {
        try { show(await beginPractice(state)); } catch (error) { show(state); area.querySelector('[role=status]').textContent = error.message; }
      } else show(state);
    } catch (error) { area.replaceChildren(node('h2', 'My IMT'), node('p', error.message)); }
  }};
})();
