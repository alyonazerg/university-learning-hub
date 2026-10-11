const test=require('node:test');const assert=require('node:assert/strict');
global.window={};require('../../frontend/semester-schedule.js');const model=window.MoonSemesterSchedule;
test('semester contains eighteen grammar classes, checkpoints replace teaching, and shared introduction is one calendar event',()=>{
  const from='2026-09-12',until='2026-12-29',weeks=model.weeks(from,until),body=model.build(from,until,weeks);
  assert.equal(body.groups.length,8);
  for(const group of body.groups.filter(g=>g.course_id==='grammar')){
    assert.equal(group.lessons.length,18);assert.deepEqual(group.lessons.map(l=>l.position).sort((a,b)=>a-b),Array.from({length:18},(_,i)=>i+1));
    assert.deepEqual(group.lessons.filter(l=>l.kind==='test').map(l=>l.position),[8,13,17,18]);
    assert.equal(group.lessons.filter(l=>l.starts_at.startsWith('2026-09-12')).length,2);
  }
  const ics=model.ical(from,until,weeks).replace(/\r\n /g,'');
  assert.equal((ics.match(/RRULE:FREQ=WEEKLY;INTERVAL=2/g)||[]).length,26);
  assert.equal((ics.match(/RECURRENCE-ID:/g)||[]).length,12);
  assert.equal((ics.match(/UID:autumn-2026-shared-introduction/g)||[]).length,1);
  assert.match(ics,/DTSTART:20260912T090000Z\r\nDTEND:20260912T120000Z/);
  weeks.find(w=>w.date==='2026-10-12').type='break';
  assert.match(model.ical(from,until,weeks),/EXDATE:/);
  for(const line of model.ical(from,until,weeks).split('\r\n'))assert(Buffer.byteLength(line)<=75);
});
