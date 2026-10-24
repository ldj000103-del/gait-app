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
export function analyzeWalk(samples, { position = 'pocket' } = {}) {
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
  for (let i = Math.round(0.3 * HZ); i < ac.length - 1; i++) if (ac[i] > ac[i - 1] && ac[i] >= ac[i + 1]) peaks.push(i);
  if (!peaks.length) return { error: 'irregular', totalS, activeS };
  const top = Math.max(...peaks.map(i => ac[i]));
  const S = peaks.find(i => ac[i] >= 0.85 * top) / HZ;    // 가장 짧은 '강한 반복' 주기

  // S가 한 걸음인지 한 보행 주기(두 걸음)인지 판단
  let stride;
  const half = peakNear(ac, (S / 2) * HZ, 0.15);
  if (S < 0.75) stride = 2 * S;                                   // 주기 0.75초 미만 = 한 걸음 (케이던스 160 넘는 보행 주기는 없음)
  else if (half > 0 && ac[half] > 0.25) stride = S;               // 절반 지점에도 반복 → S는 보행 주기
  else if (S > 1.3) stride = S;                                   // 한 걸음 1.3초 초과는 비현실적
  // ponytail: 0.75~1.3초 사이는 위치 정보로만 판단. 허리에 차고 아주 느리게(케이던스 80 미만) 걸으면 틀릴 수 있음 → 실측 데이터로 보정 필요
  else stride = position === 'waist' ? 2 * S : S;

  // 보행 주기 봉우리를 다시 찾아 보간 (더 긴 주기라 오차가 작음)
  const sp = peakNear(ac, stride * HZ, 0.12);
  if (sp > 0) stride = refinePeak(ac, sp) / HZ;
  const regularity = sp > 0 ? ac[sp] : 0;

  const cadence = 120 / stride;
  const steps = Math.round((activeS * cadence) / 60);
  if (regularity < 0.4) warnings.push('irregular');
  if (cadence >= 170) warnings.push('running');                   // Neumann 15장: 걷기→달리기 전환 약 180걸음/분
  if (cadence < 80) warnings.push('slow');                         // 느린 걸음은 기기 오차↑ (Mora-Gonzalez 2022, Simonsen 2020)
  if (position === 'hand') warnings.push('hand');

  return { cadence, steps, strideS: stride, activeS, totalS, regularity, warnings };
}

// 걸은 거리를 알 때: 걷는 속도·걸음 길이 (센서가 잰 '걷는 시간' 기준이라 참고값)
export function withDistance(result, distanceM) {
  if (!distanceM || result.error) return {};
  const speed = distanceM / result.activeS;
  return { speed, stepLength: distanceM / result.steps, walkRatio: (distanceM / result.steps) / result.cadence };
}
