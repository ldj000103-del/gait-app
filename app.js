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
  ding2025: 'Ding D 외. Daily steps and health outcomes in adults: a systematic review and dose-response meta-analysis. Lancet Public Health 2025. doi:10.1016/S2468-2667(25)00164-1',
  neumann16: 'Neumann DA. Kinesiology of the Musculoskeletal System 3판, 16장(달리기의 운동학)',
  heiderscheit: 'Heiderscheit BC 외. Effects of step rate manipulation on joint mechanics during running. Med Sci Sports Exerc 2011. doi:10.1249/MSS.0b013e3181ebedf4',
  anderson2022: 'Anderson LM 외. What is the Effect of Changing Running Step Rate on Injury, Performance and Biomechanics? Sports Med Open 2022. doi:10.1186/s40798-022-00504-0',
  petri2026: 'Petri 외. Gait Retraining for Patellofemoral Pain in Runners: An Umbrella Review. Sports Med Open 2026. doi:10.1186/s40798-026-01051-8',
  goss2025: 'Goss 외. Effects of step rate based gait training on running biomechanics: meta-analysis. Gait Posture 2025. doi:10.1016/j.gaitpost.2025.110009',
  lee2014: 'Lee DC 외. Leisure-time running reduces all-cause and cardiovascular mortality risk. J Am Coll Cardiol 2014. doi:10.1016/j.jacc.2014.04.058',
  pedisic2019: 'Pedisic Z 외. Is running associated with a lower risk of all-cause, cardiovascular and cancer mortality? Br J Sports Med 2020. doi:10.1136/bjsports-2018-100493',
  ikenaga2017: 'Ikenaga M 외. Short-interval, intermittent, low-intensity, slow-jogging program in older adults: RCT. Eur J Appl Physiol 2017. doi:10.1007/s00421-016-3493-9',
};
const ACT = { walk: '걷기', run: '러닝', slowrun: '슬로우 러닝' };
const MET_NOTE = 'MET(대사당량) = 가만히 앉아 쉴 때 쓰는 에너지를 1로 본 운동 강도 단위예요. 3 MET는 쉴 때의 약 3배 에너지를 쓰는 강도예요(1 MET ≈ 몸무게 1kg당 1분에 산소 3.5mL).';
const INTERVAL_S = 60;   // 슬로우 러닝: 조깅 1분 + 걷기 1분 반복 (Ikenaga 2017)
const GRADE = {
  g: ['b-g', '정확'], y: ['b-y', '참고'], o: ['b-o', '부정확할 수 있음'], n: ['b-n', '검증 안 됨'],
};
const WARN = {
  shortWalk: '걸은 시간이 짧아 시작·끝 구간을 빼지 못했어요. 20초 이상 걸으면 더 정확해요.',
  irregular: '걸음 신호가 불규칙해요. 휴대폰이 주머니에서 흔들렸거나 방향을 자주 바꿨을 수 있어요.',
  running: '달리기로 보여요(케이던스 170 이상). 이 분석은 걷기에서만 정확해요.',
  slow: '아주 천천히 걸으면 휴대폰이 걸음 수를 적게 셀 수 있어요.',
  walkLike: '달리기치고 케이던스가 낮아요(140 미만). 걷기였거나 측정이 잘못됐을 수 있어요.',
  hand: '손에 들면 팔 흔들림이 섞여 정확도가 낮아요. 바지 앞주머니를 권장해요.',
  paused: '측정 중에 화면이 꺼져 센서가 잠시 멈췄어요. 끊기지 않고 가장 길게 걸은 구간만으로 계산해서 걸음 수가 실제보다 적을 수 있어요. 다음엔 전원 버튼을 누르지 말고 주머니 모드 그대로 넣어 주세요.',
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

// ── 활동 종류 (선택은 이 휴대폰에 기억) ──
$('act').value = store.get('act', 'walk');
function showAct() { $('slowNote').classList.toggle('hidden', $('act').value !== 'slowrun'); $('dmodeBox').classList.toggle('hidden', $('act').value === 'slowrun'); }
$('act').addEventListener('change', () => { store.set('act', $('act').value); showAct(); });
showAct();

// ── 거리 재는 방법 (선택은 이 휴대폰에 기억) ──
$('dmode').value = store.get('dmode', 'gps');
function showDmode() { $('distBox').classList.toggle('hidden', $('dmode').value !== 'manual'); $('gpsNote').classList.toggle('hidden', $('dmode').value !== 'gps'); }
$('dmode').addEventListener('change', () => { store.set('dmode', $('dmode').value); showDmode(); });
showDmode();

// ── 측정 ──
// 설치형 안드로이드 앱이면 네이티브 기록기(화면이 꺼져도 측정), 아니면 브라우저 센서
const Native = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins.GaitRecorder : null;
let samples = [], t0 = 0, timer = null, gpsPts = [], gpsWatch = null, gpsDenied = false, wakeLock = null, hiddenDuringRec = false;
// 휴대폰 브라우저는 화면이 꺼지면 센서·GPS를 멈춤 → 측정 중엔 화면 켜짐 유지, 그래도 꺼지면 기록해 두고 이유를 알려 줌
document.addEventListener('visibilitychange', () => { if (document.hidden && t0) hiddenDuringRec = true; });
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
  const act = $('act').value;
  const useGps = act !== 'slowrun' && $('dmode').value === 'gps';
  if (Native) {
    const st = await Native.requestPermissions({ permissions: useGps ? ['location', 'notifications'] : ['notifications'] }).catch(() => ({}));
    gpsDenied = useGps && st.location !== 'granted';
  } else {
  if (typeof DeviceMotionEvent === 'undefined') return alert('이 기기·브라우저는 움직임 센서를 지원하지 않아요.');
  if (typeof DeviceMotionEvent.requestPermission === 'function') {          // 아이폰은 허락이 필요
    try { if (await DeviceMotionEvent.requestPermission() !== 'granted') return alert('움직임 센서 사용을 허락해야 측정할 수 있어요.'); }
    catch { return alert('움직임 센서 권한을 받지 못했어요.'); }
  }
  if (useGps) startGps(); else gpsPts = [];                                 // 위치 권한 창은 여기서 뜸 (카운트다운 동안 GPS가 잡힘)
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
  document.body.classList.toggle('recording', true);
  }
  samples = []; $('setup').classList.add('hidden'); $('result').classList.add('hidden'); $('rec').classList.remove('hidden');
  let left = 3;
  $('recTitle').textContent = '3초 안에 주머니에 넣으세요';
  $('recTime').textContent = left;
  timer = setInterval(() => {
    if (--left > 0) return ($('recTime').textContent = left);
    clearInterval(timer);
    navigator.vibrate?.(200);
    $('recTitle').textContent = act === 'walk' ? '걷는 중… 평소처럼 직선으로' : act === 'run' ? '달리는 중… 평소 페이스로' : '조깅 1분';
    if (Native) Native.start({ gps: useGps && !gpsDenied, intervalSec: act === 'slowrun' ? INTERVAL_S : 0 });   // 앱: 화면 꺼져도 서비스가 진동
    else window.addEventListener('devicemotion', onMotion);
    t0 = performance.now(); hiddenDuringRec = false;
    let lastPhase = 0;
    timer = setInterval(() => {
      const el = (performance.now() - t0) / 1000;
      $('recTime').textContent = Math.round(el) + '초';
      if (act === 'slowrun') {
        const ph = Math.floor(el / INTERVAL_S), jog = ph % 2 === 0;
        $('recTitle').textContent = `${jog ? '조깅' : '걷기'} 1분 · ${INTERVAL_S - Math.floor(el % INTERVAL_S)}초 남음`;
        if (ph !== lastPhase && !Native) navigator.vibrate?.(jog ? [600] : [200, 150, 200]);   // 웹: 조깅 시작 = 길게 1번, 걷기 = 짧게 2번
        lastPhase = ph;
      }
      const last = gpsPts[gpsPts.length - 1];
      if (Native) $('recHint').textContent = '이제 화면을 꺼도 측정돼요. 알림창에 "걸음 측정 중"이 보이면 정상이에요.';
      else if ($('dmode').value === 'gps') $('recHint').textContent = gpsDenied ? '위치 권한이 없어 속도는 재지 않아요 (케이던스는 정상 측정)'
        : last ? `GPS 오차 약 ${Math.round(last.acc)}m · 속도를 재려면 야외에서 1분 이상 걸어 주세요` : 'GPS 신호 찾는 중… (실내에서는 잘 안 잡혀요)';
    }, 500);
  }, 1000);
});
// 웹앱은 화면이 켜진 채 주머니에 있으니 실수로 눌리지 않게 1초 길게 눌러야 끝
let holdTimer = null;
// 설치형 앱은 화면을 끄고 걸어서 실수로 눌릴 일이 없으니 한 번 누르면 끝
if (Native) {
  $('stop').textContent = '끝'; $('stop').addEventListener('click', stopRec);
  document.querySelector('ol.guide').innerHTML = `<li><b>시작</b>을 누르고 3초 뒤 <b>화면을 끄고</b> 주머니에 넣어요. 알림창에 "걸음 측정 중"이 떠 있으면 화면이 꺼져도 측정돼요.</li>
    <li><b>평소처럼, 멈추지 말고 이어서</b> 걸어요. 케이던스만 볼 땐 20초 이상, GPS로 속도까지 볼 땐 야외에서 1분 이상. 방향을 틀며 멈추면 그 앞뒤가 따로 잘려 짧게 잡혀요.</li>
    <li>멈춰서 화면을 켜고 <b>끝</b>을 눌러요.</li>`;
}
else {
$('stop').addEventListener('pointerdown', () => { $('stop').textContent = '계속 누르고 있어요…'; holdTimer = setTimeout(stopRec, 1000); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('stop').addEventListener(ev, () => { clearTimeout(holdTimer); $('stop').textContent = '끝 (1초 길게 누르기)'; });
}
$('stop').addEventListener('contextmenu', e => e.preventDefault());
async function stopRec() {
  clearInterval(timer); t0 = 0;
  if (Native) {
    $('rec').classList.add('hidden'); $('setup').classList.remove('hidden');
    const r = await Native.stop();
    if (r.samples.length < 20) return alert('센서 값이 거의 들어오지 않았어요. 다시 시도해 주세요.');
    return finish(r.samples, false, r.gps);
  }
  document.body.classList.remove('recording');
  wakeLock?.release().catch(() => {}); wakeLock = null;
  window.removeEventListener('devicemotion', onMotion);
  stopGps();
  $('rec').classList.add('hidden'); $('setup').classList.remove('hidden');
  if (samples.length < 20) return alert('센서 값이 거의 들어오지 않았어요. 다시 시도해 주세요.');
  finish(samples, false, gpsPts);
}

function finish(data, demo = false, gps = []) {
  const position = $('pos').value;
  const act = $('act').value;
  if (act === 'slowrun') return finishSlow(data, demo);
  const res = analyzeWalk(data, { position, activity: act });
  const mode = $('dmode').value;
  let maxGap = 0;
  for (let i = 1; i < data.length; i++) maxGap = Math.max(maxGap, data[i].t - data[i - 1].t);
  const paused = !demo && ((!Native && hiddenDuringRec) || maxGap > 2000);
  // 측정 정보: 문제가 생겼을 때 원인(센서 끊김, GPS 없음, 웹/앱 방식)을 찾기 위한 값
  const durS = data.length > 1 ? (data[data.length - 1].t - data[0].t) / 1000 : 0;
  const diag = { src: Native ? 'app' : 'web', n: data.length, durS, hz: durS ? data.length / durS : 0, gapS: maxGap / 1000,
    gpsN: gps.length, gpsGood: gps.filter(p => p.acc <= 20).length, hidden: !Native && hiddenDuringRec };
  const diagHtml = `<details><summary>측정 정보 (문제 찾기용)</summary><div class="sub">${diag.src === 'app' ? '설치형 앱' : '웹'} 방식 · 센서 값 ${diag.n}개 · 기록 시간 ${durS.toFixed(0)}초 · 초당 ${diag.hz.toFixed(0)}회 · 가장 길게 끊긴 시간 ${diag.gapS.toFixed(1)}초 · GPS 점 ${diag.gpsN}개(오차 20m 이내 ${diag.gpsGood}개)${diag.hidden ? ' · 화면 꺼짐 감지' : ''}</div></details>`;              // 2초 넘게 센서 값이 끊김 = 화면 꺼짐·다른 앱
  if (paused && !res.error) res.warnings.push('paused');
  if (res.error && paused) {
    showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">측정 중에 화면이 꺼지거나 다른 앱으로 바뀌어서 센서가 멈췄어요 (최대 ${Math.round(maxGap / 1000)}초 끊김). <b>전원 버튼은 누르지 말고</b> 시작 후 그대로 주머니에 넣어 주세요(화면이 까만 주머니 모드는 켜진 상태라 측정이 계속돼요). 끝은 1초 길게 눌러야 멈춰서 주머니 속에서 실수로 눌리지 않아요.</div>`);
    return;
  }
  if (res.error) {
    const msg = { tooShort: '측정 시간이 너무 짧아요(8초 이상).', noWalk: '걷는 움직임을 찾지 못했어요. 휴대폰을 주머니에 넣고 6초 이상 걸어 주세요.', irregular: '반복되는 걸음 신호를 찾지 못했어요.' }[res.error];
    showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">${msg}</div>${diagHtml}`);
    return;
  }
  const today = new Date().toLocaleDateString('sv-SE');                  // 휴대폰 시간대 기준 YYYY-MM-DD
  const hist = store.get('history', []);
  const practice = act === 'walk' && !hist.some(h => (h.activity ?? 'walk') === 'walk' && new Date(h.date).toLocaleDateString('sv-SE') === today);   // 그날 첫 걷기 측정 = 연습 (Perry 20장)
  const dist = mode === 'manual' ? parseFloat($('dist').value) || null : null;
  const d = mode === 'gps' ? (gpsDenied && !demo ? { gpsError: 'denied' } : gpsSpeed(res, gps)) : withDistance(res, dist);
  const rec = { date: new Date().toISOString(), activity: act, position, practice, ...res, distance: dist, ...d, distSource: d.speed ? mode : null, diag, diagHtml };
  if (!demo && consent?.share && ENDPOINT) rec.receipt = send(rec);
  hist.unshift(rec); store.set('history', hist.slice(0, 200));
  const prev = hist.find(h => !h.practice && h !== rec && (h.activity ?? 'walk') === act);
  act === 'run' ? renderRun(rec, prev) : render(rec, prev);
  renderHistory();
}

// ── 슬로우 러닝: 1분 단위로 잘라 조깅 구간은 러닝, 걷기 구간은 걷기로 분석 ──
function finishSlow(data, demo) {
  const position = $('pos').value, t0s = data[0].t, segs = [];
  for (let k = 0; ; k++) {
    const a = t0s + k * INTERVAL_S * 1000, b = a + INTERVAL_S * 1000;
    if (a > data[data.length - 1].t) break;
    const slice = data.filter(p => p.t >= a && p.t < b);
    if (slice.length < 50 || (slice[slice.length - 1].t - slice[0].t) < 20000) continue;   // 20초 미만 조각은 버림
    const jog = k % 2 === 0, r = analyzeWalk(slice, { position, activity: jog ? 'run' : 'walk' });
    if (!r.error) segs.push({ jog, cadence: r.cadence, steps: r.steps, activeS: r.activeS, regularity: r.regularity });
  }
  const jogs = segs.filter(x => x.jog), walks = segs.filter(x => !x.jog);
  if (!jogs.length) return showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">조깅 구간을 찾지 못했어요. 첫 1분은 조깅, 다음 1분은 걷기로 번갈아 해 주세요. 조깅 구간이 20초 이상 있어야 분석해요.</div>`);
  const avg = (xs, k) => xs.reduce((s, x) => s + x[k], 0) / xs.length, sum = (xs, k) => xs.reduce((s, x) => s + x[k], 0);
  const hist = store.get('history', []);
  const rec = { date: new Date().toISOString(), activity: 'slowrun', position, practice: false,
    cadence: avg(jogs, 'cadence'), walkCadence: walks.length ? avg(walks, 'cadence') : null,
    steps: sum(segs, 'steps'), activeS: sum(jogs, 'activeS'), walkS: sum(walks, 'activeS'),
    regularity: avg(jogs, 'regularity'), jogCount: jogs.length, warnings: [],
    diag: { src: Native ? 'app' : 'web', durS: (data[data.length - 1].t - t0s) / 1000, hz: data.length / Math.max(1, (data[data.length - 1].t - t0s) / 1000), gapS: 0, gpsGood: 0 } };
  if (!demo && consent?.share && ENDPOINT) rec.receipt = send(rec);
  hist.unshift(rec); store.set('history', hist.slice(0, 200));
  renderSlow(rec, hist);
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
    position: r.position, practice: r.practice, warnings: [r.activity !== 'walk' && r.activity, ...r.warnings, r.distSource === 'gps' && 'gps',
      `d:${r.diag.src}/${r.diag.durS.toFixed(0)}s/${r.diag.hz.toFixed(0)}hz/gap${r.diag.gapS.toFixed(1)}/gps${r.diag.gpsGood}`].filter(Boolean).join(' '),
    ageGroup: +age ? Math.floor(+age / 10) * 10 : '', sex: sex || '',
    os: /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : '기타',
  };
  // no-cors: Apps Script는 응답을 못 읽지만 저장은 됨. 실패하면 조용히 넘어감 (측정 기록은 휴대폰에 남아 있음)
  fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }).catch(() => {});
  return receipt;
}

// ── 처음 시작할 때 동의 ──
const APP_VERSION = 'v14';
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
  const where = `이번 값 ${c.toFixed(0)} · ${c < lo ? '기준 범위보다 낮은 값' : c > hi ? '기준 범위보다 높은 값' : '기준 범위 안의 값'}`;
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
      <div class="sub">${where} · Perry 성인 평균 ${norm}걸음/분(±10%: ${lo.toFixed(0)}–${hi.toFixed(0)}) · 야외 평소 걸음 평균 116.7(Murtagh 2021)
      ${prev ? `<br>지난번 ${prev.cadence.toFixed(0)} → ${c >= prev.cadence ? '+' : ''}${(c - prev.cadence).toFixed(0)}` : ''}</div>`,
    why: [
      'Perry 20장 기준값: 성인 평균 113, 남성 111·여성 117걸음/분, 건강한 성인의 편차는 평균의 약 ±10%',
      '야외에서 평소 속도로 걸을 때 평균 116.7걸음/분 (14,015명 메타분석)',
      '스마트폰 케이던스는 기준 장비와 거의 같음: 상관 0.997, 오차 범위 1.4% (허벅지에 고정한 연구)',
      cadGrade === 'o' ? '이번 측정은 손에 들었거나 신호가 불규칙해 등급을 낮췄어요.' : '권장 위치(허벅지 밀착)에서 측정한 값이에요.',
    ],
    refs: ['perry20', 'murtagh', 'shema'],
  });
  html += metric({
    title: '걷기 강도', value: intensity, unit: '', grade: 'y',
    body: `<div class="sub">${older ? '61세 이상 기준: 100걸음/분 = 중강도(3 MET), 110 = 4 MET, 120 = 5 MET' : '기준: 100걸음/분 = 중강도(3 MET), 130 = 고강도(6 MET)'}<br>${MET_NOTE}</div>`,
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
      body: `<div class="sub">Perry 성인 평균 1.37 m/s(82 m/분)${shortNote}${slow ? `<br>참고: JAMA 2024 지침은 65세 이상에서 걷는 속도 0.8~1.0 m/s 미만을 낙상 위험을 평가하는 기준 중 하나로 써요. 이 앱은 낙상 위험을 판정하지 않아요.` : ''}</div>`,
      why: [how, '성인 평균 82 m/분 (Perry 20장)', 'JAMA 2024 지침: 65세 이상에서 지난 1년 낙상, 낙상 걱정, 걷는 속도 0.8~1.0 m/s 미만 중 하나가 있으면 낙상 예방 중재를 고려 (나이를 65 이상으로 입력하면 이 안내가 보여요)', '65세 이상에서 걷는 속도 0.1 m/s 빠를 때마다 사망 위험 12% 낮음 (관찰 연구, 연관성)'],
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
  html += recSection(recsWalk(r, { sex, age }));
  if (r.receipt) html += `<div class="sub" style="margin-top:12px">익명 결과를 보냈어요. 접수번호 <b>${r.receipt}</b> (삭제 요청할 때 필요해요, 지난 기록에도 남아요)</div>`;
  html += r.diagHtml || '';
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 걸음이 걱정되면 전문가와 상담하세요.</div>`;
  showHtml(html);
}

// ── 추천 카드: 효과를 뭉뚱그리지 않고 계산식 + 출처별 실제 결과 + 한계만 보여 줌 ──
function recCard({ title, calc = [], facts = [], limit = '', grade = 'y', refs = [] }) {
  const [cls, label] = GRADE[grade];
  return `<div class="rec"><div class="mhead"><b>💡 ${title}</b><span class="badge ${cls}">${label}</span></div>
    ${calc.length ? `<div class="calc">${calc.join('<br>')}</div>` : ''}
    <ul class="facts">${facts.map(f => `<li>${f}</li>`).join('')}</ul>
    ${limit ? `<div class="sub">한계: ${limit}</div>` : ''}
    <details><summary>출처 전체</summary><ul>${refs.map(r => `<li>${REF[r]}</li>`).join('')}</ul></details></div>`;
}
const recSection = cards => cards.length ? `<h2 style="margin-top:18px">근거로 본 추천</h2><div class="sub">연구에서 확인된 숫자만 옮겼어요. 내 몸에 맞는지는 전문가와 상의하세요.</div>${cards.join('')}` : '';

function recsWalk(r, { sex, age }) {
  const c = Math.round(r.cadence), cards = [];
  const older = +age >= 61, steps = older ? [100, 110, 120] : [100, 130];
  const next = steps.find(x => x > c);
  if (next) cards.push(recCard({
    title: next === 100 ? '중강도 걷기 기준까지' : `다음 강도 기준(${next}걸음/분)까지`,
    calc: [`${next} − ${c} = <b>+${next - c}걸음/분</b>`],
    facts: [older ? 'CADENCE-Adults(61~85세): 100걸음/분 ≈ 3 MET(중강도), 110 ≈ 4 MET, 120 ≈ 5 MET' : 'CADENCE-Adults(21~60세): 100걸음/분 ≈ 3 MET(중강도), 130 ≈ 6 MET(고강도)',
      'Aguiar 2022: 실제 바닥 걷기에서 100걸음/분 기준이 중강도를 맞힌 비율 약 75%'],
    limit: '실험실 호흡가스 측정으로 정한 평균 기준이라 사람마다 다를 수 있음. ' + MET_NOTE, refs: ['cadenceAdults', 'aguiar'] }));
  const ideal = sex === 'f' ? 0.0064 : sex === 'm' ? 0.0072 : null;
  if (ideal && r.stepLength) {
    const cm = r.stepLength * 100, ratio = r.stepLength / r.cadence, opt = ideal * r.cadence * 100;
    cards.push(recCard({ title: '에너지 효율이 가장 좋은 걸음 길이',
      calc: [`걸음 길이 ${cm.toFixed(0)}cm ÷ 케이던스 ${c} = ${ratio.toFixed(4)} m/(걸음/분) (최적 ${ideal})`, `이 케이던스의 최적 걸음 길이 = ${ideal} × ${c} = <b>${opt.toFixed(0)}cm</b> (지금보다 ${opt >= cm ? '+' : ''}${(opt - cm).toFixed(0)}cm)`],
      facts: [`Neumann 15장: 걸음 길이 ÷ 케이던스(walk ratio)가 ${sex === 'f' ? '여성 0.0064' : '남성 0.0072'}일 때 걷기 에너지 효율이 가장 높음`],
      limit: '걸음 길이는 GPS·입력 거리로 계산한 참고값이라 그 오차가 그대로 들어감', refs: ['neumann15'] }));
  }
  cards.push(recCard({ title: '하루 7,000걸음',
    calc: [`7,000 ÷ 케이던스 ${c} = 이 속도로 약 <b>${Math.ceil(7000 / r.cadence)}분</b> 걷기`],
    facts: ['Ding 2025 메타분석(57개 연구): 하루 2,000걸음 대비 7,000걸음에서 전체 사망 위험 47% 낮음, 낙상 28%·치매 38% 낮음', '사망·낙상 등은 약 5,000~7,000걸음 이후 이득이 완만해짐'],
    limit: '관찰 연구라 인과관계는 아님. 하루 걸음 수는 이 앱이 아직 재지 않음', refs: ['ding2025'] }));
  return cards;
}

function healthRunCard() {
  return recCard({ title: '달리기와 건강 (얼마나 해야 하나)',
    facts: ['Lee 2014(55,137명, 평균 15년): 하루 5~10분, 시속 9.7km 미만으로 달려도 달리지 않는 사람보다 전체 사망 30%, 심혈관 사망 45% 낮음',
      'Pedisic 2020 메타분석(232,149명): 달리기 참여 시 전체 사망 27% 낮음. 빈도·시간·속도·총량이 늘어도 추가 이득은 확인되지 않음 → 주 1회도 안 하는 것보다 나음'],
    limit: '관찰 연구라 인과관계는 아님', refs: ['lee2014', 'pedisic2019'] });
}

function recsRun(r, { age }) {
  const c = r.cadence, c5 = Math.round(c * 1.05), c10 = Math.round(c * 1.10), cards = [];
  cards.push(recCard({ title: '케이던스를 5~10% 올릴 때 연구 결과',
    calc: [`${c.toFixed(0)} × 1.05 = <b>${c5}걸음/분</b> (+5%)`, `${c.toFixed(0)} × 1.10 = <b>${c10}걸음/분</b> (+10%)`],
    facts: ['Heiderscheit 2011(취미 러너 45명, 같은 속도): +5%에서 무릎이 흡수하는 에너지 감소, +10%에서 엉덩관절 흡수와 엉덩관절 모음 각도·모멘트도 감소. 한걸음 길이·몸의 위아래 움직임·제동충격량·무릎 굽힘 정점 감소',
      'Neumann 16장(책 p.795): 케이던스 10% 증가 → 디딤기 무릎넙다리관절 힘 정점 14% 감소',
      'Neumann 16장(p.787~788): 느린 케이던스는 충격력을 키우고, 발이 몸 앞쪽 멀리 닿을수록 제동충격량이 커짐'],
    limit: 'Anderson 2022 메타분석: 손상 예방 효과는 아직 근거 부족. 평소보다 올리면 힘든 느낌·에너지 소비가 늘 수 있음(매우 제한된 근거)',
    refs: ['heiderscheit', 'neumann16', 'anderson2022'] }));
  cards.push(recCard({ title: '바꾸는 방법',
    calc: [`1단계 ${c5}걸음/분 → 익숙해지면 ${c10}걸음/분`],
    facts: ['Petri 2026 우산 고찰: 연구들의 주된 방법 = 케이던스 5~10%를 점진적으로 올리고 소리·화면 피드백을 서서히 줄이기',
      'Goss 2025 메타분석(483명): 케이던스 훈련으로 즉시 약 +16걸음/분, 여러 회기 후 약 +12걸음/분 증가',
      'Petri 2026: 무릎넙다리 통증 러너의 단기 통증·기능 개선이 가장 일관된 결과 → 무릎이 아프면 전문가와 상담'],
    limit: '대부분 단기 연구, 장기 효과·예방 효과는 불확실', refs: ['petri2026', 'goss2025'] }));
  if (+age >= 55) cards.push(recCard({ title: '55세 이상 러너가 알아 둘 점',
    facts: ['Neumann 16장(p.792): 55~65세 러너는 20~35세보다 한발짝이 짧고 케이던스가 높음. 충격정점·부하율이 더 크고, 발목 밀어내는 힘이 줄며, 종아리·아킬레스힘줄 손상이 흔함'],
    refs: ['neumann16'] }));
  cards.push(healthRunCard());
  return cards;
}

function weekSlowJogMin(hist) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // 이번 주 월요일
  return hist.filter(h => h.activity === 'slowrun' && new Date(h.date) >= d).reduce((s, h) => s + h.activeS / 60, 0);
}

function renderRun(r, prev) {
  const { age } = store.get('profile', {});
  const c = r.cadence;
  let html = `<h2>러닝 결과</h2>` + r.warnings.map(w => `<div class="warn">${WARN[w]}</div>`).join('');
  html += metric({ title: '케이던스 (분당 걸음 수)', value: c.toFixed(0), unit: '걸음/분', grade: r.warnings.includes('hand') || r.warnings.includes('irregular') ? 'o' : 'y',
    body: `<div class="sub">${prev ? `지난 러닝 ${prev.cadence.toFixed(0)} → ${c >= prev.cadence ? '+' : ''}${(c - prev.cadence).toFixed(0)}` : '러닝 케이던스는 사람·속도마다 달라 기준값 하나로 비교하지 않아요.'}</div>`,
    why: ['걷기 케이던스는 스마트폰 정확도 연구가 있지만(상관 0.997), 주머니 스마트폰의 달리기 케이던스 검증 연구는 아직 찾지 못해 "참고" 등급이에요.',
      'Neumann 16장: 속력이 빨라지면 한걸음 길이와 빈도가 모두 늘고, 일반 장거리 속도(2~5 m/s)에선 주로 한걸음 길이가 늘어요.'],
    refs: ['neumann16', 'shema'] });
  html += metric({ title: '걸음 수', value: r.steps, unit: `걸음 (달린 시간 ${Math.round(r.activeS)}초)`, grade: 'y', why: ['달리기 걸음 수 정확도는 아직 확인 못 함 → "참고"'], refs: [] });
  if (r.speed) {
    const pace = 1000 / r.speed / 60;
    html += metric({ title: '속도·페이스', value: r.speed.toFixed(2), unit: `m/s · 페이스 ${Math.floor(pace)}분 ${String(Math.round((pace % 1) * 60)).padStart(2, '0')}초/km`, grade: r.medAcc > 10 ? 'o' : 'y',
      body: `<div class="sub">GPS 거리 약 ${r.distance.toFixed(0)}m · 위치 오차 약 ${Math.round(r.medAcc)}m</div>`,
      why: ['GPS로 꾸준히 달린 구간의 이동 거리 ÷ 시간. 휴대폰 GPS 오차(보통 수 m) 때문에 "참고"', 'Neumann 16장: 걷기는 보통 2.5 m/s 이하, 달리기는 2.5~10 m/s 이상'], refs: ['neumann16'] });
  } else if (r.gpsError && r.gpsError !== 'noWalk') html += `<div class="sub" style="margin-top:12px">속도는 GPS 조건(야외, 1분·50m 이상)이 안 돼 계산하지 않았어요.</div>`;
  html += recSection(recsRun(r, { age }));
  html += r.diagHtml || '';
  if (r.receipt) html += `<div class="sub" style="margin-top:12px">익명 결과를 보냈어요. 접수번호 <b>${r.receipt}</b></div>`;
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 통증이 있으면 전문가와 상담하세요.</div>`;
  showHtml(html);
}

function renderSlow(r, hist) {
  const wk = weekSlowJogMin(hist);
  let html = `<h2>슬로우 러닝 결과</h2>`;
  html += metric({ title: '조깅 구간 케이던스', value: r.cadence.toFixed(0), unit: `걸음/분 (조깅 ${r.jogCount}구간 평균)`, grade: 'y',
    body: r.walkCadence ? `<div class="sub">걷기 구간 케이던스 ${r.walkCadence.toFixed(0)}걸음/분</div>` : '',
    why: ['1분씩 잘라 조깅 구간은 러닝 방식, 걷기 구간은 걷기 방식으로 계산했어요. 구간마다 앞뒤 2초는 뺐어요.', '달리기 케이던스의 스마트폰 정확도 검증 연구는 아직 못 찾아 "참고"'], refs: ['neumann16'] });
  html += metric({ title: '조깅한 시간', value: (r.activeS / 60).toFixed(1), unit: `분 (걷기 ${(r.walkS / 60).toFixed(1)}분, 전체 ${r.steps}걸음)`, grade: 'y', why: ['센서가 움직임을 찾은 시간만 더했어요.'], refs: [] });
  html += recSection([
    recCard({ title: '슬로우 조깅 연구의 방법과 결과',
      calc: [`이번 주 조깅 ${wk.toFixed(0)}분 / 연구의 주간량 90분 → 남은 <b>${Math.max(0, 90 - wk).toFixed(0)}분</b>`],
      facts: ['Ikenaga 2017 무작위 연구(평균 70.8세, 81명): 걷기 속도의 조깅 1분 + 걷기 1분 반복, 주 90분 조깅 + 90분 걷기를 12주',
        '결과: 무산소역치(지구력) +15.7%(대조군 +4.9%), 앉았다 일어서기 +12.9%(대조군 +4.5%), 허벅지 근육 속 지방 감소'],
      limit: '노인 대상 12주 소규모 연구', refs: ['ikenaga2017'] }),
    healthRunCard()]);
  if (r.receipt) html += `<div class="sub" style="margin-top:12px">익명 결과를 보냈어요. 접수번호 <b>${r.receipt}</b></div>`;
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 가슴 통증·어지럼이 있으면 멈추고 전문가와 상담하세요.</div>`;
  showHtml(html);
}

function showHtml(html) {
  const el = $('result'); el.innerHTML = html;
  el.insertAdjacentHTML('beforeend', glossList(markTerms(el)));
  el.classList.remove('hidden'); el.scrollIntoView({ behavior: 'smooth' });
}

// ── 전문 용어 풀이: 화면에 처음 나오는 용어에 점선 밑줄, 누르면 아래에 쉬운 뜻 ──
const GLOSS = {
  '케이던스': '1분 동안 걷거나 달린 걸음 수예요. 발이 땅에 닿는 횟수를 세요.',
  'MET': '대사당량. 가만히 앉아 쉴 때 쓰는 에너지를 1로 본 운동 강도 단위예요. 3 MET는 쉴 때의 약 3배 에너지를 써요.',
  '중강도': '숨이 조금 차지만 대화는 할 수 있는 정도의 운동 강도예요(약 3~6 MET 미만).',
  '고강도': '숨이 차서 말을 길게 하기 어려운 정도의 운동 강도예요(약 6 MET 이상).',
  '저강도': '숨이 거의 차지 않는 가벼운 운동 강도예요(3 MET 미만).',
  '걸음 길이': '한 발이 닿은 곳에서 반대 발이 닿은 곳까지의 거리예요.',
  '한걸음 길이': '같은 발이 다시 땅에 닿을 때까지 간 거리예요(두 걸음).',
  '한발짝': '한 발이 닿은 뒤 반대 발이 닿을 때까지의 한 걸음이에요.',
  'walk ratio': '걸음 길이(m)를 케이던스(걸음/분)로 나눈 값이에요. Neumann 책은 이 값이 일정할 때 에너지 효율이 좋다고 해요.',
  '페이스': '1km를 가는 데 걸리는 시간이에요(예: 6분 30초/km).',
  'GPS': '위성 신호로 휴대폰 위치를 찾는 기능이에요. 위치가 보통 몇 m씩 어긋나요.',
  '디딤기': '발이 땅에 닿아 있는 동안이에요.',
  '흔들기': '발이 땅에서 떨어져 공중에 있는 동안이에요.',
  '제동충격량': '발이 땅에 닿을 때 몸을 뒤로 잡아끄는 브레이크 힘이 쌓인 양(힘 × 시간)이에요.',
  '충격정점': '발이 땅에 닿는 순간 땅이 몸을 밀어 올리는 첫 번째 큰 힘이에요.',
  '충격력': '발이 땅에 닿을 때 몸에 전해지는 힘이에요.',
  '부하율': '착지할 때 힘이 얼마나 빨리 커지는지예요.',
  '무릎넙다리관절': '무릎뼈(슬개골)와 허벅지뼈가 맞닿는 무릎 앞쪽 관절이에요.',
  '무릎넙다리': '무릎뼈(슬개골)와 허벅지뼈가 맞닿는 무릎 앞쪽 부분이에요. 이곳 통증은 러너에게 흔해요.',
  '엉덩관절 모음': '허벅지가 몸 안쪽(가운데)으로 모이는 움직임이에요.',
  '엉덩관절': '골반과 허벅지뼈가 만나는 관절(고관절)이에요.',
  '모멘트': '관절을 돌리려는 힘(회전력)이에요.',
  '무릎 굽힘 정점': '발을 디딜 때 무릎이 가장 많이 굽혀지는 각도예요.',
  '에너지 흡수': '착지 충격을 근육이 받아내며 쓰는 일의 양이에요.',
  '아킬레스힘줄': '종아리 근육과 발뒤꿈치뼈를 잇는 굵은 힘줄이에요.',
  '무산소역치': '운동을 점점 세게 할 때 피로 물질(젖산)이 빠르게 쌓이기 시작하는 지점이에요. 지구력을 보는 지표예요.',
  '앉았다 일어서기': '의자에서 정해진 시간 동안 일어섰다 앉는 횟수로 다리 힘을 보는 검사예요.',
  '근육 속 지방': '근육 사이나 안쪽에 끼어 있는 지방이에요.',
  '대조군': '비교하려고 프로그램을 하지 않은 사람들이에요.',
  '메타분석': '같은 주제의 여러 연구 결과를 모아 통계로 합친 분석이에요.',
  '체계적 고찰': '정해진 방법으로 관련 연구를 빠짐없이 찾아 정리한 연구예요.',
  '우산 고찰': '체계적 고찰 여러 편을 다시 모아 정리한 연구예요.',
  '무작위 연구': '참가자를 제비뽑기처럼 무작위로 나눠 효과를 비교한 연구예요. 원인과 결과를 보기에 좋아요.',
  '관찰 연구': '사람들의 생활을 지켜보며 관계만 본 연구예요. 무엇이 원인인지 단정할 수는 없어요.',
  '인과관계': '하나가 다른 하나의 원인이라는 관계예요.',
  '연관성': '함께 나타나는 관계예요. 원인이라는 뜻은 아니에요.',
  '지침': '전문 학회나 기관이 연구를 바탕으로 만든 권고예요.',
  '낙상': '넘어짐을 말해요.',
  '오차': '측정한 값과 실제 값의 차이예요.',
  '정확도 등급': '이 앱이 보여 주는 값이 얼마나 믿을 만한지 연구를 바탕으로 4단계로 나눈 표시예요.',
};
const GLOSS_KEYS = Object.keys(GLOSS).sort((a, b) => b.length - a.length);   // 긴 용어부터 (무릎넙다리관절 > 무릎넙다리)
const SKIP_TAGS = new Set(['SELECT', 'OPTION', 'BUTTON', 'SCRIPT', 'STYLE', 'SUMMARY', 'INPUT', 'TEXTAREA']);
// root 안의 글자에서 각 용어의 첫 번째만 밑줄. 쓰인 용어 목록을 돌려줌
function markTerms(root) {
  const used = [];
  for (const term of GLOSS_KEYS) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        for (let e = n.parentElement; e && e !== root; e = e.parentElement) if (SKIP_TAGS.has(e.tagName) || e.classList.contains('term') || e.classList.contains('gloss')) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.includes(term) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      } });
    const node = walker.nextNode();
    if (!node) continue;
    const i = node.nodeValue.indexOf(term), after = node.splitText(i);
    after.splitText(term.length);
    const span = document.createElement('span');
    span.className = 'term'; span.tabIndex = 0; span.textContent = term;
    after.replaceWith(span);
    used.push(term);
  }
  return used;
}
function glossList(terms) {
  if (!terms.length) return '';
  return `<details class="gloss"><summary>📖 용어 풀이 (${terms.length}개)</summary><dl>${terms.map(t => `<dt>${t}</dt><dd>${GLOSS[t]}</dd>`).join('')}</dl></details>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('.term');
  if (!t) return $('tip').classList.add('hidden');
  $('tip').innerHTML = `<b>${t.textContent}</b> — ${GLOSS[t.textContent] ?? ''}<div class="sub" style="margin-top:6px">화면을 누르면 닫혀요</div>`;
  $('tip').classList.remove('hidden');
});
for (const id of ['setup', 'about', 'consent', 'profile']) markTerms($(id));


function renderHistory() {
  const hist = store.get('history', []);
  if (!hist.length) return;
  $('histBody').innerHTML = `<table class="hist"><tr><td>날짜</td><td>활동</td><td>케이던스</td><td>걸음</td><td>속도</td></tr>` +
    hist.slice(0, 20).map(h => `<tr><td>${new Date(h.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${h.practice ? ' (연습)' : ''}${h.receipt ? `<br><span class="sub">접수 ${h.receipt}</span>` : ''}</td>
      <td>${ACT[h.activity ?? 'walk']}</td><td>${h.cadence.toFixed(0)}</td><td>${h.steps}</td><td>${h.speed ? h.speed.toFixed(2) + ' m/s' : '-'}</td></tr>`).join('') + '</table>';
}
renderHistory();

// ── 데모 (주소 끝에 ?demo=1): 휴대폰 없이 화면 확인용 가짜 신호 ──
if (new URLSearchParams(location.search).has('demo')) {
  $('demo').classList.remove('hidden');
  $('demo').addEventListener('click', () => {
    // 걷기 108, 러닝 165, 슬로우 러닝은 1분마다 조깅 165 / 걷기 110을 번갈아
    const act = $('act').value, walkS = act === 'slowrun' ? 240 : 75, s = [], g = [];
    const cadAt = t => act === 'walk' ? 108 : act === 'run' ? 165 : (Math.floor(t / 60) % 2 ? 110 : 165);
    let kk = 0;
    for (let i = 0; i < (walkS + 6) * 60; i++) {
      const t = i / 60, walking = t > 3 && t < 3 + walkS;
      if (walking) kk += cadAt(t - 3) / 60 / 60;
      const k = kk;
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
