const {test}=require('node:test');
const assert=require('node:assert/strict');
const {weeklyDates,localInput}=require('../../frontend/planning-model.js');
test('weekly schedule uses inclusive dates and fixed Moscow time',()=>{
  assert.deepEqual(weeklyDates('2026-10-12','2026-10-26',1,'10:00'),['2026-10-12T07:00:00.000Z','2026-10-19T07:00:00.000Z','2026-10-26T07:00:00.000Z']);
  assert.equal(localInput('2026-10-12T07:00:00Z'),'2026-10-12T10:00');
  assert.equal(localInput(null),'');
  assert.throws(()=>weeklyDates('2026-10-12','2026-10-11',1,'10:00'));
  assert.throws(()=>weeklyDates('2026-10-12','2028-10-12',1,'10:00'));
  assert.throws(()=>weeklyDates('2026-10-12','2026-10-12',2,'10:00'));
});
