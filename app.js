import { analyzeWalk, withDistance } from './gait.js';

const $ = id => document.getElementById(id);

// ── 근거 출처 (refs/journal_evidence.md, refs/perry_analysis.md 참고) ──
const REF = {
  perry20: 'Perry J. Gait Analysis: Normal and Pathological Function. 1992, 20장(보폭 분석)',
  perry7: 'Perry J. Gait Analysis. 1992, 7장(몸통 움직임은 걸음마다 반복)',
  neumann15: 'Neumann DA. Kinesiology of the Musculoskeletal System 3판, 15장(걷기의 운동학)',
  murtagh: 'Murtagh EM 외. Outdoor Walking Speeds of Apparently Healthy Adults. Sports Med 2021. doi:10.1007/s40279-020-01351-3',
  cadenceAdults: 'Tudor-Locke C 외. CADENCE-Adults (21–40세 2019, 41–60세 2020, 61–85세 2021). Int J Behav Nutr Phys Act. doi:10.1186/s12966-019-0769-6 외',
  aguiar: 'Aguiar EJ 외. Cadence-based classification of moderate-intensity overground walking. Scand J Med Sci Sports 2022. doi:10.1111/sms.14274',
  shema: 'Shema-Shiratzky S 외. Smartphone-based inertial sensors technology. Gait Posture 2022. doi:10.1016/j.gaitpost.2022.01.024',
  simonsen: 'Simonsen MB 외. Validation of different stepping counters. Gait Posture 2020. doi:10.1016/j.gaitpost.2020.05.037',
  mora: 'Mora-Gonzalez J 외. A catalog of validity indices for step counting wearable technologies. Int J Behav Nutr Phys Act 2022. doi:10.1186/s12966-022-01350-9',
  jama2024: 'Colón-Emeric CS 외. Risk Assessment and Prevention of Falls in Older Community-Dwelling Adults. JAMA 2024. doi:10.1001/jama.2024.1416',
  studenski: 'Studenski S 외. Gait speed and survival in older adults. JAMA 2011. doi:10.1001/jama.2010.1923',
};
const GRADE = {
  g: ['b-g', '정확'], y: ['b-y', '참고'], o: ['b-o', '부정확할 수 있음'], n: ['b-n', '검증 안 됨'],
};
const WARN = {
  shortWalk: '걸은 시간이 짧아 시작·끝 구간을 빼지 못했어요. 20초 이상 걸으면 더 정확해요.',
  irregular: '걸음 신호가 불규칙해요. 휴대폰이 주머니에서 흔들렸거나 방향을 자주 바꿨을 수 있어요.',
  running: '달리기로 보여요(케이던스 170 이상). 이 분석은 걷기에서만 정확해요.',
  slow: '아주 천천히 걸으면 휴대폰이 걸음 수를 적게 셀 수 있어요.',
  hand: '손에 들면 팔 흔들림이 섞여 정확도가 낮아요. 바지 앞주머니를 권장해요.',
};

// ── 내 정보 ──
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const prof = store.get('profile', { sex: '', age: '' });
$('sex').value = prof.sex; $('age').value = prof.age;
for (const id of ['sex', 'age']) $(id).addEventListener('change', () => {
  store.set('profile', { sex: $('sex').value, age: $('age').value });
});

// ── 측정 ──
let samples = [], t0 = 0, timer = null;
function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (a && a.x != null) samples.push({ t: e.timeStamp, x: a.x, y: a.y, z: a.z });
}
$('start').addEventListener('click', async () => {
  if (typeof DeviceMotionEvent === 'undefined') return alert('이 기기·브라우저는 움직임 센서를 지원하지 않아요.');
  if (typeof DeviceMotionEvent.requestPermission === 'function') {          // 아이폰은 허락이 필요
    try { if (await DeviceMotionEvent.requestPermission() !== 'granted') return alert('움직임 센서 사용을 허락해야 측정할 수 있어요.'); }
    catch { return alert('움직임 센서 권한을 받지 못했어요.'); }
  }
  samples = []; $('setup').classList.add('hidden'); $('result').classList.add('hidden'); $('rec').classList.remove('hidden');
  let left = 3;
  $('recTitle').textContent = '3초 안에 주머니에 넣으세요';
  $('recTime').textContent = left;
  timer = setInterval(() => {
    if (--left > 0) return ($('recTime').textContent = left);
    clearInterval(timer);
    navigator.vibrate?.(200);
    $('recTitle').textContent = '걷는 중… 평소처럼 직선으로';
    window.addEventListener('devicemotion', onMotion);
    t0 = performance.now();
    timer = setInterval(() => { $('recTime').textContent = Math.round((performance.now() - t0) / 1000) + '초'; }, 500);
  }, 1000);
});
$('stop').addEventListener('click', () => {
  clearInterval(timer);
  window.removeEventListener('devicemotion', onMotion);
  $('rec').classList.add('hidden'); $('setup').classList.remove('hidden');
  if (samples.length < 20) return alert('센서 값이 거의 들어오지 않았어요. 다시 시도해 주세요.');
  finish(samples);
});

function finish(data) {
  const position = $('pos').value;
  const res = analyzeWalk(data, { position });
  const dist = parseFloat($('dist').value);
  if (res.error) {
    const msg = { tooShort: '측정 시간이 너무 짧아요(8초 이상).', noWalk: '걷는 움직임을 찾지 못했어요. 휴대폰을 주머니에 넣고 6초 이상 걸어 주세요.', irregular: '반복되는 걸음 신호를 찾지 못했어요.' }[res.error];
    showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">${msg}</div>`);
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const hist = store.get('history', []);
  const practice = !hist.some(h => h.date.startsWith(today));             // 그날 첫 측정 = 연습 (Perry 20장)
  const rec = { date: new Date().toISOString(), position, practice, ...res, ...withDistance(res, dist), distance: dist || null };
  hist.unshift(rec); store.set('history', hist.slice(0, 200));
  render(rec, hist.find(h => !h.practice && h !== rec));
  renderHistory();
}

// ── 결과 화면 ──
function metric({ title, value, unit, grade, body = '', why = [], refs = [] }) {
  const [cls, label] = GRADE[grade];
  return `<div class="metric"><div class="mhead"><div><b>${title}</b></div><span class="badge ${cls}">${label}</span></div>
    <div class="mval">${value}<span class="sub"> ${unit}</span></div>${body}
    <details><summary>근거 보기</summary><ul>${why.map(w => `<li>${w}</li>`).join('')}</ul>
    <div>출처</div><ul>${refs.map(r => `<li>${REF[r]}</li>`).join('')}</ul></details></div>`;
}

function render(r, prev) {
  const { sex, age } = store.get('profile', {});
  const norm = sex === 'm' ? 111 : sex === 'f' ? 117 : 113;
  const lo = norm * 0.9, hi = norm * 1.1;
  const c = r.cadence;
  const where = c < lo ? '정상 범위보다 느려요' : c > hi ? '정상 범위보다 빨라요' : '정상 범위예요';
  const pos = Math.min(Math.max((c - 60) / 100, 0), 1) * 100;
  const cadGrade = r.warnings.includes('hand') || r.warnings.includes('irregular') ? 'o' : 'g';
  const older = +age >= 61;
  const intensity = older
    ? (c >= 120 ? '약 5 MET (활발)' : c >= 110 ? '약 4 MET' : c >= 100 ? '중강도 (3 MET)' : '저강도')
    : (c >= 130 ? '고강도 (6 MET)' : c >= 100 ? '중강도 (3 MET)' : '저강도');

  let html = `<h2>결과 ${r.practice ? '<span class="badge b-n">연습</span>' : ''}</h2>`;
  if (r.practice) html += `<div class="warn">오늘 첫 측정은 연습으로 저장했어요. 처음 걸을 때는 보통 7% 느리게 나와요(Perry 20장). 한 번 더 걸어 주세요.</div>`;
  html += r.warnings.map(w => `<div class="warn">${WARN[w]}</div>`).join('');

  html += metric({
    title: '케이던스 (분당 걸음 수)', value: c.toFixed(0), unit: '걸음/분', grade: cadGrade,
    body: `<div class="bar"><i style="left:calc(${pos}% - 2px)"></i></div>
      <div class="sub">${where} · 정상 ${norm}걸음/분(±10%: ${lo.toFixed(0)}–${hi.toFixed(0)}) · 야외 평소 걸음 평균 116.7
      ${prev ? `<br>지난번 ${prev.cadence.toFixed(0)} → ${c >= prev.cadence ? '+' : ''}${(c - prev.cadence).toFixed(0)}` : ''}</div>`,
    why: [
      '정상값: 성인 평균 113, 남성 111·여성 117걸음/분, 정상인의 편차는 평균의 약 ±10% (Perry 20장)',
      '야외에서 평소 속도로 걸을 때 평균 116.7걸음/분 (14,015명 메타분석)',
      '스마트폰 케이던스는 기준 장비와 거의 같음: 상관 0.997, 오차 범위 1.4% (허벅지에 고정한 연구)',
      cadGrade === 'o' ? '이번 측정은 손에 들었거나 신호가 불규칙해 등급을 낮췄어요.' : '권장 위치(허벅지 밀착)에서 측정한 값이에요.',
    ],
    refs: ['perry20', 'murtagh', 'shema'],
  });
  html += metric({
    title: '걷기 강도', value: intensity, unit: '', grade: 'y',
    body: `<div class="sub">${older ? '61세 이상 기준: 100 = 중강도, 110 = 4 MET, 120 = 5 MET' : '기준: 100걸음/분 = 중강도, 130 = 고강도'}</div>`,
    why: ['실험실에서 호흡 가스로 잰 강도와 케이던스를 비교한 연구의 기준값', '실제 바닥 걷기에서 100걸음/분 기준이 중강도를 맞힌 비율은 약 75% → "참고" 등급', '나이를 입력하면 61세 이상 기준으로 바뀌어요.'],
    refs: ['cadenceAdults', 'aguiar'],
  });
  html += metric({
    title: '걸음 수', value: r.steps, unit: `걸음 (걷는 시간 ${r.activeS.toFixed(0)}초)`, grade: r.warnings.includes('slow') ? 'o' : 'g',
    why: ['바지 앞주머니 스마트폰은 실제 보행에서 오차 약 0.5%로 가장 정확했어요.', '허벅지·발목 착용 오차 약 1%, 허리 3%, 손목 15%', '시속 3km 이하로 아주 느리게 걸으면 모든 기기가 걸음을 적게 셀 수 있어요.'],
    refs: ['simonsen', 'mora'],
  });
  if (r.speed) {
    // 낙상 기준(JAMA 2024)과 사망 위험(JAMA 2011)은 65세 이상 연구라 그 나이에만 경고
    const slow = r.speed < 1.0 && +age >= 65;
    const short = r.distance < 20;                                         // 짧으면 출발·정지 구간 비중이 커져 느리게 나옴
    const dGrade = short ? 'o' : 'y';
    const shortNote = short ? '<br>20m보다 짧게 걸으면 출발·멈춤 구간이 섞여 실제보다 느리게 나와요. 20m 이상을 권장해요.' : '';
    html += metric({
      title: '걷는 속도', value: r.speed.toFixed(2), unit: `m/s (${(r.speed * 60).toFixed(0)} m/분)`, grade: dGrade,
      body: `<div class="sub">정상 성인 평균 1.37 m/s(82 m/분)${shortNote}${slow ? `<br><b>1.0 m/s 미만:</b> 낙상 예방이 필요한지 전문가와 상담해 보세요.` : ''}</div>`,
      why: ['입력한 거리 ÷ 센서가 찾은 걷는 시간. 출발·정지 구간이 포함돼 실제보다 약간 느리게 나올 수 있어요 → "참고"', '정상 82 m/분 (Perry 20장)', '65세 이상 지침: 걷는 속도가 0.8~1.0 m/s 미만이면 낙상 예방 대상 (나이를 65 이상으로 입력하면 경고가 켜져요)', '65세 이상에서 걷는 속도 0.1 m/s 빠를 때마다 사망 위험 12% 낮음 (관찰 연구, 연관성)'],
      refs: ['perry20', 'jama2024', 'studenski'],
    });
    const ideal = sex === 'f' ? 0.0064 : sex === 'm' ? 0.0072 : null;
    html += metric({
      title: '걸음 길이', value: (r.stepLength * 100).toFixed(0), unit: 'cm', grade: dGrade,
      body: ideal ? `<div class="sub">이 케이던스에서 에너지 효율이 가장 좋은 걸음 길이 약 ${(ideal * c * 100).toFixed(0)}cm</div>` : '',
      why: ['입력한 거리 ÷ 걸음 수', '걸음 길이 ÷ 케이던스가 남성 0.0072, 여성 0.0064일 때 걷기 효율이 가장 높음 (Neumann 15장)', '거리를 대충 입력하면 그만큼 오차가 생겨요.'],
      refs: ['neumann15', 'perry20'],
    });
  }
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 걸음이 걱정되면 전문가와 상담하세요.</div>`;
  showHtml(html);
}

function showHtml(html) { const el = $('result'); el.innerHTML = html; el.classList.remove('hidden'); el.scrollIntoView({ behavior: 'smooth' }); }

function renderHistory() {
  const hist = store.get('history', []);
  if (!hist.length) return;
  $('histBody').innerHTML = `<table class="hist"><tr><td>날짜</td><td>케이던스</td><td>걸음</td><td>속도</td></tr>` +
    hist.slice(0, 20).map(h => `<tr><td>${new Date(h.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${h.practice ? ' (연습)' : ''}</td>
      <td>${h.cadence.toFixed(0)}</td><td>${h.steps}</td><td>${h.speed ? h.speed.toFixed(2) + ' m/s' : '-'}</td></tr>`).join('') + '</table>';
}
renderHistory();

// ── 데모 (주소 끝에 ?demo=1): 휴대폰 없이 화면 확인용 가짜 신호 ──
if (new URLSearchParams(location.search).has('demo')) {
  $('demo').classList.remove('hidden');
  $('demo').addEventListener('click', () => {
    const cad = 108, step = 60 / cad, s = [];
    for (let i = 0; i < 26 * 60; i++) {
      const t = i / 60, k = (t - 3) / step, walking = t > 3 && t < 23;
      const ph = k - Math.floor(k);
      const a = 9.81 + (walking ? (Math.floor(k) % 2 ? 0.4 : 3.2) * Math.exp(-(((ph - .15) / .07) ** 2)) + 2 * Math.sin(Math.PI * k) : 0) + (Math.random() - .5) * .3;
      s.push({ t: t * 1000, x: 0, y: a, z: 0 });
    }
    finish(s);
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
