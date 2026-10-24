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
  const dir = pts.length > 1 && midHipX(pts[pts.length - 1]) >= midHipX(pts[0]) ? 1 : -1;   // 오른쪽으로 걸으면 +1

  const rows = [];
  for (const f of pts) {
    const [hip, knee, ankle, heel, toe] = ['Hip', 'Knee', 'Ankle', 'Heel', 'Toe'].map(k => f.p[ix(k)]);
    if ([hip, knee, ankle].some(q => q.v < VIS)) continue;
    const footOk = heel.v >= VIS && toe.v >= VIS;
    rows.push({
      t: f.t,
      knee: 180 - angleAt(hip, knee, ankle),                                       // 무릎 굽힘
      thigh: deg(Math.atan2(dir * (knee.x - hip.x), knee.y - hip.y)),              // 넓적다리: 수직 기준, 앞으로 = +
      ankle: footOk ? 90 - between([knee.x - ankle.x, knee.y - ankle.y], [toe.x - heel.x, toe.y - heel.y]) : NaN,   // 발등굽힘 = +, 발이 안 잡히면 빈칸
      fwd: dir * (ankle.x - hip.x) / Math.hypot(knee.x - hip.x, knee.y - hip.y),  // 발이 엉덩이보다 얼마나 앞에 (넓적다리 길이 단위)
    });
  }
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
        let j = seg.findIndex(r => r.t >= t); if (j <= 0) return seg[Math.max(0, j)][key];
        const r0 = seg[j - 1], r1 = seg[j], w = (t - r0.t) / (r1.t - r0.t || 1);
        return r0[key] + (r1[key] - r0[key]) * w;
      });
    }
    cycles.push({ dur, curve });
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
  const S = { l: { valgus: [], drop: [] }, r: { valgus: [], drop: [] } }, lean = { l: [], r: [] }, widths = [];
  let n = 0;
  for (const f of frames) {
    const p = px(f, W, H);
    if (need.some(i => p[i].v < VIS)) continue;
    n++;
    const L = p[P.lHip], R = p[P.rHip], hipW = Math.abs(L.x - R.x);
    if (hipW < 1) continue;
    const toLeft = Math.sign(L.x - R.x);                                // 화면에서 사람의 왼쪽이 있는 방향 (+1 = 화면 오른쪽)
    const pelvis = deg(Math.atan2(L.y - R.y, hipW));                    // + = 왼쪽 골반이 더 낮음
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
    const diff = (p[P.lAnkle].y - p[P.rAnkle].y) / H;
    if (Math.abs(diff) < 0.01) continue;
    const st = diff > 0 ? 'l' : 'r';
    S[st].valgus.push(knee(st));
    S[st].drop.push(st === 'l' ? -pelvis : pelvis);                     // 디딤 다리 반대쪽 골반이 내려간 각도
  }
  if (n < frames.length * 0.3 || n < 15) return { error: 'noPerson', validFrac: n / Math.max(1, frames.length), diag: { frames: frames.length, bodyFrames: n } };
  const q90 = xs => xs.length >= 5 ? pct(xs, 0.9) : null;               // 튀는 값을 피하려 최대 대신 상위 10% 값
  return {
    view, validFrac: n / frames.length,
    m: {
      dropL: q90(S.l.drop), dropR: q90(S.r.drop),                       // 왼발/오른발 디딜 때 반대쪽 골반 내려감
      valgusL: q90(S.l.valgus), valgusR: q90(S.r.valgus),
      leanL: q90(lean.l), leanR: q90(lean.r),
      width: widths.length ? pct(widths, 0.5) : null,                   // 걸음 폭 ÷ 골반 너비 (중앙값)
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
export async function extractPose(file, onProgress, { fps = 30, maxSec = 20 } = {}) {
  let lmk = await getLandmarker();
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = URL.createObjectURL(file);
  await new Promise((ok, no) => { video.onloadeddata = ok; video.onerror = () => no(new Error('영상을 열 수 없어요. 다른 영상으로 해 보세요.')); });
  // 휴대폰 브라우저는 한 번도 재생 안 한 영상을 넘기면 검은 화면이 나오기도 해서 잠깐 재생해 깨움
  try { await video.play(); video.pause(); } catch {}
  const dur = Math.min(Number.isFinite(video.duration) ? video.duration : maxSec, maxSec);
  const run = async (from, to, step) => {
    const out = [];
    for (let t = from; t < to; t += step) {
      video.currentTime = t;
      await new Promise(r => { video.onseeked = r; setTimeout(r, 1500); });   // 넘기기가 멈추면 1.5초 뒤 다음으로
      const res = lmk.detectForVideo(video, ts += 34);
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
  return { frames, W: video.videoWidth, H: video.videoHeight, video, dur, processed, delegate };
}

// 결과 확인용: 가운데 장면에 인식된 뼈대를 그려 보여 줌
const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]];
export async function drawSnapshot(canvas, video, frame) {
  video.currentTime = frame.t;
  await new Promise(r => { video.onseeked = r; });
  const W = video.videoWidth, H = video.videoHeight, s = Math.min(1, 480 / Math.max(W, H));
  canvas.width = W * s; canvas.height = H * s;
  const c = canvas.getContext('2d');
  c.drawImage(video, 0, 0, canvas.width, canvas.height);
  c.lineWidth = 3; c.strokeStyle = '#5fc2ab'; c.fillStyle = '#ffd34d';
  for (const [a, b] of BONES) { const p = frame.lm[a], q = frame.lm[b]; c.beginPath(); c.moveTo(p.x * canvas.width, p.y * canvas.height); c.lineTo(q.x * canvas.width, q.y * canvas.height); c.stroke(); }
  for (const i of [11, 12, 23, 24, 25, 26, 27, 28]) { const p = frame.lm[i]; c.beginPath(); c.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, 7); c.fill(); }
}
