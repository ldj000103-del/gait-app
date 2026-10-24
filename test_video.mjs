// 영상 분석 자체 점검: node test_video.mjs
// 각도를 알고 있는 가짜 걷기 뼈대를 만들어 계산이 그 각도를 되찾는지 확인
import assert from 'node:assert/strict';
import { analyzeSide, analyzeFrontal } from './video.js';

const W = 1280, H = 720, R = Math.PI / 180;
const bump = (p, c, w) => Math.exp(-(((p - c) / w) ** 2));
const blank = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));

// 옆모습: Perry 비슷한 곡선 (무릎 최대 60° at 70%, 넓적다리 ±20°)
function sideFrames({ dir = 1, strideS = 1.1, secs = 6, fps = 30 }) {
  const frames = [];
  for (let i = 0; i < secs * fps; i++) {
    const t = i / fps, p = (t / strideS) % 1;
    const thigh = 20 * Math.cos(2 * Math.PI * p);
    const knee = 5 + 13 * bump(p, 0.12, 0.06) + 55 * bump(p, 0.7, 0.1);
    const ank = -10 * bump(p, 0.07, 0.04) + 10 * bump(p, 0.4, 0.08) - 20 * bump(p, 0.62, 0.05);
    const hip = { x: 200 + dir * 120 * t + (dir < 0 ? 900 : 0), y: 300 };
    const kn = { x: hip.x + dir * 150 * Math.sin(thigh * R), y: hip.y + 150 * Math.cos(thigh * R) };
    const sh = thigh - knee;
    const an = { x: kn.x + dir * 150 * Math.sin(sh * R), y: kn.y + 150 * Math.cos(sh * R) };
    const fa = sh + 90 + ank, fu = { x: dir * Math.sin(fa * R), y: Math.cos(fa * R) };
    const heel = { x: an.x - 15 * fu.x, y: an.y - 15 * fu.y }, toe = { x: an.x + 45 * fu.x, y: an.y + 45 * fu.y };
    const lm = blank(), put = (k, q, v = 0.95) => { lm[k] = { x: q.x / W, y: q.y / H, v }; };
    put(23, hip); put(24, hip, 0.4); put(25, kn); put(27, an); put(29, heel); put(31, toe);
    put(26, kn, 0.3); put(28, an, 0.3); put(30, heel, 0.3); put(32, toe, 0.3);   // 먼 쪽 다리는 흐리게
    frames.push({ t, lm });
  }
  return frames;
}
for (const dir of [1, -1]) {
  const r = analyzeSide(sideFrames({ dir }), W, H);
  assert.ok(!r.error, r.error);
  const m = r.m;
  console.log(`옆(${dir > 0 ? '→' : '←'}) 주기 ${r.nCycles}개, 케이던스 ${r.cadence.toFixed(1)}(정답 109.1), 유각 무릎 최대 ${m.kneeSwingMax.toFixed(1)}°(60), 넓적다리 굽힘 ${m.thighFlex.toFixed(1)}°(20) 폄 ${m.thighExt.toFixed(1)}°(20), 발목 발등 ${m.ankleDF.toFixed(1)}°(10) 발바닥 ${m.anklePF.toFixed(1)}°(20)`);
  assert.equal(r.side, 'l');
  assert.ok(Math.abs(r.cadence - 109.1) < 2, '케이던스');
  assert.ok(Math.abs(m.kneeSwingMax - 60) < 3, '무릎 최대');
  assert.ok(Math.abs(m.thighFlex - 20) < 2 && Math.abs(m.thighExt - 20) < 2, '넓적다리');
  assert.ok(Math.abs(m.ankleDF - 10) < 3 && Math.abs(m.anklePF - 20) < 3, '발목');
}

// 앞·뒤: 오른발 디딜 때 왼쪽 골반 5° 내려감, 왼발 디딜 때 왼무릎 8° 안쪽
function frontFrames(view) {
  const frames = [], flip = view === 'front' ? 1 : -1;   // 앞에서 보면 사람 왼쪽이 화면 오른쪽
  for (let i = 0; i < 180; i++) {
    const t = i / 30, leftStance = Math.floor(t / 0.55) % 2 === 0, cx = 640;
    const lx = cx + flip * 60, rx = cx - flip * 60;
    const lHip = { x: lx, y: 300 + (leftStance ? 0 : Math.tan(5 * R) * 120) }, rHip = { x: rx, y: 300 };
    const lAnk = { x: lx, y: leftStance ? 600 : 585 }, rAnk = { x: rx, y: leftStance ? 585 : 600 };
    const d = leftStance ? 150 * Math.tan(4 * R) : 0;
    const lKn = { x: (lHip.x + lAnk.x) / 2 - flip * d, y: (lHip.y + lAnk.y) / 2 }, rKn = { x: rx, y: (rHip.y + rAnk.y) / 2 };
    const lm = blank(), put = (k, q) => { lm[k] = { x: q.x / W, y: q.y / H, v: 0.95 }; };
    put(11, { x: lx, y: 100 }); put(12, { x: rx, y: 100 }); put(23, lHip); put(24, rHip);
    put(25, lKn); put(26, rKn); put(27, lAnk); put(28, rAnk);
    frames.push({ t, lm });
  }
  return frames;
}
for (const view of ['front', 'back']) {
  const r = analyzeFrontal(frontFrames(view), W, H, view);
  assert.ok(!r.error, r.error);
  const m = r.m;
  console.log(`${view}: 반대쪽 골반 내려감 왼발 ${m.dropL.toFixed(1)}°(0) 오른발 ${m.dropR.toFixed(1)}°(5), 무릎 안쪽 왼 ${m.valgusL.toFixed(1)}°(8) 오른 ${m.valgusR.toFixed(1)}°(0), 걸음폭/골반폭 ${m.width.toFixed(2)}(1.00)`);
  assert.ok(Math.abs(m.dropR - 5) < 0.6 && Math.abs(m.dropL) < 0.6, '골반');
  assert.ok(Math.abs(m.valgusL - 8) < 0.8 && Math.abs(m.valgusR) < 0.8, '무릎');
}
assert.equal(analyzeSide(sideFrames({}).slice(0, 10), W, H).error, 'noPerson');
console.log('영상 분석 점검 통과');
