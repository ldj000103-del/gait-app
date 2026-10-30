// 걸음 분석 자체 점검: node test_gait.mjs
// 가짜 걷기 신호(앞뒤 3초 서 있기 포함)를 만들어 케이던스를 2% 안으로 맞히는지 확인
import assert from 'node:assert/strict';
import { analyzeWalk, fastMinutes, withDistance, gpsSpeed, gpsDistance, guessActivity, guessPosition, routeMarks, analyzeJog, mixActivity, stairClimb } from './gait.js';

function fakeWalk({ cadence, walkS = 20, position, hz = 60, seed = 1, amp = 1, odd = 0.4, sw = 2.0 }) {   // amp: 달리기는 흔들림이 큼
  let r = seed;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5);
  const step = 60 / cadence, samples = [];
  const pad = 3, total = walkS + 2 * pad;
  for (let i = 0; i < total * hz; i++) {
    const t = i / hz;
    let a = 9.81 + rand() * 0.15;
    if (t > pad && t < pad + walkS) {
      const k = (t - pad) / step, n = Math.floor(k), ph = k - n;
      const bump = Math.exp(-(((ph - 0.15) / 0.07) ** 2));            // 발 닿는 충격
      if (position === 'waist') a += amp * ((n % 2 ? 2.6 : 3.0) * bump + 0.8 * Math.sin(2 * Math.PI * k));
      else a += amp * ((n % 2 ? odd : 3.2) * bump + sw * Math.sin(Math.PI * k)); // 허벅지: 같은 다리 주기가 강함
      a += rand() * 0.4;
    }
    samples.push({ t: t * 1000, x: 0, y: a, z: 0 });
  }
  return samples;
}

const cases = [
  ['pocket', 113], ['pocket', 95], ['pocket', 130], ['pocket', 70],
  ['waist', 113], ['waist', 95], ['waist', 130], ['waist', 70],
];
for (const [position, cadence] of cases) {
  const res = analyzeWalk(fakeWalk({ cadence, position }), { position });
  assert.ok(!res.error, `${position} ${cadence}: ${res.error}`);
  const err = Math.abs(res.cadence - cadence) / cadence;
  console.log(`${position.padEnd(6)} 정답 ${cadence} → ${res.cadence.toFixed(1)}걸음/분 (오차 ${(err * 100).toFixed(2)}%), 걸음 ${res.steps}, 걷는 시간 ${res.activeS.toFixed(1)}초`);
  assert.ok(err < 0.02, `케이던스 오차 ${(err * 100).toFixed(1)}%`);
  assert.ok(Math.abs(res.activeS - 20) < 1.5, `걷는 시간 ${res.activeS}`);
}

const short = analyzeWalk(fakeWalk({ cadence: 110, walkS: 3, position: 'pocket' }));
assert.equal(short.error, 'noWalk');

const r = analyzeWalk(fakeWalk({ cadence: 113, position: 'pocket' }));
const d = withDistance(r, 28);
assert.ok(Math.abs(d.speed - 1.4) < 0.1, `속도 ${d.speed}`);
// 달리기: 케이던스 140~200, 주머니·허리 모두 2% 안
for (const position of ['pocket', 'waist']) for (const cadence of [140, 160, 175, 190, 200]) {
  const res = analyzeWalk(fakeWalk({ cadence, position, walkS: 30 }), { position, activity: 'run' });
  assert.ok(!res.error, `run ${position} ${cadence}: ${res.error}`);
  const err = Math.abs(res.cadence - cadence) / cadence;
  console.log(`run ${position.padEnd(6)} 정답 ${cadence} → ${res.cadence.toFixed(1)}`);
  assert.ok(err < 0.02, `달리기 케이던스 오차 ${(err * 100).toFixed(1)}%`);
  assert.ok(!res.warnings.includes('running'), '러닝 모드에선 running 경고 없음');
}

// GPS: 1초마다 위치, 오차 약 5m(무작위), 앞뒤 3초 서 있기 포함
function fakeGps({ walkS, speed = 1.3, acc = 5, seed = 7 }) {
  let r = seed;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5);
  const pts = [], mPerDeg = 111320, pad = 3;
  for (let t = 0; t <= walkS + 2 * pad; t++) {
    const north = Math.min(Math.max(t - pad, 0), walkS) * speed;
    const nx = (rand() + rand()) * acc, ny = (rand() + rand()) * acc;  // 위치 떨림
    pts.push({ t: t * 1000, lat: 37.5 + (north + ny) / mPerDeg, lon: 127 + nx / (mPerDeg * Math.cos(37.5 * Math.PI / 180)), acc });
  }
  return pts;
}
const long = analyzeWalk(fakeWalk({ cadence: 110, walkS: 90, position: 'pocket' }));
const g = gpsSpeed(long, fakeGps({ walkS: 90 }));
assert.ok(!g.gpsError, `GPS ${g.gpsError}`);
console.log(`GPS 90초: 정답 1.30 → ${g.speed.toFixed(2)} m/s, 걸음 길이 ${(g.stepLength * 100).toFixed(0)}cm, 거리 ${g.distance.toFixed(0)}m`);
assert.ok(Math.abs(g.speed - 1.3) / 1.3 < 0.1, `GPS 속도 ${g.speed}`);
assert.equal(gpsSpeed(r, fakeGps({ walkS: 20 })).gpsError, 'tooShort');      // 20초는 속도 안 냄
assert.equal(gpsSpeed(long, fakeGps({ walkS: 90, acc: 30 })).gpsError, 'noFix'); // 실내처럼 오차 큼
// 12분 달리기: 3 m/s로 720초 = 2160m (앞뒤 3초 서 있기 포함)
const cd = gpsDistance(fakeGps({ walkS: 720, speed: 3 }));
console.log(`12분 GPS 거리: 정답 2160 → ${cd.dist.toFixed(0)}m`);
assert.ok(Math.abs(cd.dist - 2160) / 2160 < 0.03, `12분 거리 ${cd.dist}`);
assert.equal(gpsDistance(fakeGps({ walkS: 720, acc: 30 })), null);           // 오차 큰 점만 있으면 계산 안 함
// 자동 구분: 걷기(흔들림 보통) / 달리기(흔들림 4배로 가정한 가짜 신호), 휴대폰 위치 짐작
for (const position of ['pocket', 'waist']) {
  for (const cadence of [80, 100, 113, 130]) {
    const f = fakeWalk({ cadence, position, walkS: 30 }), r = analyzeWalk(f, { activity: 'run' });
    console.log(`자동 ${position} 걷기 ${cadence}: ${guessActivity(f)} / ${guessPosition(f, 'walk')} (sd ${r.sd?.toFixed(1)})`);
    assert.equal(guessActivity(f), 'walk'); assert.equal(guessPosition(f, 'walk'), position);
  }
  for (const cadence of [150, 165, 180, 200]) {
    const f = fakeWalk({ cadence, position, walkS: 30, amp: 4 }), r = analyzeWalk(f, { activity: 'run' });
    console.log(`자동 ${position} 달리기 ${cadence}: ${guessActivity(f)} / ${guessPosition(f, 'run')} (sd ${r.sd?.toFixed(1)})`);
    assert.equal(guessActivity(f), 'run'); assert.equal(guessPosition(f, 'run'), position);
  }
}
// 슬로우 러닝 조깅 구간: 실제로 걸었으면 걷기로 계산(2배 안 나옴), 진짜 조깅은 그대로
for (const position of ['pocket', 'waist']) {
  const w = analyzeJog(fakeWalk({ cadence: 110, position, walkS: 60 }), position), j = analyzeJog(fakeWalk({ cadence: 165, position, walkS: 60, amp: 4 }), position);
  console.log(`조깅 구간 ${position}: 걸음 110 → ${w.jog ? '조깅' : '걷기'} ${w.r.cadence.toFixed(0)} / 조깅 165 → ${j.jog ? '조깅' : '걷기'} ${j.r.cadence.toFixed(0)}`);
  assert.ok(!w.jog && Math.abs(w.r.cadence - 110) < 4, '걸은 조깅 구간');
  assert.ok(j.jog && Math.abs(j.r.cadence - 165) < 5, '진짜 조깅 구간');
}
console.log('슬로우 러닝 조깅 구간 점검 통과');
// 제보 K-37856D5D: 허리에 차고 세게 걸은 110을 220으로 세 달리기로 보던 문제, 걷기 사이 2조각만 달리기로 잡혀도 슬로우 러닝이 되던 문제
for (const c of [90, 110]) {
  const f = fakeWalk({ cadence: c, position: 'waist', walkS: 30, amp: 3 });
  console.log(`허리 걷기 ${c} 흔들림 3배: ${guessActivity(f, 'waist')} (달리기 방식 ${analyzeWalk(f, { position: 'waist', activity: 'run' }).cadence.toFixed(0)})`);
  assert.equal(guessActivity(f, 'waist'), 'walk');
}
assert.equal(mixActivity([...Array(38).fill('walk'), 'run', 'run']), 'walk');
assert.equal(mixActivity([...Array(30).fill('walk'), ...Array(10).fill('run')]), 'slowrun');
assert.equal(mixActivity([...Array(8).fill('run'), 'walk', null]), 'run');
assert.equal(mixActivity([null]), null);
// K-1A100B97: 양발 충격이 비슷하고 같은 다리 주기가 약한 주머니 걷기 106을 달리기 방식이 212로 세던 문제 (흔들림 sd가 3을 넘어도 걷기)
for (const amp of [4, 5, 6]) {
  const f = fakeWalk({ cadence: 106, position: 'pocket', walkS: 30, amp, odd: 3.2, sw: 0 }), r = analyzeWalk(f, { activity: 'run' }), j = analyzeJog(f, 'pocket');
  console.log(`주머니 걷기 106 양발 같음 amp ${amp}: 달리기 방식 ${r.cadence.toFixed(0)} (sd ${r.sd.toFixed(1)}) · ${guessActivity(f, 'pocket')} · 조깅 구간 ${j.jog ? '조깅' : '걷기'} ${j.r.cadence.toFixed(0)}`);
  assert.equal(guessActivity(f, 'pocket'), 'walk'); assert.ok(!j.jog && Math.abs(j.r.cadence - 106) < 4);
}
console.log('걷기 오판 점검 통과');
const flat = fakeWalk({ cadence: 110, position: 'pocket' }).map(p => ({ t: p.t, x: 0, y: 1, z: p.y }));   // 화면이 하늘을 봄
assert.equal(guessPosition(flat, 'walk'), 'hand');
console.log('모든 점검 통과');

// 빠르게 걸은 분: 110걸음/분으로 2분 넘게 걸으면 2분, 95면 0분, 1분 미만이면 전체 0분
{
  const fast = fastMinutes(fakeWalk({ cadence: 110, walkS: 130, position: 'pocket' }), { position: 'pocket' });
  assert.deepEqual(fast, { fastMin: 2, minutes: 2 }, `빠르게 걸은 분 110: ${JSON.stringify(fast)}`);
  const slow = fastMinutes(fakeWalk({ cadence: 95, walkS: 130, position: 'pocket' }), { position: 'pocket' });
  assert.deepEqual(slow, { fastMin: 0, minutes: 2 }, `빠르게 걸은 분 95: ${JSON.stringify(slow)}`);
  assert.equal(fastMinutes(fakeWalk({ cadence: 110, walkS: 40, position: 'pocket' }), { position: 'pocket' }).minutes, 0);
  console.log('빠르게 걸은 분 점검 통과');
}
{ // 경로 km 표시: 북쪽으로 0.001°(약 111m)씩 → 2.5km면 1·2km, 12km면 2km 간격
  const line = n => Array.from({ length: n + 1 }, (_, i) => [37 + i * 0.001, 127]);
  assert.deepEqual(routeMarks(line(5)), []);
  const m = routeMarks(line(23));
  assert.deepEqual(m.map(x => x[2]), [1, 2]);
  assert.ok(Math.abs(m[0][0] - (37 + 1000 / 111195)) < 1e-4, `1km 지점 위도: ${m[0][0]}`);
  assert.deepEqual(routeMarks(line(108)).map(x => x[2]), [2, 4, 6, 8, 10, 12]);
  console.log('경로 km 표시 점검 통과');
}

{ // 계단: 5Hz 기압, 1m = 약 0.12hPa, 잡음 ±0.03hPa
  let r = 3; const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5);
  const mk = hs => hs.map((m, i) => ({ t: i * 200, hpa: 1013.25 * (1 - m / 44330) ** (1 / 0.1903) + rand() * 0.06 }));
  const ramp = (a, b, s) => Array.from({ length: s * 5 }, (_, i) => a + (b - a) * i / (s * 5));
  const up = stairClimb(mk([...ramp(0, 0, 10), ...ramp(0, 30, 300), ...ramp(30, 30, 10)]));
  assert.ok(Math.abs(up.climbM - 30) < 1.5, `30m 오름: ${up.climbM}`); assert.equal(up.floors, 10);
  const updown = stairClimb(mk([...ramp(0, 10, 100), ...ramp(10, 0, 100), ...ramp(0, 10, 100)]));
  assert.ok(Math.abs(updown.climbM - 20) < 1.5, `오르내림은 오른 것만: ${updown.climbM}`);
  const flat = stairClimb(mk(ramp(0, 0, 120)));
  assert.ok(flat.climbM < 0.6, `평지 잡음: ${flat.climbM}`);
  assert.equal(stairClimb([]), null);
  // 가속도와 같이: 걷는 동안(흔들림 큼)만 셈 — 가만히 30분 + 날씨 −1hPa/시간, 엘리베이터 10층 30초는 0
  const acc = (s, walk) => Array.from({ length: s * 50 }, (_, i) => ({ t: i * 20, x: 0, y: 9.81 + (walk ? 2 * Math.sin(i / 3) : rand() * 0.05), z: 0 }));
  const weather = Array.from({ length: 1800 * 5 }, (_, i) => ({ t: i * 200, hpa: 1013 - i * 0.2 / 3600 + rand() * 0.06 }));
  assert.ok(stairClimb(weather, acc(1800, false)).climbM < 0.6, '가만히 + 날씨는 0');
  const lift = mk([...ramp(0, 0, 10), ...ramp(0, 30, 30), ...ramp(30, 30, 10)]);
  assert.equal(stairClimb(lift, acc(50, false)).climbM, 0, '엘리베이터는 0');
  const upW = stairClimb(mk([...ramp(0, 0, 10), ...ramp(0, 30, 300), ...ramp(30, 30, 10)]), acc(320, true));
  assert.ok(Math.abs(upW.climbM - 30) < 1.5, `걸으며 30m: ${upW.climbM}`);
  console.log('계단 높이 점검 통과');
}

// 걷다 서다 반복 (K-B8EC7CAB 아버님 '24분 쟀는데 299보', 검수팀 10/30): 2분 30초 걷기 + 40초 서기 × 9 → 걸은 구간을 모두 더해야 함
// 중간에 30초 '서서 몸만 움직임'(규칙 없는 흔들림)을 넣어도 걸음으로 세지 않아야 함
{
  let r = 11; const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5);
  const hz = 60, cad = 117, step = 60 / cad, samples = [];
  const plan = []; for (let k = 0; k < 9; k++) plan.push(['walk', 150], ['still', 40]); plan.splice(5, 0, ['fidget', 30]);
  let t0 = 0, walkS = 0;
  for (const [kind, dur] of plan) {
    for (let i = 0; i < dur * hz; i++) {
      const t = t0 + i / hz; let a = 9.81 + rand() * 0.15;
      if (kind === 'walk') { const k = (i / hz) / step, n = Math.floor(k), ph = k - n; a += (n % 2 ? 0.4 : 3.2) * Math.exp(-(((ph - 0.15) / 0.07) ** 2)) + 2.0 * Math.sin(Math.PI * k) + rand() * 0.4; }
      if (kind === 'fidget') a += rand() * 4;
      samples.push({ t: t * 1000, x: 0, y: a, z: 0 });
    }
    t0 += dur; if (kind === 'walk') walkS += dur;
  }
  const res = analyzeWalk(samples, { position: 'pocket' }), want = walkS * cad / 60;
  console.log(`걷다 서다 ×9: 케이던스 ${res.cadence.toFixed(1)}, 걸음 ${res.steps} (실제 ${Math.round(want)}), 걸은 시간 ${(res.activeS / 60).toFixed(1)}분, 걸은 구간 ${res.walkSegs}개`);
  assert.ok(Math.abs(res.cadence - cad) / cad < 0.02, `케이던스 ${res.cadence}`);
  assert.ok(Math.abs(res.steps - want) / want < 0.03, `걸음 ${res.steps} / ${want}`);
  assert.equal(res.walkSegs, 9, '서서 몸만 움직인 30초는 빠짐');
  const one = analyzeWalk(fakeWalk({ cadence: 113, walkS: 300, position: 'pocket' }), { position: 'pocket' });   // 쭉 걷기는 그대로
  assert.ok(Math.abs(one.steps - 565) <= 6 && one.walkSegs === 1, `쭉 걷기 ${one.steps}`);
}
