// 걸음 분석 자체 점검: node test_gait.mjs
// 가짜 걷기 신호(앞뒤 3초 서 있기 포함)를 만들어 케이던스를 2% 안으로 맞히는지 확인
import assert from 'node:assert/strict';
import { analyzeWalk, withDistance, gpsSpeed } from './gait.js';

function fakeWalk({ cadence, walkS = 20, position, hz = 60, seed = 1 }) {
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
      if (position === 'waist') a += (n % 2 ? 2.6 : 3.0) * bump + 0.8 * Math.sin(2 * Math.PI * k);
      else a += (n % 2 ? 0.4 : 3.2) * bump + 2.0 * Math.sin(Math.PI * k); // 허벅지: 같은 다리 주기가 강함
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
console.log('모든 점검 통과');
