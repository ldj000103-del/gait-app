// 걸음 분석 계산 (화면·센서와 분리된 순수 계산 → Node로 테스트 가능)
// 근거: Perry 7장(몸통 움직임은 걸음마다 반복), 20장(시작·끝 가속/감속 구간 제외)

export const HZ = 50;          // 분석용 재샘플링 주기
const TRIM_S = 2;              // 시작·끝에서 버리는 시간 (Perry 20장: 앞뒤 2m 제외)
const ACTIVE_STD = 0.6;        // m/s², 이보다 흔들리면 '걷는 중'으로 봄 (현장 보정 필요)

// samples: [{t: ms, x, y, z}] (중력 포함 가속도, m/s²) → 50Hz 등간격 크기 배열
export function resample(samples, hz = HZ) {
  const t0 = samples[0].t, tEnd = samples[samples.length - 1].t;
  const n = Math.floor(((tEnd - t0) / 1000) * hz);
  const mag = samples.map(s => Math.hypot(s.x, s.y, s.z));
  const out = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + (i * 1000) / hz;
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j], b = samples[j + 1];
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    out[i] = mag[j] + (mag[j + 1] - mag[j]) * Math.min(Math.max(f, 0), 1);
  }
  return out;
}

function movingAvg(x, w) {
  const out = new Float64Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    s += x[i];
    if (i >= w) s -= x[i - w];
    out[i] = s / Math.min(i + 1, w);
  }
  return out;
}

// 1초 창의 표준편차가 기준을 넘는 구간들 [[시작, 끝], …] (0.5초 넘게 멈추면 끊김). 가장 긴 구간 = 케이던스·GPS를 보는 구간
export function activeSegments(x, hz = HZ) {
  const w = hz, half = w >> 1, on = new Uint8Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - half), b = Math.min(x.length, i + half);
    let m = 0;
    for (let k = a; k < b; k++) m += x[k];
    m /= b - a;
    let v = 0;
    for (let k = a; k < b; k++) v += (x[k] - m) ** 2;
    on[i] = Math.sqrt(v / (b - a)) > ACTIVE_STD ? 1 : 0;
  }
  const segs = []; let start = -1, gap = 0;
  for (let i = 0; i <= x.length; i++) {
    if (i < x.length && on[i]) { if (start < 0) start = i; gap = 0; }
    else if (start >= 0 && (++gap > hz / 2 || i === x.length)) {   // 0.5초 넘게 멈추면 끊김
      segs.push([start, i - gap + 1]);
      start = -1; gap = 0;
    }
  }
  return segs;
}

function autocorr(x, maxLag) {
  const n = x.length;
  let m = 0;
  for (const v of x) m += v;
  m /= n;
  const d = x.map(v => v - m);
  let v0 = 0;
  for (const v of d) v0 += v * v;
  const ac = new Float64Array(maxLag + 1);
  for (let L = 0; L <= maxLag; L++) {
    let s = 0;
    for (let i = 0; i + L < n; i++) s += d[i] * d[i + L];
    ac[L] = s / v0 * (n / (n - L));    // 겹치는 길이 보정
  }
  return ac;
}

// 국소 최대점의 위치를 포물선 보간으로 소수점까지 (해상도 0.02초 → 약 0.002초)
function refinePeak(ac, i) {
  const a = ac[i - 1], b = ac[i], c = ac[i + 1];
  const den = a - 2 * b + c;
  return den === 0 ? i : i + 0.5 * (a - c) / den;
}

function peakNear(ac, center, tol) {
  const lo = Math.max(1, Math.round(center * (1 - tol))), hi = Math.min(ac.length - 2, Math.round(center * (1 + tol)));
  let best = -1;
  for (let i = lo; i <= hi; i++) if (ac[i] > ac[i - 1] && ac[i] >= ac[i + 1] && (best < 0 || ac[i] > ac[best])) best = i;
  return best;
}

// position: 'pocket'(허벅지) | 'waist'(허리) | 'hand'(손) — 신호 모양이 위치마다 다름
// 허리: 걸음마다 비슷한 봉우리(Perry 7장) / 허벅지: 같은 다리가 돌아오는 '한 보행 주기'마다 봉우리
// activity: 'walk' | 'run' — 달리기는 케이던스 범위로 한 걸음/한 주기를 가름
const RUN_MIN = 120, RUN_MAX = 230, AMBIG_MIN = 103;   // 달리기 케이던스로 볼 범위 (걸음/분). 이 범위에선 한 걸음·한 주기 해석이 겹치지 않음
export function analyzeWalk(samples, { position = 'pocket', activity = 'walk' } = {}) {
  const run = activity === 'run';
  const warnings = [];
  const totalS = (samples[samples.length - 1].t - samples[0].t) / 1000;
  if (samples.length < 50 || totalS < 8) return { error: 'tooShort', totalS };

  const x = movingAvg(resample(samples), 5);          // 0.1초 평활
  const segs = activeSegments(x), [a0, a1] = segs.reduce((m, g) => g[1] - g[0] > m[1] - m[0] ? g : m, [0, 0]);
  if ((a1 - a0) / HZ < 6) return { error: 'noWalk', totalS, activeS: (a1 - a0) / HZ };

  let s = a0 + TRIM_S * HZ, e = a1 - TRIM_S * HZ;
  if ((e - s) / HZ < 6) { s = a0; e = a1; warnings.push('shortWalk'); }
  const seg = x.slice(s, e);
  const maxLag = Math.min(Math.round(2.5 * HZ), seg.length - 2);
  const ac = autocorr(seg, maxLag);

  const peaks = [];
  for (let i = Math.round((run ? 0.25 : 0.3) * HZ); i < ac.length - 1; i++) if (ac[i] > ac[i - 1] && ac[i] >= ac[i + 1]) peaks.push(i);
  if (!peaks.length) return { error: 'irregular', totalS, activeS };
  const top = Math.max(...peaks.map(i => ac[i]));
  const S = peaks.find(i => ac[i] >= 0.85 * top) / HZ;    // 가장 짧은 '강한 반복' 주기

  // S가 한 걸음인지 한 보행 주기(두 걸음)인지 판단
  let stride;
  const half = peakNear(ac, (S / 2) * HZ, 0.15);
  if (run) stride = (60 / S >= RUN_MIN && 60 / S <= RUN_MAX) || position === 'waist' || (60 / S >= AMBIG_MIN && !(half > 0 && ac[half] > 0.25)) ? 2 * S : S;
  // ↑ 60/S가 103~120이면 '걷기 한 걸음(103~120)'과 '달리기 한 주기(206~240)'가 겹침 → 절반(한 걸음)에도 반복이 있을 때만 한 주기로 봄.
  //   양발 충격이 비슷한 주머니 걷기 106을 212로 세던 문제 (K-1A100B97, 데이터분석팀 10/28 211.5). 그 아래(달리기 200 이하)는 그대로: 주머니 달리기는 절반 봉우리가 약할 수 있음
  // ponytail: 103은 '달리기 206 이상은 드묾'에 기댄 값. 양발 같은 주머니 걷기가 103 미만이면 아직 2배로 셀 수 있음 → 시트의 sd 값으로 보정   // S가 한 걸음이면 60/S가 달리기 범위. 허리는 양발 걸음이 똑같이 보여 S가 늘 한 걸음 (허리에 차고 걸은 110을 220으로 세던 문제, 제보 K-37856D5D)
  else if (S < 0.75) stride = 2 * S;                                   // 주기 0.75초 미만 = 한 걸음 (케이던스 160 넘는 보행 주기는 없음)
  else if (half > 0 && ac[half] > 0.25) stride = S;               // 절반 지점에도 반복 → S는 보행 주기
  else if (S > 1.3) stride = S;                                   // 한 걸음 1.3초 초과는 비현실적
  // ponytail: 0.75~1.3초 사이는 위치 정보로만 판단. 허리에 차고 아주 느리게(케이던스 80 미만) 걸으면 틀릴 수 있음 → 실측 데이터로 보정 필요
  else stride = position === 'waist' ? 2 * S : S;

  // 보행 주기 봉우리를 다시 찾아 보간 (더 긴 주기라 오차가 작음)
  const sp = peakNear(ac, stride * HZ, 0.12);
  if (sp > 0) stride = refinePeak(ac, sp) / HZ;
  const regularity = sp > 0 ? ac[sp] : 0;
  const hp = peakNear(ac, (stride * HZ) / 2, 0.15), stepReg = hp > 0 ? ac[hp] : 0;   // 한 걸음 간격의 반복 (위치 짐작용)
  let sd = 0; { let m = 0; for (const v of seg) m += v; m /= seg.length; for (const v of seg) sd += (v - m) ** 2; sd = Math.sqrt(sd / seg.length); }   // 흔들림 세기 (자동 구분용)

  // 걸은 시간·걸음 = 가장 긴 구간 + 다른 구간(8초 이상)마다 그 구간의 빠르기로 다시 센 값. 걸음처럼 반복(regularity ≥ 0.4)되는 구간만 더함
  // (걷다 서다 반복하면 가장 긴 구간만 세던 문제: '24분 쟀는데 299보', K-B8EC7CAB / 빠르기가 다른 구간도 빠지지 않게, 검수팀 10/30)
  // 서서 몸만 움직인 구간은 반복이 약해 빠짐. 케이던스는 가장 긴 구간 값 그대로 (Perry 기준과 비교하는 이어 걸은 값)
  // ponytail: 걸음과 비슷한 박자로 서서 다리를 떨면 걸음으로 들어감(규칙적인 흔들림은 구별 못 함). 8초 미만으로 잠깐씩 옮겨 다닌 걸음은 안 셈
  const cadence = 120 / stride;
  let activeS = (a1 - a0) / HZ, steps = (activeS * cadence) / 60, walkSegs = 1;
  for (const [p, q] of segs) {
    if (p === a0 || q - p < 8 * HZ) continue;                          // 8초: 잘라 다시 셀 때 analyzeWalk의 tooShort(8초 미만)와 맞춤
    const t0 = samples[0].t + (p * 1000) / HZ, t1 = samples[0].t + (q * 1000) / HZ;
    const r = analyzeWalk(samples.filter(o => o.t >= t0 && o.t <= t1), { position, activity });
    if (!r.error && r.regularity >= 0.4) { activeS += r.activeS; steps += (r.activeS * r.cadence) / 60; walkSegs++; }
  }
  steps = Math.round(steps);
  if (regularity < 0.4) warnings.push('irregular');
  if (!run && cadence >= 170) warnings.push('running');
  if (run && cadence < RUN_CAD) warnings.push('walkLike');            // 달리기치고 낮음 → 걷기였거나 측정 오류 가능                   // Neumann 15장: 걷기→달리기 전환 약 180걸음/분
  if (cadence < 80) warnings.push('slow');                         // 느린 걸음은 기기 오차↑ (Mora-Gonzalez 2022, Simonsen 2020)
  if (position === 'hand') warnings.push('hand');

  // 꾸준히 걸은 구간의 시각 (samples의 t 기준, ms) → GPS 거리 계산에 씀
  const steadyFrom = samples[0].t + (s * 1000) / HZ, steadyTo = samples[0].t + (e * 1000) / HZ;
  return { cadence, steps, strideS: stride, activeS, walkSegs, totalS, regularity, stepReg, sd, warnings, steadyFrom, steadyTo };
}

// ── 자동 구분 (검증 안 된 규칙 → 결과에 '참고'·'검증 안 됨'으로 표시) ──
// 걷기/달리기: 달리기 방식 케이던스가 140 이상(walkLike 경고와 같은 선)이고 흔들림도 커야 달리기.
// 케이던스만으로는 '허벅지 달리기'와 '허리 걷기'의 반복 간격이 같아서 흔들림 세기를 함께 봄.
// ponytail: RUN_SD는 가짜 신호로만 맞춘 값 → 실제 기록(시트의 sd 값)으로 보정 필요
export const RUN_CAD = 140, RUN_SD = 3;   // 걸음/분, m/s²
// 빠르게 걸은 분: 1분씩 잘라 그 1분 동안 걸은 걸음 수(= 그 분의 분당 걸음)가 100 이상인 분을 셈. 끝에 남은 1분 미만은 세지 않음
// 100걸음/분 ≈ 중간 강도 3 METs (McAvoy 2021, 21~60세 / Tudor-Locke 2021, 61~85세, 집단 평균)
export function fastMinutes(samples, opts, limit = 100) {
  const t0 = samples[0].t, total = Math.floor((samples[samples.length - 1].t - t0) / 60000);
  let fast = 0;
  for (let k = 0; k < total; k++) {
    const r = analyzeWalk(samples.filter(p => p.t >= t0 + k * 60000 && p.t < t0 + (k + 1) * 60000), opts);
    if (!r.error && r.steps >= limit) fast++;
  }
  return { fastMin: fast, minutes: total };
}

export function guessActivity(samples, position) {
  const pos = position && position !== 'auto' ? position : guessPosition(samples, 'run');   // 위치를 모르면 짐작 (허리면 한 걸음 해석이 달라짐)
  const r = analyzeWalk(samples, { position: pos, activity: 'run' });
  if (r.error) return null;
  return r.cadence >= RUN_CAD && r.sd > RUN_SD ? 'run' : 'walk';
}
// 30초 조각들의 판정(walk/run)으로 전체 활동을 고름: 적은 쪽이 2조각 이상이고 20% 이상일 때만 슬로우 러닝 (20분 걷기 중 2조각이 잘못 잡혀 슬로우 러닝이 되던 문제, 제보 K-37856D5D)
export function mixActivity(labels) {
  const w = labels.filter(Boolean), nRun = w.filter(a => a === 'run').length, nWalk = w.length - nRun, few = Math.min(nRun, nWalk);
  if (!w.length) return null;
  if (few >= 2 && few >= 0.2 * w.length) return 'slowrun';
  return nRun > nWalk ? 'run' : 'walk';
}
// 슬로우 러닝의 '조깅 1분' 구간: 실제로 걸었으면(guessActivity와 같은 기준) 걷기 방식으로 다시 계산 → 한 걸음을 한 주기로 읽어 케이던스가 2배로 나오던 문제 (데이터분석팀 10/27, 230걸음/분 기록 2건)
export function analyzeJog(samples, position) {
  const r = analyzeWalk(samples, { position, activity: 'run' });
  if (r.error || (r.cadence >= RUN_CAD && r.sd > RUN_SD)) return { r, jog: true };
  return { r: analyzeWalk(samples, { position, activity: 'walk' }), jog: false };
}
// 휴대폰 위치: 화면이 하늘을 보면 손, 아니면 허벅지(같은 다리 주기만 강함) / 허리(걸음마다 비슷, Perry 7장)
// ponytail: 0.7·0.5 기준은 검증 안 됨. 손을 옆에 늘어뜨리고 걸으면 손으로 못 알아봄
export function guessPosition(samples, activity) {
  let x = 0, y = 0, z = 0;
  for (const p of samples) { x += p.x; y += p.y; z += p.z; }
  if (Math.abs(z) / (Math.hypot(x, y, z) || 1) > 0.7) return 'hand';
  const r = analyzeWalk(samples, { position: 'pocket', activity });
  if (r.error || !r.regularity) return 'pocket';
  return r.stepReg / r.regularity > 0.5 ? 'waist' : 'pocket';
}

const GPS_MIN_S = 60, GPS_MIN_M = 50, GPS_MAX_ACC = 20;
function haversine(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 경로 지도의 km 표시: [[위도, 경도], …] 경로를 따라 누적 거리가 1km(10km 넘으면 2km)마다 되는 지점 → [[위도, 경도, km], …]
export function routeMarks(pts) {
  const seg = pts.slice(1).map((p, i) => haversine({ lat: pts[i][0], lon: pts[i][1] }, { lat: p[0], lon: p[1] }));
  const total = seg.reduce((s, d) => s + d, 0), step = total > 10000 ? 2000 : 1000, out = [];
  let done = 0, next = step;
  seg.forEach((d, i) => {
    while (d > 0 && done + d >= next) { const f = (next - done) / d, a = pts[i], b = pts[i + 1];
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, next / 1000]); next += step; }
    done += d;
  });
  return out;
}

// points: [{t: ms(samples와 같은 시계), lat, lon, acc(m)}] → 꾸준히 걸은 구간의 GPS 속도
// 위치 떨림이 거리로 쌓이지 않게 10초씩 묶어 평균 낸 점들을 이음
// ponytail: 10초보다 짧게 꺾이는 길은 모서리가 잘려 조금 짧게 나옴 → 필요하면 칼만 필터·도플러 속도로 교체
const GPS_BLOCK_MS = 10000;
function blockPath(pts) {
  const blocks = [];
  for (const p of pts) {
    const b = (blocks[Math.floor((p.t - pts[0].t) / GPS_BLOCK_MS)] ??= { t: 0, lat: 0, lon: 0, n: 0 });
    b.t += p.t; b.lat += p.lat; b.lon += p.lon; b.n++;
  }
  const c = blocks.filter(Boolean).map(b => ({ t: b.t / b.n, lat: b.lat / b.n, lon: b.lon / b.n }));
  let dist = 0;
  for (let i = 1; i < c.length; i++) dist += haversine(c[i - 1], c[i]);
  const accs = pts.map(p => p.acc).sort((a, b) => a - b);
  return { dist, durS: c.length > 1 ? (c[c.length - 1].t - c[0].t) / 1000 : 0, medAcc: accs[accs.length >> 1], blocks: c.length };
}
// 12분 달리기 테스트: 기간 안의 GPS 점 전체로 달린 거리 (멈춘 구간도 포함)
export function gpsDistance(points) {
  const pts = points.filter(p => p.acc <= GPS_MAX_ACC);
  if (pts.length < 2) return null;
  const r = blockPath(pts);
  return r.blocks < 2 ? null : r;
}
export function gpsSpeed(result, points) {
  if (result.error) return { gpsError: 'noWalk' };
  const pts = points.filter(p => p.acc <= GPS_MAX_ACC && p.t >= result.steadyFrom && p.t <= result.steadyTo);
  if (pts.length < 2) return { gpsError: 'noFix' };
  const { dist, durS, medAcc } = blockPath(pts);
  if (durS < GPS_MIN_S || dist < GPS_MIN_M) return { gpsError: 'tooShort', gpsDurS: durS, gpsDist: dist, medAcc };
  const speed = dist / durS;
  // 거리는 걸은 구간 전체로 환산 (출발·멈춤 포함 시간 × 꾸준한 속도라 약간 길게 나올 수 있음)
  return { speed, stepLength: speed * 60 / result.cadence, distance: speed * result.activeS, gpsDurS: durS, medAcc };
}

// 걸은 거리를 알 때: 걷는 속도·걸음 길이 (센서가 잰 '걷는 시간' 기준이라 참고값)
export function withDistance(result, distanceM) {
  if (!distanceM || result.error) return {};
  const speed = distanceM / result.activeS;
  return { speed, stepLength: distanceM / result.steps, walkRatio: (distanceM / result.steps) / result.cadence };
}

// 계단 오르기 (민원팀·아버님 10/28): 기압계 값 [{t, hpa}] → 올라간 높이(m). 오르기만 셈
// 높이 = 국제표준대기 기압 공식 44330·(1 − (p/p0)^0.1903). 2초 평균으로 잡음을 줄이고, 마지막 기준보다 STAIR_STEP_M 넘게 오를 때만 더함(내려가면 기준만 낮춤)
// 걷는 중(같은 2초 가속도 흔들림 ≥ STAIR_MOVE_SD, app.js STILL_SD와 같은 값)일 때만 더하고, 가만히 있을 땐 기준만 따라감 → 날씨로 바뀐 기압·엘리베이터는 빠짐 (검수팀 10/29)
// ponytail: 걸으면서 바뀐 날씨 기압은 여전히 섞임(1hPa/시간 ≈ 10분에 1.4m) → 계단은 짧게 재는 걸 전제
export const STAIR_STEP_M = 0.5, FLOOR_M = 3, STAIR_MOVE_SD = 0.6;   // 한 층 높이는 아파트 보통 값으로 가정 (참고)
export function stairClimb(press, samples) {
  const p = (press ?? []).filter(x => x.hpa > 300 && x.hpa < 1100);
  if (p.length < 10) return null;
  const B = new Map();                                                     // 1초 칸마다 가속도 크기 합·제곱합·개수
  for (const s of samples ?? []) { const k = Math.floor(s.t / 1000), m = Math.hypot(s.x, s.y, s.z), b = B.get(k) ?? [0, 0, 0]; b[0] += m; b[1] += m * m; b[2]++; B.set(k, b); }
  const moving = t => {                                                  // t 앞 2초의 흔들림 (가속도가 없으면 걷는 중으로 봄)
    if (!samples) return true;
    let a = 0, q = 0, n = 0;
    for (let k = Math.floor(t / 1000) - 2; k <= Math.floor(t / 1000); k++) { const b = B.get(k); if (b) { a += b[0]; q += b[1]; n += b[2]; } }
    return n > 10 && Math.sqrt(Math.max(0, q / n - (a / n) ** 2)) >= STAIR_MOVE_SD;
  };
  const h = p.map(x => 44330 * (1 - (x.hpa / p[0].hpa) ** 0.1903));
  let ref = null, gain = 0, j = 0, sum = 0;
  for (let i = 0; i < p.length; i++) {                                     // 지난 2초 평균
    sum += h[i];
    while (p[i].t - p[j].t > 2000) sum -= h[j++];
    const v = sum / (i - j + 1);
    if (ref == null) ref = v;
    else if (v - ref >= STAIR_STEP_M) { if (moving(p[i].t)) gain += v - ref; ref = v; }
    else if (v < ref - STAIR_STEP_M) ref = v;
  }
  return { climbM: gain, floors: Math.floor(gain / FLOOR_M + 0.3) };       // 2.1m부터 1층으로 셈 (층 높이가 2.8~3m라서)
}
