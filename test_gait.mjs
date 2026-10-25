// 걸음 분석 자체 점검: node test_gait.mjs
// 가짜 걷기 신호(앞뒤 3초 서 있기 포함)를 만들어 케이던스를 2% 안으로 맞히는지 확인
import assert from 'node:assert/strict';
import { analyzeWalk, withDistance, gpsSpeed, gpsDistance, guessActivity, guessPosition } from './gait.js';

function fakeWalk({ cadence, walkS = 20, position, hz = 60, seed = 1, amp = 1 }) {   // amp: 달리기는 흔들림이 큼
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
      else a += amp * ((n % 2 ? 0.4 : 3.2) * bump + 2.0 * Math.sin(Math.PI * k)); // 허벅지: 같은 다리 주기가 강함
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
const flat = fakeWalk({ cadence: 110, position: 'pocket' }).map(p => ({ t: p.t, x: 0, y: 1, z: p.y }));   // 화면이 하늘을 봄
assert.equal(guessPosition(flat, 'walk'), 'hand');
console.log('모든 점검 통과');
