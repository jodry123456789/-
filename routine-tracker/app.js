'use strict';

// ===== 설정 =====
const STORAGE_KEY = 'routine-tracker-v1';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_ROUTINES = 20;
const CONDITION_MAX = 5;
const CONDITIONS = [
  { key: 'mood', label: '기분 😊' },
  { key: 'energy', label: '에너지 ⚡' },
];
const DEFAULT_ROUTINES = [
  '업무 🎯', '5시 기상 ⏰', '헬스장 💪', '독서 📖', '공부 ✏️', '찬물 샤워 🚿',
  '3km 러닝 🏃', '식단 🥗', '금주 🍺', '도파민 디톡스 🌿', '명상 🧘',
];

const today = new Date();
const state = { year: today.getFullYear(), month: today.getMonth() }; // month: 0 = 1월
let db = loadDb();

const $ = (sel) => document.querySelector(sel);
const table = $('#tracker');

// ===== 저장 (브라우저 localStorage) =====
// db 구조: { "2026-10": { routines: [{id, name}], checks: {루틴id: {날짜: 1}}, mood: {날짜: 1~5}, energy: {...} } }
function loadDb() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // 시크릿 모드 등 저장이 막힌 환경에서는 화면에서만 유지됩니다.
  }
}

// ===== 날짜/계산 도우미 =====
const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const weekIndex = (d) => Math.floor((d - 1) / 7);
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const level = (p) => (p >= 80 ? 'high' : p >= 50 ? 'mid' : 'low');
const newId = () => Math.random().toString(36).slice(2, 10);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 1일부터 7일씩 끊어서 주차를 나눕니다 (영상의 시트와 같은 방식).
function getWeeks(days) {
  const weeks = [];
  for (let start = 1; start <= days; start += 7) weeks.push({ start, end: Math.min(start + 6, days) });
  return weeks;
}

function isToday(d) {
  return state.year === today.getFullYear() && state.month === today.getMonth() && d === today.getDate();
}

function dayClasses(d) {
  const cls = ['day'];
  if (d > 1 && (d - 1) % 7 === 0) cls.push('week-start');
  if (weekIndex(d) % 2) cls.push('week-alt');
  const wd = new Date(state.year, state.month, d).getDay();
  if (wd === 0) cls.push('sun');
  if (wd === 6) cls.push('sat');
  if (isToday(d)) cls.push('today');
  return cls.join(' ');
}

// 처음 여는 달은 가장 최근 달의 루틴 목록을 그대로 가져옵니다.
function getMonthData() {
  const key = monthKey(state.year, state.month);
  if (!db[key]) {
    const prev = Object.keys(db).filter((k) => k < key && db[k].routines.length).sort().pop();
    const names = prev ? db[prev].routines.map((r) => r.name) : DEFAULT_ROUTINES;
    db[key] = { routines: names.map((name) => ({ id: newId(), name })) };
  }
  const data = db[key];
  data.checks ||= {};
  for (const c of CONDITIONS) data[c.key] ||= {};
  return data;
}

function computeStats(data, year, month) {
  const days = daysInMonth(year, month);
  const routines = data.routines;
  const dailyCounts = Array.from({ length: days }, (_, i) => routines.filter((r) => data.checks[r.id]?.[i + 1]).length);

  const perRoutine = routines.map((r) => {
    const done = Object.keys(data.checks[r.id] || {}).length;
    return { id: r.id, name: r.name, goal: days, done, left: days - done, pct: percent(done, days) };
  });
  const weekly = getWeeks(days).map((w) => {
    let sum = 0;
    for (let d = w.start; d <= w.end; d++) sum += dailyCounts[d - 1];
    return percent(sum, routines.length * (w.end - w.start + 1));
  });
  const goal = routines.length * days;
  const done = perRoutine.reduce((sum, r) => sum + r.done, 0);

  return {
    days,
    perRoutine,
    daily: dailyCounts.map((c) => percent(c, routines.length)),
    weekly,
    goal,
    done,
    left: goal - done,
    pct: percent(done, goal),
  };
}

// ===== 화면 그리기 =====
function render() {
  $('#yearLabel').textContent = `${state.year}년`;
  $('#monthTitle').textContent = `${state.year}년 ${state.month + 1}월 루틴`;
  renderTable();
  updateStats();
}

function renderMonthTabs() {
  $('#monthTabs').innerHTML = Array.from({ length: 12 }, (_, m) => {
    const data = db[monthKey(state.year, m)];
    const stats = data?.checks ? computeStats(data, state.year, m) : null;
    const active = m === state.month;
    return `<button class="month-tab${active ? ' active' : ''}" data-month="${m}" aria-pressed="${active}">
      <span>${m + 1}월</span><small>${stats?.done ? `${stats.pct}%` : ''}</small></button>`;
  }).join('');
}

function renderTable() {
  const data = getMonthData();
  const days = daysInMonth(state.year, state.month);
  const dayList = Array.from({ length: days }, (_, i) => i + 1);

  const weekHead = getWeeks(days).map((w, i) =>
    `<th class="week-head${i % 2 ? ' week-alt' : ''}${i ? ' week-start' : ''}" colspan="${w.end - w.start + 1}">Week ${i + 1}</th>`).join('');
  const weekdayHead = dayList.map((d) =>
    `<th class="${dayClasses(d)}">${WEEKDAYS[new Date(state.year, state.month, d).getDay()]}</th>`).join('');
  const dateHead = dayList.map((d) => `<th class="${dayClasses(d)}">${d}</th>`).join('');

  const rows = data.routines.map((r) => `
    <tr data-rid="${r.id}">
      <th class="name-col"><div class="name-cell">
        <input class="routine-name" value="${escapeHtml(r.name)}" maxlength="30" placeholder="루틴 이름" aria-label="루틴 이름">
        <button class="del" title="루틴 삭제" aria-label="루틴 삭제">×</button>
      </div></th>
      ${dayList.map((d) => `<td class="${dayClasses(d)}"><input type="checkbox" class="check" data-day="${d}"${data.checks[r.id]?.[d] ? ' checked' : ''} aria-label="${d}일"></td>`).join('')}
      <td class="an analysis-start">${days}</td>
      <td class="an done"></td>
      <td class="an left"></td>
      <td class="an-progress"><div class="progress"><div class="meter"><span></span></div><span class="pct"></span></div></td>
    </tr>`).join('');

  const full = data.routines.length >= MAX_ROUTINES;
  const addRow = `<tr><th class="name-col"><button class="add-btn"${full ? ' disabled' : ''}>${full ? `최대 ${MAX_ROUTINES}개` : '+ 루틴 추가'}</button></th><td colspan="${days + 4}"></td></tr>`;

  const condRows = CONDITIONS.map((c) => `
    <tr data-cond="${c.key}">
      <th class="name-col">${c.label}<small>칸을 누르면 1→5</small></th>
      ${dayList.map((d) => {
        const v = data[c.key][d];
        return `<td class="${dayClasses(d)}"><button class="cond" data-day="${d}"${v ? ` data-v="${v}"` : ''} aria-label="${d}일 ${c.label}">${v || ''}</button></td>`;
      }).join('')}
      <td class="cond-avg analysis-start" colspan="4"></td>
    </tr>`).join('');

  table.innerHTML = `
    <thead>
      <tr><th class="name-col" rowspan="3">루틴</th>${weekHead}<th class="analysis-start" colspan="4">분석</th></tr>
      <tr>${weekdayHead}<th class="an analysis-start" rowspan="2">목표</th><th class="an" rowspan="2">실제</th><th class="an" rowspan="2">남음</th><th class="an-progress" rowspan="2">진행률</th></tr>
      <tr>${dateHead}</tr>
    </thead>
    <tbody>${rows}${addRow}</tbody>
    <tfoot>
      <tr class="daily-row"><th class="name-col">일일 진행률</th>${dayList.map((d) => `<td class="${dayClasses(d)}" data-day="${d}"></td>`).join('')}<td class="analysis-start" colspan="4"></td></tr>
      ${condRows}
    </tfoot>`;
}

// 체크할 때마다 숫자·그래프만 다시 계산합니다 (표 전체를 다시 그리지 않음).
function updateStats() {
  const data = getMonthData();
  const s = computeStats(data, state.year, state.month);

  for (const r of s.perRoutine) {
    const row = table.querySelector(`tr[data-rid="${r.id}"]`);
    if (!row) continue;
    row.querySelector('.done').textContent = r.done;
    row.querySelector('.left').textContent = r.left;
    row.querySelector('.meter span').style.width = `${r.pct}%`;
    const pctEl = row.querySelector('.pct');
    pctEl.textContent = `${r.pct}%`;
    pctEl.dataset.level = level(r.pct);
  }

  table.querySelectorAll('.daily-row td[data-day]').forEach((td) => {
    const p = s.daily[td.dataset.day - 1];
    td.textContent = data.routines.length ? `${p}%` : '';
    td.dataset.level = level(p);
  });

  for (const c of CONDITIONS) {
    const values = Object.values(data[c.key]);
    const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '-';
    table.querySelector(`tr[data-cond="${c.key}"] .cond-avg`).textContent = `평균 ${avg}`;
  }

  $('#statGoal').textContent = s.goal;
  $('#statDone').textContent = s.done;
  $('#statLeft').textContent = s.left;
  $('#donutPct').textContent = `${s.pct}%`;
  const donut = $('#donutValue');
  const circumference = 2 * Math.PI * 52;
  donut.style.strokeDasharray = circumference;
  donut.style.strokeDashoffset = circumference * (1 - s.pct / 100);
  donut.style.strokeOpacity = s.pct ? 1 : 0;

  renderBars($('#dailyChart'), s.daily.map((v, i) => ({
    value: v,
    label: i === 0 || (i + 1) % 5 === 0 || isToday(i + 1) ? i + 1 : '',
    title: `${state.month + 1}월 ${i + 1}일 · ${v}%`,
    today: isToday(i + 1),
  })));
  renderBars($('#weeklyChart'), s.weekly.map((v, i) => ({ value: v, label: `Week ${i + 1}`, title: `Week ${i + 1} · ${v}%` })));
  renderTop(s.perRoutine);
  renderCondition(data, s.days);
  renderMonthTabs();
}

function renderBars(el, items) {
  el.innerHTML = items.map((it) => `
    <div class="bar-col${it.today ? ' today' : ''}" title="${it.title}">
      <span class="bar-val">${it.value}%</span>
      <div class="bar-track"><div class="bar-fill" style="height:${it.value}%"></div></div>
      <span class="bar-label">${it.label}</span>
    </div>`).join('');
}

function renderTop(perRoutine) {
  // sort는 순서가 안정적이라 완료 수가 같으면 표에 있는 순서를 유지합니다.
  const top = perRoutine.filter((r) => r.name.trim()).sort((a, b) => b.done - a.done).slice(0, 10);
  $('#topList').innerHTML = top.length
    ? top.map((r, i) => `
      <li>
        <span class="rank">${i + 1}</span>
        <span class="top-name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</span>
        <span class="meter"><span style="width:${r.pct}%"></span></span>
        <span class="pct" data-level="${level(r.pct)}">${r.pct}%</span>
      </li>`).join('')
    : '<li class="empty">루틴을 추가해 보세요</li>';
}

function renderCondition(data, days) {
  const W = 640, H = 190, padL = 26, padR = 12, padT = 12, padB = 26;
  const x = (d) => padL + ((d - 1) * (W - padL - padR)) / Math.max(days - 1, 1);
  const y = (v) => padT + ((CONDITION_MAX - v) * (H - padT - padB)) / (CONDITION_MAX - 1);

  let svg = '';
  for (let v = 1; v <= CONDITION_MAX; v++) {
    svg += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text x="${padL - 8}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  }
  for (let d = 1; d <= days; d++) {
    if (d === 1 || d % 5 === 0) svg += `<text x="${x(d)}" y="${H - 8}" text-anchor="middle">${d}일</text>`;
  }

  let hasData = false;
  for (const c of CONDITIONS) {
    const points = Object.entries(data[c.key])
      .map(([d, v]) => [Number(d), v])
      .filter(([d]) => d <= days)
      .sort((a, b) => a[0] - b[0]);
    if (!points.length) continue;
    hasData = true;
    const path = points.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<path class="line-${c.key}" d="${path}"/>`;
    svg += points.map(([d, v]) => `<circle class="line-${c.key}" cx="${x(d)}" cy="${y(v)}" r="3.5"><title>${d}일 · ${v}</title></circle>`).join('');
  }

  $('#conditionChart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="일별 기분과 에너지 그래프">${svg}</svg>`
    + (hasData ? '' : '<div class="empty-msg">표 아래 기분·에너지 칸을 눌러 기록해 보세요</div>');
}

function scrollToToday() {
  const cell = table.querySelector('thead th.today');
  const wrap = $('.table-scroll');
  if (!cell) {
    wrap.scrollLeft = 0;
    return;
  }
  const nameWidth = table.querySelector('.name-col').offsetWidth;
  wrap.scrollLeft = Math.max(0, cell.offsetLeft - nameWidth - wrap.clientWidth / 3);
}

// ===== 이벤트 =====
table.addEventListener('change', (e) => {
  const box = e.target.closest('.check');
  if (!box) return;
  const data = getMonthData();
  const rid = box.closest('tr').dataset.rid;
  const checks = (data.checks[rid] ||= {});
  if (box.checked) checks[box.dataset.day] = 1;
  else delete checks[box.dataset.day];
  saveDb();
  updateStats();
});

table.addEventListener('input', (e) => {
  if (!e.target.matches('.routine-name')) return;
  const rid = e.target.closest('tr').dataset.rid;
  getMonthData().routines.find((r) => r.id === rid).name = e.target.value;
  saveDb();
  updateStats();
});

table.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('.routine-name')) e.target.blur();
});

table.addEventListener('click', (e) => {
  const data = getMonthData();

  if (e.target.closest('.del')) {
    const rid = e.target.closest('tr').dataset.rid;
    const routine = data.routines.find((r) => r.id === rid);
    if (!confirm(`'${routine.name || '이름 없는 루틴'}'을(를) 삭제할까요?\n이번 달 체크 기록도 함께 지워집니다.`)) return;
    data.routines = data.routines.filter((r) => r.id !== rid);
    delete data.checks[rid];
    saveDb();
    render();
    return;
  }

  if (e.target.closest('.add-btn')) {
    if (data.routines.length >= MAX_ROUTINES) return;
    const id = newId();
    data.routines.push({ id, name: '' });
    saveDb();
    render();
    table.querySelector(`tr[data-rid="${id}"] .routine-name`).focus();
    return;
  }

  const cond = e.target.closest('.cond');
  if (cond) {
    const store = data[cond.closest('tr').dataset.cond];
    const day = cond.dataset.day;
    const next = (store[day] || 0) + 1; // 1 → 2 → … → 5 → 빈칸
    if (next > CONDITION_MAX) delete store[day];
    else store[day] = next;
    cond.textContent = store[day] || '';
    if (store[day]) cond.dataset.v = store[day];
    else delete cond.dataset.v;
    saveDb();
    updateStats();
  }
});

$('#monthTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.month-tab');
  if (!tab) return;
  state.month = Number(tab.dataset.month);
  render();
  scrollToToday();
});

$('#prevYear').addEventListener('click', () => { state.year--; render(); scrollToToday(); });
$('#nextYear').addEventListener('click', () => { state.year++; render(); scrollToToday(); });

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `routine-tracker-backup-${today.toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const valid = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      && Object.values(parsed).every((m) => m && Array.isArray(m.routines));
    if (!valid) throw new Error('형식 오류');
    if (!confirm('지금 기록을 백업 파일 내용으로 바꿀까요?')) return;
    db = parsed;
    saveDb();
    render();
  } catch {
    alert('백업 파일을 읽을 수 없습니다. 이 앱에서 저장한 .json 파일인지 확인해 주세요.');
  }
});

render();
scrollToToday();
