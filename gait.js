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

// 1초 창의 표준편차가 기준을 넘는 가장 긴 구간 = 실제로 걸은 구간
export function activeSegment(x, hz = HZ) {
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
  let best = [0, 0], start = -1, gap = 0;
  for (let i = 0; i <= x.length; i++) {
    if (i < x.length && on[i]) { if (start < 0) start = i; gap = 0; }
    else if (start >= 0 && (++gap > hz / 2 || i === x.length)) {   // 0.5초 넘게 멈추면 끊김
      const end = i - gap + 1;
      if (end - start > best[1] - best[0]) best = [start, end];
      start = -1; gap = 0;
    }
  }
  return best;
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
const RUN_MIN = 120, RUN_MAX = 230;   // 달리기 케이던스로 볼 범위 (걸음/분). 이 범위에선 한 걸음·한 주기 해석이 겹치지 않음
export function analyzeWalk(samples, { position = 'pocket', activity = 'walk' } = {}) {
  const run = activity === 'run';
  const warnings = [];
  const totalS = (samples[samples.length - 1].t - samples[0].t) / 1000;
  if (samples.length < 50 || totalS < 8) return { error: 'tooShort', totalS };

  const x = movingAvg(resample(samples), 5);          // 0.1초 평활
  const [a0, a1] = activeSegment(x);
  const activeS = (a1 - a0) / HZ;
  if (activeS < 6) return { error: 'noWalk', totalS, activeS };

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
  if (run) stride = (60 / S >= RUN_MIN && 60 / S <= RUN_MAX) || position === 'waist' ? 2 * S : S;   // S가 한 걸음이면 60/S가 달리기 범위. 허리는 양발 걸음이 똑같이 보여 S가 늘 한 걸음 (허리에 차고 걸은 110을 220으로 세던 문제, 제보 K-37856D5D)
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

  const cadence = 120 / stride;
  const steps = Math.round((activeS * cadence) / 60);
  if (regularity < 0.4) warnings.push('irregular');
  if (!run && cadence >= 170) warnings.push('running');
  if (run && cadence < RUN_CAD) warnings.push('walkLike');            // 달리기치고 낮음 → 걷기였거나 측정 오류 가능                   // Neumann 15장: 걷기→달리기 전환 약 180걸음/분
  if (cadence < 80) warnings.push('slow');                         // 느린 걸음은 기기 오차↑ (Mora-Gonzalez 2022, Simonsen 2020)
  if (position === 'hand') warnings.push('hand');

  // 꾸준히 걸은 구간의 시각 (samples의 t 기준, ms) → GPS 거리 계산에 씀
  const steadyFrom = samples[0].t + (s * 1000) / HZ, steadyTo = samples[0].t + (e * 1000) / HZ;
  return { cadence, steps, strideS: stride, activeS, totalS, regularity, stepReg, sd, warnings, steadyFrom, steadyTo };
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
