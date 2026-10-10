(function(root) {
  'use strict';
  function weeklyDates(from, until, weekday, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Проверь даты и время расписания.');
    const start = new Date(from + 'T12:00:00Z'), end = new Date(until + 'T12:00:00Z');
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !Number.isFinite(+start) || !Number.isFinite(+end) || end < start || end-start > 366*86400000) throw new Error('Период расписания должен быть от одного дня до года.');
    const dates = [];
    for (let day = start; day <= end; day = new Date(+day+86400000)) if (day.getUTCDay() === weekday) dates.push(new Date(day.toISOString().slice(0,10)+'T'+time+':00+03:00').toISOString());
    if (!dates.length) throw new Error('В этом периоде нет выбранного дня недели.');
    return dates;
  }
  function localInput(value) {return value ? new Date(new Date(value).getTime()+3*3600000).toISOString().slice(0,16) : '';}
  const api = Object.freeze({weeklyDates, localInput});
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MoonPlanningModel = api;
})(typeof window === 'undefined' ? globalThis : window);
