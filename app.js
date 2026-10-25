import { analyzeWalk, withDistance, gpsSpeed } from './gait.js';
import { analyzeSide, analyzeFrontal, extractPose, drawSnapshot } from './video.js';

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
  perry9: 'Perry J. Gait Analysis. 1992, 9장(다리 전체 기능: 단계별 관절 각도)',
  perry17: 'Perry J. Gait Analysis. 1992, 17장(동작 분석: 카메라 1대의 한계)',
  russo2026: 'Russo M 외. Estimation of the Knee Joint with Single-Camera Smartphone. Sensors 2026. doi:10.3390/s26072148',
  cheng2025: 'Cheng X 외. Reliability and validity of computer vision based motion capture systems in gait analysis: systematic review. Gait Posture 2025. doi:10.1016/j.gaitpost.2025.04.016',
  wegner2026: 'Wegner M 외. 2D video-based pose estimation app vs markerless 3D motion capture in knee osteoarthritis. Front Bioeng Biotechnol 2026. doi:10.3389/fbioe.2026.1869878',
  ikenaga2017: 'Ikenaga M 외. Short-interval, intermittent, low-intensity, slow-jogging program in older adults: RCT. Eur J Appl Physiol 2017. doi:10.1007/s00421-016-3493-9',
};
const ACT = { walk: '걷기', run: '러닝', slowrun: '슬로우 러닝', video: '영상' };
const VIEW = { side: '옆', front: '앞', back: '뒤' };
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
const under14 = age => +age > 0 && +age < 14;
const ageNote = () => $('ageNote').classList.toggle('hidden', !under14($('age').value));
for (const id of ['sex', 'age']) $(id).addEventListener('change', () => {
  store.set('profile', { sex: $('sex').value, age: $('age').value }); ageNote();
});
ageNote();

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
  }
  document.body.classList.add('recording');                                 // 측정 중엔 탭 막대를 숨겨 다른 화면으로 못 넘어가게 (앱도 같이)
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
  const ran = t0; clearInterval(timer); t0 = 0;
  document.body.classList.remove('recording');
  if (Native) {
    $('rec').classList.add('hidden'); $('setup').classList.remove('hidden');
    if (!ran) return;                                                       // 카운트다운 중에 끝 → 측정이 시작 안 돼서 지난번 센서 값이 다시 나오지 않게
    let r;
    try { r = await Native.stop(); } catch { return alert('측정을 끝내지 못했어요. 앱을 껐다 켜고 다시 해 주세요.'); }
    if (r.samples.length < 20) return alert('센서 값이 거의 들어오지 않았어요. 다시 시도해 주세요.');
    return finish(r.samples, false, r.gps);
  }
  wakeLock?.release().catch(() => {}); wakeLock = null;
  window.removeEventListener('devicemotion', onMotion);
  stopGps();
  $('rec').classList.add('hidden'); $('setup').classList.remove('hidden');
  if (samples.length < 20) return alert('센서 값이 거의 들어오지 않았어요. 다시 시도해 주세요.');
  finish(samples, false, gpsPts);
}

function finish(data, demo = false, gps = []) {
  shownDate = null;
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
  shownDate = rec.date;
  const prev = hist.find(h => !h.practice && h !== rec && (h.activity ?? 'walk') === act);
  act === 'run' ? renderRun(rec, prev) : render(rec, prev);
  renderHistory();
}

// ── 슬로우 러닝: 1분 단위로 잘라 조깅 구간은 러닝, 걷기 구간은 걷기로 분석 ──
function finishSlow(data, demo) {
  shownDate = null;
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
  shownDate = rec.date;
  renderSlow(rec, hist);
  renderHistory();
}

// ── 익명 결과 보내기 (선택 동의 2개를 모두 한 사람만) ──
// 구글 Apps Script 웹앱 주소. 비어 있으면 아무것도 보내지 않음 (설정법: apps_script.gs)
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwLfXvMoqIPDkmemDjQ5oJWhaDDKboetKlxkU603xABxQqTPjzvr1hN3Iyhb9km3OCb/exec';
function send(r) {
  const { sex, age } = store.get('profile', {});
  if (under14(age)) return null;                                           // 개인정보 보호법 제22조의2: 만 14세 미만은 법정대리인 동의가 필요해서 보내지 않음
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
const APP_VERSION = 'v31';
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
  return `<div class="rec"><div class="mhead"><b>${title}</b><span class="badge ${cls}">${label}</span></div>
    ${calc.length ? `<div class="calc">${calc.join('<br>')}</div>` : ''}
    <ul class="facts">${facts.map(f => `<li>${f}</li>`).join('')}</ul>
    ${limit ? `<div class="sub">한계: ${limit}</div>` : ''}
    <details><summary>출처 전체</summary><ul>${refs.map(r => `<li>${REF[r]}</li>`).join('')}</ul></details></div>`;
}
const recSection = (cards, title = '근거로 본 추천') => cards.length ? `<details class="recs"><summary>${title} <span class="sub">(눌러서 보기)</span></summary><div class="sub" style="margin-top:8px">책·연구의 기준값과 이번 값, 계산식만 옮겼어요. 원인 판단과 내 몸에 맞는지는 전문가와 상의하세요.</div>${cards.join('')}</details>` : '';

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


// ── 그때 상황 남기기: 글자 입력 없이 탭으로 (기록에만 저장, 시트로 보내지 않음) ──
const CTX = {
  cond: ['컨디션', ['좋음', '보통', '피곤', '통증 있음']],
  road: ['길', ['평지', '오르막', '내리막', '트레드밀']],
  shoe: ['신발', ['운동화', '구두·샌들', '맨발·기타']],
};
let shownDate = null;   // 지금 결과 화면에 떠 있는 기록의 날짜 (이걸로 기록을 찾음)
function ctxBox(date) {
  const h = store.get('history', []).find(x => x.date === date);
  if (!h) return '';
  const c = h.ctx || {};
  return `<div class="ctx" data-date="${date}"><div class="sub" style="margin-bottom:6px">그때 상황 남기기 <span style="opacity:.7">(선택 · 누르기만 하면 저장돼요)</span></div>
    ${Object.entries(CTX).map(([k, [name, opts]]) => `<div class="ctxrow"><span class="ctxk">${name}</span>${opts.map(o => `<button class="chip" data-k="${k}" data-v="${o}" aria-pressed="${c[k] === o}">${o}</button>`).join('')}</div>`).join('')}
    <div class="sub" style="margin-top:4px;font-size:.75rem">Neumann 16장: 오르막·내리막에 따라 착지 충격이 달라져서, 길 종류를 남겨 두면 기록을 비교할 때 도움이 돼요.</div></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest?.('.ctx .chip');
  if (!b) return;
  const box = b.closest('.ctx'), hist = store.get('history', []), h = hist.find(x => x.date === box.dataset.date);
  if (!h) return;
  h.ctx = h.ctx || {};
  h.ctx[b.dataset.k] = h.ctx[b.dataset.k] === b.dataset.v ? undefined : b.dataset.v;   // 같은 걸 다시 누르면 지움
  store.set('history', hist);
  for (const x of box.querySelectorAll(`.chip[data-k="${b.dataset.k}"]`)) x.setAttribute('aria-pressed', h.ctx[b.dataset.k] === x.dataset.v);
  renderHistory();
});
const ctxText = c => c ? Object.keys(CTX).map(k => c[k]).filter(Boolean).join(' · ') : '';

// ── 결과 카드 공유: 내가 고른 결과만 이미지로 만들어 카톡·인스타 등으로 (서버 없음) ──
const APP_URL = 'ldj000103-del.github.io/gait-app';
function cardRows(h) {
  const { sex, age } = store.get('profile', {});
  const norm = sex === 'm' ? 111 : sex === 'f' ? 117 : 113, lo = norm * 0.9, hi = norm * 1.1;
  const f = (x, d = 0) => x == null || Number.isNaN(x) ? null : x.toFixed(d);
  const vs = (a, ref, w) => a == null || Number.isNaN(a) ? '' : hint(a - ref, w);
  const act = h.activity ?? 'walk', rows = [];
  const push = (k, v, u, n) => { if (v != null) rows.push(u === '°' ? { k, v: v + '°', u: '', n } : { k, v, u, n }); };   // 도(°)는 숫자에 붙임
  if (act === 'walk') {
    const c = h.cadence, older = +age >= 61;
    push('케이던스', f(c), '걸음/분', `Perry 성인 평균 ${norm}(±10% ${lo.toFixed(0)}–${hi.toFixed(0)}) · ${c < lo ? '기준 범위보다 낮은 값' : c > hi ? '기준 범위보다 높은 값' : '기준 범위 안'}`);
    const level = older ? (c >= 120 ? '약 5 MET' : c >= 110 ? '약 4 MET' : c >= 100 ? '중강도(3 MET)' : '저강도') : (c >= 130 ? '고강도(6 MET)' : c >= 100 ? '중강도(3 MET)' : '저강도');
    push('걷기 강도', level, '', older ? 'CADENCE-Adults 61세 이상 기준: 100 = 중강도' : 'CADENCE-Adults 기준: 100걸음/분 = 중강도, 130 = 고강도');
    if (h.speed) push('걷는 속도', f(h.speed, 2), 'm/s', `Perry 성인 평균 1.37 · 차이 ${h.speed - 1.37 >= 0 ? '+' : ''}${(h.speed - 1.37).toFixed(2)}`);
    if (h.stepLength && sex) { const ideal = (sex === 'f' ? 0.0064 : 0.0072) * c * 100; push('걸음 길이', f(h.stepLength * 100), 'cm', `Neumann 효율 최적 약 ${ideal.toFixed(0)}cm (${vs(h.stepLength * 100, ideal, ['더 길게 디뎌도 됨', '더 짧게 디뎌도 됨'])})`); }
    push('걸음 수', String(h.steps), '걸음', `걷는 시간 ${Math.round(h.activeS)}초`);
  } else if (act === 'run') {
    push('러닝 케이던스', f(h.cadence), '걸음/분', `+5% = ${Math.round(h.cadence * 1.05)}, +10% = ${Math.round(h.cadence * 1.1)} (Heiderscheit 2011·Neumann 16장 연구 범위)`);
    if (h.speed) { const pace = 1000 / h.speed / 60; push('페이스', `${Math.floor(pace)}'${String(Math.round((pace % 1) * 60)).padStart(2, '0')}"`, '/km', `속도 ${f(h.speed, 2)} m/s · GPS로 잰 참고값`); }
    push('걸음 수', String(h.steps), '걸음', `달린 시간 ${Math.round(h.activeS)}초`);
  } else if (act === 'slowrun') {
    push('조깅 케이던스', f(h.cadence), '걸음/분', h.walkCadence ? `걷기 구간 ${f(h.walkCadence)}걸음/분` : '조깅 1분 + 걷기 1분');
    push('조깅한 시간', f(h.activeS / 60, 1), '분', `걷기 ${f(h.walkS / 60, 1)}분`);
    const wk = weekSlowJogMin(store.get('history', []));
    push('이번 주 조깅', f(wk), '분', `Ikenaga 2017 연구의 주간량 90분 중 ${Math.round(Math.min(1, wk / 90) * 100)}%`);
  } else if (h.view === 'side') {
    const m = h.r.m;
    push('유각기 무릎 굽힘', f(m.kneeSwingMax), '°', `Perry 약 60° · ${vs(m.kneeSwingMax, 60, BEND)} — 발끝이 바닥에 걸리지 않게 하는 굽힘`);
    push('체중 받기 무릎 굽힘', f(m.kneeLoad), '°', `Perry 15~18° · ${vs(m.kneeLoad, 16, BEND)} — 충격 흡수`);
    push('입각기 무릎 폄', f(m.kneeStanceMin), '°', `Perry 약 5° · ${vs(m.kneeStanceMin, 5, ['덜 펴도 됨', '더 펴야 함'])}`);
    push('넓적다리 뒤로 젖힘', f(m.thighExt), '°', `Perry 약 20° · ${vs(m.thighExt, 20, ['더 뒤로 젖혀야 함', '덜 젖혀도 됨'])} — 한걸음 길이`);
  } else {
    const m = h.r.m, d0 = x => f(x) ?? '-';
    const lrp = (a, b) => { if (a == null || b == null) return ''; const d = Math.abs(a - b); return `좌우 차이 ${d.toFixed(0)}° (${d <= 4 ? '비슷함' : d > 10 ? '많이 남' : '조금 남'})`; };
    push('골반 내려감 (반대쪽)', `${d0(m.dropL)}° / ${d0(m.dropR)}°`, '왼발/오른발', `Perry 약 4° · 왼발 ${vs(m.dropL, 4, ['덜 내려가는 편', '덜 내려가야 함'])}, 오른발 ${vs(m.dropR, 4, ['덜 내려가는 편', '덜 내려가야 함'])}`);
    push('무릎 안쪽 모임', `${d0(m.valgusL)}° / ${d0(m.valgusR)}°`, '왼/오른', `${lrp(m.valgusL, m.valgusR)} · 영상 기준값 없음`);
    push('몸통 옆 기울기', `${d0(m.leanL)}° / ${d0(m.leanR)}°`, '왼쪽/오른쪽', lrp(m.leanL, m.leanR));
    if (m.width != null) push('걸음 폭', f(m.width, 2), '× 골반 너비', 'Neumann 성인 걸음 폭 8~10cm (영상엔 cm 기준이 없어 비율로)');
  }
  return rows;
}

// 1080×1350 카드 그리기: rows = [{k, v, u, n}], chart = { h, draw(g, x, y, w, h, F) } (선택)
async function drawCard(title, label, rows, chart) {
  await Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 1500))]);
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), F = (w, px) => `${w} ${px}px "Pretendard Variable", Pretendard, sans-serif`;
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2a9d84'); bg.addColorStop(1, '#1d6b5c');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // 아이콘 불러오기가 늦거나 실패해도 카드는 만들어지게 (최대 2초 기다림)
  const icon = await new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = 'icon-512.png'; setTimeout(() => ok(im.complete && im.naturalWidth ? im : null), 2000); });
  if (icon) g.drawImage(icon, 64, 56, 96, 96);
  g.fillStyle = '#fff'; g.font = F(700, 44); g.fillText(title, 184, 104);
  g.globalAlpha = .85; g.font = F(500, 28); g.fillText(label, 184, 144); g.globalAlpha = 1;

  // 흰 카드 + 줄마다 항목 / 큰 숫자 / 기준·풀이
  const x0 = 56, y0 = 196, w0 = W - 112, h0 = 1040, chartH = chart?.h ?? 0, rowH = (h0 - chartH - 40) / Math.max(rows.length, 1);
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x0, y0, w0, h0, 40); g.fill();
  const wrap = (text, maxW) => {                                          // 기준·풀이 문장이 길면 두 줄로
    const words = text.split(' '), lines = ['']; for (const wd of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + wd : wd; if (g.measureText(t).width > maxW && lines[lines.length - 1]) lines.push(wd); else lines[lines.length - 1] = t; } return lines.slice(0, 2);
  };
  rows.forEach((r, i) => {
    const y = y0 + 24 + rowH * i;
    if (i) { g.fillStyle = '#e6eae8'; g.fillRect(x0 + 48, y, w0 - 96, 2); }
    g.fillStyle = '#69736f'; g.font = F(500, 28); g.fillText(r.k, x0 + 52, y + 46);
    const big = r.v.length > 9 ? 52 : 68;
    g.fillStyle = '#121816'; g.font = F(700, big); g.fillText(r.v, x0 + 50, y + 46 + big + 6);
    const vw = g.measureText(r.v).width;
    g.fillStyle = '#69736f'; g.font = F(500, 26); g.fillText(r.u, x0 + 62 + vw, y + 46 + big + 6);
    g.font = F(400, 25);
    wrap(r.n || '', w0 - 104).forEach((ln, j) => g.fillText(ln, x0 + 52, y + 46 + big + 46 + j * 32));
  });
  if (chart) chart.draw(g, x0 + 52, y0 + h0 - chartH - 10, w0 - 104, chartH, F);
  g.fillStyle = '#fff'; g.globalAlpha = .85; g.font = F(400, 26);
  g.fillText(`${APP_URL} · 책·논문 기준과 비교한 참고값이에요 · 의료 진단이 아니에요`, 60, 1300); g.globalAlpha = 1;
  return c;
}
function makeCard(h) {
  const act = h.activity ?? 'walk', what = act === 'video' ? `영상 분석 · ${VIEW[h.view]}모습` : ACT[act];
  const label = `${what} · ${new Date(h.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}${h.ctx && ctxText(h.ctx) ? ' · ' + ctxText(h.ctx) : ''}`;
  const knee = act === 'video' && h.view === 'side' && h.r?.curves?.knee;
  return drawCard('걸음 분석 결과', label, cardRows(h), knee && { h: 250, draw: (g, cx, cy, cw, chartH, F) => {   // 무릎 굽힘 곡선: 이번 영상 vs Perry 기준점
    const ch = chartH - 70, X = q => cx + cw * q / 100, Y = d => cy + 40 + ch * (1 - d / 70);
    g.fillStyle = '#69736f'; g.font = F(500, 26); g.fillText('무릎 굽힘 곡선 (보행 주기 0~100%)', cx, cy + 22);
    g.strokeStyle = '#e6eae8'; g.lineWidth = 2; for (const d of [0, 30, 60]) { g.beginPath(); g.moveTo(cx, Y(d)); g.lineTo(cx + cw, Y(d)); g.stroke(); }
    g.setLineDash([12, 10]); g.strokeStyle = '#9aa5a1'; g.lineWidth = 4; g.beginPath();
    [[0, 5], [15, 18], [40, 5], [62, 40], [73, 60], [85, 30], [97, 2], [100, 5]].forEach(([q, d], k) => k ? g.lineTo(X(q), Y(d)) : g.moveTo(X(q), Y(d))); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#008a6e'; g.lineWidth = 6; g.beginPath(); knee.forEach((d, q) => q ? g.lineTo(X(q), Y(d)) : g.moveTo(X(q), Y(d))); g.stroke();
    g.font = F(400, 22); g.fillStyle = '#008a6e'; g.fillText('이번 영상', cx + cw - 250, cy + 22); g.fillStyle = '#9aa5a1'; g.fillText('- - Perry 기준', cx + cw - 130, cy + 22);
  } });
}
async function shareCanvas(canvas, text) {
  const dataUrl = canvas.toDataURL('image/png');
  const P = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null;
  try {
    if (P?.Share && P?.Filesystem) {                                    // 설치형 앱: 파일로 저장해서 안드로이드 공유 창
      const { uri } = await P.Filesystem.writeFile({ path: `gait-card-${Date.now()}.png`, data: dataUrl.split(',')[1], directory: 'CACHE' });
      await P.Share.share({ title: '걸음 분석', text, files: [uri] });
      return;
    }
    const blob = await (await fetch(dataUrl)).blob(), file = new File([blob], 'gait-card.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '걸음 분석', text }); return; }
  } catch (e) { if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return; }
  const a = document.createElement('a'); a.href = dataUrl; a.download = 'gait-card.png'; a.click();   // 공유가 안 되면 이미지 내려받기
}
async function shareRecord(date) {
  const h = store.get('history', []).find(x => x.date === date);
  if (h) shareCanvas(await makeCard(h), `걸음 분석으로 잰 내 걸음 · https://${APP_URL}/`);
}
document.addEventListener('click', e => { const b = e.target.closest?.('.sharebtn'); if (b) shareRecord(b.dataset.date); });
// 친구에게 설치 안내 링크 보내기 (카톡은 apk 파일을 막아서 링크로)
$('invite').addEventListener('click', async () => {
  const url = `https://${APP_URL}/install.html`, text = `걸음 분석 앱: 걸음을 재고 결과마다 책·논문 근거를 보여 줘요. 설치 안내 👉 ${url}`;
  const P = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null;
  try {
    if (P?.Share) return await P.Share.share({ title: '걸음 분석', text });     // 링크는 text 안에 있음 (url도 넘기면 카톡에 두 번 붙음)
    if (navigator.share) return await navigator.share({ title: '걸음 분석', text });
  } catch (e) { if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return; }
  try { await navigator.clipboard.writeText(text); alert('설치 안내 링크를 복사했어요. 카톡에 붙여 넣어 보내세요.'); }
  catch { prompt('이 링크를 복사해 보내세요', url); }
});
const shareBtn = date => `<button class="ghost sharebtn" data-date="${date}" style="margin:4px 0 10px">결과 카드 공유하기</button>`;

function showHtml(html) {
  const el = $('result'); el.innerHTML = html;
  if (shownDate) el.querySelector('h2')?.insertAdjacentHTML('afterend', shareBtn(shownDate) + ctxBox(shownDate));
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
  '보행 주기': '한 발이 땅에 닿은 뒤 같은 발이 다시 닿을 때까지의 한 번의 걸음 동작(두 걸음)이에요. 0~100%로 나눠 봐요.',
  '첫 닿기': '발이 땅에 처음 닿는 순간이에요(보행 주기 0%).',
  '체중 받기': '발이 닿은 직후 몸무게가 그 다리로 실리는 구간이에요(보행 주기 0~10%).',
  '입각기': '발이 땅에 닿아 몸을 받치는 구간이에요(보행 주기 약 0~60%).',
  '유각기': '발이 땅에서 떨어져 앞으로 나가는 구간이에요(보행 주기 약 60~100%).',
  '넓적다리 각도': '허벅지가 수직선에서 앞(굽힘)이나 뒤(폄)로 기운 각도예요. Perry는 골반 움직임이 섞이지 않는 이 각도를 임상에서 더 쓸모 있다고 해요.',
  '발등굽힘': '발끝이 정강이 쪽으로 올라가는 발목 움직임이에요.',
  '발바닥굽힘': '발끝이 아래로 내려가는 발목 움직임이에요(까치발 방향).',
  '골반 내려감': '한 발로 디딜 때 반대쪽 골반이 아래로 처지는 정도예요.',
  '무릎 안쪽 모임': '앞이나 뒤에서 볼 때 무릎이 엉덩이-발목을 잇는 선보다 몸 안쪽으로 들어간 정도예요.',
  '자세 인식': '영상 속 사람의 어깨·엉덩이·무릎·발목 위치를 AI가 찾아내는 기술이에요.',
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
        for (let e = n.parentElement; e && e !== root; e = e.parentElement) if (SKIP_TAGS.has(e.tagName) || e instanceof SVGElement || e.classList.contains('term') || e.classList.contains('gloss')) return NodeFilter.FILTER_REJECT;
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
  return `<details class="gloss"><summary>용어 풀이 (${terms.length}개)</summary><dl>${terms.map(t => `<dt>${t}</dt><dd>${GLOSS[t]}</dd>`).join('')}</dl></details>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('.term');
  if (!t) return $('tip').classList.add('hidden');
  $('tip').innerHTML = `<b>${t.textContent}</b> — ${GLOSS[t.textContent] ?? ''}<div class="sub" style="margin-top:6px">화면을 누르면 닫혀요</div>`;
  $('tip').classList.remove('hidden');
});
for (const id of ['setup', 'vsetup', 'about', 'consent', 'profile']) markTerms($(id));


function renderHistory() {
  const hist = store.get('history', []);
  if (homeReady && document.body.dataset.tab === 'home') renderHome();   // 홈 코드가 다 읽힌 뒤에만
  if (!hist.length) return;
  $('histBody').innerHTML = `<div class="sub">줄을 누르면 그때 결과를 다시 볼 수 있어요.</div><table class="hist"><tr><td>날짜</td><td>활동</td><td>케이던스</td><td>걸음</td><td>속도</td></tr>` +
    hist.slice(0, 20).map((h, i) => `<tr data-i="${i}" class="clickable"><td>${new Date(h.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${h.practice ? ' (연습)' : ''}${h.receipt ? `<br><span class="sub">접수 ${h.receipt}</span>` : ''}${h.ctx && ctxText(h.ctx) ? `<br><span class="sub">${ctxText(h.ctx)}</span>` : ''}</td>
      <td>${ACT[h.activity ?? 'walk']}${h.view ? `(${VIEW[h.view]})` : ''}</td><td>${(h.cadence ?? h.r?.cadence)?.toFixed(0) ?? '-'}</td><td>${h.steps ?? '-'}</td><td>${h.speed ? h.speed.toFixed(2) + ' m/s' : '-'}</td></tr>`).join('') + '</table>';
}
renderHistory();

// ── 아래 탭 ──
var homeReady = false;   // var: 위쪽 renderHistory가 먼저 불려도 오류 없이 false로 보임
function setTab(name) {
  document.body.dataset.tab = name;
  for (const b of document.querySelectorAll('#tabbar button')) b.setAttribute('aria-selected', b.dataset.go === name);
  if (name === 'home') renderHome();
}
document.querySelector('#tabbar').addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if (b) { setTab(b.dataset.go); scrollTo(0, 0); } });

// ── 홈: 요약 카드 · 이번 주 슬로우 조깅 링 · 변화 그래프 ──
const shortDate = d => new Date(d).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
function tile(label, value, unit, sub, i) {
  if (value == null) return `<div class="tile empty"><div class="k">${label}</div><div class="v">기록 없음</div><div class="d">${sub}</div></div>`;
  return `<button class="tile" data-i="${i}"><div class="k">${label}</div><div class="v">${value}<small> ${unit}</small></div><div class="d">${sub}</div></button>`;
}

// 주간 통계: 고른 주(월~일) vs 그 전 주, 점수 없이 숫자와 차이만
const dayKey = d => new Date(d).toLocaleDateString('sv-SE');                 // 2026-10-25 (휴대폰 시간 기준)
const monOf = d => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
const avgOf = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
const inRange = (hist, a, b) => hist.filter(h => { const t = new Date(h.date); return !h.practice && t >= a && t < b; });
function statOf(list) {
  const walk = list.filter(h => (h.activity ?? 'walk') === 'walk');
  return { n: list.length, days: new Set(list.map(h => dayKey(h.date))).size, walkCad: avgOf(walk.map(h => h.cadence)), speed: avgOf(walk.filter(h => h.speed).map(h => h.speed)),
    runCad: avgOf(list.filter(h => h.activity === 'run').map(h => h.cadence)),
    jog: list.filter(h => h.activity === 'slowrun').reduce((s, h) => s + h.activeS / 60, 0), video: list.filter(h => h.activity === 'video').length };
}
function weekSummary(hist, mon = monOf(new Date())) {
  const next = new Date(mon); next.setDate(mon.getDate() + 7);
  const prevMon = new Date(mon); prevMon.setDate(mon.getDate() - 7);
  return { cur: statOf(inRange(hist, mon, next)), prev: statOf(inRange(hist, prevMon, mon)) };
}
// 기록 달력: 날짜마다 활동 종류별 점, 누르면 그날 기록 + 그 주 통계
const ACT_C = { walk: 'var(--c-walk)', run: 'var(--c-run)', slowrun: 'var(--c-slow)', video: 'var(--c-video)' };
let calMonth = new Date(); calMonth.setDate(1); let calSel = dayKey(new Date());
function renderWeek() {
  const hist = store.get('history', []), byDay = {};
  hist.forEach((h, i) => (byDay[dayKey(h.date)] ??= []).push(i));
  const y = calMonth.getFullYear(), mo = calMonth.getMonth(), end = new Date(y, mo + 1, 1), today = dayKey(new Date());
  let cells = '';
  for (let d = monOf(new Date(y, mo, 1)); d < end || d.getDay() !== 1; d.setDate(d.getDate() + 1)) {   // 월요일부터, 마지막 주는 일요일까지 채움
    const k = dayKey(d), list = byDay[k] ?? [], acts = [...new Set(list.map(i => hist[i].activity ?? 'walk'))];
    cells += `<button class="cday${d.getMonth() !== mo ? ' out' : ''}${k === today ? ' today' : ''}${k === calSel ? ' sel' : ''}" data-d="${k}"
      aria-label="${d.getMonth() + 1}월 ${d.getDate()}일 기록 ${list.length}개"><span>${d.getDate()}</span><i>${acts.map(a => `<b style="background:${ACT_C[a]}"></b>`).join('')}</i></button>`;
  }
  // 고른 날의 기록
  const sel = new Date(calSel + 'T00:00'), selList = byDay[calSel] ?? [];
  const val = h => h.activity === 'video' ? `${VIEW[h.view]}모습 영상` : h.cadence != null ? `${h.cadence.toFixed(0)} 걸음/분` : '';
  const recs = selList.length ? selList.map(i => { const h = hist[i];
      return `<button class="dayrec" data-i="${i}"><span>${ACT[h.activity ?? 'walk']}${h.practice ? ' <span class="sub">(연습)</span>' : ''}</span>
        <span>${val(h)} <span class="sub">${new Date(h.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} ›</span></span></button>`; }).join('')
    : '<div class="sub" style="margin-top:6px">이날은 기록이 없어요.</div>';
  // 고른 날이 속한 주의 통계
  const mon = monOf(sel), sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const { cur, prev } = weekSummary(hist, mon);
  const row = (label, a, b, unit, dec = 0) => {
    const v = a == null ? '-' : `${a.toFixed(dec)}<small> ${unit}</small>`;
    const d = a != null && b != null ? `${a - b >= 0 ? '+' : ''}${(a - b).toFixed(dec)}` : '-';
    return `<tr><td>${label}</td><td class="num">${v}</td><td class="num sub">${d}</td></tr>`;
  };
  const thisWeek = dayKey(mon) === dayKey(monOf(new Date()));
  $('week').innerHTML = `<div class="calhead"><button data-m="-1" aria-label="지난달">‹</button><span>${y}년 ${mo + 1}월</span><button data-m="1" aria-label="다음 달">›</button></div>
    <div class="cal">${['월', '화', '수', '목', '금', '토', '일'].map(w => `<div class="dow">${w}</div>`).join('')}${cells}</div>
    <div class="legend">${Object.entries(ACT_C).map(([a, c]) => `<span><b style="background:${c}"></b>${ACT[a]}</span>`).join('')}</div>
    <div class="calsec">${sel.getMonth() + 1}월 ${sel.getDate()}일 기록</div>${recs}
    <div class="calsec">${thisWeek ? '이번 주' : `${shortDate(mon)}~${shortDate(sun)} 주`} 통계</div>
    <table class="wk"><tr class="sub"><td></td><td class="num">${thisWeek ? '이번 주' : '그 주'}</td><td class="num">전 주 대비</td></tr>
    ${row('측정 횟수', cur.n, prev.n, '회')}${row('걷기 케이던스 평균', cur.walkCad, prev.walkCad, '걸음/분')}${row('걷는 속도 평균', cur.speed, prev.speed, 'm/s', 2)}
    ${row('러닝 케이던스 평균', cur.runCad, prev.runCad, '걸음/분')}${row('슬로우 조깅', cur.jog, prev.jog, '분')}${row('영상 분석', cur.video, prev.video, '회')}</table>
    <div class="row" style="margin-top:4px"><button class="ghost" data-card="week">이 주 카드 공유</button><button class="ghost" data-card="month">이 달 카드 공유</button></div>
    <button class="ghost" data-card="best" style="margin-top:8px">최고 기록 카드 공유</button>
    <div class="sub" style="margin-top:6px">월요일~일요일 기록이에요(연습 측정 제외). 점수로 바꾸지 않고 잰 숫자만 모았어요. 날짜를 누르면 그날 기록과 그 주 통계가 보여요.</div>`;
}
$('week').addEventListener('click', e => {
  const m = e.target.closest('button[data-m]'), d = e.target.closest('.cday'), r = e.target.closest('.dayrec'), c = e.target.closest('button[data-card]');
  if (c) shareSummary(c.dataset.card);
  else if (m) { calMonth.setMonth(calMonth.getMonth() + +m.dataset.m); renderWeek(); }
  else if (d) { calSel = d.dataset.d; const t = new Date(calSel + 'T00:00'); if (t.getMonth() !== calMonth.getMonth()) calMonth = new Date(t.getFullYear(), t.getMonth(), 1); renderWeek(); }
  else if (r) showRecord(+r.dataset.i);
});
// 요약 카드: 주간·월간(달력 점 그림) / 최고 기록 — 잰 숫자와 출처만, 점수·판정 없음
const CARD_C = { walk: '#008a6e', run: '#2f6fd1', slowrun: '#c46f1c', video: '#8a5cd1' };   // 화면 달력과 같은 색 (밝은 배경 대비 검증 통과)
const md = d => { d = new Date(d); return `${d.getMonth() + 1}/${d.getDate()}`; };
const plusDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const paceText = sp => { const p = 1000 / sp / 60; return `${Math.floor(p)}'${String(Math.round((p % 1) * 60)).padStart(2, '0')}"`; };
function sumRows(st, month) {
  const rows = [{ k: '측정', v: `${st.n}회`, u: '', n: `측정한 날 ${st.days}일 · 연습 측정 제외` }];
  if (st.walkCad != null) rows.push({ k: '걷기 케이던스 평균', v: st.walkCad.toFixed(0), u: '걸음/분', n: 'Perry 성인 평균 113 (남 111 / 여 117)' });
  if (st.speed != null) rows.push({ k: '걷는 속도 평균', v: st.speed.toFixed(2), u: 'm/s', n: 'Perry 성인 평균 1.37' });
  if (st.jog) rows.push({ k: month ? '슬로우 조깅 합계' : '슬로우 조깅', v: st.jog.toFixed(0), u: '분', n: 'Ikenaga 2017 연구의 주간 조깅량 90분' });
  if (st.runCad != null) rows.push({ k: '러닝 케이던스 평균', v: st.runCad.toFixed(0), u: '걸음/분', n: '사람·속도마다 달라 기준선 없이 기록만' });
  return rows;
}
function calChart(start, end, mo) {                                       // 카드 아래 달력: 날짜마다 활동 종류별 점 + 색 설명
  const acts = {};
  for (const h of store.get('history', [])) (acts[dayKey(h.date)] ??= new Set()).add(h.activity ?? 'walk');
  const days = []; for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  const weeks = Math.ceil(days.length / 7);
  return { h: 60 + weeks * 64 + 44, draw: (g, x, y, w, _h, F) => {
    const cw = w / 7; g.textAlign = 'center';
    g.font = F(500, 22); g.fillStyle = '#69736f'; [...'월화수목금토일'].forEach((t, i) => g.fillText(t, x + cw * (i + .5), y + 24));
    days.forEach((d, i) => {
      const cx = x + cw * (i % 7 + .5), cy = y + 66 + 64 * Math.floor(i / 7), a = [...(acts[dayKey(d)] ?? [])];
      g.globalAlpha = mo == null || d.getMonth() === mo ? 1 : .3;
      g.fillStyle = '#121816'; g.font = F(500, 26); g.fillText(String(d.getDate()), cx, cy);
      a.forEach((k, j) => { g.fillStyle = CARD_C[k]; g.beginPath(); g.arc(cx + (j - (a.length - 1) / 2) * 16, cy + 18, 6, 0, 7); g.fill(); });
    });
    g.globalAlpha = 1; g.textAlign = 'left'; g.font = F(400, 22);
    let lx = x; const ly = y + 60 + weeks * 64 + 28;
    for (const [k, col] of Object.entries(CARD_C)) { g.fillStyle = col; g.beginPath(); g.arc(lx + 7, ly - 7, 7, 0, 7); g.fill(); g.fillStyle = '#69736f'; g.fillText(ACT[k], lx + 20, ly); lx += 40 + g.measureText(ACT[k]).width; }
  } };
}
function bestRows() {
  const hist = store.get('history', []).filter(h => !h.practice), rows = [];
  const top = (list, key) => list.reduce((b, h) => !b || key(h) > key(b) ? h : b, null);
  const walk = hist.filter(h => (h.activity ?? 'walk') === 'walk');
  const sp = top(walk.filter(h => h.speed), h => h.speed);
  if (sp) rows.push({ k: '가장 빠른 걷는 속도', v: sp.speed.toFixed(2), u: 'm/s', n: `${md(sp.date)} · Perry 성인 평균 1.37` });
  const lg = top(walk, h => h.activeS);
  if (lg) rows.push({ k: '가장 오래 걸은 측정', v: (lg.activeS / 60).toFixed(1), u: '분', n: `${md(lg.date)} · 케이던스 ${lg.cadence.toFixed(0)}걸음/분` });
  const rn = top(hist.filter(h => h.activity === 'run' && h.speed), h => h.speed);
  if (rn) rows.push({ k: '가장 빠른 러닝 페이스', v: paceText(rn.speed), u: '/km', n: `${md(rn.date)} · GPS로 잰 참고값` });
  const wk = {}; for (const h of hist.filter(h => h.activity === 'slowrun')) { const k = dayKey(monOf(h.date)); wk[k] = (wk[k] ?? 0) + h.activeS / 60; }
  const bw = Object.entries(wk).sort((a, b) => b[1] - a[1])[0];
  if (bw) rows.push({ k: '한 주 슬로우 조깅 최다', v: bw[1].toFixed(0), u: '분', n: `${md(bw[0] + 'T00:00')} 주 · Ikenaga 2017 연구의 주간량 90분` });
  if (hist.length) rows.push({ k: '지금까지 측정한 날', v: `${new Set(hist.map(h => dayKey(h.date))).size}일`, u: '', n: `측정 ${hist.length}회 · 연습 측정 제외` });
  return rows;
}
async function shareSummary(kind) {
  const hist = store.get('history', []);
  let title = '걸음 분석 요약', label, rows, chart;
  if (kind === 'best') { title = '걸음 분석 최고 기록'; label = '지금까지 내 기록'; rows = bestRows(); }
  else if (kind === 'week') {
    const mon = monOf(new Date(calSel + 'T00:00')), next = plusDays(mon, 7);
    label = `${md(mon)}~${md(plusDays(mon, 6))} 한 주`; rows = sumRows(statOf(inRange(hist, mon, next))); chart = calChart(mon, next);
  } else {
    const y = calMonth.getFullYear(), mo = calMonth.getMonth(), a = new Date(y, mo, 1), b = new Date(y, mo + 1, 1), e = new Date(b);
    while (e.getDay() !== 1) e.setDate(e.getDate() + 1);                  // 마지막 주는 일요일까지
    label = `${y}년 ${mo + 1}월`; rows = sumRows(statOf(inRange(hist, a, b)), true); chart = calChart(monOf(a), e, mo);
  }
  if (!rows.length) return alert('아직 기록이 없어요.');
  const max = !chart ? 5 : chart.h > 300 ? 3 : 4;                          // 달력이 크면 줄 수를 줄여 글자가 겹치지 않게
  shareCanvas(await drawCard(title, label, rows.slice(0, max), chart), `걸음 분석으로 잰 내 기록 · https://${APP_URL}/`);
}
function renderHome() {
  const hist = store.get('history', []);
  const idx = f => hist.findIndex(f);
  const isWalk = h => (h.activity ?? 'walk') === 'walk';
  const iw = idx(isWalk), w = hist[iw];
  const wPrev = iw >= 0 ? hist.slice(iw + 1).find(isWalk) : null;
  const is = idx(h => isWalk(h) && h.speed), sp = hist[is];
  const ir = idx(h => h.activity === 'run'), rn = hist[ir];
  const iv = idx(h => h.activity === 'video' && h.view === 'side' && h.r?.m), vd = hist[iv];
  const delta = (a, b) => b ? ` · 지난번보다 ${a - b >= 0 ? '+' : ''}${(a - b).toFixed(0)}` : '';
  $('tiles').innerHTML =
    tile('최근 걷기 케이던스', w?.cadence.toFixed(0), '걸음/분', w ? `${shortDate(w.date)}${delta(w.cadence, wPrev?.cadence)}` : '측정 탭에서 걸어 보세요', iw) +
    tile('최근 걷는 속도', sp?.speed.toFixed(2), 'm/s', sp ? `${shortDate(sp.date)} · Perry 성인 평균 1.37` : 'GPS나 거리 입력이 필요해요', is) +
    tile('최근 러닝 케이던스', rn?.cadence.toFixed(0), '걸음/분', rn ? shortDate(rn.date) : '측정 탭에서 러닝을 골라요', ir) +
    tile('영상: 유각기 무릎', vd ? vd.r.m.kneeSwingMax.toFixed(0) : null, '°', vd ? `${shortDate(vd.date)} · Perry 약 60°` : '영상 탭에서 옆모습을 찍어요', iv);
  // 링: 이번 주 슬로우 조깅 분 / 연구의 주간량 90분 (Ikenaga 2017)
  const wk = weekSlowJogMin(hist), frac = Math.min(1, wk / 90), C = 2 * Math.PI * 42;
  $('ring').innerHTML = `<svg viewBox="0 0 108 108" role="img" aria-label="이번 주 슬로우 조깅 ${wk.toFixed(0)}분, 90분 중 ${Math.round(frac * 100)}%">
      <circle cx="54" cy="54" r="42" fill="none" stroke="var(--line)" stroke-width="10"/>
      <circle cx="54" cy="54" r="42" fill="none" stroke="var(--series)" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 54 54)"/>
      <text x="54" y="52" text-anchor="middle" font-size="22" font-weight="800" fill="var(--ink)">${wk.toFixed(0)}</text>
      <text x="54" y="70" text-anchor="middle" font-size="11" fill="var(--sub)">/ 90분</text></svg>
    <div><div style="font-weight:700">${Math.round(frac * 100)}%</div>
      <div class="sub">월요일부터 이번 주에 슬로우 러닝으로 조깅한 시간이에요. 90분은 Ikenaga 2017 무작위 연구의 주간 조깅량이에요(목표 처방이 아니에요).</div></div>`;
  renderWeek();
  renderTrend();
  markTerms($('home'));
}
$('tiles').addEventListener('click', e => { const t = e.target.closest('.tile[data-i]'); if (t) showRecord(+t.dataset.i); });

// 변화 그래프: 선 하나 + 기준선/기준 범위(출처), 점을 누르면 값과 날짜
const TREND = {
  walkCad: { label: '걷기 케이던스', unit: '걸음/분', pick: h => (h.activity ?? 'walk') === 'walk' ? h.cadence : null,
    ref: () => { const { sex } = store.get('profile', {}); const n = sex === 'm' ? 111 : sex === 'f' ? 117 : 113; return { band: [n * 0.9, n * 1.1], text: `회색 띠 = Perry 성인 평균 ${n}걸음/분 ±10%` }; } },
  walkSpeed: { label: '걷는 속도', unit: 'm/s', dec: 2, pick: h => (h.activity ?? 'walk') === 'walk' ? h.speed ?? null : null, ref: () => ({ line: 1.37, text: '점선 = Perry 성인 평균 1.37 m/s' }) },
  runCad: { label: '러닝 케이던스', unit: '걸음/분', pick: h => h.activity === 'run' ? h.cadence : null, ref: () => ({ text: '러닝 케이던스는 사람·속도마다 달라 기준선 없이 변화만 봐요' }) },
  knee: { label: '영상: 유각기 무릎 굽힘', unit: '°', pick: h => h.activity === 'video' && h.view === 'side' ? h.r?.m?.kneeSwingMax ?? null : null, ref: () => ({ line: 60, text: '점선 = Perry 초기 유각 약 60° · 영상 각도는 같은 조건으로 찍어야 비교돼요' }) },
};
$('tmetric').value = store.get('tmetric', 'walkCad');
$('tmetric').addEventListener('change', () => { store.set('tmetric', $('tmetric').value); renderTrend(); });
function renderTrend() {
  const cfg = TREND[$('tmetric').value], dec = cfg.dec ?? 0;
  const pts = store.get('history', []).filter(h => !h.practice).map(h => ({ d: h.date, v: cfg.pick(h) })).filter(p => p.v != null && !Number.isNaN(p.v)).reverse().slice(-20);
  const ref = cfg.ref();
  if (pts.length < 2) { $('tchart').innerHTML = `<div class="sub" style="margin-top:10px">기록이 2개 이상 쌓이면 그래프가 그려져요. (지금 ${pts.length}개, 연습 측정은 빼요)</div>`; return; }
  const vals = pts.map(p => p.v).concat(ref.band ?? [], ref.line ?? []);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.15 || 1; lo -= pad; hi += pad;
  const Wd = 320, Ht = 170, L = 38, R = 10, T = 12, B = 26;
  const X = i => L + (Wd - L - R) * (pts.length === 1 ? 0.5 : i / (pts.length - 1)), Y = v => T + (Ht - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  $('tchart').innerHTML = `<svg viewBox="0 0 ${Wd} ${Ht}" class="chart" role="img" aria-label="${cfg.label} 변화, 최근 ${pts.length}개">
      ${ticks.map(t => `<line x1="${L}" x2="${Wd - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(t) + 4}" font-size="10" text-anchor="end" fill="var(--sub)">${t.toFixed(dec)}</text>`).join('')}
      ${ref.band ? `<rect x="${L}" width="${Wd - L - R}" y="${Y(ref.band[1])}" height="${Y(ref.band[0]) - Y(ref.band[1])}" fill="var(--sub)" opacity=".12"/>` : ''}
      ${ref.line ? `<line x1="${L}" x2="${Wd - R}" y1="${Y(ref.line)}" y2="${Y(ref.line)}" stroke="var(--sub)" stroke-width="1.5" stroke-dasharray="5 4"/>` : ''}
      <polyline points="${pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--series)" stroke-width="2" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.v)}" r="4" fill="var(--series)" stroke="var(--card)" stroke-width="2"/><circle class="hit" data-k="${i}" cx="${X(i)}" cy="${Y(p.v)}" r="14" fill="transparent"/>`).join('')}
      <text x="${L}" y="${Ht - 6}" font-size="10" fill="var(--sub)">${shortDate(pts[0].d)}</text>
      <text x="${Wd - R}" y="${Ht - 6}" font-size="10" text-anchor="end" fill="var(--sub)">${shortDate(pts[pts.length - 1].d)}</text>
    </svg><div id="ttip" class="hidden"></div>
    <div class="sub">${cfg.label}(${cfg.unit}) · 최근 ${pts.length}개 · ${ref.text}. 점을 누르면 값이 보여요. 표는 기록 탭에서 볼 수 있어요.</div>`;
  const svg = $('tchart').querySelector('svg');
  const show = e => {
    const c = e.target.closest?.('.hit'); if (!c) return $('ttip').classList.add('hidden');
    const p = pts[+c.dataset.k], box = svg.getBoundingClientRect(), sc = box.width / Wd;
    $('ttip').textContent = `${shortDate(p.d)} · ${p.v.toFixed(dec)} ${cfg.unit}`;
    $('ttip').classList.remove('hidden');
    const half = $('ttip').offsetWidth / 2, x = c.cx.baseVal.value * sc;   // 말풍선이 그래프 밖으로 잘리지 않게
    $('ttip').style.left = `${Math.min(Math.max(x, half), box.width - half)}px`; $('ttip').style.top = `${c.cy.baseVal.value * sc}px`;
  };
  svg.addEventListener('pointermove', show); svg.addEventListener('click', show);
  svg.addEventListener('pointerleave', () => $('ttip').classList.add('hidden'));
}

$('histBody').addEventListener('click', e => { const tr = e.target.closest('tr[data-i]'); if (tr) showRecord(+tr.dataset.i); });
function showRecord(i) {
  const hist = store.get('history', []), h = hist[i];
  if (!h) return;
  const when = new Date(h.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const banner = `<div class="sub" style="margin-bottom:6px">지난 기록 다시 보기 · ${when}</div>`;
  const act = h.activity ?? 'walk';
  shownDate = h.date;
  if (act === 'video') { setTab('video'); renderVideo(h.r); $('vresult').insertAdjacentHTML('afterbegin', banner); return; }
  setTab('measure');
  const prev = hist.slice(i + 1).find(x => !x.practice && (x.activity ?? 'walk') === act);
  if (act === 'slowrun') renderSlow(h, hist); else if (act === 'run') renderRun(h, prev); else render(h, prev);
  $('result').insertAdjacentHTML('afterbegin', banner);
}

// ── 영상 분석 (옆·앞·뒤) ──
const VGUIDE = {
  side: ['휴대폰을 <b>허리 높이</b>에 세워 고정해요(누가 들어 주거나 물건에 기대기). 세로보다 <b>가로</b>로 찍으면 더 많이 담겨요.',
    '걷는 길에서 <b>3~4m 떨어져 옆에서</b> 찍어요. 화면 끝에서 끝까지 <b>4~5m 지나가며 3걸음 이상</b> 담기게 해요.',
    '머리부터 발끝까지 보이게, 밝은 곳에서. 반바지나 몸에 붙는 옷이 잘 잡혀요. 10~20초면 충분해요.'],
  front: ['휴대폰을 <b>허리 높이, 정면</b>에 고정해요.', '<b>6~8m 떨어진 곳에서 카메라 쪽으로</b> 평소처럼 걸어와요.', '머리부터 발끝까지 보이게, 밝은 곳에서. 10~20초면 충분해요.'],
  back: ['휴대폰을 <b>허리 높이</b>에 고정해요.', '카메라 바로 앞에서 출발해 <b>6~8m 멀어지며</b> 평소처럼 걸어가요.', '머리부터 발끝까지 보이게, 밝은 곳에서. 10~20초면 충분해요.'],
};
function showVGuide() { $('vguide').innerHTML = VGUIDE[$('vview').value].map(x => `<li>${x}</li>`).join(''); }
$('vview').value = store.get('vview', 'side');
$('vview').addEventListener('change', () => { store.set('vview', $('vview').value); showVGuide(); });
showVGuide();
for (const id of ['vcam', 'vfile']) $(id).addEventListener('change', e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) runVideo(f); });

async function runVideo(file) {
  const view = $('vview').value;
  shownDate = null;
  $('vresult').classList.add('hidden'); $('vcanvas').classList.add('hidden'); $('vprog').classList.remove('hidden');
  const prog = (r, msg) => { $('vbar').style.width = `${Math.round(r * 100)}%`; $('vmsg').textContent = msg; };
  prog(0, '자세 인식 프로그램 준비 중… (처음 한 번은 조금 걸려요)');
  try {
    const { frames, W, H, video, dur, processed, delegate } = await extractPose(file, r => prog(r, `영상 분석 중… ${Math.round(r * 100)}%`));
    prog(1, '계산 중…');
    // 실패하면 원인을 찾을 수 있게 숫자를 같이 보여 줌
    const info = extra => `<details open><summary>측정 정보 (문제 찾기용)</summary><div class="sub">영상 길이 ${dur.toFixed(1)}초(최대 20초 분석) · 화면 ${W}×${H} · 확인한 장면 ${processed}개 · 사람이 잡힌 장면 ${frames.length}개 · 계산 방식 ${delegate}${extra || ''}</div></details>`;
    if (frames.length < 15) throw { html: '사람을 거의 찾지 못했어요. 머리부터 발끝까지 보이게, 밝은 곳에서 다시 찍어 주세요.' + info() };
    const r = view === 'side' ? analyzeSide(frames, W, H) : analyzeFrontal(frames, W, H, view);
    const d = r.diag || {};
    const extra = view === 'side' ? ` · 다리(엉덩이·무릎·발목)가 잡힌 장면 ${d.legFrames ?? '-'}개 · 카메라 쪽 다리 ${d.side === 'l' ? '왼' : '오른'}쪽 · 걷는 방향 ${d.dir > 0 ? '→' : '←'} · 찾은 발 닿기 ${d.contacts ?? '-'}번 · 쓸 수 있는 보행 주기 ${d.cycles ?? '-'}개`
      : ` · 몸 전체가 잡힌 장면 ${d.bodyFrames ?? '-'}개`;
    if (r.error) throw { html: { noPerson: '다리가 또렷하게 잡힌 장면이 너무 적어요. 다리 전체가 보이게, 밝은 곳에서 다시 찍어 주세요.',
      noCycle: '한 걸음 주기(같은 발이 두 번 닿기)를 찾지 못했어요. 옆에서 화면 끝에서 끝까지 3걸음 이상 지나가게 찍어 주세요.' }[r.error] + info(extra) };
    $('vcanvas').classList.remove('hidden');
    await drawSnapshot($('vcanvas'), video, frames[Math.floor(frames.length / 2)]);
    URL.revokeObjectURL(video.src);
    const hist = store.get('history', []);
    const vrec = { date: new Date().toISOString(), activity: 'video', view, r };   // 영상은 저장 안 하고 계산된 숫자만
    hist.unshift(vrec); store.set('history', hist.slice(0, 200));
    shownDate = vrec.date;
    renderVideo(r, dur);
    renderHistory();
  } catch (err) {
    // 프로그램 내부 오류(영어)는 쉬운 안내 + 접은 칸에 원문
    const msg = err.html || (err.message && /[가-힣]/.test(err.message) ? err.message
      : `분석 중 오류가 났어요. 앱을 완전히 껐다 켜고 다시 해 주세요.<details><summary>오류 원문 (문제 찾기용)</summary><div class="sub">${String(err.message || err).slice(0, 300)}</div></details>`);
    showV(`<h2>다시 찍어 주세요</h2><div class="warn">${msg}</div>`);
  } finally { $('vprog').classList.add('hidden'); }
}

function showV(html) {
  const el = $('vresult'); el.innerHTML = html;
  if (shownDate) el.querySelector('h2')?.insertAdjacentHTML('afterend', shareBtn(shownDate) + ctxBox(shownDate));
  el.insertAdjacentHTML('beforeend', glossList(markTerms(el)));
  el.classList.remove('hidden'); el.scrollIntoView({ behavior: 'smooth' });
}
const f0 = x => x == null || Number.isNaN(x) ? '-' : `${x.toFixed(0)}°`;
// 무릎 곡선 그림: 이번 영상(초록) vs Perry 5장 표의 기준점(회색 점선)
function kneeChart(curve) {
  const perry = [[0, 5], [15, 18], [40, 5], [62, 40], [73, 60], [85, 30], [97, 2], [100, 5]];
  const X = q => 30 + q * 2.8, Y = d => 150 - d * 2;
  const line = pts => pts.map(([q, d]) => `${X(q).toFixed(1)},${Y(d).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 320 175" role="img" aria-label="무릎 굽힘 곡선">
    ${[0, 20, 40, 60].map(d => `<line x1="30" x2="310" y1="${Y(d)}" y2="${Y(d)}" stroke="currentColor" opacity=".12"/><text x="24" y="${Y(d) + 4}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">${d}°</text>`).join('')}
    <line x1="${X(60)}" x2="${X(60)}" y1="20" y2="150" stroke="currentColor" opacity=".2" stroke-dasharray="3 3"/>
    <text x="${X(30)}" y="168" font-size="10" text-anchor="middle" fill="currentColor" opacity=".7">입각기</text><text x="${X(80)}" y="168" font-size="10" text-anchor="middle" fill="currentColor" opacity=".7">유각기</text>
    <polyline points="${line(perry)}" fill="none" stroke="currentColor" opacity=".45" stroke-width="2" stroke-dasharray="5 4"/>
    <polyline points="${line(curve.map((d, q) => [q, d]))}" fill="none" stroke="var(--accent)" stroke-width="3"/>
  </svg><div class="sub">초록 = 이번 영상 평균, 회색 점선 = Perry 5장 표의 기준점 · 가로 = 보행 주기 0~100%</div>`;
}

// 차이를 괄호로 쉽게: ±4° 이내 = 비슷(영상 오차 약 3~5°), 4~10° = 조금, 10° 초과 = 많이
// w = [기준보다 작을 때 할 말, 기준보다 클 때 할 말], 예: ['더 굽혀야 함', '덜 굽혀도 됨']
function hint(d, w) {
  if (Math.abs(d) <= 4) return '기준과 비슷함';
  return `${Math.abs(d) > 10 ? '많이' : '조금'} ${d < 0 ? w[0] : w[1]}`;
}
const hw = (a, ref, w) => a == null || Number.isNaN(a) ? '' : `(${hint(a - ref, w)})`;
const dif = (a, ref, w) => a == null || Number.isNaN(a) ? '-'
  : (d => `${a.toFixed(0)}° − ${ref}° = <b>${d > 0 ? '+' : ''}${d}°</b>${w ? ` (${hint(a - ref, w)})` : ''}`)(Math.round(a - ref));
const BEND = ['더 굽혀야 함', '덜 굽혀도 됨'];
function videoRecs(r) {
  const m = r.m, lim = '카메라 1대로 찍은 2D 영상이라 다리가 돌아가 있으면 굽힘 각도가 작게 찍혀요(Perry 17장). 원인 판단은 전문가에게.';
  if (r.view === 'side') return [
    recCard({ title: '유각기 무릎 굽힘 (발 들어 올리기)', calc: [`이번 − Perry 약 60° → ${dif(m.kneeSwingMax, 60, ['더 굽혀야 함', '덜 굽혀도 됨'])}`],
      facts: [`Perry 4·5장: 초기 유각에 무릎이 약 60° 굽혀져야${hw(m.kneeSwingMax, 60, BEND)} 발끝이 바닥에 걸리지 않음. 이 굽힘은 거의 근육 없이 관성으로 만들어짐`,
        'Perry 4장: 유각 전에 발목이 빠르게 발바닥굽힘 20°가 되면서 무릎 굽힘을 이끔',
        'Perry 5장: 초기 유각에 굽힘이 15°에 못 미치면 다리가 덜 나가고 발끝이 바닥에 끌릴 수 있음'], limit: lim, refs: ['perry9', 'perry17'] }),
    recCard({ title: '체중 받기 무릎 굽힘 (충격 흡수)', calc: [`이번 − Perry 약 16° → ${dif(m.kneeLoad, 16, ['더 굽혀야 함(충격 흡수)', '덜 굽혀도 됨'])} · 기준 범위 15~18°`],
      facts: [`Perry 4장: 발이 닿고 0.02초 만에 체중 60%가 실림. 무릎 약 15° 굽힘${hw(m.kneeLoad, 16, ['더 굽혀야 함', '덜 굽혀도 됨'])}, 발목 발바닥굽힘 10°, 반대쪽 골반 4° 내려감으로 충격을 흡수`,
        'Perry 5장의 구분: 체중 받기 때 25° 넘게 굽으면 "굽힘 과다"로 봄'], limit: lim, refs: ['perry9'] }),
    recCard({ title: '입각기 무릎 펴기', calc: [`이번 최소 − Perry 약 5° → ${dif(m.kneeStanceMin, 5, ['덜 펴도 됨', '더 펴야 함'])}`],
      facts: [`Perry 5장: 말기 입각에 무릎이 약 5°까지 펴짐${hw(m.kneeStanceMin, 5, ['덜 펴도 됨', '더 펴야 함'])}. 10° 이내로 펴지지 않으면 "폄 부족"으로 봄`, 'Perry 5장: 말기 유각에 덜 펴지면 걸음 길이가 짧아짐'], limit: lim, refs: ['perry9'] }),
    recCard({ title: '넓적다리 뒤로 젖히기 (한걸음 길이)', grade: 'o', calc: [`뒤로 젖힘: 이번 − Perry 약 20° → ${dif(m.thighExt, 20, ['더 뒤로 젖혀야 함', '덜 젖혀도 됨'])}`, `앞으로 굽힘: 이번 − Perry 약 20° → ${dif(m.thighFlex, 20, ['더 앞으로 들어야 함', '덜 들어도 됨'])}`],
      facts: [`Perry 6장: 말기 입각에 넓적다리가 수직에서 뒤로 약 20° 젖혀짐${hw(m.thighExt, 20, ['더 뒤로 젖혀야 함', '덜 젖혀도 됨'])}`, 'Perry 6장: 이 젖힘이 부족하면 한걸음 길이가 짧아짐', 'Perry 6장: 첫 닿기 때 고관절 굽힘 약 30°(넓적다리 약 20°)는 미끄러짐과 안정성 사이의 최적 타협'],
      limit: lim + ' 넓적다리 각도는 영상 정확도가 낮은 편이에요(Wegner 2026).', refs: ['perry9', 'wegner2026'] }),
    recCard({ title: '발목 (밀어내기)', grade: 'o', calc: [`발등굽힘: 이번 − Perry 약 10° → ${dif(m.ankleDF, 10, ['더 발등 쪽으로 굽혀야 함(정강이를 앞으로)', '덜 굽혀도 됨'])}`, `발바닥굽힘: 이번 − Perry 약 20° → ${dif(m.anklePF, 20, ['더 발끝으로 밀어내야 함', '덜 밀어내도 됨'])}`],
      facts: [`Perry 4장: 말기 입각에 뒤꿈치가 들리며 발목 발등굽힘 약 10°${hw(m.ankleDF, 10, ['더 발등 쪽으로 굽혀야 함', '덜 굽혀도 됨'])}. 앞발을 축으로 굴러가는 이 동작(앞발 흔들의자)이 가장 강한 추진력`, 'Perry 4장: 중간 입각 30%까지 발등굽힘이 5° 이상 되는지 봄'],
      limit: lim + ' 발목 각도는 영상 정확도가 낮아요(Russo 2026, Cheng 2025).', refs: ['perry9', 'russo2026', 'cheng2025'] }),
  ];
  const lr = (a, b) => { if (a == null || b == null) return '-'; const d = Math.abs(a - b);
    return `|${a.toFixed(0)}° − ${b.toFixed(0)}°| = <b>${d.toFixed(0)}°</b> (${d <= 4 ? '좌우 비슷함' : d > 10 ? '좌우 차이 많이 남' : '좌우 차이 조금 남'})`; };
  return [
    recCard({ title: '골반 내려감 (엉덩이 옆 근육)', grade: 'n', calc: [`왼발 디딜 때 − Perry 약 4° → ${dif(m.dropL, 4, ['덜 내려가는 편', '덜 내려가야 함(엉덩이 옆 근육으로 잡아 주기)'])}`, `오른발 디딜 때 − Perry 약 4° → ${dif(m.dropR, 4, ['덜 내려가는 편', '덜 내려가야 함(엉덩이 옆 근육으로 잡아 주기)'])}`, `좌우 차이 ${lr(m.dropL, m.dropR)}`],
      facts: [`Perry 4장: 체중 받기 때 반대쪽 골반이 약 4° 내려가며 충격을 나눠 받음 — 이번: 왼발 ${m.dropL == null ? '-' : hint(m.dropL - 4, ['덜 내려가는 편', '덜 내려가야 함'])}, 오른발 ${m.dropR == null ? '-' : hint(m.dropR - 4, ['덜 내려가는 편', '덜 내려가야 함'])}`, 'Perry 6·9장: 엉덩이 벌림근(중둔근 등)이 체중의 약 1.5배 힘으로 골반 처짐을 5° 이하로 잡아 줌'],
      limit: '휴대폰 앞·뒤 영상의 골반 각도는 검증 연구를 찾지 못했어요. 같은 조건으로 찍어 변화를 보세요.', refs: ['perry9'] }),
    recCard({ title: '왼쪽·오른쪽 비교', grade: 'n', calc: [`무릎 안쪽 모임 ${lr(m.valgusL, m.valgusR)}`, `몸통 옆 기울기 ${lr(m.leanL, m.leanR)}`],
      facts: ['Perry 책에는 이 두 각도의 영상 기준값이 없어서 숫자 기준 대신 좌우 차이와 이전 영상과의 변화로만 비교해요', 'Neumann 15장: 두 다리는 서로 의존해서, 한쪽 문제가 반대쪽 다리의 걸음에 나타나기도 함'],
      limit: '검증 안 됨. 원인 판단은 전문가에게.', refs: ['perry17', 'neumann15'] }),
  ];
}

function renderVideo(r, dur) {
  let html = '';
  if (r.view === 'side') {
    const m = r.m;
    html += `<h2>영상 분석 결과 · 옆모습</h2><div class="sub">${r.side === 'l' ? '왼' : '오른'}쪽 다리(카메라 쪽) · 보행 주기 ${r.nCycles}개 평균 · 다리가 잡힌 장면 ${Math.round(r.validFrac * 100)}%</div>`;
    html += metric({ title: '무릎 각도', value: f0(m.kneeSwingMax), unit: `유각기 최대 굽힘 (보행 주기 ${m.kneeSwingAt}%)`, grade: 'y',
      body: `${kneeChart(r.curves.knee)}<div class="calc">이번 값 / Perry 9장 기준<br>첫 닿기 ${f0(m.kneeIC)} / 0~5°<br>체중 받기 최대 ${f0(m.kneeLoad)} / 15~18°<br>입각기 최소 ${f0(m.kneeStanceMin)} / 약 5°<br>유각기 최대 ${f0(m.kneeSwingMax)} / 약 60°(초기 유각)</div>`,
      why: ['무릎 각도 = 180° − (엉덩이·무릎·발목 세 점이 이루는 각). Perry 17장: 영상에서 가장 잘 잡히는 관절',
        'Russo 2026: 스마트폰 + 같은 종류의 자세 인식(MediaPipe)으로 무릎 굽힘 평균 오차 3.2~4.1°',
        'Wegner 2026: 무릎 곡선 모양은 잘 맞지만 정확한 절대 각도보다 같은 사람의 변화 추적에 알맞음',
        '첫 닿기는 "발이 엉덩이보다 가장 앞에 있는 순간"으로 근사해서 실제보다 몇 % 일찍 잡힐 수 있어요'],
      refs: ['perry9', 'perry17', 'russo2026', 'wegner2026'] });
    html += metric({ title: '넓적다리 각도', value: f0(m.thighFlex), unit: `앞으로 최대 · 뒤로 최대 ${f0(m.thighExt)}`, grade: 'o',
      body: `<div class="calc">이번 값 / Perry 기준<br>앞으로(굽힘) ${f0(m.thighFlex)} / 약 20°<br>뒤로(폄) ${f0(m.thighExt)} / 약 20°(말기 입각)</div>`,
      why: ['넓적다리 각도 = 수직선과 허벅지(엉덩이→무릎)가 이루는 각. 골반 움직임이 섞이지 않아 Perry가 임상에서 권하는 지표',
        'Cheng 2025: 2D 영상의 엉덩관절 각도 오차는 5° 안쪽이지만, Wegner 2026에선 일치도가 낮았어요 → "부정확할 수 있음"'],
      refs: ['perry9', 'cheng2025', 'wegner2026'] });
    html += metric({ title: '발목 각도', value: f0(m.ankleDF), unit: `입각기 최대 발등굽힘 · 최대 발바닥굽힘 ${f0(m.anklePF)}`, grade: 'o',
      body: `<div class="calc">이번 값 / Perry 기준<br>발등굽힘 ${f0(m.ankleDF)} / 10°(말기 입각)<br>발바닥굽힘 ${f0(m.anklePF)} / 20°(유각 전)</div>`,
      why: ['발목 각도 = 정강이(무릎→발목)와 발(뒤꿈치→발끝) 사이 각도 − 90°',
        'Russo 2026, Cheng 2025: 영상의 발목 각도는 정확도가 낮음 → 참고만 하세요'],
      refs: ['perry9', 'russo2026', 'cheng2025'] });
    html += metric({ title: '영상으로 잰 케이던스', value: r.cadence.toFixed(0), unit: '걸음/분', grade: 'y',
      why: ['보행 주기 시간으로 계산(케이던스 = 120 ÷ 주기 초)', 'Wegner 2026: 2D 영상의 케이던스는 기준 장비와 일치도 높음(ICC 0.74~0.95 범위)'], refs: ['wegner2026'] });
  } else {
    const m = r.m, side = r.view === 'front' ? '앞모습' : '뒷모습';
    const diff = (a, b) => a != null && b != null ? `좌우 차이 ${Math.abs(a - b).toFixed(0)}°` : '';
    html += `<h2>영상 분석 결과 · ${side}</h2><div class="sub">몸이 잡힌 장면 ${Math.round(r.validFrac * 100)}% · 앞·뒤 각도는 휴대폰 영상으로 검증된 연구를 찾지 못해 모두 "검증 안 됨"이에요. 같은 조건으로 찍어 좌우 비교·변화 추적에 쓰세요.</div>`;
    html += metric({ title: '골반 내려감 (반대쪽)', value: `왼발 ${f0(m.dropL)} · 오른발 ${f0(m.dropR)}`, unit: '', grade: 'n',
      body: `<div class="calc">한 발로 디딜 때 반대쪽 골반이 내려간 각도 (상위 10% 값)<br>${diff(m.dropL, m.dropR)}<br>Perry 4·9장: 체중 받기 때 반대쪽 골반 약 4°, 엉덩이 벌림근이 5° 이하로 제한</div>`,
      why: ['양쪽 엉덩이 점을 잇는 선이 수평에서 기운 각도', '디딤 다리는 "발목이 화면에서 더 아래에 있는 다리"로 근사', '휴대폰 2D 영상의 정확도 연구는 찾지 못함'], refs: ['perry9'] });
    html += metric({ title: '무릎 안쪽 모임', value: `왼 ${f0(m.valgusL)} · 오른 ${f0(m.valgusR)}`, unit: '', grade: 'n',
      body: `<div class="calc">디딜 때 무릎이 엉덩이-발목 선보다 안쪽(+)·바깥쪽(−)으로 간 각도 (상위 10% 값)<br>${diff(m.valgusL, m.valgusR)}</div>`,
      why: ['Perry 책에는 이 각도의 영상 기준값이 없어요 → 기준값 없이 좌우만 비교', 'Perry 17장: 다리가 돌아가 있으면 카메라 1대의 각도는 실제와 달라질 수 있어요'], refs: ['perry17'] });
    html += metric({ title: '몸통 옆 기울기', value: `왼쪽 ${f0(m.leanL)} · 오른쪽 ${f0(m.leanR)}`, unit: '', grade: 'n',
      body: `<div class="calc">어깨 가운데와 엉덩이 가운데를 잇는 선이 수직에서 기운 각도 (상위 10% 값)</div>`, why: ['휴대폰 2D 영상의 정확도 연구는 찾지 못함'], refs: [] });
    html += metric({ title: '걸음 폭', value: m.width != null ? `골반 너비의 ${m.width.toFixed(2)}배` : '-', unit: '', grade: 'n',
      body: `<div class="sub">두 발목 사이 가로 거리 ÷ 양쪽 엉덩이 점 사이 거리 (중앙값). 참고: Neumann 15장 성인 걸음 폭 8~10cm</div>`,
      why: ['영상에는 cm 기준이 없어서 골반 너비에 대한 비율로만 보여 줘요'], refs: ['neumann15'] });
  }
  html += recSection(videoRecs(r), '레퍼런스로 본 걷는 법');
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 걸음이 걱정되면 전문가와 상담하세요. 영상은 저장되지 않았어요(계산된 숫자만 지난 기록에 남아요).</div>`;
  showV(html);
}

// ── 데모 (주소 끝에 ?demo=1): 휴대폰 없이 화면 확인용 가짜 신호 ──
if (new URLSearchParams(location.search).has('demo')) {
  window.__v = { renderVideo, analyzeSide, analyzeFrontal, makeCard };   // 영상 결과 화면 점검용
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

homeReady = true;
setTab('home');
// 새 화면 버전이 적용되면 한 번 새로고침 (옛 화면이 남지 않게)
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !window.__reloaded) { window.__reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
}
$('appver').textContent = `화면 버전 ${APP_VERSION}`;
