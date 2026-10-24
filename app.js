import { analyzeWalk, withDistance, gpsSpeed } from './gait.js';

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

// ── 거리 재는 방법 (선택은 이 휴대폰에 기억) ──
$('dmode').value = store.get('dmode', 'gps');
function showDmode() { $('distBox').classList.toggle('hidden', $('dmode').value !== 'manual'); $('gpsNote').classList.toggle('hidden', $('dmode').value !== 'gps'); }
$('dmode').addEventListener('change', () => { store.set('dmode', $('dmode').value); showDmode(); });
showDmode();

// ── 측정 ──
let samples = [], t0 = 0, timer = null, gpsPts = [], gpsWatch = null, gpsDenied = false;
// 위치 좌표는 이 휴대폰 안에서 거리 계산에만 쓰고 저장·전송하지 않음
function startGps() {
  gpsPts = []; gpsDenied = false;
  if ($('dmode').value !== 'gps' || !navigator.geolocation) return;
  gpsWatch = navigator.geolocation.watchPosition(
    p => gpsPts.push({ t: performance.now(), lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
    e => { if (e.code === 1) gpsDenied = true; },
    { enableHighAccuracy: true, maximumAge: 0 });
}
function stopGps() { if (gpsWatch != null) navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; }
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
  startGps();                                                              // 위치 권한 창은 여기서 뜸 (카운트다운 동안 GPS가 잡힘)
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
    timer = setInterval(() => {
      $('recTime').textContent = Math.round((performance.now() - t0) / 1000) + '초';
      const last = gpsPts[gpsPts.length - 1];
      if ($('dmode').value === 'gps') $('recHint').textContent = gpsDenied ? '위치 권한이 없어 속도는 재지 않아요 (케이던스는 정상 측정)'
        : last ? `GPS 오차 약 ${Math.round(last.acc)}m · 속도를 재려면 야외에서 1분 이상 걸어 주세요` : 'GPS 신호 찾는 중… (실내에서는 잘 안 잡혀요)';
    }, 500);
  }, 1000);
});
$('stop').addEventListener('click', () => {
  clearInterval(timer);
  window.removeEventListener('devicemotion', onMotion);
  stopGps();
  $('rec').classList.add('hidden'); $('setup').classList.remove('hidden');
  if (samples.length < 20) return alert('센서 값이 거의 들어오지 않았어요. 다시 시도해 주세요.');
  finish(samples, false, gpsPts);
});

function finish(data, demo = false, gps = []) {
  const position = $('pos').value;
  const res = analyzeWalk(data, { position });
  const mode = $('dmode').value;
  if (res.error) {
    const msg = { tooShort: '측정 시간이 너무 짧아요(8초 이상).', noWalk: '걷는 움직임을 찾지 못했어요. 휴대폰을 주머니에 넣고 6초 이상 걸어 주세요.', irregular: '반복되는 걸음 신호를 찾지 못했어요.' }[res.error];
    showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">${msg}</div>`);
    return;
  }
  const today = new Date().toLocaleDateString('sv-SE');                  // 휴대폰 시간대 기준 YYYY-MM-DD
  const hist = store.get('history', []);
  const practice = !hist.some(h => new Date(h.date).toLocaleDateString('sv-SE') === today);             // 그날 첫 측정 = 연습 (Perry 20장)
  const dist = mode === 'manual' ? parseFloat($('dist').value) || null : null;
  const d = mode === 'gps' ? (gpsDenied && !demo ? { gpsError: 'denied' } : gpsSpeed(res, gps)) : withDistance(res, dist);
  const rec = { date: new Date().toISOString(), position, practice, ...res, distance: dist, ...d, distSource: d.speed ? mode : null };
  if (!demo && consent?.share && ENDPOINT) rec.receipt = send(rec);
  hist.unshift(rec); store.set('history', hist.slice(0, 200));
  render(rec, hist.find(h => !h.practice && h !== rec));
  renderHistory();
}

// ── 익명 결과 보내기 (선택 동의 2개를 모두 한 사람만) ──
// 구글 Apps Script 웹앱 주소. 비어 있으면 아무것도 보내지 않음 (설정법: apps_script.gs)
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwLfXvMoqIPDkmemDjQ5oJWhaDDKboetKlxkU603xABxQqTPjzvr1hN3Iyhb9km3OCb/exec';
function send(r) {
  const { sex, age } = store.get('profile', {});
  const ua = navigator.userAgent;
  const receipt = crypto.randomUUID().slice(0, 8);                       // 삭제 요청용 접수번호, 개인과 연결 안 됨
  const body = {
    receipt, date: new Date(r.date).toLocaleDateString('sv-SE'), appVersion: APP_VERSION,           // 시각은 빼고 날짜만 (식별 가능성 낮춤)
    cadence: +r.cadence.toFixed(1), steps: r.steps, activeS: +r.activeS.toFixed(1), regularity: +r.regularity.toFixed(2),
    speed: r.speed ? +r.speed.toFixed(2) : '', stepLength: r.stepLength ? +r.stepLength.toFixed(2) : '', distance: r.distance ? +r.distance.toFixed(1) : '',
    // ponytail: 시트 칸을 늘리려면 Apps Script 재배포가 필요해서 거리 출처(gps)는 warnings 칸에 붙여 보냄
    position: r.position, practice: r.practice, warnings: [...r.warnings, r.distSource === 'gps' && 'gps'].filter(Boolean).join(' '),
    ageGroup: +age ? Math.floor(+age / 10) * 10 : '', sex: sex || '',
    os: /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : '기타',
  };
  // no-cors: Apps Script는 응답을 못 읽지만 저장은 됨. 실패하면 조용히 넘어감 (측정 기록은 휴대폰에 남아 있음)
  fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }).catch(() => {});
  return receipt;
}

// ── 처음 시작할 때 동의 ──
const APP_VERSION = 'v6';
let consent = store.get('consent', null);
function showConsent() {
  document.body.classList.add('needConsent');
  $('cShare').checked = $('cHealth').checked = !!consent?.share;
  $('cMust').checked = !!consent;
  updateConsentBtn();
}
function updateConsentBtn() { $('cOk').disabled = !$('cMust').checked; }
$('cMust').addEventListener('change', updateConsentBtn);
$('cAll').addEventListener('click', () => { $('cMust').checked = $('cShare').checked = $('cHealth').checked = true; updateConsentBtn(); });
$('cOk').addEventListener('click', () => {
  consent = { date: new Date().toISOString(), version: 1, share: $('cShare').checked && $('cHealth').checked };
  store.set('consent', consent);
  document.body.classList.remove('needConsent');
  $('consentState').textContent = consent.share ? '익명 결과 보내기: 동의함' : '익명 결과 보내기: 동의 안 함';
});
$('cEdit').addEventListener('click', e => { e.preventDefault(); showConsent(); scrollTo(0, 0); });
if (!consent) showConsent();
else $('consentState').textContent = consent.share ? '익명 결과 보내기: 동의함' : '익명 결과 보내기: 동의 안 함';

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
    const gps = r.distSource === 'gps';
    const short = !gps && r.distance < 20;                                 // 짧으면 출발·정지 구간 비중이 커져 느리게 나옴
    const dGrade = short || (gps && r.medAcc > 10) ? 'o' : 'y';
    const shortNote = short ? '<br>20m보다 짧게 걸으면 출발·멈춤 구간이 섞여 실제보다 느리게 나와요. 20m 이상을 권장해요.'
      : gps ? `<br>GPS로 잰 거리 약 ${r.distance.toFixed(0)}m · 위치 오차 약 ${Math.round(r.medAcc)}m${r.medAcc > 10 ? ' (오차가 커서 등급을 낮췄어요)' : ''}` : '';
    const how = gps ? `GPS: 출발·멈춤 2초를 뺀 꾸준히 걸은 ${Math.round(r.gpsDurS)}초 동안 이동한 거리 ÷ 시간. 위치 떨림을 줄이려 10초씩 평균 낸 위치를 이어요. 휴대폰 GPS 오차(보통 수 m) 때문에 "참고"`
      : '입력한 거리 ÷ 센서가 찾은 걷는 시간. 출발·정지 구간이 포함돼 실제보다 약간 느리게 나올 수 있어요 → "참고"';
    html += metric({
      title: '걷는 속도', value: r.speed.toFixed(2), unit: `m/s (${(r.speed * 60).toFixed(0)} m/분)`, grade: dGrade,
      body: `<div class="sub">정상 성인 평균 1.37 m/s(82 m/분)${shortNote}${slow ? `<br><b>1.0 m/s 미만:</b> 낙상 예방이 필요한지 전문가와 상담해 보세요.` : ''}</div>`,
      why: [how, '정상 82 m/분 (Perry 20장)', '65세 이상 지침: 걷는 속도가 0.8~1.0 m/s 미만이면 낙상 예방 대상 (나이를 65 이상으로 입력하면 경고가 켜져요)', '65세 이상에서 걷는 속도 0.1 m/s 빠를 때마다 사망 위험 12% 낮음 (관찰 연구, 연관성)'],
      refs: ['perry20', 'jama2024', 'studenski'],
    });
    const ideal = sex === 'f' ? 0.0064 : sex === 'm' ? 0.0072 : null;
    html += metric({
      title: '걸음 길이', value: (r.stepLength * 100).toFixed(0), unit: 'cm', grade: dGrade,
      body: ideal ? `<div class="sub">이 케이던스에서 에너지 효율이 가장 좋은 걸음 길이 약 ${(ideal * c * 100).toFixed(0)}cm</div>` : '',
      why: [gps ? 'GPS 속도 ÷ 초당 걸음 수' : '입력한 거리 ÷ 걸음 수', '걸음 길이 ÷ 케이던스가 남성 0.0072, 여성 0.0064일 때 걷기 효율이 가장 높음 (Neumann 15장)', gps ? '속도 오차가 그대로 걸음 길이 오차가 돼요.' : '거리를 대충 입력하면 그만큼 오차가 생겨요.'],
      refs: ['neumann15', 'perry20'],
    });
  } else if (r.gpsError) {
    const msg = { tooShort: `짧은 거리는 GPS 오차(보통 수 m)가 거리의 큰 부분을 차지해 속도가 크게 틀릴 수 있어요. 그래서 꾸준히 걸은 시간이 1분 이상이고 50m 이상 이동해야 계산해요 (이번 약 ${Math.round(r.gpsDurS ?? 0)}초). 야외에서 더 오래 걸어 주세요.`,
      noFix: 'GPS 신호가 약해서 속도는 계산하지 않았어요. 실내였다면 야외에서 다시 재 보세요.', denied: '위치 권한을 허용하지 않아 속도는 계산하지 않았어요.', noWalk: '' }[r.gpsError];
    if (msg) html += `<div class="sub" style="margin-top:12px">${msg} 케이던스와 걸음 수는 GPS 없이도 정확해요.</div>`;
  }
  if (r.receipt) html += `<div class="sub" style="margin-top:12px">익명 결과를 보냈어요. 접수번호 <b>${r.receipt}</b> (삭제 요청할 때 필요해요, 지난 기록에도 남아요)</div>`;
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 걸음이 걱정되면 전문가와 상담하세요.</div>`;
  showHtml(html);
}

function showHtml(html) { const el = $('result'); el.innerHTML = html; el.classList.remove('hidden'); el.scrollIntoView({ behavior: 'smooth' }); }

function renderHistory() {
  const hist = store.get('history', []);
  if (!hist.length) return;
  $('histBody').innerHTML = `<table class="hist"><tr><td>날짜</td><td>케이던스</td><td>걸음</td><td>속도</td></tr>` +
    hist.slice(0, 20).map(h => `<tr><td>${new Date(h.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${h.practice ? ' (연습)' : ''}${h.receipt ? `<br><span class="sub">접수 ${h.receipt}</span>` : ''}</td>
      <td>${h.cadence.toFixed(0)}</td><td>${h.steps}</td><td>${h.speed ? h.speed.toFixed(2) + ' m/s' : '-'}</td></tr>`).join('') + '</table>';
}
renderHistory();

// ── 데모 (주소 끝에 ?demo=1): 휴대폰 없이 화면 확인용 가짜 신호 ──
if (new URLSearchParams(location.search).has('demo')) {
  $('demo').classList.remove('hidden');
  $('demo').addEventListener('click', () => {
    const cad = 108, step = 60 / cad, s = [], walkS = 75, g = [];
    for (let i = 0; i < (walkS + 6) * 60; i++) {
      const t = i / 60, k = (t - 3) / step, walking = t > 3 && t < 3 + walkS;
      const ph = k - Math.floor(k);
      const a = 9.81 + (walking ? (Math.floor(k) % 2 ? 0.4 : 3.2) * Math.exp(-(((ph - .15) / .07) ** 2)) + 2 * Math.sin(Math.PI * k) : 0) + (Math.random() - .5) * .3;
      s.push({ t: t * 1000, x: 0, y: a, z: 0 });
    }
    for (let t = 0; t <= walkS + 6; t++) {                                  // 1.3 m/s로 북쪽, 오차 ±5m
      const north = Math.min(Math.max(t - 3, 0), walkS) * 1.3 + (Math.random() - .5) * 10;
      g.push({ t: t * 1000, lat: 37.5 + north / 111320, lon: 127 + (Math.random() - .5) * 10 / 88300, acc: 6 });
    }
    finish(s, true, g);
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
