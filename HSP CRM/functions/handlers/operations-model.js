const { fail, text, date } = require('./finance-model');
function todayChicago(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
function anniversary(year, month, day) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
function servicePeriod(startDate, onDate) {
  date(startDate); date(onDate);
  if (onDate < startDate) fail('Time cannot be logged before the plan starts.');
  const anchor = Number(startDate.slice(8)), [year, month] = onDate.split('-').map(Number);
  let y = year, m = month;
  if (onDate < anniversary(y, m, anchor)) { m--; if (!m) { m = 12; y--; } }
  const start = anniversary(y, m, anchor);
  const end = anniversary(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, anchor);
  return { start, end };
}
function timeFields(data, plan) {
  const workDate = date(data.workDate), minutes = Number(data.minutes);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440) fail('Enter 1–1440 whole minutes.');
  const period = servicePeriod(plan.startDate, workDate);
  const billing = data.billing === 'additional' ? 'additional' : 'included';
  const approval = text(data.approval, 1000), scope = text(data.scope, 1000), rate = Number(data.rate || 0);
  if (!scope) fail('Describe the work.');
  if (billing === 'additional' && (!approval || !Number.isFinite(rate) || rate < 30 || rate > 65)) fail('Additional work requires documented advance approval and a $30–$65 hourly rate.');
  const approvedOn = billing === 'additional' ? date(data.approvedOn) : null;
  if (approvedOn && approvedOn > workDate) fail('Approval must precede or match the work date.');
  return { workDate, minutes, billing, scope, rate: billing === 'additional' ? rate : 0, approval: billing === 'additional' ? approval : '', approvedOn, periodStart: period.start, periodEnd: period.end };
}
module.exports = { todayChicago, anniversary, servicePeriod, timeFields };
