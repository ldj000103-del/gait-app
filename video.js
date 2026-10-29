// 휴대폰 영상(카메라 1대) 보행 분석: 자세 인식 점 → 관절 각도
// 근거: Perry 9장(단계별 기준 각도)·17장(카메라 1대의 한계), refs/video_evidence.md
// 각도 표시 규칙(Perry 17장): 0° = 중립, 양수 = 굽힘·발등굽힘, 음수 = 폄·발바닥굽힘

// MediaPipe Pose 점 번호
const P = { lShoulder: 11, rShoulder: 12, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28, lHeel: 29, rHeel: 30, lToe: 31, rToe: 32 };
const VIS = 0.5;   // 이보다 흐릿하게 잡힌 점은 버림

const deg = r => r * 180 / Math.PI;
function angleAt(a, b, c) {   // b에서 a·c 사이 각도
  const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y];
  return deg(Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))))));
}
function between(u, v) {      // 두 벡터 사이 각도
  return deg(Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))))));
}
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const smooth = (xs, w = 2) => xs.map((_, i) => mean(xs.slice(Math.max(0, i - w), i + w + 1)));
// 정규화 좌표(0~1)를 픽셀로 바꿔 가로세로 비율 왜곡을 없앰
const px = (f, W, H) => f.lm.map(p => ({ x: p.x * W, y: p.y * H, v: p.v ?? 1 }));

// ── 옆모습: 카메라 쪽 다리의 무릎·넓적다리·발목 ──
// frames: [{t: 초, lm: [{x, y, v}] 33개}]
export function analyzeSide(frames, W, H) {
  const pts = frames.map(f => ({ t: f.t, p: px(f, W, H) }));
  const visOf = ids => mean(pts.map(f => mean(ids.map(i => f.p[i].v))));
  const side = visOf([P.lKnee, P.lAnkle]) >= visOf([P.rKnee, P.rAnkle]) ? 'l' : 'r';
  const ix = k => P[side + k];
  const midHipX = f => (f.p[P.lHip].x + f.p[P.rHip].x) / 2;
  let dir = pts.length > 1 && midHipX(pts[pts.length - 1]) >= midHipX(pts[0]) ? 1 : -1;   // 오른쪽으로 걸으면 +1 (첫·끝 장면으로 짐작)

  // 무릎이 엉덩이–발목 선보다 걷는 방향 쪽에 있으면 굽힘(+), 반대쪽이면 뒤로 젖혀짐(−, Perry 12장 과신전)
  const kneeSign = (hip, knee, ankle) => dir * (knee.x - (hip.x + (ankle.x - hip.x) * (knee.y - hip.y) / ((ankle.y - hip.y) || 1))) >= 0 ? 1 : -1;
  const build = () => {
    const out = [];
    for (const f of pts) {
      const [hip, knee, ankle, heel, toe] = ['Hip', 'Knee', 'Ankle', 'Heel', 'Toe'].map(k => f.p[ix(k)]);
      if ([hip, knee, ankle].some(q => q.v < VIS)) continue;
      const footOk = heel.v >= VIS && toe.v >= VIS;
      out.push({
        t: f.t,
        knee: kneeSign(hip, knee, ankle) * (180 - angleAt(hip, knee, ankle)),       // 무릎 굽힘 (뒤로 젖혀지면 −)
        thigh: deg(Math.atan2(dir * (knee.x - hip.x), knee.y - hip.y)),              // 넓적다리: 수직 기준, 앞으로 = +
        ankle: footOk ? 90 - between([knee.x - ankle.x, knee.y - ankle.y], [toe.x - heel.x, toe.y - heel.y]) : NaN,   // 발등굽힘 = +, 발이 안 잡히면 빈칸
        fwd: dir * (ankle.x - hip.x) / Math.hypot(knee.x - hip.x, knee.y - hip.y),  // 발이 엉덩이보다 얼마나 앞에 (넓적다리 길이 단위)
        toeFwd: footOk ? dir * (toe.x - hip.x) / Math.hypot(knee.x - hip.x, knee.y - hip.y) : NaN,   // 발끝 (발가락 떼기 근사용)
      });
    }
    return out;
  };
  let rows = build();
  // 방향 확인: 유각기 굽힘(20° 넘게)은 늘 앞쪽이라, 큰 굽힘이 대부분 음수면 방향을 거꾸로 짐작한 것 → 뒤집어 다시 계산
  // (돌아오는 장면이 섞이거나 카메라가 따라가며 찍은 영상 대비. 실제 과신전은 −20°까지 가지 않음)
  if (rows.filter(r => r.knee < -20).length > rows.filter(r => r.knee > 20).length) { dir = -dir; rows = build(); }
  const diag = { frames: frames.length, legFrames: rows.length, side, dir };
  if (rows.length < frames.length * 0.4 || rows.length < 20) return { error: 'noPerson', validFrac: rows.length / Math.max(1, frames.length), diag };

  // 첫 닿기 ≈ 발이 엉덩이보다 가장 앞에 있는 순간 (근사)
  const fwd = smooth(rows.map(r => r.fwd));
  const ics = [];
  for (let i = 2; i < rows.length - 2; i++) {
    if (fwd[i] >= fwd[i - 1] && fwd[i] > fwd[i + 1] && fwd[i] >= fwd[i - 2] && fwd[i] > fwd[i + 2] && fwd[i] > 0.3)
      if (!ics.length || rows[i].t - rows[ics[ics.length - 1]].t > 0.6) ics.push(i);
  }
  const cycles = [];
  for (let k = 1; k < ics.length; k++) {
    const a = ics[k - 1], b = ics[k], dur = rows[b].t - rows[a].t;
    if (dur < 0.6 || dur > 2.2) continue;                              // 케이던스 약 55~200 범위 밖은 버림
    const seg = rows.slice(a, b + 1), curve = {};
    for (const key of ['knee', 'thigh', 'ankle']) {
      curve[key] = Array.from({ length: 101 }, (_, q) => {
        const t = rows[a].t + dur * q / 100;
        let j = seg.findIndex(r => r.t >= t); if (j <= 0) return seg[j < 0 ? seg.length - 1 : 0][key];   // 주기 끝(100%)이 소수점 오차로 넘치면 마지막 장면
        const r0 = seg[j - 1], r1 = seg[j], w = (t - r0.t) / (r1.t - r0.t || 1);
        return r0[key] + (r1[key] - r0[key]) * w;
      });
    }
    // 디딤기(입각기) 비율: 발가락 떼기 ≈ 발끝이 엉덩이보다 가장 뒤에 있는 순간 (첫 닿기와 같은 방식의 근사, 본부 10/29). Perry 1장 표 1.1 기준 약 60%
    // 발목으로 재면 발을 든 뒤에도 무릎이 굽으며 더 뒤로 가서 늦게 잡힘 → 발끝이 잡힌 장면만, 발끝이 거의 안 잡히면 발목으로
    const tf = rows.slice(a, b + 1).map(r => r.toeFwd), useToe = tf.filter(v => !Number.isNaN(v)).length > tf.length * 0.6;
    let to = a; for (let i = a; i <= b; i++) { const v = useToe ? rows[i].toeFwd : fwd[i], w = useToe ? rows[to].toeFwd : fwd[to]; if (!Number.isNaN(v) && (Number.isNaN(w) || v < w)) to = i; }
    cycles.push({ dur, curve, stance: (rows[to].t - rows[a].t) / dur });
  }
  diag.contacts = ics.length; diag.cycles = cycles.length;
  if (!cycles.length) return { error: 'noCycle', validFrac: rows.length / frames.length, diag };

  const avg = key => Array.from({ length: 101 }, (_, q) => { const v = cycles.map(c => c.curve[key][q]).filter(x => !Number.isNaN(x)); return v.length ? mean(v) : NaN; });
  const knee = avg('knee'), thigh = avg('thigh'), ankle = avg('ankle');
  const range = (xs, a, b) => xs.slice(a, b + 1);
  const argmax = (xs, a, b) => a + range(xs, a, b).indexOf(Math.max(...range(xs, a, b)));
  const swingIdx = argmax(knee, 50, 90);
  return {
    view: 'side', side, dir, nCycles: cycles.length, diag, cadence: 120 / mean(cycles.map(c => c.dur)),
    validFrac: rows.length / frames.length, curves: { knee, thigh, ankle },
    m: {
      kneeIC: knee[0],
      kneeLoad: Math.max(...range(knee, 0, 20)),
      kneeStanceMin: Math.min(...range(knee, 20, 50)),
      kneeSwingMax: knee[swingIdx], kneeSwingAt: swingIdx,
      stancePct: 100 * mean(cycles.map(c => c.stance)),                   // 디딤기 %, 흔듦기 = 100 − 이 값
      thighFlex: Math.max(...range(thigh, 80, 100), ...range(thigh, 0, 10)),
      thighExt: -Math.min(...range(thigh, 30, 65)),
      ankleDF: Math.max(...range(ankle, 10, 55)),
      anklePF: -Math.min(...range(ankle, 50, 80)),
    },
  };
}

// ── 앞·뒤: 골반 좌우 기울기, 몸통 옆 기울기, 무릎 안쪽·바깥쪽, 걸음 폭 (좌우 비교) ──
export function analyzeFrontal(frames, W, H, view) {
  const need = [P.lShoulder, P.rShoulder, P.lHip, P.rHip, P.lKnee, P.rKnee, P.lAnkle, P.rAnkle];
  const S = { l: { valgus: [], drop: [] }, r: { valgus: [], drop: [] } }, lean = { l: [], r: [] }, widths = [], tilts = [], rows = [];
  let n = 0;
  for (const f of frames) {
    const p = px(f, W, H);
    if (need.some(i => p[i].v < VIS)) continue;
    n++;
    const L = p[P.lHip], R = p[P.rHip], hipW = Math.abs(L.x - R.x);
    if (hipW < 1) continue;
    const toLeft = Math.sign(L.x - R.x);                                // 화면에서 사람의 왼쪽이 있는 방향 (+1 = 화면 오른쪽)
    const pelvis = deg(Math.atan2(L.y - R.y, hipW));                    // + = 왼쪽 골반이 더 낮음
    tilts.push(pelvis);
    const mH = { x: (L.x + R.x) / 2, y: (L.y + R.y) / 2 };
    const mS = { x: (p[P.lShoulder].x + p[P.rShoulder].x) / 2, y: (p[P.lShoulder].y + p[P.rShoulder].y) / 2 };
    const leanL = deg(Math.atan2(toLeft * (mS.x - mH.x), mH.y - mS.y));  // + = 몸통이 왼쪽으로
    (leanL >= 0 ? lean.l : lean.r).push(Math.abs(leanL));
    widths.push(Math.abs(p[P.lAnkle].x - p[P.rAnkle].x) / hipW);
    const knee = s => {                                                  // + = 무릎이 몸 안쪽(가운데)으로
      const hip = p[P[s + 'Hip']], k = p[P[s + 'Knee']], a = p[P[s + 'Ankle']];
      const xl = hip.x + (a.x - hip.x) * (k.y - hip.y) / ((a.y - hip.y) || 1);
      const dev = 180 - angleAt(hip, k, a);
      return Math.sign(k.x - xl) === Math.sign(mH.x - xl) ? dev : -dev;
    };
    // 디딤 다리 = 발목이 화면에서 더 아래(땅 쪽)에 있는 다리 (근사)
    const diff = (p[P.lAnkle].y - p[P.rAnkle].y) / H, vL = knee('l'), vR = knee('r');
    rows.push({ t: f.t, st: Math.abs(diff) < 0.01 ? null : diff > 0 ? 'l' : 'r', tilt: pelvis, lean: leanL, valgusL: vL, valgusR: vR });
    if (Math.abs(diff) < 0.01) continue;
    const st = diff > 0 ? 'l' : 'r';
    S[st].valgus.push(knee(st));
    S[st].drop.push(st === 'l' ? -pelvis : pelvis);                     // 디딤 다리 반대쪽 골반이 내려간 각도
  }
  if (n < frames.length * 0.3 || n < 15) return { error: 'noPerson', validFrac: n / Math.max(1, frames.length), diag: { frames: frames.length, bodyFrames: n } };
  const q90 = xs => xs.length >= 5 ? pct(xs, 0.9) : null;               // 튀는 값을 피하려 최대 대신 상위 10% 값
  // 오른발 보행 주기: 디딘 다리가 왼발 → 오른발로 바뀌는 순간 = 오른발 첫 닿기 (근사, 검증 안 됨). 주기마다 0~100%로 펴서 평균
  const ics = [];
  let prev = null;
  for (let i = 0; i < rows.length; i++) {
    const st = rows[i].st; if (!st) continue;
    if (prev === 'l' && st === 'r' && (!ics.length || rows[i].t - rows[ics[ics.length - 1]].t > 0.6)) ics.push(i);
    prev = st;
  }
  const KEYS = ['tilt', 'lean', 'valgusL', 'valgusR'], cyc = [];
  for (let k = 1; k < ics.length; k++) {
    const a = ics[k - 1], b = ics[k], dur = rows[b].t - rows[a].t;
    if (dur < 0.6 || dur > 2.2) continue;                              // 옆모습과 같은 범위 (케이던스 약 55~200)
    const seg = rows.slice(a, b + 1), curve = {};
    for (const key of KEYS) curve[key] = Array.from({ length: 101 }, (_, q) => {
      const t = rows[a].t + dur * q / 100;
      let j = seg.findIndex(r => r.t >= t); if (j <= 0) return seg[j < 0 ? seg.length - 1 : 0][key];
      const r0 = seg[j - 1], r1 = seg[j], w = (t - r0.t) / (r1.t - r0.t || 1);
      return r0[key] + (r1[key] - r0[key]) * w;
    });
    cyc.push(curve);
  }
  const fc = cyc.length ? Object.fromEntries(KEYS.map(key => [key, Array.from({ length: 101 }, (_, q) => mean(cyc.map(c => c[key][q])))])) : null;
  if (fc) fc.n = cyc.length;
  return {
    view, validFrac: n / frames.length, fc,                             // fc: 오른발 주기 0~100% 평균 (tilt + = 왼쪽 골반 낮음, lean + = 몸통 왼쪽, valgus + = 무릎 안쪽)
    m: {
      dropL: q90(S.l.drop), dropR: q90(S.r.drop),                       // 왼발/오른발 디딜 때 반대쪽 골반 내려감
      valgusL: q90(S.l.valgus), valgusR: q90(S.r.valgus),
      leanL: q90(lean.l), leanR: q90(lean.r),
      width: widths.length ? pct(widths, 0.5) : null,                   // 걸음 폭 ÷ 골반 너비 (중앙값)
      tilt: tilts.length >= 5 ? pct(tilts, 0.5) : null,                 // 골반 좌우 높이 (중앙값, + = 왼쪽이 낮음 = 오른쪽이 높음)
    },
  };
}

// ── 브라우저에서 영상 → 자세 인식 점 (MediaPipe, 휴대폰 안에서 처리, 영상은 어디에도 보내지 않음) ──
const TV = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
let landmarker = null, delegate = 'GPU';
let ts = 0;   // MediaPipe는 장면 시간 번호가 계속 커져야 해서, 영상을 여러 번 분석해도 처음으로 되돌리지 않음
async function getLandmarker(force) {
  if (landmarker && !force) return landmarker;
  const { FilesetResolver, PoseLandmarker } = await import(TV);
  const fs = await FilesetResolver.forVisionTasks(TV + '/wasm');
  const opts = d => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: 'VIDEO', numPoses: 1 });
  if (force) { landmarker?.close(); delegate = force; landmarker = await PoseLandmarker.createFromOptions(fs, opts(force)); return landmarker; }
  try { landmarker = await PoseLandmarker.createFromOptions(fs, opts('GPU')); delegate = 'GPU'; }
  catch { landmarker = await PoseLandmarker.createFromOptions(fs, opts('CPU')); delegate = 'CPU'; }
  return landmarker;
}
// ponytail: 프레임마다 영상을 되감아(seek) 처리해서 느림(20초 영상에 수십 초). 빨라야 하면 requestVideoFrameCallback으로 재생하며 처리
// 영상의 실제 초당 장수: 잠깐 재생하며 화면에 나온 장면 시각(mediaTime) 간격의 중앙값 → 반올림. 이 기능이 없는 브라우저면 null ('분석 30장'만 표시)
async function videoFps(video) {
  if (!video.requestVideoFrameCallback) return null;
  const ts = [];
  await new Promise(done => {
    let n = 0; setTimeout(done, 1500);
    const cb = (_, m) => { ts.push(m.mediaTime); if (++n < 14) video.requestVideoFrameCallback(cb); else done(); };
    video.requestVideoFrameCallback(cb); video.play().catch(done);
  });
  video.pause();
  const d = ts.slice(1).map((t, i) => t - ts[i]).filter(x => x > 0.004).sort((a, b) => a - b);
  return d.length >= 4 ? Math.round(1 / d[Math.floor(d.length / 2)]) : null;
}
export async function extractPose(file, onProgress, { fps = 30, maxSec = 20 } = {}) {
  let lmk = await getLandmarker();
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = URL.createObjectURL(file);
  await new Promise((ok, no) => { video.onloadeddata = ok; video.onerror = () => no(new Error('영상을 열 수 없어요. 다른 영상으로 해 보세요.')); });
  // 휴대폰 브라우저는 한 번도 재생 안 한 영상을 넘기면 검은 화면이 나오기도 해서 잠깐 재생해 깨움
  try { await video.play(); video.pause(); } catch {}
  let srcFps = null; try { srcFps = await videoFps(video); } catch {}   // 촬영 조건 표용 (디자인 팀 10/29)
  const lc = document.createElement('canvas'); lc.width = 32; lc.height = 18; const lx = lc.getContext('2d', { willReadFrequently: true }); const lum = [];   // 밝기: 10장마다 작게 그려 평균
  const dur = Math.min(Number.isFinite(video.duration) ? video.duration : maxSec, maxSec);
  const run = async (from, to, step) => {
    const out = [];
    for (let t = from; t < to; t += step) {
      video.currentTime = t;
      await new Promise(r => { video.onseeked = r; setTimeout(r, 1500); });   // 넘기기가 멈추면 1.5초 뒤 다음으로
      const res = lmk.detectForVideo(video, ts += 34);
      if (out.length % 10 === 0) { try { lx.drawImage(video, 0, 0, 32, 18); const p = lx.getImageData(0, 0, 32, 18).data; let s = 0; for (let i = 0; i < p.length; i += 4) s += 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]; lum.push(s / (p.length / 4) / 2.55); } catch {} }
      if (res.landmarks?.[0]) out.push({ t, lm: res.landmarks[0].map(q => ({ x: q.x, y: q.y, v: q.visibility ?? 1 })) });
      onProgress?.(t / dur);
    }
    return out;
  };
  // 처음 1초를 먼저 봐서 사람을 하나도 못 찾으면, GPU 대신 CPU로 바꿔 다시 (앱 안에서 GPU가 조용히 실패하는 경우 대비)
  let frames = await run(0, Math.min(1, dur), 1 / fps);
  if (!frames.length && delegate === 'GPU') { lmk = await getLandmarker('CPU'); frames = await run(0, Math.min(1, dur), 1 / fps); }
  frames = frames.concat(await run(Math.min(1, dur), dur, 1 / fps));
  const processed = Math.round(dur * fps);
  const bright = lum.length ? lum.reduce((a, b) => a + b, 0) / lum.length : null;   // 0~100
  return { frames, W: video.videoWidth, H: video.videoHeight, video, dur, processed, delegate, srcFps, bright };
}

// 결과 확인용: 가운데 장면에 인식된 뼈대를 그려 보여 줌
const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]];
// 부위 아이콘: 동그라미 안 뼈 그림 (24×24, 앱이 직접 그린 모양). 결과 표(SVG)와 사진(캔버스)이 같은 모양을 씀. 골반만 구멍이 있어 evenodd로 칠함
const ring = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
export const PART_ICON = {
  knee: 'M3.2 2.6L7.4 1l3.9 5.6a3.7 3.7 0 1 1-3.9 4.9z M6.8 14.6q4.4-1.2 8.6 0q-.2 2-2.6 3.2l-.2 5.2h-3l-.2-5.2q-2.4-1.2-2.6-3.2z M13.4 17.8h1.3l-.2 5h-1.2z M15.8 7.4a1.4 2.2 0 1 0 0 4.4a1.4 2.2 0 1 0 0-4.4z',   // 넓적다리뼈 끝·정강이뼈·종아리뼈·무릎뼈
  pelvis: 'M3.5 6.5c2.4-2 5.6-1.2 7 1.6l1.5 1 1.5-1c1.4-2.8 4.6-3.6 7-1.6.6 3.6-.9 6.6-3.4 8.2l-1.3 3.3-2-1.6h-3.6l-2 1.6-1.3-3.3c-2.5-1.6-4-4.6-3.4-8.2z' + ring(9, 14.8, 1.4) + ring(15, 14.8, 1.4),
  thigh: ring(10, 3.8, 2.3) + ring(14, 3.8, 2.3) + 'M10.5 4.5h3v15h-3z' + ring(10, 20.2, 2.3) + ring(14, 20.2, 2.3),   // 넓적다리뼈
  ankle: 'M8 2h3.6v10.6c1 1.6 3.4 3 6.8 3.6 1.6.3 2.4 1.4 2.2 2.6-.2.9-.9 1.4-1.8 1.4H6.2c-1.3 0-2-1-1.6-2.3l1.6-4.6c.6-.6 1.2-.8 1.8-.8z',   // 정강이와 발
  body: 'M9 2.5h6a1.2 1.2 0 0 1 0 2.4H9a1.2 1.2 0 0 1 0-2.4zM8.6 7.3h6.8a1.3 1.3 0 0 1 0 2.6H8.6a1.3 1.3 0 0 1 0-2.6zM8.2 12.3h7.6a1.4 1.4 0 0 1 0 2.8H8.2a1.4 1.4 0 0 1 0-2.8zM7.8 17.5h8.4a1.5 1.5 0 0 1 0 3H7.8a1.5 1.5 0 0 1 0-3z',   // 척추뼈
  step: 'M7.5 3c1.7 0 2.7 2 2.6 5-.1 2.2-.6 3.8-2.6 3.8S5 10.2 4.9 8C4.8 5 5.8 3 7.5 3zM5.4 13.3h4.3c.1 2-.6 3.3-2.1 3.3s-2.2-1.3-2.2-3.3zM16.5 7c1.7 0 2.7 2 2.6 5-.1 2.2-.6 3.8-2.6 3.8s-2.5-1.6-2.6-3.8c-.1-3 .9-5 2.6-5zM14.4 17.3h4.3c.1 2-.6 3.3-2.1 3.3s-2.2-1.3-2.2-3.3z',   // 발자국
};
// marks: [{i: 점 번호, text, color, part, left}] → 그 점에 색 동그라미 + 부위 그림 이름표 (결과 표의 같은 그림)
export async function drawSnapshot(canvas, video, frame, marks = []) {
  video.currentTime = frame.t;
  await new Promise(r => { video.onseeked = r; setTimeout(r, 1500); });   // 넘기기 신호가 안 와도 멈추지 않게
  const W = video.videoWidth, H = video.videoHeight, s = Math.min(1, 480 / Math.max(W, H));
  canvas.width = W * s; canvas.height = H * s;
  const c = canvas.getContext('2d');
  c.drawImage(video, 0, 0, canvas.width, canvas.height);
  c.lineWidth = 3; c.strokeStyle = '#5fc2ab'; c.fillStyle = '#ffd34d';
  for (const [a, b] of BONES) { const p = frame.lm[a], q = frame.lm[b]; c.beginPath(); c.moveTo(p.x * canvas.width, p.y * canvas.height); c.lineTo(q.x * canvas.width, q.y * canvas.height); c.stroke(); }
  for (const i of [11, 12, 23, 24, 25, 26, 27, 28]) { const p = frame.lm[i]; c.beginPath(); c.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, 7); c.fill(); }
  c.font = 'bold 14px "Pretendard Variable", Pretendard, sans-serif'; c.textBaseline = 'middle';
  for (const { i, text, color, part, left } of marks) {
    const x = frame.lm[i].x * canvas.width, y = frame.lm[i].y * canvas.height, w = c.measureText(text).width + 40;
    c.lineWidth = 3; c.strokeStyle = color; c.beginPath(); c.arc(x, y, 9, 0, 7); c.stroke();
    const bx = left ? x - 14 - w : x + 14;
    c.fillStyle = 'rgba(255,255,255,.94)'; c.beginPath(); c.roundRect(bx, y - 15, w, 30, 15); c.fill();
    c.save(); c.translate(bx + 4, y - 12); c.scale(24 / 28, 24 / 28); c.translate(2, 2);   // 아이콘 칸 −2~26 (동그라미 포함)
    c.lineWidth = 1.6; c.strokeStyle = '#121816'; c.beginPath(); c.arc(12, 12, 13, 0, 7); c.stroke();
    c.fillStyle = color; c.fill(new Path2D(PART_ICON[part]), part === 'pelvis' ? 'evenodd' : 'nonzero'); c.restore();
    c.fillStyle = color; c.fillText(text, bx + 32, y + 1);
  }
}
