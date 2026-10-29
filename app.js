import { analyzeWalk, fastMinutes, withDistance, gpsSpeed, gpsDistance, guessActivity, guessPosition, routeMarks, RUN_CAD, analyzeJog, mixActivity, stairClimb, FLOOR_M, STAIR_STEP_M } from './gait.js';
import { analyzeSide, analyzeFrontal, extractPose, drawSnapshot, PART_ICON } from './video.js';

const $ = id => document.getElementById(id);

// ── 근거 출처 (refs/journal_evidence.md, refs/perry_analysis.md 참고) ──
const REF = {
  perry20: 'Perry J. Gait Analysis: Normal and Pathological Function. 1992, 20장(보폭 분석)',
  perry7: 'Perry J. Gait Analysis. 1992, 7장(몸통 움직임은 걸음마다 반복)',
  neumann15: 'Neumann DA. Kinesiology of the Musculoskeletal System 3판, 15장(걷기의 운동학)',
  murtagh: 'Murtagh EM 외. Outdoor Walking Speeds of Apparently Healthy Adults. Sports Med 2021. doi:10.1007/s40279-020-01351-3',
  cadenceAdults: 'Tudor-Locke C 외. CADENCE-Adults (21–40세 2019, 41–60세 2020, 61–85세 2021). Int J Behav Nutr Phys Act. doi:10.1186/s12966-019-0769-6 외',
  mcavoy2021: 'McAvoy CR 외. Cadence (steps/min) and relative intensity in 21 to 60-year-olds: the CADENCE-adults study. Int J Behav Nutr Phys Act 2021. doi:10.1186/s12966-021-01096-w',
  moeNilssen2004: 'Moe-Nilssen R, Helbostad JL. Estimation of gait cycle characteristics by trunk accelerometry. J Biomech 2004. doi:10.1016/s0021-9290(03)00233-1',
  ota2021: 'Ota M 외. Verification of validity of gait analysis systems during treadmill walking and running using human pose tracking algorithm (OpenPose). Gait Posture 2021. doi:10.1016/j.gaitpost.2021.02.006',
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
  perry1: 'Perry J. Gait Analysis. 1992, 1장 5~6쪽(표 1.1: 디딤기 60%·흔듦기 40%, 보통 빠르기 80m/분에서 62%·38%)',
  perry20range: 'Perry J. Gait Analysis. 1992, 20장 432~433쪽(걷는 속도: 연구별 평균 남 80~91·여 73~81m/분, 한 보행 주기 길이 남 1.46·여 1.28m, 케이던스 남 111·여 117걸음/분 — 범위 막대는 이 평균값들 사이)',
  perry3: 'Perry J. Gait Analysis. 1992, 3장(기본 기능: 몸이 앞으로 굴러가는 원리)',
  perry4: 'Perry J. Gait Analysis. 1992, 4장(발목·발: 3개의 흔들의자)',
  perry5: 'Perry J. Gait Analysis. 1992, 5장(무릎: 체중 받기 때 대퇴사두근의 제동)',
  perry10: 'Perry J. Gait Analysis. 1992, 10장(병적 보행의 원인)',
  perry12: 'Perry J. Gait Analysis. 1992, 12장(무릎의 비정상 보행: 과신전)',
  perry17: 'Perry J. Gait Analysis. 1992, 17장(동작 분석: 카메라 1대의 한계)',
  russo2026: 'Russo M 외. Estimation of the Knee Joint with Single-Camera Smartphone. Sensors 2026. doi:10.3390/s26072148',
  cheng2025: 'Cheng X 외. Reliability and validity of computer vision based motion capture systems in gait analysis: systematic review. Gait Posture 2025. doi:10.1016/j.gaitpost.2025.04.016',
  wegner2026: 'Wegner M 외. 2D video-based pose estimation app vs markerless 3D motion capture in knee osteoarthritis. Front Bioeng Biotechnol 2026. doi:10.3389/fbioe.2026.1869878',
  cooper1968: 'Cooper KH. A means of assessing maximal oxygen intake: correlation between field and treadmill testing. JAMA 1968;203(3):201-4. PMID 5694044',
  ikenaga2017: 'Ikenaga M 외. Short-interval, intermittent, low-intensity, slow-jogging program in older adults: RCT. Eur J Appl Physiol 2017. doi:10.1007/s00421-016-3493-9',
};
// 기준값을 누구에게서 잰 자료인지 (법률검토팀 26번, 10/29): refs/ 원문·초록에 있는 것만, 없으면 '출처에 … 정보 없음'
const REF_WHO = {
  perry20: 'Rancho Los Amigos 병원(미국 캘리포니아) 실험실에서 평소 빠르기로 걸은 성인 남 135명·여 158명(20~85세)',
  murtagh: '건강한 성인이 야외에서 걸은 35개 연구 14,015명을 모은 분석 (나이·성별·나라 구성은 출처에 정보 없음)',
  shema: '이스라엘 클리닉 환자 72명(평균 57.2세, 여 37명·남 35명), 무릎 골관절염 68%·허리 통증 17%·발목·고관절 관절염 15%',
  cadenceAdults: '21~85세 성인(21~40세·41~60세·61~85세 연구), 트레드밀 걷기 (인원·성별·나라는 출처에 정보 없음)',
  mcavoy2021: '21~60세 성인 (CADENCE-Adults 연구, 인원·성별·나라는 출처에 정보 없음)',
  aguiar: '41~85세 174명이 평소 속도로 바닥을 걸은 자료 (성별·나라는 출처에 정보 없음)',
  simonsen: '덴마크 올보르대학교 건강한 성인 30명(평균 28.2세, 여성 13.3%)',
  mora: 'CADENCE-Adults 연구 참가자 (나이·성별·인원은 출처에 정보 없음)',
  moeNilssen2004: '출처에 나이·성별 정보 없음',
  jama2024: '65세 이상 지역사회에 사는 노인을 다룬 연구 리뷰 (인원·성별·나라는 출처에 정보 없음)',
  studenski: '9개 코호트, 65세 이상 34,485명, 6~21년 추적 (성별·나라는 출처에 정보 없음)',
  neumann15: '출처에 나이·성별 정보 없음',
  ding2025: '57개 연구(35개 코호트): 미국 37%·영국 21%·일본 14%(한국 연구 없음), 일반 성인 56%·노인(평균 65세 이상) 44% (성별은 출처에 정보 없음)',
  perry20range: 'Rancho Los Amigos 병원(미국 캘리포니아) 실험실에서 평소 빠르기로 걸은 성인 남 135명·여 158명(20~85세)',
  perry1: '출처에 나이·성별 정보 없음',
  perry3: '출처에 나이·성별 정보 없음',
  perry4: '출처에 나이·성별 정보 없음',
  perry5: '출처에 나이·성별 정보 없음',
  perry7: '출처에 나이·성별 정보 없음',
  perry9: '출처에 나이·성별 정보 없음',
  perry10: '출처에 나이·성별 정보 없음',
  perry12: '출처에 나이·성별 정보 없음',
  perry17: '출처에 나이·성별 정보 없음',
  neumann16: '출처에 나이·성별 정보 없음',
  cooper1968: '출처에 나이·성별 정보 없음',
  ota2021: '출처에 나이·성별 정보 없음',
  heiderscheit: '취미로 달리는 사람 45명 (나이·성별·나라는 출처에 정보 없음)',
  anderson2022: '37편 연구를 모은 체계적 고찰 (나이·성별·인원은 출처에 정보 없음)',
  petri2026: '무릎앞통증이 있는 주자를 다룬 리뷰 8편 종합 (나이·성별·인원은 출처에 정보 없음)',
  goss2025: '20편 연구 483명 (나이·성별·나라는 출처에 정보 없음)',
  lee2014: '55,137명, 15년 추적 (나이·성별·나라는 출처에 정보 없음)',
  pedisic2019: '여러 연구 약 23만 명을 모은 분석 (나이·성별·나라는 출처에 정보 없음)',
  ikenaga2017: '70.8세 노인 81명 무작위 연구 (성별·나라는 출처에 정보 없음)',
  russo2026: '건강한 성인 27명 (나이·성별·나라는 출처에 정보 없음)',
  cheng2025: '20편 연구를 모은 체계적 고찰 (나이·성별·인원은 출처에 정보 없음)',
  wegner2026: '무릎 골관절염 환자 예비 연구 (인원·나이·성별은 출처에 정보 없음)',
};
const refLi = r => `<li>${REF[r]}${REF_WHO[r] ? `<br><span class="sub" style="font-size:.75rem">누구 자료: ${REF_WHO[r]}</span>` : ''}</li>`;
const ACT = { walk: '걷기', run: '러닝', slowrun: '슬로우 러닝', easyrun: '천천히 달리기', cooper: '12분 달리기', stairs: '계단 오르기', video: '영상', auto: '자동' };
// 달리기 활동: 시작 위 '뛰기 전 몸 풀기', 결과 아래 '뛴 뒤 정리 운동' (판은 아래 openEx)
const RUN_ACTS = ['run', 'slowrun', 'easyrun', 'cooper'];
const COOL_BTN = '<button class="textlike" data-ex="cool" style="margin-top:12px">뛴 뒤 정리 운동 ›</button>';
const isRun = h => h.activity === 'run' || h.activity === 'easyrun';   // 천천히 달리기도 러닝 통계에 넣음
const POS = { pocket: '바지 앞주머니', waist: '허리', hand: '손' };
const VIEW = { side: '옆', front: '앞', back: '뒤' };
const whenTxt = d => { d = new Date(d); return Number.isNaN(+d) ? '날짜 모름' : d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };   // 날짜가 없거나 깨진 기록은 'Invalid Date' 대신
const MET_NOTE = 'MET(대사당량) = 가만히 앉아 쉴 때 쓰는 에너지를 1로 본 운동 강도 단위예요. 3 MET는 쉴 때의 약 3배 에너지를 쓰는 강도예요(1 MET ≈ 몸무게 1kg당 1분에 산소 3.5mL).';
const INTERVAL_S = 60;   // 슬로우 러닝: 조깅 1분 + 걷기 1분 반복 (Ikenaga 2017)
const COOPER_S = 720;    // 12분 달리기 테스트 (Cooper 1968)
const LEAD_S = 3;        // 시작 후 주머니에 넣는 시간 (계산에서 뺌)
const GRADE = {
  g: ['b-g', '정확'], y: ['b-y', '참고'], o: ['b-o', '부정확할 수 있음'], n: ['b-n', '검증 안 됨'],
};
// 오래 걷지 않을 때 (민원팀 10/28): 걷지 않는 상태가 IDLE_ASK_S 이어지면 물음, 물은 뒤 IDLE_END_S 동안 답이 없으면 저장하고 끝냄, MAX_REC_S가 되면 저장하고 끝냄
// 설치형 앱은 GaitService.java가 같은 값으로 화면이 꺼져도 처리, 웹은 화면이 켜져 있는 동안만. 데이터분석팀이 조정
const IDLE_ASK_S = 15 * 60, IDLE_END_S = 15 * 60, MAX_REC_S = 3 * 3600, STILL_SD = 0.6;   // STILL_SD: 5초 가속도 크기 흔들림(m/s²)이 이보다 작으면 걷지 않음
let pendingEnd = null;                                                   // 이번 측정이 자동으로 끝난 이유 → 저장할 기록의 warnings에 붙임
const WARN = {
  idleEnd: `오래 움직임이 없어 자동으로 끝냈어요. ${IDLE_ASK_S / 60}분 넘게 걷지 않아 물었고 ${IDLE_END_S / 60}분 동안 답이 없어, 그때까지 잰 기록으로 분석했어요.`,
  maxEnd: `측정이 ${MAX_REC_S / 3600}시간이 되어 자동으로 끝냈어요. 앞 ${MAX_REC_S / 3600}시간까지 잰 기록으로 분석했어요.`,
  shortWalk: '걸은 시간이 짧아 시작·끝 구간을 빼지 못했어요. 20초 이상 걸으면 더 정확해요.',
  irregular: '걸음 신호가 불규칙해요. 휴대폰이 주머니에서 흔들렸거나 방향을 자주 바꿨을 수 있어요.',
  running: '달리기로 보여요(케이던스 170 이상). 이 분석은 걷기에서만 정확해요.',
  slow: '아주 천천히 걸으면 휴대폰이 걸음 수를 적게 셀 수 있어요.',
  walkLike: '달리기치고 케이던스가 낮아요(140 미만). 걷기였거나 측정이 잘못됐을 수 있어요.',
  hand: '손에 들면 팔 흔들림이 섞여 정확도가 낮아요. 바지 앞주머니를 권장해요.',
  paused: '측정 중에 화면이 꺼지거나 다른 앱(카톡·전화)으로 가서 센서가 잠시 멈췄어요. 설치형 안드로이드 앱은 다른 앱을 써도 계속 측정돼요. 끊기지 않고 가장 길게 걸은 구간만으로 계산해서 걸음 수가 실제보다 적을 수 있어요. 다음엔 전원 버튼을 누르지 말고 주머니 모드 그대로 넣어 주세요.',
};
const warnHtml = r => r.warnings.map(w => `<div class="warn">${w === 'paused' && r.diag?.gapS >= 1 ? `<b>중간에 ${Math.round(r.diag.gapS)}초 끊겼어요.</b> ` : ''}${WARN[w]}${w === 'paused' && !Native ? ' <a href="install.html">설치형 앱 받기</a>' : ''}</div>`).join('');

// ── 내 정보 ──
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const prof = store.get('profile', { sex: '', age: '' });
// 내 정보: 성별은 큰 버튼 3개(숨은 #sex에 값), 나이는 큰 숫자 칸 (이름·사진·생년월일은 받지 않음)
// 바꾸는 즉시 저장: 화면의 '만 14세 미만은 보내지 않아요' 안내와 실제 전송(send)이 늘 같은 나이를 보게 (개인정보 보호법 제22조의2). '저장'은 확인용
const saveProf = () => store.set('profile', { sex: $('sex').value, age: $('age').value });
const setSex = v => { $('sex').value = v; for (const b of $('sexBtns').children) b.setAttribute('aria-pressed', b.dataset.sex === v); $('profMsg').textContent = ''; };
setSex(prof.sex ?? ''); $('age').value = prof.age ?? '';
const under14 = age => +age > 0 && +age < 14;
const ageNote = () => $('ageNote').classList.toggle('hidden', !under14($('age').value));
$('sexBtns').addEventListener('click', e => { const b = e.target.closest('[data-sex]'); if (b) { setSex(b.dataset.sex); saveProf(); } });
// 숫자 칸(type=number)은 안드로이드 한글 키보드가 숫자 아닌 글자를 보내면 값을 통째로 버려 빈칸이 됨(제보 K-47B65E2E) → 글자 칸 + 숫자만 남김
$('age').addEventListener('input', () => { const a = $('age'), d = a.value.replace(/\D/g, '').slice(0, 3); if (a.value !== d) a.value = d; saveProf(); ageNote(); $('profMsg').textContent = ''; });
$('profSave').addEventListener('click', () => { saveProf(); ageNote(); $('profMsg').textContent = '저장했어요'; showProfSum(false); });
ageNote();

// ── 활동 종류 (선택은 이 휴대폰에 기억) ──
$('act').value = store.get('act', 'auto');
// 위치기반서비스 이용 동의 (위치정보법 제19조): GPS를 쓰는 측정에만 필요, 체크를 풀면 철회
// 위치 약관이 바뀌면 이미 동의한 사람에게만 앱을 열 때 안내 (재동의 아님). '약관 보기'나 '닫기'를 누르면 다시 안 뜸.
// 새로 동의하는 사람은 지금 약관을 보고 동의하니 본 것으로 둠. 다음 개정 땐 날짜·문구만 바꿈
const LOC_TERMS = '2026-10-26';
$('locOk').checked = !!store.get('locConsent', null);
$('locOk').addEventListener('change', () => {
  store.set('locConsent', $('locOk').checked ? { date: new Date().toISOString(), version: 1 } : null);
  if ($('locOk').checked) store.set('locTermsSeen', LOC_TERMS);
});
// 약관·처리방침이 바뀌면 이미 동의한 사람에게 앱을 열 때 한 번 안내 (재동의 아님). '보기'나 '닫기'를 누르면 다시 안 뜸
function changeNote(id, seenKey, date, text, href, view) {
  document.querySelector('main > .sub').insertAdjacentHTML('afterend', `<div class="card sub" id="${id}" role="status">${text}
    <div style="display:flex;gap:6px;margin-top:10px"><button class="chip" data-n="view">${view}</button><button class="chip" data-n="close">닫기</button></div></div>`);
  $(id).addEventListener('click', e => {
    const b = e.target.closest('[data-n]'); if (!b) return;
    store.set(seenKey, date); $(id).remove();
    if (b.dataset.n === 'view') location.href = href;
  });
}
if (store.get('locConsent', null) && store.get('locTermsSeen', null) !== LOC_TERMS)
  changeNote('locNote', 'locTermsSeen', LOC_TERMS, '위치기반서비스 이용약관이 바뀌었어요 (2026년 10월 26일 시행). 위치를 받는 방법, 기록 보관, 다른 사람에게 주지 않는다는 설명을 보탰어요. 동의하신 내용은 그대로라 다시 동의할 필요는 없어요.', 'location-terms.html', '약관 보기');
// 처리방침 10번 "바꾸면 앱에 미리 알립니다". 바꿀 때마다 새 값. 익명 결과 전송 동의자에게는 수집 항목이 바뀐 안내를, 나머지 동의자에게는 지난 안내(사진 첨부)를
const PRIV_DATE = '2026-10-28-delete';
const privSeen = store.get('privSeen', null), cons = store.get('consent', null);
if (cons && privSeen !== PRIV_DATE)                                       // 이번 변경(기록 지우기) + 익명 전송 동의자가 지난 수집 안내를 아직 못 봤으면 함께
  changeNote('privNote', 'privSeen', PRIV_DATE, (cons.share && privSeen !== '2026-10-26-quality' ? '익명 결과 수집 안내가 바뀌었어요: 측정 품질 정보와 결과가 안 나온 측정의 이유도 함께 보내요(걸음 숫자·위치는 없어요). 원하지 않으면 화면 아래 ‘동의 변경’에서 끌 수 있어요. ' : '')
    + '개인정보 처리방침에 기록 지우기와 익명 결과 삭제 요청 방법이 추가됐어요 (2026년 10월 28일 시행).', 'privacy.html', '처리방침 보기');
const usesGps = a => a === 'cooper' || (a !== 'slowrun' && a !== 'stairs' && $('dmode').value === 'gps');   // 계단은 실내라 GPS 안 씀
function showLoc() {
  const need = usesGps($('act').value);
  $('locBox').classList.toggle('hidden', !need);
  if (need && !store.get('locConsent', null)) openSet(true);                 // 위치 약관 동의가 필요하면 시작 전에 꼭 보이게 펼침
}
// 고르기 판 (디자인 팀 시안 C, 5곳이 판 하나를 같이 씀): 숨긴 select가 값의 원본, 판에서 고르면 select 값을 바꾸고 change를 보냄 → 기존 동작 그대로
// select 앞에 '아이콘 + 이름 + ›' 줄(#<select id>Btn)을 만들고, 줄 이름·아이콘은 syncPicks()가 select 값에서 다시 읽음 (코드로 값을 바꾼 곳도 따라오게)
const IC = {
  wand: '<path d="M4 20 14 10"/><path d="M15 3v4M13 5h4M19 9v3M17.5 10.5h3"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="M10 21l2-6-2-3 1-4 3 3h3M10.5 9 7 11.5M12 15l3 6"/>',
  run: '<circle cx="16" cy="4" r="2"/><path d="M4 20l4-4h3l1.5-4-3-1.5L7 13M12.5 12l3.5 2 3-2.5M13 16l2 5"/>',
  loop: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  feather: '<path d="M20 4C12 4 7 9 7 17l-3 3"/><path d="M7 17c6 0 10-3 12-8M10 13h5"/>',
  watch: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',   // STAT_ICON.time과 같은 모양 (그건 아래에서 정의돼 여기서 못 씀)
  pants: '<path d="M7 3h10l1 18h-4l-2-11-2 11H6z"/><path d="M7 7h10"/>',
  belt: '<rect x="2" y="9" width="20" height="6" rx="1"/><rect x="9" y="8" width="6" height="8" rx="1"/><path d="M12 12h3"/>',
  hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4L4 14a1.5 1.5 0 0 1 2.5-1.5L8 14"/>',
  ask: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  ruler: '<rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
  none: '<circle cx="12" cy="12" r="9"/><path d="M6 18 18 6"/>',
  toward: '<path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 21h14"/>',
  away: '<path d="M12 21V8M7 13l5-5 5 5"/><path d="M5 3h14"/>',
  steps: '<path d="M7 3c2 0 3 2.5 3 5.5S9 13 7 13s-3-1.5-3-4.5S5 3 7 3zM5 16h4v1.5a2 2 0 0 1-4 0zM17 7c2 0 3 2.5 3 5.5S19 17 17 17s-3-1.5-3-4.5S15 7 17 7zM15 20h4v.5a2 2 0 0 1-4 0z"/>',
  pace: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
  knee: '<path d="M9 3l2.5 8.5L9 21"/><circle cx="11.5" cy="11.5" r="2"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  stairs: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};
const PICKS = {   // select id → 판 제목, [값, 이름, 설명, 아이콘, 표시]
  act: ['무엇을 잴까요?', [['auto', '자동', '걷기·달리기를 알아서 나눠요', IC.wand], ['walk', '걷기', '', IC.walk], ['run', '러닝', '', IC.run],
    ['slowrun', '슬로우 러닝', '조깅 1분 + 걷기 1분', IC.loop], ['easyrun', '천천히 달리기', '걷는 속도로 쭉', IC.feather], ['cooper', '12분 달리기 테스트', '쿠퍼 테스트', IC.watch], ['stairs', '계단 오르기', '오르기만 · 높이는 설치형 앱', IC.stairs]]],
  pos: ['휴대폰을 어디에 둘까요?', [['pocket', '바지 앞주머니', '허벅지에 밀착', IC.pants, '권장'], ['waist', '허리', '벨트·밴드', IC.belt], ['hand', '손에 들고', '', IC.hand], ['auto', '자동 짐작', '검증 안 된 방법', IC.ask]]],
  dmode: ['거리는 어떻게 잴까요?', [['gps', 'GPS 자동', '야외 1분 이상', IC.pin], ['manual', '거리를 직접 입력', '', IC.ruler], ['none', '재지 않음', '케이던스만', IC.none]]],
  vview: ['어느 방향에서 찍을까요?', [['side', '옆모습', '무릎·넓적다리·발목 각도', IC.walk], ['front', '앞모습', '카메라 쪽으로 걸어오기', IC.toward], ['back', '뒷모습', '카메라에서 멀어지기', IC.away]]],
  tmetric: ['무엇을 볼까요?', [['walkCad', '걷기 케이던스', '', IC.steps], ['walkSpeed', '걷는 속도', '', IC.pace], ['runCad', '러닝 케이던스', '', IC.run], ['knee', '영상: 유각기 무릎 굽힘', '', IC.knee]]],
};
const svgIc = ic => `<svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg>`;
for (const id of Object.keys(PICKS)) {
  $(id).hidden = true;
  $(id).insertAdjacentHTML('beforebegin', `<button id="${id}Btn" class="pickRow${id === 'tmetric' ? ' mini' : ''}" data-pick="${id}" aria-haspopup="dialog"><span class="pIc"></span><span class="pName"></span><span class="pChev" aria-hidden="true">›</span></button>`);
}
{ const h = $('tmetricBtn').previousElementSibling; h.classList.add('pickHead'); h.append($('tmetricBtn')); }   // 변화 그래프: 제목 오른쪽에 작게
function syncPicks() {
  for (const [id, [, items]] of Object.entries(PICKS)) {
    const it = items.find(x => x[0] === $(id).value) ?? items[0], b = $(`${id}Btn`);
    b.querySelector('.pIc').innerHTML = id === 'tmetric' ? '' : svgIc(it[3]); b.querySelector('.pName').textContent = it[1];
  }
}
let pickFor = null, pickDragY = null;
function openPick(id) {
  const [title, items] = PICKS[id], v = $(id).value;
  pickFor = id; $('pickQ').textContent = title;
  $('pickList').innerHTML = items.map(([val, name, desc, ic, tag]) => `<button data-val="${val}" aria-pressed="${val === v}">${svgIc(ic)}<span>${name}${tag ? ` <em>${tag}</em>` : ''}${desc ? `<small>${desc}</small>` : ''}</span><b class="ok" aria-hidden="true">✓</b></button>`).join('');
  $('pickSheet').hidden = false; history.pushState({ pickSheet: 1 }, '');   // 뒤로 가기 = 판 닫기
  $('pickList').querySelector('[aria-pressed="true"]')?.focus();
}
function closePick(back = true) {
  if ($('pickSheet').hidden) return;
  $('pickSheet').hidden = true; (pickFor ? $(`${pickFor}Btn`) : document.querySelector('[data-sharepick]'))?.focus();
  if (back && history.state?.pickSheet) history.back();                  // 판을 열 때 넣은 기록 한 칸을 되돌림
}
document.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) openPick(b.dataset.pick); });
addEventListener('popstate', () => closePick(false));
// 설치형 앱 휴대폰 뒤로 가기: MainActivity가 먼저 물어봄. 열린 판을 닫았으면 true(앱은 그대로), 아니면 false(예전처럼 앱 닫힘)
window.gaitBack = () => {
  if (!$('pickSheet').hidden) { closePick(); return true; }
  if (!$('stopSheet').hidden) { closeStopSheet(); $('stop').focus(); return true; }   // 측정 종료 확인 창 = '계속 측정'
  if ($('exDet')) { $('exDet').querySelector('[data-exd=back]').click(); return true; }   // 운동 상세 → 목록
  const btn = document.querySelector('#permOv [data-p=later], #fbOv [data-f=close], #dictOv [data-dx=skip], #lessonOv [data-lx=close], #exOv [data-ex=close]');   // 권한 안내 = '나중에', 건의하기 = '닫기'(Esc와 같음), 지표 사전 = '건너뛰기'(닫기)
  if (btn) { btn.click(); return true; }
  if (!$('tip').classList.contains('hidden')) { $('tip').classList.add('hidden'); return true; }   // 용어 풀이 팝업
  if (subOpen) { closeSub(); return true; }                                 // 홈 하위 화면 → 홈
  return false;
};
// 홈 '공유 카드 만들기' → 같은 판에서 이 주·이 달·최고 기록 고르기. 받는 사람이 숫자를 본다는 안내는 공유 직전 이 판에 (개인정보 보호법 제23조 3항 취지)
function openShare() {
  pickFor = null; $('pickQ').textContent = '어떤 카드를 공유할까요?';
  $('pickList').innerHTML = [['week', '이 주 카드', '고른 날짜가 있는 주'], ['month', '이 달 카드', '달력에 보이는 달'], ['best', '최고 기록 카드', '지금까지 내 기록']]
    .map(([v, n, d]) => `<button data-share="${v}">${svgIc(v === 'best' ? IC.star : IC.cal)}<span>${n}<small>${d}</small></span></button>`).join('')
    + '<p class="sub" style="margin:12px 20px 8px">카드에는 걸음·건강 숫자가 담겨요. 공유하면 받는 사람이 그 숫자를 보게 돼요.</p>';
  $('pickSheet').hidden = false; history.pushState({ pickSheet: 1 }, '');
  $('pickList').querySelector('button')?.focus();
}
// 기록 지우기: 공용 판에 확인 → 휴대폰 기록(localStorage)과 그 측정의 센서 원본(IndexedDB)에서 그 기록 하나만 뺌. 익명으로 보낸 결과는 운영자에게 삭제 요청 (처리방침 6번)
function openDelete(date) {
  const h = store.get('history', []).find(x => x.date === date); if (!h) return;
  const what = h.view ? `영상 ${{ side: '옆모습', front: '앞모습', back: '뒷모습' }[h.view]}` : ACT[h.activity ?? 'walk'];
  pickFor = null; $('pickQ').textContent = '이 기록을 지울까요?';
  $('pickList').innerHTML = `<p class="delDesc">${whenTxt(h.date)} ${what} · 지우면 되살릴 수 없어요. 달력·그래프·한 달 점검에서도 빠져요.</p>`
    + (h.receipt ? `<p class="delDesc">이 기록은 익명 결과로도 보냈어요(접수번호 <b>${h.receipt}</b>).</p><label class="delAsk"><input type="checkbox" id="delAsk"> 운영자에게 보낸 익명 결과도 지워 달라고 요청하기</label>` : '')   // 법률 검토 21번: 지우면 접수번호도 사라지니 지우기 전에 요청 기회
    + `<div class="delActs"><button data-del="${h.date}">지우기</button><button data-keep>그대로 두기</button></div>`;
  $('pickSheet').hidden = false; history.pushState({ pickSheet: 1 }, '');
  $('pickList').querySelector('[data-keep]').focus();
}
const rawDel = async key => { const db = await rawDb(); db.transaction('raw', 'readwrite').objectStore('raw').delete(key); };
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2000); }
// 익명 결과 삭제 요청: 접수번호만 보냄(다른 정보 없음). no-cors라 응답은 못 읽고, 보내기 자체가 실패(오프라인 등)하면 false
const askDelete = receipt => fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind: 'delete', receipt }) }).then(() => true, () => false);
async function deleteRec(date) {
  const hist = store.get('history', []), i = hist.findIndex(x => x.date === date); if (i < 0) return closePick();
  const ask = $('delAsk')?.checked && hist[i].receipt;
  if (ask) {
    const b = $('pickList').querySelector('[data-del]'); b.disabled = true;
    const ok = await askDelete(hist[i].receipt); b.disabled = false;
    if (!ok) {                                                            // 접수번호가 먼저 사라지면 안 되니 휴대폰 기록은 그대로 (체크를 풀면 기록만 지울 수 있음)
      if ($('pickSheet').hidden) return toast('삭제 요청을 보내지 못해 기록을 그대로 뒀어요');   // 보내는 중에 판을 닫았으면 판 밖에서 알림
      $('pickList').querySelector('.delErr')?.remove();
      $('pickList').querySelector('.delActs').insertAdjacentHTML('beforebegin', '<p class="delDesc delErr" role="alert">삭제 요청을 보내지 못했어요. 인터넷 연결 후 다시 시도해 주세요</p>');
      return;
    }
  }
  hist.splice(i, 1); store.set('history', hist); rawDel(date).catch(() => {});
  closePick();
  if (shownDate === date) { shownDate = null; route = null; $('result').classList.add('hidden'); $('vresult').classList.add('hidden'); }   // 지운 기록 화면은 닫음
  if (!hist.length) $('histBody').innerHTML = '아직 기록이 없어요.';
  renderHistory(); setTab('records'); scrollTo(0, 0); toast(ask ? '지웠어요 · 익명 결과 삭제도 요청했어요' : '지웠어요');   // 홈 요약·달력·통계·그래프·한 달 점검·영상 비교값은 기록에서 다시 계산됨
}
document.addEventListener('click', e => { const d = e.target.closest('[data-delrec]'); if (d) openDelete(d.dataset.delrec); });
// 지난 기록 줄 길게 누르기(0.6초) = 지우기 판
let lpT = 0, lpFired = false;
$('histBody').addEventListener('pointerdown', e => { const r = e.target.closest('[data-i]'); if (!r) return; lpFired = false; clearTimeout(lpT);
  lpT = setTimeout(() => { lpFired = true; const h = store.get('history', [])[+r.dataset.i]; if (h) openDelete(h.date); }, 600); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('histBody').addEventListener(ev, () => clearTimeout(lpT));
$('histBody').addEventListener('contextmenu', e => { if (e.target.closest('[data-i]')) e.preventDefault(); });
$('pickList').addEventListener('click', e => {
  const dl = e.target.closest('[data-del]'); if (dl) { deleteRec(dl.dataset.del); return; }
  if (e.target.closest('[data-keep]')) { closePick(); return; }
  const s = e.target.closest('[data-share]'); if (s) { closePick(); shareSummary(s.dataset.share); return; }
  const b = e.target.closest('[data-val]'); if (!b) return;
  if ($(pickFor).value !== b.dataset.val) { $(pickFor).value = b.dataset.val; $(pickFor).dispatchEvent(new Event('change')); syncPicks(); }
  closePick();
});
$('pickSheet').addEventListener('click', e => { if (e.target.id === 'pickSheet') closePick(); });   // 바깥 = 닫기
$('pickSheet').addEventListener('keydown', e => { if (e.key === 'Escape') closePick(); });
$('pickSheet').addEventListener('pointerdown', e => { pickDragY = e.clientY; });          // 아래로 끌면 닫기
$('pickSheet').addEventListener('pointerup', e => { if (pickDragY != null && e.clientY - pickDragY > 60) closePick(); pickDragY = null; });
function showAct() { showLoc(); const a = $('act').value;
  syncPicks(); $('autoNote').classList.toggle('hidden', a !== 'auto'); $('easyNote').classList.toggle('hidden', a !== 'easyrun'); $('slowNote').classList.toggle('hidden', a !== 'slowrun'); $('cooperNote').classList.toggle('hidden', a !== 'cooper'); $('warmBtn').classList.toggle('hidden', !RUN_ACTS.includes(a)); $('stairsNote').classList.toggle('hidden', a !== 'stairs'); $('dmodeBox').classList.toggle('hidden', a === 'slowrun' || a === 'cooper' || a === 'stairs'); }
$('act').addEventListener('change', () => { store.set('act', $('act').value); showAct(); showSetSum(); });
showAct();
if (!store.get('history', []).length) $('firstGuide').open = true;   // 처음 쓰는 사람에겐 사용법을 펼쳐 둠

// ── 거리 재는 방법 (선택은 이 휴대폰에 기억) ──
$('dmode').value = store.get('dmode', 'gps');
function showDmode() { showLoc(); $('distBox').classList.toggle('hidden', $('dmode').value !== 'manual'); $('gpsNote').classList.toggle('hidden', $('dmode').value !== 'gps'); }
$('dmode').addEventListener('change', () => { store.set('dmode', $('dmode').value); showDmode(); showSetSum(); });
showDmode();

// ── 측정 ──
// 설치형 안드로이드 앱이면 네이티브 기록기(화면이 꺼져도 측정), 아니면 브라우저 센서
const Native = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins.GaitRecorder : null;
if (Native) $('webOnly')?.remove();
// 카톡·네이버·인스타 안의 브라우저: 다른 화면으로 가면 측정이 끊기고 설치·홈 화면 추가도 잘 안 돼서 크롬·사파리로 넘기는 안내 (검수팀 제안 a)
{
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua), kakao = /KAKAOTALK/i.test(ua);
  if (!Native && (kakao || /NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua))) {
    const href = kakao ? 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href)          // 카톡 공식 외부 브라우저 열기 주소
      : ios ? '' : `intent://${location.href.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    const name = ios ? '사파리로' : kakao ? '크롬(기본 브라우저)으로' : '크롬으로';
    document.querySelector('main > .sub').insertAdjacentHTML('afterend', `<div class="warn" id="inAppNote" role="status" style="font-size:1rem">
      <b>${kakao ? '카톡' : '다른 앱'} 안에서 열렸어요.</b> 여기서는 측정 중에 다른 화면으로 가면 측정이 끊겨요. ${name} 열어 주세요.
      ${href ? `<a class="btnlike" href="${href}">${name} 열기</a>` : `<br>화면 구석의 메뉴(⋯)에서 <b>"Safari로 열기"</b>를 눌러 주세요.`}
      ${ios ? '' : '<a class="btnlike ghostlike" href="install.html">설치형 앱 받기 (다른 앱을 써도 측정이 계속돼요)</a>'}</div>`);
  }
}
// 웹에서 주머니·허리(또는 자동 짐작)를 고르면 시작 전에 끊김 경고 (데이터: 웹 주머니 측정은 초당 3번·대부분 끊김)
const showPocketNote = () => $('pocketNote').classList.toggle('hidden', !!Native || $('pos').value === 'hand');
$('pos').value = store.get('pos', 'pocket');                                  // 휴대폰 위치도 지난 선택을 기억
$('pos').addEventListener('change', () => { store.set('pos', $('pos').value); showPocketNote(); showSetSum(); });
showPocketNote();
// 측정 탭 요약 줄: 저장된 내 정보·설정은 한 줄로 접고 '바꾸기'로 펼침 (아버님 피드백: 매번 내려가서 시작을 찾음)
const POS_NAME = { pocket: '바지 앞주머니', waist: '허리', hand: '손에 들고', auto: '위치 자동 짐작' };
const DMODE_NAME = { gps: 'GPS 자동', manual: '거리 직접 입력', none: '거리 안 잼' };
function openSet(open) { $('setEdit').hidden = !open; $('setSum').hidden = $('setSumNote').hidden = open || store.get('act', null) == null; $('setOpen').setAttribute('aria-expanded', open); }
function showSetSum() {
  syncPicks();
  const a = $('act').value, gpsBox = !$('dmodeBox').classList.contains('hidden');
  $('setSumTxt').textContent = [ACT[a] ?? a, POS_NAME[$('pos').value], gpsBox ? DMODE_NAME[$('dmode').value] : a === 'cooper' ? 'GPS 자동' : ''].filter(Boolean).join(' · ');
}
$('setOpen').addEventListener('click', () => openSet(true));
function showProfSum(open) {
  const { sex, age } = store.get('profile', {}), txt = [{ m: '남성', f: '여성' }[sex], age && `${age}세`].filter(Boolean).join(' · ');
  $('profSumTxt').textContent = txt;
  $('profSum').hidden = open || !txt; $('profEdit').hidden = !open && !!txt;
  $('profOpen').setAttribute('aria-expanded', !!open);
}
$('profOpen').addEventListener('click', () => showProfSum(true));
showProfSum(false);
openSet(store.get('act', null) == null);                                   // 처음 쓰는 사람은 펼친 채로
showAct(); showSetSum();
let samples = [], t0 = 0, timer = null, gpsPts = [], gpsWatch = null, gpsDenied = false, wakeLock = null, hiddenDuringRec = false;
// 휴대폰 브라우저는 화면이 꺼지면 센서·GPS를 멈춤 → 측정 중엔 화면 켜짐 유지, 그래도 꺼지면 기록해 두고 이유를 알려 줌
// 웹앱은 다른 앱(카톡·전화)으로 가면 센서가 멈추고, 휴대폰이 브라우저를 정리하면 페이지가 닫혀 측정이 사라짐
// → 나가는 순간 지금까지의 값을 저장해 두고, 돌아오면 지움. 페이지가 닫혔다 다시 열리면 저장본으로 분석 (resumeRec)
function saveSnap() {
  if (!t0 || Native) return;
  try { localStorage.setItem('recSnap', JSON.stringify({ rec: store.get('rec', null), pos: $('pos').value, dmode: $('dmode').value, gpsDenied,
    s: samples.map(p => [Math.round(p.t * 10) / 10, Math.round(Math.hypot(p.x, p.y, p.z) * 100) / 100]), g: gpsPts })); } catch {}   // 분석은 가속도 크기만 씀 → 크기만 저장해 용량 절약
}
document.addEventListener('visibilitychange', () => {
  if (!t0) return;
  if (document.hidden) { hiddenDuringRec = true; saveSnap(); }
  else { store.set('recSnap', null); if (!Native) navigator.wakeLock?.request('screen').then(w => { if (t0) wakeLock = w; else w.release(); }, () => {}); }   // 브라우저는 다른 앱에 가면 화면 켜짐을 풀어 버림 → 돌아오면 다시 요청
});
addEventListener('pagehide', saveSnap);
// 위치 좌표는 이 휴대폰 안에서 거리 계산에만 쓰고 저장·전송하지 않음
function startGps() {
  gpsPts = []; gpsDenied = false;
  if (($('dmode').value !== 'gps' && $('act').value !== 'cooper') || !navigator.geolocation) return;   // 12분 테스트는 늘 GPS
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
// 휴대폰 허용 창이 뜨기 전에 무엇을·어디에 쓰는지 우리 화면으로 먼저 보여 줌(처음 한 번). '나중에 할게요'면 false (문구는 privacy.html과 같게)
let permOpen = null;                                                       // 판이 떠 있으면 같은 답을 기다림 (키보드로 '시작'을 또 눌러도 판·권한 요청이 두 번 생기지 않게)
function permIntro(key, title, cards) {
  if (store.get(key, false)) return Promise.resolve(true);
  if (permOpen) return permOpen.then(() => false);
  return permOpen = new Promise(res => {
    const o = document.createElement('div');
    o.id = 'permOv'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', title);
    o.innerHTML = `<div class="dsheet" style="padding-left:20px;padding-right:20px"><h3 style="margin:0 0 4px">${title}</h3><div class="sub">다음 화면에서 휴대폰이 허용을 물어봐요.</div>
      ${cards.map(([h, t]) => `<div class="pcard"><b>${h}</b><div class="sub">${t}</div></div>`).join('')}
      <button data-p="ok">계속</button><button class="ghost" data-p="later">나중에 할게요</button></div>`;
    document.body.append(o);
    for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = true;
    o.addEventListener('click', e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = false;
      o.remove(); permOpen = null; if (b.dataset.p === 'ok') store.set(key, true); res(b.dataset.p === 'ok');
    });
    o.querySelector('[data-p=ok]').focus();
  });
}
const INTRO_LOC = ['위치를 사용할까요?', [['가져오는 것', '측정하는 동안만 GPS 위치(위도·경도·정확도). 측정 중 알림창 표시도 허용을 물어봐요.'],
  ['쓰는 곳', '걸은 거리·속도 계산과 경로 지도(지도는 누를 때만 카카오 지도를 불러와요)'],
  ['보내지 않아요', '경로는 그 측정 기록과 함께 이 휴대폰에만 저장해요(최근 30개 기록). 운영자에게 보내지 않아요. 지도를 누를 때만 보이는 지역의 대략 위치와 인터넷 주소(IP)가 카카오에 전달돼요.']]];
const INTRO_NOTI = ['알림을 허용할까요?', [['가져오는 것', '가져오는 정보는 없어요. 알림을 띄우는 권한만 써요.'],
  ['쓰는 곳', '측정하는 동안 알림창에 "걸음 측정 중"을 보여 줘요. 화면이 꺼져도 측정이 이어져요.'],
  ['보내지 않아요', '알림 권한으로는 아무것도 보내지 않아요.']]];
const INTRO_HC = ['걸음 수를 가져올까요?', [['가져오는 것', '삼성헬스(갤럭시 워치 포함) 등이 헬스 커넥트에 저장한 걸음 수·수면 시간, 측정하는 동안의 심박수'],
  ['쓰는 곳', '홈 카드에 숫자로 보여 줘요. 심박수 평균·최고는 그 측정 기록에 붙여 둬요.'],
  ['보내지 않아요', '이 휴대폰 안에만 두고 운영자에게 보내지 않아요. 휴대폰 설정 → 헬스 커넥트에서 언제든 끌 수 있어요.']]];
$('start').addEventListener('click', async () => {
  const act = $('act').value;
  const useGps = usesGps(act);
  if (useGps && !store.get('locConsent', null)) { openSet(true); $('locBox').scrollIntoView({ block: 'center' }); $('locOk').focus({ preventScroll: true }); return alert('GPS로 거리·경로를 재려면 위치기반서비스 이용약관에 동의해 주세요(시작 버튼 위 체크). 동의하지 않으려면 거리 재는 방법을 "재지 않음"으로 바꿔 주세요.'); }
  if (Native) {
    if (!await permIntro(useGps ? 'introLoc' : 'introNoti', ...(useGps ? INTRO_LOC : INTRO_NOTI))) return;   // 나중에 → 측정 시작 안 함
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
  $('recTitle').textContent = '3초 안에 주머니에 넣으세요';
  $('recTime').textContent = LEAD_S; setArc(1); $('recAct').textContent = ACT[act] ?? '';
  // 앱: 카운트다운 전에 측정 서비스부터 켬. 카운트다운 중에 화면을 꺼도 화면 타이머만 멈추고 측정은 계속됨 (예전엔 서비스가 안 켜져 결과가 안 나왔음)
  // 처음 3초(주머니에 넣는 시간)는 끝낼 때 빼고 계산. 슬로우 러닝은 서비스 진동이 켠 순간부터 1분마다라 그 시각을 기준으로 둠(첫 조깅 57초)
  const cdEnd = Date.now() + LEAD_S * 1000, lead = Native && act === 'slowrun' ? 0 : LEAD_S;
  const startWall = cdEnd - (LEAD_S - lead) * 1000;
  if (Native) {
    Native.start({ gps: useGps && !gpsDenied, intervalSec: act === 'slowrun' ? INTERVAL_S : 0, endSec: act === 'cooper' ? COOPER_S + LEAD_S : 0, baro: act === 'stairs' });   // endSec: 달리기 12분이 되면 서비스가 진동
    store.set('rec', { act, startWall, native: true, lead });               // 측정 중 표시: 전화·카톡 뒤 앱이 다시 열려도 이어서 보여 주려고
    t0 = startWall;                                                         // 카운트다운 중에 끝을 눌러도 서비스를 멈추고 안내하게
  }
  timer = setInterval(() => {                                               // 시계 기준이라 화면이 잠깐 멈췄다 돌아와도 맞게 셈
    const left = Math.ceil((cdEnd - Date.now()) / 1000);
    if (left > 0) { $('recTime').textContent = left; return setArc(left / LEAD_S); }
    clearInterval(timer);
    navigator.vibrate?.(200);
    if (!Native) { window.addEventListener('devicemotion', onMotion); store.set('rec', { act, startWall, native: false }); }
    hiddenDuringRec = false;
    runRec(act);
  }, 250);
});
// 측정 중 화면 (시간·안내). 시작 시각 기준이라 다시 열린 앱에서도 이어서 셈
// 가운데 원: 기본 1분에 한 바퀴, 12분 테스트는 남은 시간, 슬로우 러닝은 조깅·걷기 1분 구간마다 한 바퀴
const setArc = f => { $('recArc').style.strokeDashoffset = (565.5 * (1 - Math.min(1, Math.max(0, f)))).toFixed(1); };
function runRec(act) {
  const { startWall } = store.get('rec', {});
  $('recTitle').textContent = { walk: '걷는 중 · 평소처럼', run: '달리는 중 · 평소 페이스로', easyrun: '천천히 달리는 중 · 걷는 속도 정도로', cooper: '12분 동안 최대한 멀리', stairs: '계단 오르는 중 · 오르기만', auto: '측정 중 · 걷거나 달려요' }[act] ?? '조깅 1분';
  t0 = startWall; liveSteps = 0; lastMoveAt = 0; idleAskedAt = 0; $('recAct').textContent = ACT[act] ?? '';
  for (const id of ['lvCad', 'lvSteps', 'lvDist']) $(id).textContent = '–';
  $('recFind').textContent = '걸음 신호 찾는 중…';
  $('lvDistBox').hidden = !usesGps(act);
  $('recGpsNote').classList.toggle('hidden', !usesGps(act) || act === 'cooper');
  $('recMapBox').classList.toggle('hidden', !KAKAO_KEY || !usesGps(act));
  closeRecMap();
  let lastPhase = Math.floor((Date.now() - startWall) / 1000 / INTERVAL_S), tick = 0;
    timer = setInterval(() => {
      const el = Math.max(0, (Date.now() - startWall) / 1000);
      if (++tick % 6 === 0) updateLive(act, el);
      $('recTime').textContent = clock(el);
      setArc(act === 'cooper' ? 1 - el / COOPER_S : (el % INTERVAL_S) / INTERVAL_S);   // INTERVAL_S = 60초
      if (act === 'slowrun') {
        const ph = Math.floor(el / INTERVAL_S), jog = ph % 2 === 0;
        $('recTitle').textContent = `${jog ? '조깅' : '걷기'} 1분 · ${INTERVAL_S - Math.floor(el % INTERVAL_S)}초 남음`;
        if (ph !== lastPhase && !Native) navigator.vibrate?.(jog ? [600] : [200, 150, 200]);   // 웹: 조깅 시작 = 길게 1번, 걷기 = 짧게 2번
        lastPhase = ph;
      }
      if (act === 'cooper') {
        const left = Math.max(0, COOPER_S - Math.floor(el));
        $('recTitle').textContent = `${clock(left)} 남음 · 최대한 멀리`;
        if (el >= COOPER_S) { navigator.vibrate?.([600, 200, 600]); return stopRec(); }   // 12분이 되면 자동으로 끝
      }
      const last = gpsPts[gpsPts.length - 1];
      if (Native) $('recHint').textContent = '알림창에 "걸음 측정 중"이 보이면 정상이에요';
      else if ($('dmode').value === 'gps') $('recHint').textContent = gpsDenied ? '위치 권한이 없어 속도는 재지 않아요 (케이던스는 정상 측정)'
        : last ? `GPS 오차 약 ${Math.round(last.acc)}m · 속도를 재려면 야외에서 1분 이상 걸어 주세요` : 'GPS 신호 찾는 중… (실내에서는 잘 안 잡혀요)';
    }, 500);
}
// 측정 중 실시간 값 (아버님 피드백: 재는 동안 값이 안 보여 답답함). 최종 결과는 끝낸 뒤 전체로 다시 계산
let liveSteps = 0;
async function updateLive(act, el) {
  let s, g;
  if (Native) {
    let ended; try { ({ samples: s, gps: g, ended } = await Native.peek({ sec: 20 })); } catch { return; }   // 0.10 이하 앱엔 peek가 없음 → 조용히 넘어감
    if (ended && t0) return stopRec(false, ended);                         // 서비스가 오래 걷지 않음·3시간·알림 '끝내기'로 끝냄 → 그때까지 잰 것으로 저장
  }
  else { const cut = (samples[samples.length - 1]?.t ?? 0) - 20000; s = samples.filter(p => p.t >= cut); g = gpsPts; webIdle(el); }
  if (!t0) return;
  const ok = s?.length > 50, pos = $('pos').value === 'auto' ? 'pocket' : $('pos').value;
  const mode = !ok ? null : act === 'slowrun' ? (Math.floor(el / INTERVAL_S) % 2 === 0 ? 'run' : 'walk') : act === 'auto' ? guessActivity(s, $('pos').value) ?? 'walk' : act === 'walk' ? 'walk' : 'run';
  const r = ok ? analyzeWalk(s, { position: pos, activity: mode }) : { error: 'tooShort' };
  if (act === 'auto' && !r.error) $('recTitle').textContent = `지금 ${mode === 'run' ? '달리기' : '걷기'}로 보여요`;
  if (!r.error) { liveSteps += r.cadence * 3 / 60; $('lvCad').textContent = Math.round(r.cadence); $('lvSteps').textContent = Math.round(liveSteps).toLocaleString(); }
  $('recFind').textContent = r.error ? '걸음 신호 찾는 중…' : '';
  const d = g?.length > 1 ? gpsDistance(g) : null;
  if (d) $('lvDist').textContent = Math.round(d.dist).toLocaleString();
}
// 웹: 화면이 켜져 있는 동안 '오래 걷지 않음' (설치형 앱은 서비스가 처리). 측정 종료 확인 창을 문구만 바꿔 씀
let lastMoveAt = 0, idleAskedAt = 0;
function webIdle(el) {
  const now = Date.now();
  if (el >= MAX_REC_S) return stopRec(false, 'maxEnd');
  const w = samples.filter(p => p.t >= (samples[samples.length - 1]?.t ?? 0) - 5000).map(p => Math.hypot(p.x, p.y, p.z));
  if (w.length > 20) { const m = w.reduce((a, b) => a + b, 0) / w.length, sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / w.length); if (sd >= STILL_SD) lastMoveAt = now; }
  if (!lastMoveAt) lastMoveAt = now;
  if (idleAskedAt && lastMoveAt > idleAskedAt) return closeIdleAsk(true);   // 다시 걸으면 물음을 거둠
  if (idleAskedAt && now - idleAskedAt >= IDLE_END_S * 1000) return stopRec(false, 'idleEnd');
  if (!idleAskedAt && now - lastMoveAt >= IDLE_ASK_S * 1000) {
    idleAskedAt = now; navigator.vibrate?.([400, 200, 400]);
    $('stopQ').textContent = `${IDLE_ASK_S / 60}분째 걷지 않았어요. 측정을 끝낼까요?`; $('stopYes').textContent = '끝내기'; $('stopNo').textContent = '계속 재기';
    $('stopSheet').hidden = false; $('stopNo').focus();
  }
}
function closeIdleAsk(hide) {
  if (!idleAskedAt) return;
  idleAskedAt = 0; lastMoveAt = Date.now();
  $('stopQ').textContent = '측정을 끝낼까요?'; $('stopYes').textContent = '측정 종료'; $('stopNo').textContent = '계속 측정';
  if (hide) $('stopSheet').hidden = true;
}
// 측정 종료: 한 번 누르면 확인 창, '측정 종료'를 눌러야 끝 (사용자 결정 10/27: 길게 누르기 대신 확인 창 하나로 주머니 오작동 막기)
const closeStopSheet = () => { $('stopSheet').hidden = true; };
$('stop').addEventListener('click', () => { $('stopSheet').hidden = false; $('stopNo').focus(); });
$('stopNo').addEventListener('click', () => { closeStopSheet(); closeIdleAsk(); $('stop').focus(); });   // '계속 재기'면 다시 처음부터 셈
$('stopYes').addEventListener('click', () => { closeStopSheet(); stopRec(); });
$('stopSheet').addEventListener('click', e => { if (e.target.id === 'stopSheet') closeStopSheet(); });   // 시트 바깥 = 계속 측정
$('stopSheet').addEventListener('keydown', e => { if (e.key === 'Escape') closeStopSheet(); });
if (Native) {
  const ol = document.querySelector('ol.guide'); ol.querySelectorAll('[data-web]').forEach(li => li.remove());   // 웹 전용 측정 단계 → 설치형 앱 단계로
  ol.lastElementChild.insertAdjacentHTML('beforebegin', `<li><b>시작</b>을 누르고 3초 뒤 <b>화면을 끄고</b> 주머니에 넣어요. 알림창에 "걸음 측정 중"이 떠 있으면 화면이 꺼져도 측정돼요.</li>
    <li><b>평소처럼, 멈추지 말고 이어서</b> 걸어요. 케이던스만 볼 땐 20초 이상, GPS로 속도까지 볼 땐 야외에서 1분 이상. 방향을 틀며 멈추면 그 앞뒤가 따로 잘려 짧게 잡혀요.</li>
    <li>멈춰서 화면을 켜고 <b>측정 종료</b>를 누른 뒤 한 번 더 확인해요.</li>`);
}
// 설치형 앱에서 휴대폰(절전·메모리 정리)이 측정 중인 앱을 끄면 측정이 멈춤 → 이유와 막는 방법을 알려 줌
const BATTERY_TIP = '삼성 휴대폰은 설정 → 배터리 → 백그라운드 사용 제한 → <b>절전 예외 앱</b>에 ‘스텝미러’(예전 이름 ‘걸음 분석’)를 넣으면 측정 중에 앱이 정리되지 않아요.';
// 결과가 안 나온 측정도 이유만 한 줄 보냄 (시작한 측정 중 몇 번 성공했나 = 수율의 분모, 데이터분석팀). 걸음 숫자 칸은 빈칸,
// warnings = 이유 표시(end:… / failed:…) + 측정 정보. 익명 전송 동의자만, 14세 미만은 send()가 막음. 휴대폰 기록에는 저장 안 함
function sendEnd(tags, act, position, diag) {
  if (!consent?.share || !ENDPOINT) return null;
  const today = new Date().toLocaleDateString('sv-SE');
  const practice = act === 'walk' && !store.get('history', []).some(h => (h.activity ?? 'walk') === 'walk' && new Date(h.date).toLocaleDateString('sv-SE') === today);
  try { return send({ date: new Date().toISOString(), activity: act, position, practice, warnings: tags, diag }); } catch { return null; }
}
const sentNote = rc => rc ? `<div class="sub">걸음 숫자 없이 측정 정보만 익명으로 보냈어요. 접수번호 <b>${rc}</b> · 지우고 싶으면 이 번호를 ldj000103@gmail.com으로 보내 주세요(이 화면을 벗어나면 다시 볼 수 없으니 적어 두세요).</div>` : '';
const sentText = rc => rc ? `

측정 정보만 익명으로 보냈어요. 접수번호 ${rc} (지우려면 이 번호를 ldj000103@gmail.com으로 보내 주세요)` : '';
const noDiag = () => ({ src: Native ? 'app' : 'web', durS: 0, hz: 0, gapS: 0, gpsGood: 0 });   // 센서 값이 거의 없어 측정 정보를 못 만든 경우
async function stopRec(killed = false, reason = null) {
  killed = killed === true;                                                // 혹시 클릭 이벤트가 넘어와도 진짜 true일 때만
  reason = typeof reason === 'string' && reason in WARN ? reason : null;   // idleEnd·maxEnd만 기록에 남김 (알림의 '끝내기'는 보통 종료)
  closeIdleAsk();
  closeStopSheet();                                                        // 12분 자동 종료·앱 정리로 끝날 때 확인 창이 남지 않게
  shownDate = null;                                                        // 실패 화면에 앞 측정의 공유·원본·상황 버튼이 붙지 않게 (finish는 따로 다시 정함)
  const rec = store.get('rec', null), ran = t0, lead = rec?.lead ?? 0; clearInterval(timer); t0 = 0;
  const endTag = !rec || Date.now() < rec.startWall ? 'end:cancel' : 'end:noData';   // 3초 카운트다운 중에 끝 = 취소
  store.set('rec', null); store.set('recSnap', null);
  document.body.classList.remove('recording');
  if (Native) {
    $('rec').classList.add('hidden'); $('setup').classList.remove('hidden');
    if (!ran) return;
    let r;
    try { r = await Native.stop(); } catch { return alert('측정을 끝내지 못했어요. 앱을 껐다 켜고 다시 해 주세요.'); }
    const cut = (r.samples[0]?.t ?? 0) + lead * 1000;                       // 주머니에 넣던 처음 3초는 뺌 (센서·GPS 시각은 같은 시계)
    const lim = reason === 'maxEnd' ? cut + MAX_REC_S * 1000 : Infinity;   // 3시간에 끝난 측정은 앞 3시간만 (그 뒤는 화면이 꺼져 CPU가 잠들며 값이 듬성듬성할 수 있음)
    const s = r.samples.filter(p => p.t >= cut && p.t <= lim), g = r.gps.filter(p => p.t >= cut && p.t <= lim), pr = (r.press ?? []).filter(p => p.t >= cut && p.t <= lim);   // press: 0.16 이하 앱엔 없음
    const longRun = rec?.startWall && Date.now() - rec.startWall > 20000;   // 20초 넘게 지났는데 값이 없으면 '짧아서'가 아니라 측정이 멈춘 것
    if (s.length < 20) {
      const act = rec?.act ?? $('act').value;
      if (killed || longRun) return showHtml(`<h2>측정이 멈췄어요</h2><div class="warn">휴대폰이 앱을 정리해서 측정이 멈췄고, 저장된 측정값이 없어요. 다시 측정해 주세요.<br>${BATTERY_TIP}</div>${sentNote(sendEnd(['end:killed'], act, $('pos').value, noDiag()))}`);
      const rc = sendEnd([endTag], act, $('pos').value, noDiag());
      return alert('측정 시간이 너무 짧아요. 시작 후 3초 동안은 주머니에 넣는 시간이라 빼고, 그 뒤부터 재요. 걷고 나서 측정 종료를 눌러 주세요.' + sentText(rc));
    }
    pendingEnd = reason; finish(s, false, g, pr); endNote(reason);
    if (killed || r.fromFile) $('result').insertAdjacentHTML('afterbegin', `<div class="warn">측정 중에 휴대폰이 앱을 정리해서 측정이 중간에 멈췄어요. 멈추기 전까지 저장된 기록으로 분석했어요(걸음 수·시간이 실제보다 적을 수 있어요).<br>${BATTERY_TIP}</div>`);
    return;
  }
  wakeLock?.release().catch(() => {}); wakeLock = null;
  window.removeEventListener('devicemotion', onMotion);
  stopGps();
  $('rec').classList.add('hidden'); $('setup').classList.remove('hidden');
  if (samples.length < 20) { const rc = sendEnd([endTag], $('act').value, $('pos').value, noDiag()); if (endTag === 'end:cancel') return; return alert('센서 값이 거의 들어오지 않았어요. 다시 시도해 주세요.' + sentText(rc)); }
  pendingEnd = reason; finish(samples, false, gpsPts); endNote(reason);
}
// 슬로우 러닝·12분 테스트 결과는 경고 목록을 따로 안 그려서 자동 종료 이유를 맨 위에 한 번 더 보여 줌 (걷기·러닝은 warnHtml이 보여 줌)
function endNote(reason) {
  pendingEnd = null;
  if (reason && !$('result').textContent.includes(WARN[reason].slice(0, 10))) $('result').insertAdjacentHTML('afterbegin', `<div class="warn">${WARN[reason]}</div>`);
}

function finish(data, demo = false, gps = [], press = []) {
  shownDate = null; route = null;
  let act = $('act').value, position = $('pos').value;
  const auto = {};                                                         // 자동으로 고른 것 → 결과에 '참고'·'검증 안 됨'으로 표시
  if (act === 'auto') act = auto.act = autoAct(data, position);
  if (position === 'auto') position = auto.pos = guessPosition(data, act === 'walk' ? 'walk' : 'run');
  if (act === 'slowrun') return finishSlow(data, demo, position, auto);
  if (act === 'cooper') return finishCooper(data, gps, demo, position);
  if (act === 'stairs') return finishStairs(data, demo, position, press);
  const res = analyzeWalk(data, { position, activity: act === 'walk' ? 'walk' : 'run' });   // 천천히 달리기도 러닝 방식으로 분석
  if (act === 'walk' && !res.error) Object.assign(res, fastMinutes(data, { position, activity: 'walk' }));   // 빠르게 걸은 분 (기록에 같이 저장)
  const mode = $('dmode').value;
  let maxGap = 0, gapSum = 0;                                              // 2초 넘게 센서 값이 없던 빈틈 = 끊김
  for (let i = 1; i < data.length; i++) { const g = data[i].t - data[i - 1].t; maxGap = Math.max(maxGap, g); if (g > 2000) gapSum += g; }
  // 끊김은 실제 데이터의 빈틈으로만 판정 (화면이 잠깐 숨겨져도 센서가 계속 들어오는 브라우저가 있어서, 숨김만으로는 판정하지 않음)
  const paused = !demo && maxGap > 2000;
  // 측정 정보: 문제가 생겼을 때 원인(센서 끊김, GPS 없음, 웹/앱 방식)을 찾기 위한 값
  const durS = data.length > 1 ? (data[data.length - 1].t - data[0].t) / 1000 : 0;
  const diag = { src: Native ? 'app' : 'web', n: data.length, durS, hz: durS ? data.length / durS : 0, gapS: maxGap / 1000, sd: res.sd,
    gpsN: gps.length, gpsGood: gps.filter(p => p.acc <= 20).length, hidden: !Native && hiddenDuringRec };
  const diagHtml = `<details><summary>측정 정보 (문제 찾기용)</summary><div class="sub">${diag.src === 'app' ? '설치형 앱' : '웹'} 방식 · 센서 값 ${diag.n}개 · 기록 시간 ${durS.toFixed(0)}초 · 초당 ${diag.hz.toFixed(0)}회 · 가장 길게 끊긴 시간 ${diag.gapS.toFixed(1)}초 · GPS 점 ${diag.gpsN}개(오차 20m 이내 ${diag.gpsGood}개)${diag.hidden ? ' · 화면 꺼짐 감지' : ''}</div></details>`;              // 2초 넘게 센서 값이 끊김 = 화면 꺼짐·다른 앱
  // 측정 품질이 너무 낮으면(초당 10번 미만 또는 끊긴 시간이 절반 넘음) 결과를 보여 주지 않음 — 웹을 주머니에 넣으면 화면이 꺼져 거의 기록되지 않음
  const recS = Math.max(0, durS - gapSum / 1000);
  if (!demo && durS > 0 && (diag.hz < 10 || recS < durS / 2)) {
    const why = diag.hz < 10 ? `기록이 초당 ${diag.hz.toFixed(0)}번뿐이라(정상은 수십 번) 걸음을 셀 수 없었어요.` : `${mmss(durS)} 중 ${mmss(recS)}만 기록됐어요.`;
    // 실패한 측정도 걸음 숫자 없이 '실패' 표시와 측정 정보만 보냄 (실패가 얼마나 잦은지 세려고, 데이터분석팀). 휴대폰 기록에는 저장 안 함
    const note = sentNote(sendEnd([diag.hz < 10 ? 'failed:lowHz' : 'failed:gaps'], act, position, diag));
    showHtml(`<h2>측정이 제대로 안 됐어요</h2><div class="warn">${Native ? '' : '<b>다음엔 손에 들고 화면을 켠 채로 재 주세요.</b> 주머니에 넣고 재려면 <a href="install.html">설치형 앱</a>을 쓰세요.<br>'}${why} 그래서 이번 측정은 기록에 저장하지 않았어요.</div>${note}${diagHtml}`);
    return;
  }
  if (paused && !res.error) res.warnings.push('paused');
  if (res.error && paused) {
    showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">측정 중에 화면이 꺼지거나 다른 앱으로 바뀌어서 센서가 멈췄어요 (최대 ${Math.round(maxGap / 1000)}초 끊김). <b>전원 버튼은 누르지 말고</b> 시작 후 그대로 주머니에 넣어 주세요(화면이 까만 주머니 모드는 켜진 상태라 측정이 계속돼요). 측정 종료는 누른 뒤 한 번 더 확인해야 끝나서 주머니 속에서 실수로 끝나지 않아요.</div>${sentNote(sendEnd([`end:${res.error}`, 'paused'], act, position, diag))}`);
    return;
  }
  if (res.error) {
    const msg = { tooShort: '측정 시간이 너무 짧아요(8초 이상).', noWalk: '걷는 움직임을 찾지 못했어요. 휴대폰을 주머니에 넣고 6초 이상 걸어 주세요.', irregular: '반복되는 걸음 신호를 찾지 못했어요.' }[res.error];
    showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">${msg} 그래서 이번 측정은 기록에 저장하지 않았어요.</div>${sentNote(sendEnd([`end:${res.error}`], act, position, diag))}${diagHtml}`);
    return;
  }
  const today = new Date().toLocaleDateString('sv-SE');                  // 휴대폰 시간대 기준 YYYY-MM-DD
  const hist = store.get('history', []);
  const practice = act === 'walk' && !hist.some(h => (h.activity ?? 'walk') === 'walk' && new Date(h.date).toLocaleDateString('sv-SE') === today);   // 그날 첫 걷기 측정 = 연습 (Perry 20장)
  const dist = mode === 'manual' ? parseFloat($('dist').value) || null : null;
  const d = mode === 'gps' ? (gpsDenied && !demo ? { gpsError: 'denied' } : gpsSpeed(res, gps)) : withDistance(res, dist);
  const rec = { date: new Date().toISOString(), start: Date.now() - durS * 1000, activity: act, position, auto, practice, route: packRoute(gps), ...res, distance: dist, ...d, distSource: d.speed ? mode : null, diag, diagHtml };
  saveRec(rec, hist, demo, data);
  shownDate = rec.date;
  route = rec.route;
  const prev = hist.find(h => !h.practice && h !== rec && (h.activity ?? 'walk') === act);
  act === 'walk' ? render(rec, prev) : renderRun(rec, prev);
  renderHistory();
}

// sec초씩 자른 조각 [{k, s}] (20초 미만 조각은 버림)
function chunks(data, sec) {
  const out = [], t0s = data[0].t;
  for (let k = 0; ; k++) {
    const a = t0s + k * sec * 1000, b = a + sec * 1000;
    if (a > data[data.length - 1].t) break;
    const s = data.filter(p => p.t >= a && p.t < b);
    if (s.length >= 50 && s[s.length - 1].t - s[0].t >= 20000) out.push({ k, s });
  }
  return out;
}
// 자동 구분: 30초씩 걷기·달리기를 고르고, 둘 다 1분(2조각) 이상 섞이면 슬로우 러닝
// ponytail: 신호등에서 1분 넘게 걸은 러닝도 슬로우 러닝으로 봄 → 실제 기록으로 보정 필요
function autoAct(data, position) {
  return mixActivity(chunks(data, 30).map(c => guessActivity(c.s, position))) ?? guessActivity(data, position) ?? 'walk';
}

// ── 슬로우 러닝: 1분 단위로 잘라 조깅 구간은 러닝, 걷기 구간은 걷기로 분석 (자동 구분이면 30초씩 신호로 가름) ──
function finishSlow(data, demo, position, auto = {}) {
  shownDate = null;
  const t0s = data[0].t, segs = [];
  const parts = auto.act ? chunks(data, 30).map(({ s }) => ({ s, jog: guessActivity(s, position) === 'run' })) : chunks(data, INTERVAL_S).map(({ k, s }) => ({ s, jog: k % 2 === 0 }));
  let asWalk = 0, walkLike = false;
  for (const { s: slice, jog } of parts) {
    const a = jog ? analyzeJog(slice, position) : { r: analyzeWalk(slice, { position, activity: 'walk' }), jog: false }, r = a.r;
    if (jog && !a.jog && !r.error) asWalk++;                               // 조깅 시간인데 걷기로 잡힘 → 걷기로 계산
    if (a.jog && r.warnings?.includes('walkLike')) walkLike = true;
    if (!r.error) segs.push({ jog: a.jog, cadence: r.cadence, steps: r.steps, activeS: r.activeS, regularity: r.regularity, sd: r.sd });
  }
  const jogs = segs.filter(x => x.jog), walks = segs.filter(x => !x.jog);
  if (!jogs.length) return showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">조깅 구간을 찾지 못했어요.${asWalk ? ' 조깅 시간에 잡힌 움직임이 걷기와 비슷했어요(흔들림이 작음).' : ''} 첫 1분은 조깅, 다음 1분은 걷기로 번갈아 해 주세요. 조깅 구간이 20초 이상 있어야 분석해요.</div>`);
  const avg = (xs, k) => xs.reduce((s, x) => s + x[k], 0) / xs.length, sum = (xs, k) => xs.reduce((s, x) => s + x[k], 0);
  const hist = store.get('history', []);
  const rec = { date: new Date().toISOString(), start: Date.now() - (data[data.length - 1].t - t0s), activity: 'slowrun', position, auto, practice: false,
    cadence: avg(jogs, 'cadence'), walkCadence: walks.length ? avg(walks, 'cadence') : null,
    steps: sum(segs, 'steps'), activeS: sum(jogs, 'activeS'), walkS: sum(walks, 'activeS'),
    regularity: avg(jogs, 'regularity'), sd: avg(jogs, 'sd'), jogCount: jogs.length,   // sd = 조깅 구간 흔들림 평균 (RUN_SD 보정용, 데이터분석팀)
    warnings: [`jog${jogs.length}`, ...(asWalk ? [`jogAsWalk${asWalk}`] : []), ...(walkLike ? ['walkLike'] : [])],   // 조깅으로 계산한 구간 수 · 조깅 시간인데 걷기로 계산한 구간 수 · 달리기치고 낮은 케이던스
    diag: { src: Native ? 'app' : 'web', durS: (data[data.length - 1].t - t0s) / 1000, hz: data.length / Math.max(1, (data[data.length - 1].t - t0s) / 1000), gapS: 0, gpsGood: 0 } };
  saveRec(rec, hist, demo, data);
  shownDate = rec.date;
  renderSlow(rec, hist);
  renderHistory();
}

// ── 12분 달리기 테스트: 처음 12분의 GPS 거리·페이스 기록 (체력 추정은 의료기기 위험이 있어 하지 않음) ──
function finishCooper(data, gps, demo, position) {
  shownDate = null; route = null;
  const t0s = data[0].t, end = t0s + COOPER_S * 1000;
  const run = data.filter(p => p.t <= end);                                // 앱은 화면이 꺼져 있어 12분 뒤에 끝을 눌러도 앞 12분만 씀
  const durS = (run[run.length - 1].t - t0s) / 1000;
  const g = gpsDenied && !demo ? null : gpsDistance(gps.filter(p => p.t >= t0s && p.t <= end));
  if (!g) return showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">GPS로 거리를 재지 못했어요. 위치 권한을 허용하고, 하늘이 트인 운동장이나 트랙에서 해 주세요.</div>`);
  if (g.dist < 100) return showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">GPS 거리가 ${Math.round(g.dist)}m로 너무 짧게 잡혔어요. 하늘이 트인 곳에서 GPS가 잡힌 뒤 달려 주세요.</div>`);
  const res = analyzeWalk(run, { position, activity: 'run' }), full = durS >= COOPER_S - 15;   // 15초쯤 일찍 끝난 건 12분으로 봄
  const rec = { date: new Date().toISOString(), start: Date.now() - (data[data.length - 1].t - t0s), activity: 'cooper', position, practice: false, distance: g.dist, durS, medAcc: g.medAcc, route: packRoute(gps.filter(p => p.t >= t0s && p.t <= end)),
    speed: g.dist / durS, full,
    cadence: res.error ? null : res.cadence, steps: res.error ? null : res.steps, activeS: res.error ? durS : res.activeS, warnings: [] };
  saveRec(rec, store.get('history', []), demo, data);
  shownDate = rec.date;
  route = rec.route;
  renderCooper(rec);
  renderHistory();
}
function renderCooper(r) {
  let head = `<h2>12분 달리기 테스트 결과</h2>`;
  if (r.full === false) head += `<div class="warn">12분을 다 채우지 않았어요(${(r.durS / 60).toFixed(1)}분). 거리는 그 시간 동안의 값이에요.</div>`;
  head += topCards(r, { label: '달린 거리', value: Math.round(r.distance).toLocaleString(), unit: 'm', grade: r.medAcc > 10 ? 'o' : 'y', sub: `GPS · 위치 오차 약 ${Math.round(r.medAcc)}m`,
    stats: [{ icon: 'time', value: clock(r.durS), label: '시간' }, { icon: 'dist', value: (r.distance / 1000).toFixed(2), label: '거리 km' }, { icon: 'pace', value: paceText(r.speed), label: '페이스 /km' }, { icon: 'steps', value: r.steps, label: '걸음' }] }, [
    { label: '케이던스', value: r.cadence ? r.cadence.toFixed(0) : '-', unit: '걸음/분', grade: 'y', sub: r.cadence ? '기준선 없음' : '걸음 신호 못 찾음' }]);
  let html = metric({ title: '달린 거리', value: Math.round(r.distance).toLocaleString(), unit: `m · 평균 페이스 ${paceText(r.speed)}/km`, grade: r.medAcc > 10 ? 'o' : 'y',
    body: `<div class="sub">${(r.durS / 60).toFixed(1)}분 · 위치 오차 약 ${Math.round(r.medAcc)}m · 10초씩 묶은 GPS 점을 이은 거리</div>`,
    why: ['휴대폰 GPS는 보통 수 m 오차가 있고, 굽은 길에서는 거리가 조금 짧게 나올 수 있어 "참고"예요. 거리가 표시된 트랙이면 바퀴 수로 확인해 보세요.'], refs: [] });
  if (r.cadence) html += metric({ title: '러닝 케이던스', value: r.cadence.toFixed(0), unit: '걸음/분', grade: 'y', why: ['주머니 스마트폰의 달리기 케이던스 검증 연구는 아직 못 찾아 "참고"'], refs: ['neumann16'] });
  html = head + more(html + READ_GUIDE);
  if (r.receipt) html += `<div class="sub" style="margin-top:12px">익명 결과를 보냈어요. 접수번호 <b>${r.receipt}</b></div>`;
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 힘껏 달리는 테스트라 심장·폐·관절 질환이 있거나 평소 운동을 안 했다면 먼저 전문가와 상의하세요. 가슴 통증·어지럼이 있으면 바로 멈추세요.</div>`;
  html += COOL_BTN;                                                         // 뛴 뒤 정리 운동 (디자인 팀 10/29)
  showHtml(html);
}

// ── 계단 오르기 (민원팀·아버님 10/28): 오르기만. 높이는 설치형 앱의 기압계로, 걸음·케이던스는 걷기 방식 그대로 (계단에서는 검증 안 됨), 기준값 없음 ──
// 익명 전송은 다른 측정과 같은 칸만 (활동 이름 stairs는 warnings에). 올라간 높이는 이 휴대폰에만 저장
function finishStairs(data, demo, position, press) {
  shownDate = null; route = null;
  const durS = (data[data.length - 1].t - data[0].t) / 1000;
  const res = analyzeWalk(data, { position, activity: 'walk' }), climb = stairClimb(press, data);
  if (res.error && !climb?.climbM) return showHtml(`<h2>다시 측정해 주세요</h2><div class="warn">걸음 신호를 찾지 못했어요. 휴대폰을 주머니에 넣고 계단을 6초 이상 올라 주세요. 그래서 이번 측정은 기록에 저장하지 않았어요.</div>`);
  const rec = { date: new Date().toISOString(), start: Date.now() - durS * 1000, activity: 'stairs', position, practice: false, durS,
    cadence: res.error ? null : res.cadence, steps: res.error ? null : res.steps, activeS: res.error ? durS : res.activeS, regularity: res.error ? null : res.regularity, sd: res.sd,
    climbM: climb?.climbM ?? null, floors: climb?.floors ?? null, warnings: climb ? [] : ['noBaro'],
    diag: { src: Native ? 'app' : 'web', n: data.length, durS, hz: data.length / Math.max(1, durS), gapS: 0, gpsGood: 0 } };
  saveRec(rec, store.get('history', []), demo, data);
  shownDate = rec.date;
  renderStairs(rec);
  renderHistory();
}
function renderStairs(r) {
  const baro = r.climbM != null, perFloor = baro && r.floors >= 1 ? r.durS / r.floors : null;
  let html = `<h2>계단 오르기 결과</h2>` + topCards(r, baro
    ? { label: '올라간 높이', value: r.climbM.toFixed(0), unit: 'm', grade: 'y', sub: `${r.floors ? `약 ${r.floors}층` : '1층 미만'} · 한 층을 ${FLOOR_M}m로 셈`,
        stats: [{ icon: 'time', value: clock(r.durS), label: '시간' }, { icon: 'steps', value: r.steps, label: '걸음' }, ...(perFloor ? [{ icon: 'pace', value: clock(perFloor), label: '1층당' }] : [])] }
    : { label: '걸음', value: r.steps ?? '-', unit: '걸음', grade: 'n', sub: r.diag?.src === 'app' ? '이 휴대폰엔 기압계가 없어 높이는 못 재요' : '웹은 높이를 못 재요 · 설치형 앱은 기압계로 재요',
        stats: [{ icon: 'time', value: clock(r.durS), label: '시간' }] },
    [{ label: '케이던스', value: r.cadence ? r.cadence.toFixed(0) : '-', unit: '걸음/분', grade: 'n', sub: '계단 기준값 없음' },
     ...(baro ? [{ label: '걸음 수', value: r.steps ?? '-', unit: '걸음', grade: 'n', sub: '계단에서 검증 안 됨' }] : [])]);   // 높이가 없으면 걸음이 큰 카드라 겹치지 않게
  let body = '';
  if (baro) body += metric({ title: '올라간 높이', value: r.climbM.toFixed(1), unit: `m · ${r.floors ? `약 ${r.floors}층` : '1층 미만'}`, grade: 'y',
    body: `<div class="sub">${clock(r.durS)} 동안${perFloor ? ` · 1층에 평균 ${clock(perFloor)}` : ''}</div>`,
    why: [`휴대폰 기압계로 잰 기압 변화를 높이로 바꿨어요(국제표준대기 공식). 2초 평균으로 흔들림을 줄이고, 걷는 중에 ${STAIR_STEP_M}m 넘게 오를 때만 더해요. 내려간 높이와 가만히 있을 때 바뀐 높이(엘리베이터·날씨)는 세지 않아요`,
      `층수는 올라간 높이를 한 층 ${FLOOR_M}m로 나눈 대략값이에요. 건물마다 층 높이가 달라요`,
      '기압은 날씨로도 조금씩 바뀌어서, 오래 잴수록 오차가 커질 수 있어요'],
    refs: [], limit: '같은 계단에서 잰 기록끼리 비교해 보세요.' });
  body += metric({ title: '걸음·케이던스', value: r.cadence ? r.cadence.toFixed(0) : '-', unit: '걸음/분', grade: 'n',
    why: ['걷기와 같은 방식(가속도의 반복)으로 셌어요. 계단 오르기에서 이 방식의 정확도를 확인한 연구는 아직 찾지 못했어요', '계단 케이던스의 기준값은 없어서 비교하지 않아요'], refs: [] });
  html += more(body);
  if (r.receipt) html += `<div class="sub" style="margin-top:12px">익명 결과를 보냈어요. 접수번호 <b>${r.receipt}</b></div>`;
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 가슴이 아프거나 숨이 많이 차거나 어지러우면 멈추고 쉬세요.</div>`;
  showHtml(html);
}

// ── 익명 결과 보내기 (선택 동의 2개를 모두 한 사람만) ──
// 구글 Apps Script 웹앱 주소. 비어 있으면 아무것도 보내지 않음 (설정법: apps_script.gs)
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwLfXvMoqIPDkmemDjQ5oJWhaDDKboetKlxkU603xABxQqTPjzvr1hN3Iyhb9km3OCb/exec';
// 기록을 먼저 휴대폰에 저장하고, 익명 전송은 그다음에. 전송에서 어떤 오류가 나도 기록은 남음
// 센서 원본: 최근 RAW_KEEP개 측정만 이 휴대폰(IndexedDB, localStorage보다 큼)에 보관 → 결과 화면에서 CSV로 내보내기. 서버로 보내지 않음
// 한 줄 = [시각 ms, x, y, z] (중력 포함 가속도 m/s²). 50Hz·10분 측정이 약 1MB라 10개면 약 10MB
const RAW_KEEP = 10;
const rawDb = () => new Promise((ok, bad) => { const r = indexedDB.open('gaitRaw', 1); r.onupgradeneeded = () => r.result.createObjectStore('raw'); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
async function rawPut(key, rows) {
  const db = await rawDb(), tx = db.transaction('raw', 'readwrite'), st = tx.objectStore('raw');
  st.put(rows, key);
  const q = st.getAllKeys();                                                // 키 = 기록 날짜(ISO)라 정렬하면 오래된 순
  q.onsuccess = () => q.result.sort().slice(0, -RAW_KEEP).forEach(k => st.delete(k));
  return new Promise((ok, bad) => { tx.oncomplete = ok; tx.onerror = () => bad(tx.error); });
}
async function rawGet(key) {
  const db = await rawDb();
  return new Promise(ok => { const q = db.transaction('raw').objectStore('raw').get(key); q.onsuccess = () => ok(q.result ?? null); q.onerror = () => ok(null); });
}
function saveRec(rec, hist, demo, raw) {
  if (pendingEnd) { rec.warnings = [...(rec.warnings ?? []), pendingEnd]; pendingEnd = null; }   // 결과·기록·익명 전송에 '자동으로 끝냄'
  if (raw && !demo && !raw[0]?.mag) rawPut(rec.date, raw.map(p => [Math.round(p.t * 10) / 10, +p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)])).catch(() => {});
  hist.unshift(rec);
  hist.forEach((h, i) => { if (i >= ROUTE_KEEP) delete h.route; });     // ponytail: 휴대폰 저장 공간(약 5MB) 때문에 최근 30개만. 더 필요하면 IndexedDB로
  store.set('history', hist.slice(0, 200));
  if (demo || !consent?.share || !ENDPOINT) return;
  try { rec.receipt = send(rec); store.set('history', hist.slice(0, 200)); } catch {}
}
const osName = () => /iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : '기타';
function send(r) {
  const { sex, age } = store.get('profile', {});
  if (under14(age) || under14($('age').value)) return null;                  // 화면 칸도 함께 확인 (안내와 동작이 어긋나지 않게)
  const receipt = (crypto.randomUUID?.() ?? Math.random().toString(16).slice(2) + Date.now().toString(16)).slice(0, 8);   // 오래된 폰은 randomUUID가 없음                       // 삭제 요청용 접수번호, 개인과 연결 안 됨
  const num = (x, d) => x == null ? '' : +x.toFixed(d);                  // 12분 테스트는 케이던스·규칙성·측정 정보가 없을 수 있음
  const body = {
    receipt, date: new Date(r.date).toLocaleDateString('sv-SE'), appVersion: APP_VERSION,           // 시각은 빼고 날짜만 (식별 가능성 낮춤)
    cadence: num(r.cadence, 1), steps: r.steps ?? '', activeS: num(r.activeS, 1), regularity: num(r.regularity, 2),
    speed: r.speed ? +r.speed.toFixed(2) : '', stepLength: r.stepLength ? +r.stepLength.toFixed(2) : '', distance: r.distance ? +r.distance.toFixed(1) : '',
    // ponytail: 시트 칸을 늘리려면 Apps Script 재배포가 필요해서 거리 출처(gps)는 warnings 칸에 붙여 보냄
    position: r.position, practice: r.practice, warnings: [r.activity !== 'walk' && r.activity, ...r.warnings, r.distSource === 'gps' && 'gps', r.sd != null && `sd${r.sd.toFixed(1)}`,   // 흔들림 세기(m/s²): 걷기·달리기 구분 기준 RUN_SD를 실제 기록으로 보정하려고
      r.diag && `d:${r.diag.src}/${r.diag.durS.toFixed(0)}s/${r.diag.hz.toFixed(0)}hz/gap${r.diag.gapS.toFixed(1)}/gps${r.diag.gpsGood}`].filter(Boolean).join(' '),
    ageGroup: +age ? Math.floor(+age / 10) * 10 : '', sex: sex || '',
    os: osName(),
  };
  // no-cors: Apps Script는 응답을 못 읽지만 저장은 됨. 실패하면 조용히 넘어감 (측정 기록은 휴대폰에 남아 있음)
  fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }).catch(() => {});
  return receipt;
}

// ── 건의함: 이용자가 '보내기'를 누를 때만 익명 의견을 보냄 (글 + 날짜·버전·OS·설치형/웹·접수번호 + 사진 3장까지, 이름·연락처·위치·측정 기록 없음). 처리방침 2-1번 ──
// 사진은 휴대폰 안에서 canvas에 다시 그려 JPEG로 만듦 → 촬영 위치(EXIF GPS)·기기 정보가 빠지고 긴 변 1280px로 줄어듦. 원본은 보내지 않음
async function shrinkPhoto(file, max = 1280) {
  const img = new Image(), url = URL.createObjectURL(file);
  try {                                                                    // 못 여는 사진(HEIC 등)이나 멈춘 해독은 10초 뒤 실패로
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; setTimeout(bad, 10000); img.src = url; });
  } finally { URL.revokeObjectURL(url); }
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
function openFeedback() {
  const photos = [];                                                       // 줄인 사진 data URL
  const showPhotos = () => {
    $('fbPics').innerHTML = photos.map((p, i) => `<span class="fbpic"><img src="${p}" alt="넣은 사진 ${i + 1}"><button class="chip" data-f="del" data-i="${i}" aria-label="사진 ${i + 1} 빼기">빼기</button></span>`).join('');
    $('fbAdd').hidden = photos.length >= 3;
    $('fbOkBox').hidden = !photos.length;                                  // 사진이 있을 때만 확인 체크 (동의가 아니라 확인, 법률 검토 12번)
  };
  const o = document.createElement('div');
  o.id = 'fbOv'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', '건의하기');
  o.innerHTML = `<div class="dsheet" style="padding-left:20px;padding-right:20px"><h3 style="margin:0 0 4px">건의하기</h3>
    <div class="sub">앱을 쓰면서 불편한 점이나 바라는 점을 적어 주세요.</div>
    <textarea id="fbText" maxlength="1000" rows="5" aria-label="건의 내용"></textarea>
    <div class="sub" style="font-size:.8125rem">앱 화면 캡처처럼 문제를 보여 주는 사진만 올려 주세요. 사람 얼굴, 이름, 진료기록, 다른 사람이 찍힌 사진은 올리지 마세요. 사진은 촬영 위치·기기 정보를 지우고 보내며 90일 뒤 지워요.</div>
    <div id="fbPics"></div>
    <button class="ghost" id="fbAdd" data-f="add">사진 넣기 (선택 · 3장까지)</button><input type="file" id="fbFile" accept="image/*" multiple hidden>
    <label class="chk" id="fbOkBox" hidden><input type="checkbox" id="fbOk"><span>얼굴이나 이름이 보이는 사진이 없어요</span></label>
    <div class="sub" style="font-size:.8125rem">이름, 전화번호, 이메일, 주소, 병원·질병 이름처럼 나를 알아볼 수 있는 정보는 쓰지 마세요. 보낸 글은 앱 개선에만 쓰고 1년 뒤 지워요(Google 서버, 미국 등에 보관). 보내지 않아도 앱은 똑같이 쓸 수 있어요.<br>답장이 필요하면 ldj000103@gmail.com으로 메일 주세요.</div>
    <div id="fbMsg" class="sub" role="status" style="margin-top:8px"></div>
    <button data-f="send">보내기</button><button class="ghost" data-f="close">닫기</button></div>`;
  document.body.append(o);
  for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = true;
  const close = () => { for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = false; o.remove(); $('fbBtn').focus(); };
  o.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    if (b.dataset.f === 'close') return close();
    if (b.dataset.f === 'add') return $('fbFile').click();
    if (b.dataset.f === 'del') { photos.splice(+b.dataset.i, 1); showPhotos(); return ($('fbPics').querySelector('[data-f=del]') ?? $('fbAdd')).focus(); }   // 다시 그려도 포커스 유지
    const text = $('fbText').value.trim(), msg = $('fbMsg');
    if (under14(store.get('profile', {}).age)) return (msg.textContent = '만 14세 미만은 건의함을 쓸 수 없어요.');   // 처리방침 8번
    if (!text) return (msg.textContent = '내용을 적어 주세요.');
    if (photos.length && !$('fbOk').checked) return (msg.textContent = '사진을 보내려면 "얼굴이나 이름이 보이는 사진이 없어요"를 확인해 체크해 주세요. 사진을 빼면 글만 보낼 수 있어요.');
    const receipt = 'K-' + [...crypto.getRandomValues(new Uint8Array(4))].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    const body = { kind: 'feedback', receipt, date: new Date().toLocaleDateString('sv-SE'), appVersion: APP_VERSION, os: osName(), src: Native ? 'app' : 'web', text,
      photos: photos.map(p => p.slice(p.indexOf(',') + 1)) };                // base64만
    b.disabled = true; msg.textContent = '보내는 중…';
    fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
      .then(() => { $('fbText').remove(); $('fbPics').remove(); $('fbAdd').remove(); $('fbOkBox').remove(); b.remove(); msg.innerHTML = `<b>보냈어요. 고마워요.</b><br>접수번호 ${receipt} · 지우고 싶으면 이 번호를 ldj000103@gmail.com으로 보내 주세요.`; },
        () => { b.disabled = false; msg.textContent = '보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'; });   // 글은 그대로 남겨 둠
  });
  $('fbFile').addEventListener('change', async () => {
    const msg = $('fbMsg');
    for (const f of [...$('fbFile').files].slice(0, 3 - photos.length)) {
      try { photos.push(await shrinkPhoto(f)); } catch { msg.textContent = '이 사진은 열지 못했어요. 다른 사진을 골라 주세요.'; }
    }
    $('fbFile').value = ''; showPhotos();
  });
  $('fbText').focus();
}
$('fbBtn').addEventListener('click', openFeedback);

// ── 처음 시작할 때 동의 ──
const APP_VERSION = 'v182';
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
  store.set('consent', consent); store.set('privSeen', PRIV_DATE);          // 지금 처리방침을 보고 동의함
  $('privNote')?.remove();
  document.body.classList.remove('needConsent');
  $('consentState').textContent = consent.share ? '익명 결과 보내기: 동의함' : '익명 결과 보내기: 동의 안 함';
});
$('cEdit').addEventListener('click', e => { e.preventDefault(); showConsent(); scrollTo(0, 0); });
if (!consent) showConsent();
else $('consentState').textContent = consent.share ? '익명 결과 보내기: 동의함' : '익명 결과 보내기: 동의 안 함';

// ── 결과 화면 ──
// 자동으로 고른 활동·휴대폰 위치 표시 (검증 안 된 규칙이라 등급을 함께)
const ro = w => { const c = (w.charCodeAt(w.length - 1) - 0xac00) % 28; return w + (c > 0 && c !== 8 ? '으로' : '로'); };   // 받침 있으면 '으로' (ㄹ 받침은 '로')
function autoNote(r) {
  const a = r.auto ?? {};
  if (!a.act && !a.pos) return '';
  return `<div class="metric"><div class="sub">${a.act ? `활동: <b>${ro(ACT[a.act])}</b> 자동 구분 <span class="badge b-y">참고</span><br>` : ''}${a.pos ? `휴대폰 위치: <b>${ro(POS[a.pos])}</b> 짐작 <span class="badge b-n">검증 안 됨</span><br>` : ''}다르면 다음엔 측정 탭에서 골라 주세요.</div>
    <details><summary>어떻게 골랐나요?</summary><ul>
    ${a.act ? `<li>달리기 방식으로 센 케이던스가 ${RUN_CAD}걸음/분 이상이고 흔들림도 크면 달리기, 아니면 걷기로 봐요. 이 선은 이 앱이 정한 것이고 연구로 확인하지 않았어요.</li><li>30초씩 나눠 보고 걷기와 달리기가 각각 1분 넘게 섞여 있으면 슬로우 러닝으로 봐요.</li>` : ''}
    ${a.pos ? '<li>화면이 하늘을 보고 있으면 손, 같은 다리가 돌아올 때만 신호가 크게 반복되면 바지 앞주머니(허벅지), 걸음마다 비슷하면 허리로 짐작해요(Perry 7장: 몸통 움직임은 걸음마다 반복). 정확도를 확인한 연구가 없어요.</li>' : ''}</ul></details></div>`;
}
const READ_GUIDE = `<details class="howto"><summary>이 숫자 읽는 법</summary><ul>
  <li>큰 숫자가 <b>이번에 잰 값</b>이고, 그 아래 작은 글씨가 책·연구에 나온 <b>기준값</b>이에요.</li>
  <li>기준값은 여러 사람의 평균이에요. 내 값이 기준값과 달라도 그것만으로 좋다·나쁘다를 뜻하지 않아요.</li>
  <li>오른쪽 색 표시는 이 값을 얼마나 믿을 수 있는지예요.<br><span class="badge b-g">정확</span> 기준 장비와 거의 같게 나온 연구가 있어요 · <span class="badge b-y">참고</span> 경향은 맞지만 오차가 있어요 · <span class="badge b-o">부정확할 수 있음</span> 이번 조건에선 오차가 클 수 있어요 · <span class="badge b-n">검증 안 됨</span> 확인한 연구가 없어요</li>
  <li><b>근거 보기</b>를 누르면 어느 책·논문의 숫자인지 나와요.</li>
  <li>한 번보다 여러 번 재서 <b>변화</b>를 보세요. 같은 길·같은 신발·같은 휴대폰 위치로 재야 비교가 돼요. 지난 기록은 홈 달력에 있어요.</li>
  <li>궁금한 점은 이 화면을 전문가에게 보여 주고 물어보세요.</li></ul></details>`;
// 근거 보기: 맨 위 [페리 기준 | 나 | 차이] 세 칸 → 각도면 뼈 그림(회색 = 페리 기준, 초록 = 나) → 쉬운 문장 → 한계 한 줄 → 출처
// 문장 앞 "Perry 4장:", "Russo 2026:" 같은 머리말과 "(Perry 20장)"은 빼고 출처 목록에만 둠 (사용자 메모: 근거 보기 가독성)
const plain = w => w.replace(/(^|\. )[A-Z][A-Za-z]*( et al\.?)?(, [A-Z][A-Za-z]* \d{4})* (\d{4}|[\d·]+장)(\([^)]*\))?[^:.]{0,15}: /g, '$1').replace(/ ?\((Perry|Neumann) [\d·]+장\)/g, '');
const signed = (d, dp = 0) => `${d > 0 ? '+' : ''}${d.toFixed(dp)}`;
const mmss = x => { const t = Math.round(x); return t >= 60 ? `${Math.floor(t / 60)}분 ${t % 60}초` : `${t}초`; };   // 초를 먼저 반올림 ("1분 60초" 방지)
// 결과 한눈에 보기 (홈 카드 모양, 디자인 팀 10/26): 맨 위 한 줄 → 대표 값 큰 카드 → 2칸 작은 카드. 긴 설명은 그 아래 '자세히 보기'에 접어 둠
const badge = g => { if (!g) return ''; const [cls, label] = GRADE[g]; return `<span class="badge ${cls}">${label}</span>`; };
// 대표 카드 아래 아이콘 숫자 줄 (디자인 팀 10/27): 탭 막대와 같은 선 아이콘, 값이 없는 칸은 빼고 남은 칸을 같은 폭으로
const STAT_ICON = { time: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>', dist: '<path d="M6 20c-2 0-3-1.5-3-3s1-3 3-3h12c1.7 0 3-1.3 3-3s-1.3-3-3-3H9"/><circle cx="6" cy="5" r="2"/><circle cx="18" cy="20" r="1.5"/>',
  steps: '<path d="M7 3c2 0 3 2.5 3 5.5S9 13 7 13s-3-1.5-3-4.5S5 3 7 3zM5 16h4v1.5a2 2 0 0 1-4 0zM17 7c2 0 3 2.5 3 5.5S19 17 17 17s-3-1.5-3-4.5S15 7 17 7zM15 20h4v.5a2 2 0 0 1-4 0z"/>',
  pace: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>', jog: '<path d="M4 12h3l2-5 4 10 2-5h5"/>' };
const clock = s => { const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
// 전체 시간(측정)과 걸은 시간(꾸준히 걸은 구간)을 나란히 (민원팀 10/28: 오래 멈춘 측정도 걸은 시간이 보이게). 둘이 거의 같으면 하나만
const timeStats = r => { const all = r.diag?.durS ?? r.activeS; return all - r.activeS >= 30 ? [{ icon: 'time', value: clock(all), label: '전체 시간' }, { icon: 'time', value: clock(r.activeS), label: '걸은 시간' }] : [{ icon: 'time', value: clock(all), label: '시간' }]; };
const statRow = stats => { const ok = stats.filter(s => s.value != null && s.value !== ''); return ok.length ? `<div class="rstats" style="grid-template-columns:repeat(${ok.length},1fr)">${ok.map(s =>
  `<div><svg viewBox="0 0 24 24" aria-hidden="true">${STAT_ICON[s.icon]}</svg><b>${s.value}</b><small>${s.label}</small></div>`).join('')}</div>` : ''; };
// 범위 막대 (본부 10/29): 회색 띠 = Perry 책의 평균값들 사이(정상 범위 아님 → 라벨 lab에 무엇인지 적음), 점 = 내 값. 판정 말 없음 (검수팀 10/29)
function rangeBar(v, lo, hi, min, max, dp, lab) {
  if (v == null || Number.isNaN(v)) return '';
  const p = x => (Math.min(Math.max((x - min) / (max - min), 0), 1) * 100).toFixed(1);
  return `<div class="rbar" aria-hidden="true"><b style="left:${p(lo)}%;width:${(p(hi) - p(lo)).toFixed(1)}%"></b><i style="left:${p(v)}%"></i></div><div class="rlab"><span>${lab} ${lo.toFixed(dp)}~${hi.toFixed(dp)}</span><span>나 ${v.toFixed(dp)}</span></div>`;
}
function topCards(r, hero, cells) {
  const dur = r.diag?.durS ?? r.durS;
  const top = [whenTxt(r.date), ACT[r.activity ?? 'walk'], dur && `측정 ${mmss(dur)}`].filter(Boolean).join(' · ');
  const color = ACT_C[r.activity ?? 'walk'] ?? 'var(--c-run)';
  return `<div class="sub">${top}</div>
    <div class="mcard static rhero"><div class="mtop"><span class="mlab"><i style="background:${color}"></i>${hero.label}</span>${badge(hero.grade)}</div>
    <div class="mnum">${hero.value}<small>${hero.unit}</small></div>${hero.bar ?? ''}<div class="msub">${hero.sub}</div>${statRow(hero.stats ?? [])}</div>
    <div class="rgrid">${cells.map(c => `<div class="mcard static"><div class="mtop"><span class="mlab">${c.label}</span>${c.value === '-' ? '' : badge(c.grade)}</div>
      <div class="rnum">${c.value}<small>${c.value === '-' ? '' : c.unit}</small></div>${c.bar ?? ''}<div class="msub">${c.sub}</div></div>`).join('')}</div>`;
}
const more = inner => `<details class="more"><summary>자세히 보기 <span class="sub">(근거·읽는 법)</span></summary>${inner}</details>`;
function cmpCells({ unit, dp = 0, rows }) {
  const v = x => x == null || Number.isNaN(x) ? '-' : x.toFixed(dp);
  return rows.map(({ label, ref, mine }) => `${label ? `<div class="sub" style="margin-top:6px">${label}</div>` : ''}<div class="cmp3">
    <div><small>페리 기준</small><b>${v(ref)}</b></div><div><small>나</small><b>${v(mine)}</b></div>
    <div><small>차이</small><b>${mine == null || Number.isNaN(mine) ? '-' : signed(+mine.toFixed(dp) - ref, dp)}</b></div></div>`).join('')
    + `<div class="sub" style="font-size:.75rem">단위: ${unit}</div>`;
}
// 관절 각도 그림: 관절 J에서 기준선(점선)과 움직이는 마디가 이루는 각을 호로. 방향 θ는 아래 = 0°, 걷는 방향(오른쪽) = +90°
function angleFig(kind, ref, mine) {
  const R = d => d * Math.PI / 180, P = (p, th, L) => [p[0] + L * Math.sin(R(th)), p[1] + L * Math.cos(R(th))], f = p => p.map(n => n.toFixed(1)).join(',');
  const arc = (J, a, b, r) => { const s = P(J, a, r), e = P(J, b, r); return `M${f(s)} A${r},${r} 0 0 ${b > a ? 0 : 1} ${f(e)}`; };
  const G = { knee: { J: [150, 70], base: 0, dir: -1, fixed: [[150, 10]] },          // 넓적다리(위) 고정, 정강이가 뒤로 굽힘
    thigh: { J: [150, 50], base: 0, dir: 1, fixed: [[150, 5]] },                   // 몸통(위) 고정, 넓적다리가 앞으로
    ankle: { J: [130, 90], base: 90, dir: 1, fixed: [[130, 20]] } }[kind];           // 정강이(위) 고정, 발이 발등 쪽으로
  const L = kind === 'ankle' ? 60 : 80, seg = (a, color, r, txt) => {
    if (a == null || Number.isNaN(a)) return '';
    const th = G.base + G.dir * a, end = P(G.J, th, L), lab = P(G.J, G.base + G.dir * a / 2, r + 12);
    return `<line x1="${G.J[0]}" y1="${G.J[1]}" x2="${end[0].toFixed(1)}" y2="${end[1].toFixed(1)}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
      <path d="${arc(G.J, G.base, th, r)}" fill="none" stroke="${color}" stroke-width="2"/>
      <text x="${lab[0].toFixed(1)}" y="${lab[1].toFixed(1)}" font-size="11" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="middle">${txt}</text>`;
  };
  const dash = P(G.J, G.base, L);
  return `<svg class="chart" viewBox="0 0 300 ${kind === 'ankle' ? 130 : 160}" role="img" aria-label="각도 그림: 페리 기준 ${ref}°, 나 ${mine == null ? '-' : Math.round(mine)}°">
    ${G.fixed.map(q => `<line x1="${G.J[0]}" y1="${G.J[1]}" x2="${q[0]}" y2="${q[1]}" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".2"/>`).join('')}
    <line x1="${G.J[0]}" y1="${G.J[1]}" x2="${dash[0].toFixed(1)}" y2="${dash[1].toFixed(1)}" stroke="currentColor" stroke-dasharray="4 4" opacity=".4"/>
    ${seg(ref, '#9aa5a1', 26, `${ref}°`)}${seg(mine, 'var(--accent)', 46, mine == null ? '' : `${Math.round(mine)}°`)}
    <circle cx="${G.J[0]}" cy="${G.J[1]}" r="5" fill="currentColor"/></svg>`;
}
// 골반 내려감 그림: 앞에서 본 골반 선. 수평 점선 + 페리 기준 4°(회색) + 나(초록)
function pelvisFig(rows) {                                                 // 앞모습 기준: 왼발로 디디면 화면 왼쪽(사람의 오른쪽) 골반이 내려감
  const one = ({ label, ref, mine }, x, sg) => {
    const line = (a, color, ty) => { const r = sg * a * Math.PI / 180, dx = 50 * Math.cos(r), dy = 50 * Math.sin(r);
      return `<line x1="${(x - dx).toFixed(1)}" y1="${(55 + dy).toFixed(1)}" x2="${(x + dx).toFixed(1)}" y2="${(55 - dy).toFixed(1)}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
        <text x="${x - sg * 62}" y="${ty}" font-size="11" font-weight="700" fill="${color}" text-anchor="middle">${Math.round(a)}°</text>`; };
    return `<line x1="${x - 60}" y1="55" x2="${x + 60}" y2="55" stroke="currentColor" stroke-dasharray="4 4" opacity=".4"/>${line(ref, '#9aa5a1', 40)}${mine == null || Number.isNaN(mine) ? '' : line(mine, 'var(--accent)', 88)}
      <text x="${x}" y="108" font-size="11" text-anchor="middle" fill="currentColor" opacity=".8">${label}</text>`;
  };
  return `<svg class="chart" viewBox="0 0 300 115" role="img" aria-label="골반 내려감 그림">${rows.map((row, i) => one(row, 80 + i * 140, i ? -1 : 1)).join('')}</svg>`;
}
function metric({ title, value, unit, grade, body = '', why = [], refs = [], cmp, limit }) {
  const [cls, label] = GRADE[grade];
  const fig = !cmp?.fig ? '' : cmp.fig === 'pelvis' ? pelvisFig(cmp.rows) : angleFig(cmp.fig, cmp.rows[0].ref, cmp.rows[0].mine);
  return `<div class="metric"><div class="mhead"><div><b>${title}</b></div><span class="badge ${cls}">${label}</span></div>
    <div class="mval">${value}<span class="sub"> ${unit}</span></div>${body}
    <details><summary>근거 보기</summary>${cmp ? cmpCells(cmp) + fig + (cmp.fig ? '<div class="sub" style="font-size:.75rem">회색 = 페리 기준 · 초록 = 나 · 점선 = 기준선 · 흐린 위 마디는 움직이지 않는 쪽</div>' : '') : ''}
    <ul>${why.map(w => `<li>${plain(w)}</li>`).join('')}</ul>
    ${limit ? `<div class="sub" style="font-size:.8125rem">${limit}</div>` : ''}
    <div>출처</div><ul>${refs.map(refLi).join('')}</ul></details></div>`;
}

function render(r, prev) {
  const { sex, age } = store.get('profile', {});
  const norm = sex === 'm' ? 111 : sex === 'f' ? 117 : 113;
  const c = r.cadence;
  const where = `이번 값 ${c.toFixed(0)} · 페리 평균과 차이 ${signed(+c.toFixed(0) - norm)}`;   // 막대와 같은 기준: Perry 평균값과 숫자 차이만 (예전 ±10% 안·밖 문장은 판정처럼 읽혀 뺌, 검수팀 10/29)
  const pos = Math.min(Math.max((c - 60) / 100, 0), 1) * 100;
  const cadGrade = r.warnings.includes('hand') || r.warnings.includes('irregular') ? 'o' : 'g';
  const older = +age >= 61;
  const intensity = older
    ? (c >= 120 ? '약 5 MET (활발)' : c >= 110 ? '약 4 MET' : c >= 100 ? '중강도 (3 MET)' : '저강도')
    : (c >= 130 ? '고강도 (6 MET)' : c >= 100 ? '중강도 (3 MET)' : '저강도');

  let html = `<h2>결과 ${r.practice ? '<span class="badge b-n">연습</span>' : ''}</h2>`;
  if (r.practice) html += `<div class="warn">오늘 첫 측정은 연습으로 저장했어요. 처음 걸을 때는 보통 7% 느리게 나와요(Perry 20장). 한 번 더 걸어 주세요.</div>`;
  html += autoNote(r) + warnHtml(r);
  const gps = r.distSource === 'gps';
  const short = !gps && r.distance < 20;                                   // 짧으면 출발·정지 구간 비중이 커져 느리게 나옴
  const dGrade = short || (gps && r.medAcc > 10) ? 'o' : 'y';
  const ideal = sex === 'f' ? 0.0064 : sex === 'm' ? 0.0072 : null;
  html += topCards(r, { label: '케이던스', value: c.toFixed(0), unit: '걸음/분', grade: cadGrade,
    bar: rangeBar(c, 111, 117, 60, 160, 0, 'Perry 평균 남~여'),            // 20장 남 111·여 117 (책에 케이던스 표준편차는 없음, 본부 10/29)
    sub: `페리의 보행 분석 기준 ${norm} · 차이 ${signed(+c.toFixed(0) - norm)}${prev ? ` · 지난번보다 ${signed(c - prev.cadence)}` : ''}`,
    stats: [...timeStats(r), { icon: 'dist', value: r.distance && (r.distance / 1000).toFixed(2), label: '거리 km' },
      { icon: 'steps', value: r.steps, label: '걸음' }] }, [   // 걸음 길이·속도는 기준값이 있는 작은 카드에만 (같은 값이 두 번 안 보이게)
    { label: '걷기 속도', value: r.speed ? r.speed.toFixed(2) : '-', unit: 'm/s', grade: dGrade, sub: r.speed ? `페리 1.37 · 차이 ${signed(+r.speed.toFixed(2) - 1.37, 2)}` : 'GPS·거리 입력 필요',
      bar: r.speed ? rangeBar(r.speed, 1.22, 1.52, 0.6, 2.0, 2, 'Perry 연구별 평균') : '' },   // Perry 20장: 연구별 평균 73~91m/분
    { label: '걸음 길이', value: r.stepLength ? (r.stepLength * 100).toFixed(0) : '-', unit: 'cm', grade: dGrade, bar: r.stepLength ? rangeBar(r.stepLength * 100, 64, 73, 30, 100, 0, 'Perry 평균 여~남') : '', sub: !r.stepLength ? 'GPS·거리 입력 필요' : ideal ? `효율 기준 약 ${(ideal * c * 100).toFixed(0)}cm` : '성별을 넣으면 기준이 보여요' },   // 걸음 길이 Perry 범위: 20장 한 주기 남 1.46·여 1.28m의 절반
  ]);   // 걸음 수·거리는 위 아이콘 줄에 있어서 작은 카드에서 뺌 (등급·근거는 자세히 보기에)
  const head = html; html = '';

  html += metric({
    title: '케이던스 (분당 걸음 수)', value: c.toFixed(0), unit: '걸음/분', grade: cadGrade,
    body: `<div class="bar"><i style="left:calc(${pos}% - 2px)"></i></div>
      <div class="sub">${where} · 페리의 보행 분석 성인 평균 ${norm}걸음/분(남 111·여 117) · 야외 평소 걸음 평균 116.7(Murtagh 2021)
      ${prev ? `<br>지난번 ${prev.cadence.toFixed(0)} → ${c >= prev.cadence ? '+' : ''}${(c - prev.cadence).toFixed(0)}` : ''}</div>`,
    why: [
      'Perry 20장 기준값: 성인 평균 113, 남성 111·여성 117걸음/분 (케이던스의 표준편차·범위는 책에 없음)',
      '야외에서 평소 속도로 걸을 때 평균 116.7걸음/분 (14,015명 메타분석)',
      '스마트폰 케이던스는 기준 장비와 거의 같음: 상관 0.997, 오차 범위 1.4% (허벅지에 고정한 연구)',
      cadGrade === 'o' ? '이번 측정은 손에 들었거나 신호가 불규칙해 등급을 낮췄어요.' : '권장 위치(허벅지 밀착)에서 측정한 값이에요.',
    ],
    refs: ['perry20', 'murtagh', 'shema'], cmp: { unit: '걸음/분', rows: [{ ref: norm, mine: c }] },
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
  if (r.minutes != null) html += metric({
    title: '빠르게 걸은 시간', value: r.minutes ? `${r.fastMin}분` : '-', unit: r.minutes ? `/ 전체 ${r.minutes}분 · 분당 100걸음 이상인 분` : '1분 이상 재면 보여요', grade: 'y',
    why: ['측정을 1분씩 나눠, 그 1분 동안 걸은 걸음 수가 100걸음 이상인 분을 셌어요. 끝에 남은 1분 미만은 세지 않아요.',
      '21~60세와 61~85세 연구에서 분당 100걸음은 중간 강도(약 3 MET)에 해당했어요. 집단 평균 값이라 사람마다 강도는 달라요.',
      '케이던스는 정확하지만 강도와 맞는지는 집단 평균이라 "참고"예요.'],
    refs: ['mcavoy2021', 'cadenceAdults'] });
  if (r.regularity != null) html += metric({
    title: '걸음 규칙성', value: r.regularity.toFixed(2), unit: '0~1 · 1에 가까울수록 같은 박자로 반복', grade: 'n',
    why: ['같은 다리가 다시 디딜 때까지의 흔들림 모양이 얼마나 비슷하게 되풀이되는지를 0~1로 나타낸 값(자기상관)이에요.',
      '원래 방법은 허리에 단 센서로 만든 것이라, 주머니에 넣은 휴대폰으로는 검증되지 않았어요.'],
    refs: ['moeNilssen2004'] });
  if (r.speed) {
    // 낙상 기준(JAMA 2024)과 사망 위험(JAMA 2011)은 65세 이상 연구라 그 나이에만 안내. 측정값과 상관없이 늘 같은 문구(값이 낮을 때만 뜨면 위험 판정처럼 읽힘, 법률검토팀 26번)
    const older65 = +age >= 65;
    const shortNote = short ? '<br>20m보다 짧게 걸으면 출발·멈춤 구간이 섞여 실제보다 느리게 나와요. 20m 이상을 권장해요.'
      : gps ? `<br>GPS로 잰 거리 약 ${r.distance.toFixed(0)}m · 위치 오차 약 ${Math.round(r.medAcc)}m${r.medAcc > 10 ? ' (오차가 커서 등급을 낮췄어요)' : ''}` : '';
    const how = gps ? `GPS: 출발·멈춤 2초를 뺀 꾸준히 걸은 ${Math.round(r.gpsDurS)}초 동안 이동한 거리 ÷ 시간. 위치 떨림을 줄이려 10초씩 평균 낸 위치를 이어요. 휴대폰 GPS 오차(보통 수 m) 때문에 "참고"`
      : '입력한 거리 ÷ 센서가 찾은 걷는 시간. 출발·정지 구간이 포함돼 실제보다 약간 느리게 나올 수 있어요 → "참고"';
    html += metric({
      title: '걷는 속도', value: r.speed.toFixed(2), unit: `m/s (${(r.speed * 60).toFixed(0)} m/분)`, grade: dGrade,
      body: `<div class="sub">페리의 보행 분석 성인 평균 1.37 m/s(82 m/분)${shortNote}${older65 ? `<br>참고: JAMA 2024 지침은 65세 이상에서 걷는 속도 0.8~1.0 m/s 미만을 낙상 위험을 평가하는 기준 중 하나로 써요. 이 앱은 낙상 위험을 판정하지 않아요.` : ''}</div>`,
      why: [how, '성인 평균 82 m/분 (Perry 20장)', '65세 이상 낙상 예방 지침(JAMA 2024)은 지난 1년 낙상, 낙상 걱정, 걷는 속도 0.8~1.0 m/s 미만 중 하나가 있으면 낙상 예방 중재를 고려하라고 해요 (나이를 65 이상으로 입력하면 이 안내가 보여요)', '65세 이상에서 걷는 속도 0.1 m/s 빠를 때마다 사망 위험 12% 낮음 (관찰 연구, 연관성)'],
      refs: ['perry20', 'jama2024', 'studenski'], cmp: { unit: 'm/s', dp: 2, rows: [{ ref: 1.37, mine: r.speed }] },
    });
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
  html = head + more(html + READ_GUIDE) + recSection(recsWalk(r, { sex, age }));
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
    <details><summary>출처 전체</summary><ul>${refs.map(refLi).join('')}</ul></details></div>`;
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
    limit: '관찰 연구라 인과관계는 아님. 하루 걸음 수는 설치형 앱 홈에서 볼 수 있음(헬스 커넥트)', refs: ['ding2025'] }));
  return cards;
}

function healthRunCard(speed) {
  return recCard({ title: '달리기와 건강 (얼마나 해야 하나)', calc: speed ? [`이번 속도 ${speed.toFixed(2)} m/s × 3.6 = <b>시속 ${(speed * 3.6).toFixed(1)}km</b> (Lee 2014 연구의 느린 달리기: 시속 9.7km 미만)`] : [],
    facts: ['Lee 2014(55,137명, 평균 15년): 하루 5~10분, 시속 9.7km 미만으로 달려도 달리지 않는 사람보다 전체 사망 30%, 심혈관 사망 45% 낮음',
      'Pedisic 2020 메타분석(232,149명): 달리기 참여 시 전체 사망 27% 낮음. 빈도·시간·속도·총량이 늘어도 추가 이득은 확인되지 않음 → 주 1회도 안 하는 것보다 나음'],
    limit: '관찰 연구라 인과관계는 아님', refs: ['lee2014', 'pedisic2019'] });
}

function recsRun(r, { age }) {
  const c = r.cadence, c5 = Math.round(c * 1.05), c10 = Math.round(c * 1.10), cards = [];
  cards.push(recCard({ title: '케이던스를 5~10% 올릴 때 연구 결과',
    calc: [`${c.toFixed(0)} × 1.05 = <b>${c5}걸음/분</b> (+5%)`, `${c.toFixed(0)} × 1.10 = <b>${c10}걸음/분</b> (+10%)`],
    facts: ['Heiderscheit 2011(취미 러너 45명, 같은 속도): +5%에서 무릎이 흡수하는 에너지 감소, +10%에서 엉덩관절 흡수와 엉덩관절 모음 각도·모멘트도 감소. 한걸음 길이·몸의 위아래 움직임·제동충격량·무릎 굽힘 정점 감소',
      'Neumann 16장(책 p.795): 케이던스 10% 증가 → 입각기 무릎넙다리관절 힘 정점 14% 감소',
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
  cards.push(healthRunCard(r.speed));
  return cards;
}

function weekSlowJogMin(hist) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // 이번 주 월요일
  return hist.filter(h => h.activity === 'slowrun' && new Date(h.date) >= d).reduce((s, h) => s + h.activeS / 60, 0);
}

function renderRun(r, prev) {
  const { age } = store.get('profile', {});
  const c = r.cadence;
  const easy = r.activity === 'easyrun';
  const cGrade = r.warnings.includes('hand') || r.warnings.includes('irregular') ? 'o' : 'y';
  const head = `<h2>${easy ? '천천히 달리기' : '러닝'} 결과</h2>` + autoNote(r) + warnHtml(r)
    + topCards(r, { label: '케이던스', value: c.toFixed(0), unit: '걸음/분', grade: cGrade, sub: prev ? `기준선 없음 · 지난 러닝보다 ${signed(c - prev.cadence)}` : '기준선 없음 · 내 기록의 변화만 봐요',
      stats: [...timeStats(r), { icon: 'dist', value: r.distance && (r.distance / 1000).toFixed(2), label: '거리 km' },
        { icon: 'pace', value: r.speed && paceText(r.speed), label: '페이스 /km' }, { icon: 'steps', value: r.steps, label: '걸음' }] }, [
      { label: '속도', value: r.speed ? r.speed.toFixed(2) : '-', unit: 'm/s', grade: r.medAcc > 10 ? 'o' : 'y', sub: r.speed ? `페이스 ${paceText(r.speed)}/km` : 'GPS 조건 안 됨' },
    ]);
  let html = metric({ title: '케이던스 (분당 걸음 수)', value: c.toFixed(0), unit: '걸음/분', grade: cGrade,
    body: `<div class="sub">${prev ? `지난 러닝 ${prev.cadence.toFixed(0)} → ${c >= prev.cadence ? '+' : ''}${(c - prev.cadence).toFixed(0)}` : '러닝 케이던스는 사람·속도마다 달라 기준값 하나로 비교하지 않아요.'}</div>`,
    why: ['걷기 케이던스는 스마트폰 정확도 연구가 있지만(상관 0.997), 주머니 스마트폰의 달리기 케이던스 검증 연구는 아직 찾지 못해 "참고" 등급이에요.',
      'Neumann 16장: 속력이 빨라지면 한걸음 길이와 빈도가 모두 늘고, 일반 장거리 속도(2~5 m/s)에선 주로 한걸음 길이가 늘어요.'],
    refs: ['neumann16', 'shema'] });
  html += metric({ title: '걸음 수', value: r.steps, unit: `걸음 (달린 시간 ${Math.round(r.activeS)}초)`, grade: 'y', why: ['달리기 걸음 수 정확도는 아직 확인 못 함 → "참고"'], refs: [] });
  if (r.speed) {
    html += metric({ title: '속도·페이스', value: r.speed.toFixed(2), unit: `m/s · 페이스 ${paceText(r.speed)}/km`, grade: r.medAcc > 10 ? 'o' : 'y',
      body: `<div class="sub">GPS 거리 약 ${r.distance.toFixed(0)}m · 위치 오차 약 ${Math.round(r.medAcc)}m</div>`,
      why: ['GPS로 꾸준히 달린 구간의 이동 거리 ÷ 시간. 휴대폰 GPS 오차(보통 수 m) 때문에 "참고"', 'Neumann 16장: 걷기는 보통 2.5 m/s 이하, 달리기는 2.5~10 m/s 이상'], refs: ['neumann16'] });
  } else if (r.gpsError && r.gpsError !== 'noWalk') html += `<div class="sub" style="margin-top:12px">속도는 GPS 조건(야외, 1분·50m 이상)이 안 돼 계산하지 않았어요.</div>`;
  html = head + more(html + READ_GUIDE) + recSection(easy ? [healthRunCard(r.speed)] : recsRun(r, { age }));   // 천천히 달리기는 Lee 2014·Pedisic 2020만
  html += r.diagHtml || '';
  if (r.receipt) html += `<div class="sub" style="margin-top:12px">익명 결과를 보냈어요. 접수번호 <b>${r.receipt}</b></div>`;
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 통증이 있으면 전문가와 상담하세요.</div>`;
  html += COOL_BTN;                                                         // 뛴 뒤 정리 운동 (디자인 팀 10/29)
  showHtml(html);
}

function renderSlow(r, hist) {
  const wk = weekSlowJogMin(hist);
  const head = `<h2>슬로우 러닝 결과</h2>` + autoNote(r)
    + topCards(r, { label: '조깅한 시간', value: (r.activeS / 60).toFixed(1), unit: '분', grade: 'y', sub: `이번 주 조깅 ${wk.toFixed(0)}분 · 연구의 주간량 90분`,
      stats: [{ icon: 'time', value: clock(r.diag?.durS ?? r.activeS + r.walkS), label: '전체 시간' }, { icon: 'jog', value: r.jogCount, label: '조깅 구간' }, { icon: 'steps', value: r.steps, label: '걸음' }] }, [
      { label: '조깅 케이던스', value: r.cadence.toFixed(0), unit: '걸음/분', grade: 'y', sub: `조깅 ${r.jogCount}구간 평균` },
      { label: '걷기 시간', value: (r.walkS / 60).toFixed(1), unit: '분', grade: 'y', sub: r.walkCadence ? `걷기 케이던스 ${r.walkCadence.toFixed(0)}` : '걷기 구간' },
    ]);
  let html = metric({ title: '조깅 구간 케이던스', value: r.cadence.toFixed(0), unit: `걸음/분 (조깅 ${r.jogCount}구간 평균)`, grade: 'y',
    body: r.walkCadence ? `<div class="sub">걷기 구간 케이던스 ${r.walkCadence.toFixed(0)}걸음/분</div>` : '',
    why: ['1분씩 잘라 조깅 구간은 러닝 방식, 걷기 구간은 걷기 방식으로 계산했어요. 구간마다 앞뒤 2초는 뺐어요.', '달리기 케이던스의 스마트폰 정확도 검증 연구는 아직 못 찾아 "참고"'], refs: ['neumann16'] });
  html += metric({ title: '조깅한 시간', value: (r.activeS / 60).toFixed(1), unit: `분 (걷기 ${(r.walkS / 60).toFixed(1)}분, 전체 ${r.steps}걸음)`, grade: 'y', why: ['센서가 움직임을 찾은 시간만 더했어요.'], refs: [] });
  html = head + more(html + READ_GUIDE) + recSection([
    recCard({ title: '슬로우 조깅 연구의 방법과 결과',
      calc: [`이번 주 조깅 ${wk.toFixed(0)}분 / 연구의 주간량 90분 → 남은 <b>${Math.max(0, 90 - wk).toFixed(0)}분</b>`],
      facts: ['Ikenaga 2017 무작위 연구(평균 70.8세, 81명): 걷기 속도의 조깅 1분 + 걷기 1분 반복, 주 90분 조깅 + 90분 걷기를 12주',
        '결과: 무산소역치(지구력) +15.7%(대조군 +4.9%), 앉았다 일어서기 +12.9%(대조군 +4.5%), 허벅지 근육 속 지방 감소'],
      limit: '노인 대상 12주 소규모 연구', refs: ['ikenaga2017'] }),
    healthRunCard()]);
  if (r.receipt) html += `<div class="sub" style="margin-top:12px">익명 결과를 보냈어요. 접수번호 <b>${r.receipt}</b></div>`;
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 가슴 통증·어지럼이 있으면 멈추고 전문가와 상담하세요.</div>`;
  html += COOL_BTN;                                                         // 뛴 뒤 정리 운동 (디자인 팀 10/29)
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
  const norm = sex === 'm' ? 111 : sex === 'f' ? 117 : 113;
  const f = (x, d = 0) => x == null || Number.isNaN(x) ? null : x.toFixed(d);
  const vs = (a, ref, w) => a == null || Number.isNaN(a) ? '' : hint(a - ref, w);
  const act = h.activity ?? 'walk', rows = [];
  const push = (k, v, u, n) => { if (v != null) rows.push(u === '°' ? { k, v: v + '°', u: '', n } : { k, v, u, n }); };   // 도(°)는 숫자에 붙임
  if (act === 'walk') {
    const c = h.cadence, older = +age >= 61;
    push('케이던스', f(c), '걸음/분', `페리의 보행 분석 성인 평균 ${norm}(남 111·여 117) · 차이 ${signed(+f(c) - norm)}`);
    const level = older ? (c >= 120 ? '약 5 MET' : c >= 110 ? '약 4 MET' : c >= 100 ? '중강도(3 MET)' : '저강도') : (c >= 130 ? '고강도(6 MET)' : c >= 100 ? '중강도(3 MET)' : '저강도');
    push('걷기 강도', level, '', older ? 'CADENCE-Adults 61세 이상 기준: 100 = 중강도' : 'CADENCE-Adults 기준: 100걸음/분 = 중강도, 130 = 고강도');
    if (h.speed) push('걷는 속도', f(h.speed, 2), 'm/s', `페리 기준 성인 평균 1.37 · 차이 ${h.speed - 1.37 >= 0 ? '+' : ''}${(h.speed - 1.37).toFixed(2)}`);
    if (h.stepLength && sex) { const ideal = (sex === 'f' ? 0.0064 : 0.0072) * c * 100; push('걸음 길이', f(h.stepLength * 100), 'cm', `Neumann 효율 최적 약 ${ideal.toFixed(0)}cm (${vs(h.stepLength * 100, ideal, ['더 길게 디뎌도 됨', '더 짧게 디뎌도 됨'])})`); }
    push('걸음 수', String(h.steps), '걸음', `걷는 시간 ${Math.round(h.activeS)}초`);
  } else if (act === 'run' || act === 'easyrun') {
    push('러닝 케이던스', f(h.cadence), '걸음/분', act === 'easyrun' ? '걷기 없이 쭉 천천히 달린 기록' : `+5% = ${Math.round(h.cadence * 1.05)}, +10% = ${Math.round(h.cadence * 1.1)} (Heiderscheit 2011·Neumann 16장 연구 범위)`);
    if (h.speed) { push('페이스', paceText(h.speed), '/km', `속도 ${f(h.speed, 2)} m/s · GPS로 잰 참고값`); }
    push('걸음 수', String(h.steps), '걸음', `달린 시간 ${Math.round(h.activeS)}초`);
  } else if (act === 'slowrun') {
    push('조깅 케이던스', f(h.cadence), '걸음/분', h.walkCadence ? `걷기 구간 ${f(h.walkCadence)}걸음/분` : '조깅 1분 + 걷기 1분');
    push('조깅한 시간', f(h.activeS / 60, 1), '분', `걷기 ${f(h.walkS / 60, 1)}분`);
    const wk = weekSlowJogMin(store.get('history', []));
    push('이번 주 조깅', f(wk), '분', `Ikenaga 2017 연구의 주간량 90분 중 ${Math.round(Math.min(1, wk / 90) * 100)}%`);
  } else if (act === 'cooper') {
    push('12분 달린 거리', Math.round(h.distance).toLocaleString(), 'm', `평균 페이스 ${paceText(h.speed)}/km · GPS로 잰 참고값`);
    if (h.cadence) push('러닝 케이던스', f(h.cadence), '걸음/분', '주머니 스마트폰으로 잰 참고값');
  } else if (act === 'stairs') {
    if (h.climbM != null) push('올라간 높이', f(h.climbM), 'm', `${h.floors ? `약 ${h.floors}층` : '1층 미만'} · 기압계로 잰 참고값`);
    push('시간', clock(h.durS), '', h.steps != null ? `${h.steps}걸음 · 계단 걸음 수는 검증 안 됨` : '');
  } else if (h.view === 'side') {
    const m = h.r.m;
    push('유각기 무릎 굽힘', f(m.kneeSwingMax), '°', `페리의 보행 분석 기준 약 60° · ${vs(m.kneeSwingMax, 60, BEND)} — 발끝이 바닥에 걸리지 않게 하는 굽힘`);
    push('체중 받기 무릎 굽힘', f(m.kneeLoad), '°', `페리 기준 15~18° · ${vs(m.kneeLoad, 16, BEND)} — 충격 흡수`);
    push('입각기 무릎 폄', f(m.kneeStanceMin), '°', `페리 기준 약 5° · ${extTxt(m.kneeStanceMin).replace(/^\(|\)$/g, '')}`);
    push('넓적다리 뒤로 젖힘', f(m.thighExt), '°', `페리의 보행 분석 기준 약 20° · ${vs(m.thighExt, 20, ['더 뒤로 젖혀야 함', '덜 젖혀도 됨'])} — 한걸음 길이`);
  } else {
    const m = h.r.m, d0 = x => f(x) ?? '-';
    const lrp = (a, b) => { if (a == null || b == null) return ''; const d = Math.abs(a - b); return `좌우 차이 ${d.toFixed(0)}° (${d <= 4 ? '비슷함' : d > 10 ? '많이 남' : '조금 남'})`; };
    push('골반 내려감 정도 (반대쪽)', `${d0(m.dropL)}° / ${d0(m.dropR)}°`, '왼발/오른발', `페리의 보행 분석 기준 약 4° · 왼발 ${vs(m.dropL, 4, ['덜 내려가는 편', '덜 내려가야 함'])}, 오른발 ${vs(m.dropR, 4, ['덜 내려가는 편', '덜 내려가야 함'])}`);
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
  return drawCard('스텝미러 결과', label, cardRows(h), knee && { h: 250, draw: (g, cx, cy, cw, chartH, F) => {   // 무릎 굽힘 곡선: 이번 영상 vs 페리의 보행 분석 기준점
    const ch = chartH - 70, X = q => cx + cw * q / 100, Y = d => cy + 40 + ch * (1 - d / 70);
    g.fillStyle = '#69736f'; g.font = F(500, 26); g.fillText('무릎 굽힘 곡선 (보행 주기 0~100%)', cx, cy + 22);
    g.strokeStyle = '#e6eae8'; g.lineWidth = 2; for (const d of [0, 30, 60]) { g.beginPath(); g.moveTo(cx, Y(d)); g.lineTo(cx + cw, Y(d)); g.stroke(); }
    g.setLineDash([12, 10]); g.strokeStyle = '#9aa5a1'; g.lineWidth = 4; g.beginPath();
    [[0, 5], [15, 18], [40, 5], [62, 40], [73, 60], [85, 30], [97, 2], [100, 5]].forEach(([q, d], k) => k ? g.lineTo(X(q), Y(d)) : g.moveTo(X(q), Y(d))); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#008a6e'; g.lineWidth = 6; g.beginPath(); knee.forEach((d, q) => q ? g.lineTo(X(q), Y(d)) : g.moveTo(X(q), Y(d))); g.stroke();
    g.font = F(400, 22); g.fillStyle = '#008a6e'; g.fillText('이번 영상', cx + cw - 300, cy + 22); g.fillStyle = '#9aa5a1'; g.fillText('- - 페리 기준', cx + cw - 185, cy + 22);
  } });
}
async function shareCanvas(canvas, text) { return shareFile(canvas.toDataURL('image/png'), 'gait-card.png', text); }
// 파일 공유: 설치형 앱은 캐시에 저장해서 안드로이드 공유 창, 웹은 공유 창 → 안 되면 내려받기
async function shareFile(dataUrl, name, text) {
  const P = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null;
  try {
    if (P?.Share && P?.Filesystem) {                                    // 설치형 앱: 파일로 저장해서 안드로이드 공유 창
      const { uri } = await P.Filesystem.writeFile({ path: `${Date.now()}-${name}`, data: dataUrl.split(',')[1], directory: 'CACHE' });
      await P.Share.share({ title: '스텝미러', text, files: [uri] });
      return;
    }
    const blob = await (await fetch(dataUrl)).blob(), file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '스텝미러', text }); return; }
  } catch (e) { if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return; }
  const a = document.createElement('a'); a.href = dataUrl; a.download = name; a.click();   // 공유가 안 되면 내려받기
}
async function shareRecord(date) {
  const h = store.get('history', []).find(x => x.date === date);
  if (h) shareCanvas(await makeCard(h), `스텝미러로 잰 내 걸음 · https://${APP_URL}/`);
}
document.addEventListener('click', e => { const b = e.target.closest?.('.sharebtn'); if (b) shareRecord(b.dataset.date); });
// 친구에게 설치 안내 링크 보내기 (카톡은 apk 파일을 막아서 링크로)
$('invite').addEventListener('click', async () => {
  const url = `https://${APP_URL}/install.html`, text = `스텝미러 앱: 걸음을 재고 결과마다 책·논문 근거를 보여 줘요. 설치 안내 👉 ${url}`;
  const P = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null;
  try {
    if (P?.Share) return await P.Share.share({ title: '스텝미러', text });     // 링크는 text 안에 있음 (url도 넘기면 카톡에 두 번 붙음)
    if (navigator.share) return await navigator.share({ title: '스텝미러', text });
  } catch (e) { if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return; }
  try { await navigator.clipboard.writeText(text); alert('설치 안내 링크를 복사했어요. 카톡에 붙여 넣어 보내세요.'); }
  catch { prompt('이 링크를 복사해 보내세요', url); }
});
const shareBtn = date => `<button class="ghost sharebtn" data-date="${date}" style="margin:4px 0 10px">결과 카드 공유하기</button><div class="sub" style="font-size:.75rem;margin:-4px 0 10px">카드에는 걸음·건강 숫자가 담겨요. 공유하면 받는 사람이 그 숫자를 보게 돼요.</div>`;   // 민감정보가 남에게 보일 수 있음을 공유 전에 알림 (개인정보 보호법 제23조 3항 취지)

// ── 지도에서 경로 보기 (카카오맵, 위치정보법 검토: 노션 법률 검토 7번) ──
// 누를 때만 지도를 불러옴. 경로 좌표는 이 휴대폰의 기록에만 저장(최근 30개)하고 운영자에게 보내지 않음 (send()에 넣지 않음)
// 키: 카카오 개발자 사이트에서 JavaScript 키 발급 + 웹 도메인(https://ldj000103-del.github.io) 등록. 비어 있으면 버튼을 숨김
const KAKAO_KEY = '2df85317dc9c2ac32b9f29bc1f8ba478';   // 공개용 키(등록한 도메인에서만 작동). 카카오 개발자 앱 '걸음 분석' ID 1621825
let route = null, kakaoLoad = null;
const ROUTE_KEEP = 30;
// GPS 점 → 5초에 한 점, 소수점 5자리(약 1m)로 줄인 [[위도, 경도], …] (오차 20m 넘는 점은 뺌)
function packRoute(gps) {
  const out = []; let last = -Infinity;
  for (const p of gps) if (p.acc <= 20 && p.t - last >= 5000) { out.push([+p.lat.toFixed(5), +p.lon.toFixed(5)]); last = p.t; }
  return out.length > 1 ? out : null;
}
function routeBox() {
  if (!KAKAO_KEY || !(route?.length > 1)) return '';
  return `<div class="metric" id="routeBox"><div class="mhead"><b>지도에서 경로 보기</b><span class="badge b-y">참고</span></div>
    <div class="sub">누르면 카카오 지도 서버에서 지도 그림을 받아 와요. 이때 보이는 지역의 대략 위치와 인터넷 주소(IP)가 카카오에 전달돼요. 경로는 이 휴대폰의 기록에만 저장되고(최근 30개 기록) 운영자에게 보내지 않아요. GPS 오차(보통 수 m) 때문에 선이 조금 삐뚤 수 있어요.</div>
    <button class="ghost" id="routeBtn">지도 불러오기</button> <button class="ghost" id="routeDel">이 경로 지우기</button><div id="routeMap" class="hidden" style="height:280px;border-radius:12px;margin-top:8px"></div></div>`;
}
function loadKakao() {
  return kakaoLoad ??= new Promise((ok, no) => {
    if (window.kakao?.maps) return kakao.maps.load(ok);
    const sc = document.createElement('script');
    sc.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
    sc.onload = () => kakao.maps.load(ok); sc.onerror = no;
    document.head.append(sc);
  });
}
document.addEventListener('click', e => {
  if (!e.target.closest?.('#routeDel') || !confirm('이 기록의 경로를 지울까요? 다른 결과는 그대로 남아요.')) return;
  const hist = store.get('history', []), h = hist.find(x => x.date === shownDate);
  if (h) { delete h.route; store.set('history', hist); }
  route = null; $('routeBox')?.remove();
});
// 경로 그리기 (디자인 팀 10/27): 흰 테두리 초록 선, 출발·도착(측정 중엔 '지금') 점과 말풍선, 1km(10km 넘으면 2km)마다 숫자, 경로 전체 보기 버튼
const ROUTE_C = '#008a6e';
const dotHtml = (fill, ring) => `<div style="width:16px;height:16px;border-radius:50%;background:${fill};border:3px solid ${ring};box-sizing:border-box"></div>`;
const tagHtml = t => `<div style="margin-left:14px;background:#121816;color:#fff;font:700 12px/18px sans-serif;padding:0 8px;border-radius:999px;white-space:nowrap">${t}</div>`;
const kmHtml = n => `<div style="width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid ${ROUTE_C};box-sizing:border-box;color:#005c49;font:700 12px/18px sans-serif;text-align:center">${n}</div>`;
async function drawRoute(box, pts, live = false) {
  try { await loadKakao(); } catch { kakaoLoad = null; return false; }
  const K = kakao.maps, path = pts.map(([lat, lon]) => new K.LatLng(lat, lon));
  box.innerHTML = ''; box.classList.remove('hidden'); box.style.position = 'relative';
  const map = new K.Map(box, { center: path[0], level: 4 }), b = new K.LatLngBounds();
  new K.Polyline({ map, path, strokeWeight: 9, strokeColor: '#ffffff', strokeOpacity: 1 });
  new K.Polyline({ map, path, strokeWeight: 5, strokeColor: ROUTE_C, strokeOpacity: 1 });
  const pin = (p, html, x = 0.5, z = 3) => new K.CustomOverlay({ map, position: p, content: html, xAnchor: x, yAnchor: 0.5, zIndex: z });
  for (const [lat, lon, km] of routeMarks(pts)) pin(new K.LatLng(lat, lon), kmHtml(km), 0.5, 2);
  const end = path[path.length - 1];
  pin(path[0], dotHtml('#fff', ROUTE_C)); pin(path[0], tagHtml('출발'), 0);
  pin(end, dotHtml(ROUTE_C, '#fff'), 0.5, 4); pin(end, tagHtml(live ? '지금' : '도착'), 0, 4);
  path.forEach(p => b.extend(p)); map.setBounds(b);
  const fit = document.createElement('button');                           // 오른쪽 아래: 카카오 로고(왼쪽 아래)를 가리지 않게
  fit.type = 'button'; fit.textContent = '경로 전체 보기';
  fit.style.cssText = 'position:absolute;right:8px;bottom:8px;z-index:3;width:auto;margin:0;padding:6px 12px;border-radius:999px;background:#fff;color:#121816;border:1px solid #d5dbd8;font-size:.75rem;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.15)';
  fit.addEventListener('click', () => map.setBounds(b));
  box.append(fit);
  return true;
}
document.addEventListener('click', async e => {
  const btn = e.target.closest?.('#routeBtn');
  if (!btn) return;
  btn.disabled = true; btn.textContent = '지도 불러오는 중…';
  if (await drawRoute($('routeMap'), route)) btn.remove();
  else { btn.disabled = false; btn.textContent = '지도를 못 불러왔어요 · 다시 누르기'; }
});
// 측정 중: 누를 때만 그 순간까지의 경로를 한 번 그림 (따라가며 계속 그리지 않음 → 배터리·카카오 전달은 누를 때만)
// 지도가 열려 있으면 이 버튼이 '지도 접기'. 측정 종료 버튼은 화면 아래에 고정이라 지도를 열어도 가려지지 않음
function closeRecMap() { $('recMap').classList.add('hidden'); $('recMap').innerHTML = ''; $('rec').classList.remove('mapOpen'); $('recMapBtn').textContent = '지금까지 경로 지도 보기 ›'; }
$('recMapBtn').addEventListener('click', async () => {
  const btn = $('recMapBtn');
  if (!$('recMap').classList.contains('hidden')) return closeRecMap();
  let g = gpsPts;
  if (Native) { try { ({ gps: g } = await Native.peek({ sec: 1 })); } catch { g = []; } }
  const pts = packRoute(g ?? []);
  if (!pts) return (btn.textContent = '아직 경로가 없어요 · 야외에서 조금 더 간 뒤 다시 눌러요');
  btn.textContent = '지도 불러오는 중…';
  $('rec').classList.add('mapOpen');
  if (await drawRoute($('recMap'), pts, true)) { btn.textContent = '지도 접기'; $('recMap').scrollIntoView({ block: 'center' }); }
  else { closeRecMap(); btn.textContent = '지도를 못 불러왔어요 · 다시 누르기'; }
});

$('result').addEventListener('click', async e => {
  const b = e.target.closest('[data-raw]'); if (!b) return;
  const rows = await rawGet(b.dataset.raw).catch(() => null);
  if (!rows?.length) return alert(`이 측정은 센서 원본이 없어요. 원본은 v82 이후 측정 중 최근 ${RAW_KEEP}개만 이 휴대폰에 보관해요.`);
  const csv = 't_ms,ax,ay,az\n' + rows.map(r => r.join(',')).join('\n') + '\n';
  const name = `gait-raw-${new Date(b.dataset.raw).toLocaleString('sv-SE').slice(0, 16).replace(/[- :]/g, '')}.csv`;   // 휴대폰 시간 기준 YYYYMMDDHHMM
  // ponytail: 문자열을 base64로 한 번에 만듦. 3시간(약 16MB) 측정은 저사양 폰에서 느릴 수 있음 → 필요하면 Blob + Filesystem utf8 쓰기로
  shareFile('data:text/csv;base64,' + btoa(csv), name, '스텝미러 센서 원본');   // CSV는 숫자·쉼표만이라 btoa 그대로 됨
});
function showHtml(html) {
  const el = $('result'); el.innerHTML = html;
  el.querySelector('details.more, details.howto')?.insertAdjacentHTML('beforebegin', routeBox());   // 지도는 접지 않고 카드 바로 아래
  if (shownDate) el.querySelector('h2')?.insertAdjacentHTML('afterend', shareBtn(shownDate));
  el.insertAdjacentHTML('beforeend', glossList(markTerms(el)));
  if (shownDate) el.insertAdjacentHTML('beforeend', `<button class="ghost" data-raw="${shownDate}">센서 원본 내보내기 (CSV)</button><div class="sub" style="font-size:.8125rem">이 파일에는 이번 측정의 센서 원본이 들어 있어요. 운영자에게 보내려면 먼저 실험 참여 동의서를 써 주세요.</div>`);   // 최근 ${RAW_KEEP}개 측정만
  if (shownDate) el.insertAdjacentHTML('beforeend', ctxBox(shownDate));   // 지표 먼저, 그때 상황 남기기는 맨 아래 (사용자 메모)
  el.classList.remove('hidden'); el.scrollIntoView({ behavior: 'smooth' });
  if (shownDate) heartBox(shownDate);
}
// 측정하는 동안의 워치 심박수 (헬스 커넥트, 설치형 앱): 찾으면 기록에 붙여 두고 결과 화면에 한 칸 추가
async function heartBox(date) {
  if (typeof HS === 'undefined' || !HS || !stepsState?.heart) return;
  const hist = store.get('history', []), h = hist.find(x => x.date === date);
  if (!h || !['walk', 'run', 'slowrun', 'easyrun', 'cooper'].includes(h.activity ?? 'walk')) return;
  const start = h.start ?? new Date(h.date).getTime() - (h.totalS ?? h.diag?.durS ?? h.durS ?? 0) * 1000;   // 예전 기록은 끝 시각에서 거꾸로
  const end = h.activity === 'cooper' ? start + h.durS * 1000 : new Date(h.date).getTime();
  if (!(end > start)) return;
  try {
    const r = h.hr ?? await HS.heartRate({ from: Math.round(start), to: Math.round(end) });   // 자바 getLong은 소수점 숫자를 못 읽어서 정수로
    if (!r?.avg || shownDate !== date) return;
    if (!h.hr) { h.hr = { avg: r.avg, max: r.max }; store.set('history', hist); }
    const html = metric({ title: '워치 심박수 (측정하는 동안)', value: r.avg, unit: `bpm 평균 · 최고 ${r.max ?? '-'}`, grade: 'y',
      why: ['삼성헬스(갤럭시 워치 등)가 헬스 커넥트에 저장한 심박수 중 이 측정 시간에 해당하는 값의 평균·최고예요. 심박 구간이나 강도로 판정하지 않아요.',
        '워치 기록은 몇 분 늦게 넘어올 수 있어 측정 직후엔 안 보일 수 있어요. 나중에 기록 탭에서 다시 열면 보여요.',
        '손목 심박수는 팔을 많이 흔들면 오차가 커질 수 있어 "참고"예요.'], refs: [] });
    const last = [...$('result').querySelectorAll('.metric')].pop();
    if (last) last.insertAdjacentHTML('afterend', html);
  } catch {}
}

// ── 전문 용어 풀이: 화면에 처음 나오는 용어에 점선 밑줄, 누르면 아래에 쉬운 뜻 ──
const GLOSS = {
  '걸음 규칙성': '같은 다리가 다시 디딜 때까지의 흔들림 모양이 얼마나 비슷하게 되풀이되는지를 0~1로 나타낸 값이에요. 1에 가까울수록 같은 박자로 반복돼요.',
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
  // 걸음걸이 탭 입체 비교 화면의 전통 단계 이름 ↔ 이 앱의 단계 이름 (Perry 2장 구간)
  '발뒤꿈치 닿기': '= 첫 닿기(Initial contact). 발뒤꿈치가 바닥에 처음 닿는 순간이에요(보행 주기 0~2%).',
  '발바닥 닿기': '= 체중 받기(Loading response). 발바닥 전체가 바닥에 닿으며 체중이 실리는 구간이에요(2~12%).',
  '중간 디딤기': '= 중간 입각(Mid stance). 한 발로 몸을 받치고 몸이 그 발 위를 지나가는 구간이에요(12~31%).',
  '발뒤꿈치 떼기': '= 말기 입각(Terminal stance). 발뒤꿈치가 들리고 몸이 발 앞으로 나가는 구간이에요(31~50%).',
  '발가락 떼기': '= 유각 전(Pre-swing). 발가락이 떨어지기 직전까지의 구간이에요(50~62%).',
  '초기 흔들기': '= 초기 유각(Initial swing). 발이 떨어져 다리가 앞으로 나가기 시작하는 구간이에요(62~75%).',
  '중간 흔들기': '= 중간 유각(Mid swing). 흔드는 다리가 몸 아래를 지나가는 구간이에요(75~87%).',
  '말기 흔들기': '= 말기 유각(Terminal swing). 다리가 앞으로 뻗으며 속도를 줄여 닿을 준비를 하는 구간이에요(87~100%).',
  '페리': 'Jacquelin Perry. 물리치료사들이 보행을 배울 때 쓰는 책 『Gait Analysis(보행 분석)』(1992)의 저자예요. 이 앱의 기준 각도·값은 주로 이 책에서 가져와요.',
  'Perry': '물리치료사들이 보행을 배울 때 쓰는 책 『Gait Analysis(보행 분석)』(1992)의 저자예요. 이 앱의 기준 각도·값은 주로 이 책에서 가져와요.',
  '입각기': '발이 땅에 닿아 몸을 받치는 구간이에요(보행 주기 약 0~60%). 새 용어로 "디딤기", 영어로 Stance phase라고도 해요.',
  '유각기': '발이 땅에서 떨어져 앞으로 나가는 구간이에요(보행 주기 약 60~100%). 새 용어로 "흔듦기", 영어로 Swing phase라고도 해요.',
  '넓적다리 각도': '허벅지가 수직선에서 앞(굽힘)이나 뒤(폄)로 기운 각도예요. Perry는 골반 움직임이 섞이지 않는 이 각도를 임상에서 더 쓸모 있다고 해요.',
  '발등굽힘': '발끝이 정강이 쪽으로 올라가는 발목 움직임이에요.',
  '발바닥굽힘': '발끝이 아래로 내려가는 발목 움직임이에요(까치발 방향).',
  '골반 내려감': '한 발로 디딜 때 반대쪽 골반이 아래로 처지는 정도예요.',
  '무릎 안쪽 모임': '앞이나 뒤에서 볼 때 무릎이 엉덩이-발목을 잇는 선보다 몸 안쪽으로 들어간 정도예요.',
  '자세 인식': '영상 속 사람의 어깨·엉덩이·무릎·발목 위치를 AI가 찾아내는 기술이에요. 이 앱은 Google MediaPipe를 써요. 학습 자료: <a href="https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf" target="_blank" rel="noopener">Google 모델 카드</a>',
  '정확도 등급': '이 앱이 보여 주는 값이 얼마나 믿을 만한지 연구를 바탕으로 4단계로 나눈 표시예요.',
};
const GLOSS_KEYS = Object.keys(GLOSS).sort((a, b) => b.length - a.length);   // 긴 용어부터 (무릎넙다리관절 > 무릎넙다리)
const SKIP_TAGS = new Set(['SELECT', 'OPTION', 'BUTTON', 'SCRIPT', 'STYLE', 'SUMMARY', 'INPUT', 'TEXTAREA']);
// root 안의 글자에서 각 용어의 첫 번째만 밑줄. 쓰인 용어 목록을 돌려줌
function markTerms(root) {
  const used = [];
  const done = new Set([...root.querySelectorAll('.term')].map(e => e.textContent));   // 홈처럼 여러 번 불려도 밑줄이 늘지 않게
  for (const term of GLOSS_KEYS) {
    if (done.has(term)) { used.push(term); continue; }
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
  if (homeReady) scheduleReminders();                                     // 알림 속 이번 주 숫자를 새 기록으로
  if (homeReady && document.body.dataset.tab === 'home') renderHome();   // 홈 코드가 다 읽힌 뒤에만
  if (!hist.length) return;
  // 줄 목록 (디자인 팀 10/28): "10월 27일 · 영상 뒷모습" + 오른쪽에 그 기록의 대표 숫자 하나, 빈칸('-') 없음
  $('histBody').innerHTML = `<div class="sub">줄을 누르면 그때 결과를 다시 볼 수 있어요.</div>` + hist.slice(0, 20).map((h, i) => {
    const d = new Date(h.date), when = Number.isNaN(+d) ? '날짜 모름' : `${d.getMonth() + 1}월 ${d.getDate()}일`;   // 날짜가 없거나 깨진 기록
    const what = h.view ? `영상 ${{ side: '옆모습', front: '앞모습', back: '뒷모습' }[h.view]}` : ACT[h.activity ?? 'walk'];
    return `<button class="dayrec" data-i="${i}"><span>${when} · ${what}${h.practice ? ' <span class="sub">(연습)</span>' : ''}${h.receipt ? `<br><span class="sub">접수 ${h.receipt}</span>` : ''}${h.ctx && ctxText(h.ctx) ? `<br><span class="sub">${ctxText(h.ctx)}</span>` : ''}</span><span class="sub" style="text-align:right;white-space:nowrap">${histNum(h)} ›</span></button>`;
  }).join('');
}
// 기록 줄의 대표 숫자: 걷기·러닝 = 케이던스, 옆 영상 = 유각기 무릎 최대 굽힘, 앞·뒤 영상 = 골반 내려감(큰 쪽), 12분 테스트 = 거리. 없으면 비움
function histNum(h) {
  const m = h.r?.m, r0 = v => Math.round(v);
  if (h.activity === 'cooper') return h.distance ? `${r0(h.distance).toLocaleString()}m` : '';
  if (h.activity === 'stairs') return h.climbM != null ? `${r0(h.climbM)}m 오름` : h.steps != null ? `${h.steps}걸음` : '';
  if (h.activity === 'video') return h.view === 'side' ? (m?.kneeSwingMax != null ? `무릎 ${r0(m.kneeSwingMax)}°` : '')
    : (m?.dropL != null || m?.dropR != null ? `골반 ${r0(Math.max(m.dropL ?? -Infinity, m.dropR ?? -Infinity))}°` : '');
  const c = h.cadence ?? h.r?.cadence; return c != null ? `${r0(c)}걸음/분` : '';
}
renderHistory();

// ── 아래 탭 ──
var homeReady = false;   // var: 위쪽 renderHistory가 먼저 불려도 오류 없이 false로 보임
function setTab(name) {
  syncPicks();                                                            // 측정 이어 하기 등 코드로 바꾼 select 값을 줄에 반영
  if (subOpen) closeSub();                                                // 탭바 '홈'을 눌러도 홈 첫 화면으로
  document.body.dataset.tab = name;
  for (const b of document.querySelectorAll('#tabbar button')) b.setAttribute('aria-selected', b.dataset.go === name);
  if (name === 'home') renderHome();
}
$('meBtn').addEventListener('click', () => { setTab('measure'); showProfSum(true); $('profile').scrollIntoView({ block: 'start' }); });   // 홈 '나' → 내 정보 펼침
document.querySelector('#tabbar').addEventListener('click', e => {
  const b = e.target.closest('button[data-go]'); if (!b) return;
  if (b.dataset.go === 'measure') $('result').classList.add('hidden');   // 측정 탭 = 측정 화면 (결과가 떠 있으면 시작 버튼이 결과 위 제자리로 가서 안 보임, 결과는 기록 탭에 있음)
  setTab(b.dataset.go); scrollTo(0, 0);
});

// ── 홈: 요약 카드 · 이번 주 슬로우 조깅 링 · 변화 그래프 ──
const shortDate = d => new Date(d).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
// 요약 카드: 색 점 + 이름 / 날짜 → 큰 숫자 + 최근 추세선 → 기준·출처 한 줄
// 최근 값 추세선 (축 없이 모양만, 마지막 점 강조). 세로 폭은 기준값 ±15%로 고정 — 105→103→108 같은 작은 차이가 큰 V자로 보이지 않게 (사용자·디자인 팀 10/28)
// base: 페리의 보행 분석 기준값, 없으면 최근 값 평균. 범위 밖 값은 위아래 끝에 붙임. 기준 자리에 옅은 점선
let sparkDrawn = false;                                                    // 선 그리기 움직임은 화면에 처음 보일 때 한 번만
function spark(vals, color, base) {
  if (vals.length < 2) return '';
  const c = base ?? vals.reduce((s, v) => s + v, 0) / vals.length, lo = c * 0.85, hi = c * 1.15;
  if (!(c > 0)) return '';                                                  // 기준·평균이 0 이하면 ±15% 폭이 없음
  const X = i => 4 + i * 64 / (vals.length - 1), Y = v => 28 - 24 * (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo);
  const pts = vals.map((v, i) => [X(i), Y(v)]), n = pts.length;
  // monotone 곡선(Fritsch–Carlson): 점과 점 사이에서 값을 넘어 출렁이지 않음
  const d = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (p[0] - pts[i][0]));
  const m = pts.map((_, i) => i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], t = a * a + b * b; if (t > 9) { const k = 3 / Math.sqrt(t); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; } }
  const path = pts.map((p, i) => i === 0 ? `M${f1(p[0])},${f1(p[1])}` : (([x0, y0], [x1, y1], h) => `C${f1(x0 + h)},${f1(y0 + m[i - 1] * h)} ${f1(x1 - h)},${f1(y1 - m[i] * h)} ${f1(x1)},${f1(y1)}`)(pts[i - 1], p, (p[0] - pts[i - 1][0]) / 3)).join('');
  const last = pts[n - 1], draw = !sparkDrawn && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  return `<svg class="spark${draw ? ' draw' : ''}" width="72" height="32" viewBox="0 0 72 32" aria-hidden="true">${base != null ? `<line x1="2" x2="70" y1="${f1(Y(base))}" y2="${f1(Y(base))}" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 2"/>` : ''}<path d="${path}" pathLength="1" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".55"/><circle cx="${f1(last[0])}" cy="${f1(last[1])}" r="3.5" fill="${color}" stroke="var(--card)" stroke-width="1.5"/></svg>`;
}
// 걸음 수 카드: 최근 7일 막대 (지난 날은 옅게, 오늘만 진하게)
function weekBars(vals, color) {
  const hi = Math.max(...vals, 1);
  return `<svg width="72" height="32" viewBox="0 0 72 32" aria-hidden="true">${vals.map((v, i) => { const h = Math.max(2, 28 * v / hi); return `<rect x="${3 + i * 10}" y="${30 - h}" width="5" height="${h}" rx="2" fill="${color}" opacity="${i === vals.length - 1 ? 1 : .25}"/>`; }).join('')}</svg>`;
}
function mcard({ label, color, date = '', value, unit, sub, i, vals = [], k, base }) {
  const top = `<div class="mtop"><span class="mlab">${label}</span><span class="mdate">${date}${i != null && value != null ? (k ? ' ⌄' : ' ›') : ''}</span></div>`;
  if (value == null) return `<div class="mcard empty">${top}<div class="mrow"><div class="mnum">기록 없음</div></div><div class="msub">${sub}</div></div>`;
  return `<button class="mcard" ${i != null ? `data-i="${i}"` : ''}${k ? ` data-k="${k}" aria-expanded="false"` : ''}>${top}<div class="mrow"><div class="mnum">${value}<small>${unit}</small></div>${spark(vals, color, base)}</div><div class="msub">${sub}</div></button>`;
}
const trendVals = key => store.get('history', []).filter(h => !h.practice).map(TREND[key].pick).filter(v => v != null && !Number.isNaN(v)).slice(0, 7).reverse();

// 주간 통계: 고른 주(월~일) vs 그 전 주, 점수 없이 숫자와 차이만
const dayKey = d => new Date(d).toLocaleDateString('sv-SE');                 // 2026-10-25 (휴대폰 시간 기준)
const monOf = d => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
const avgOf = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
const inRange = (hist, a, b) => hist.filter(h => { const t = new Date(h.date); return !h.practice && t >= a && t < b; });
function statOf(list) {
  const walk = list.filter(h => (h.activity ?? 'walk') === 'walk');
  return { n: list.length, days: new Set(list.map(h => dayKey(h.date))).size, walkCad: avgOf(walk.map(h => h.cadence)), speed: avgOf(walk.filter(h => h.speed).map(h => h.speed)),
    runCad: avgOf(list.filter(isRun).map(h => h.cadence)),
    jog: list.filter(h => h.activity === 'slowrun').reduce((s, h) => s + h.activeS / 60, 0), video: list.filter(h => h.activity === 'video').length };
}
function weekSummary(hist, mon = monOf(new Date())) {
  const next = new Date(mon); next.setDate(mon.getDate() + 7);
  const prevMon = new Date(mon); prevMon.setDate(mon.getDate() - 7);
  return { cur: statOf(inRange(hist, mon, next)), prev: statOf(inRange(hist, prevMon, mon)) };
}
// 기록 달력: 날짜마다 활동 종류별 점, 누르면 그날 기록 + 그 주 통계
const ACT_C = { walk: 'var(--c-walk)', stairs: 'var(--c-walk)', run: 'var(--c-run)', slowrun: 'var(--c-slow)', video: 'var(--c-video)' };
let calMonth = new Date(); calMonth.setDate(1); let calSel = dayKey(new Date());
function renderWeek() {
  const hist = store.get('history', []), byDay = {};
  hist.forEach((h, i) => (byDay[dayKey(h.date)] ??= []).push(i));
  const dot = a => a === 'cooper' || a === 'easyrun' ? 'run' : a === 'stairs' ? 'walk' : a;   // 12분 테스트·천천히 달리기는 러닝 색, 계단은 걷기 색 점
  const y = calMonth.getFullYear(), mo = calMonth.getMonth(), end = new Date(y, mo + 1, 1), today = dayKey(new Date());
  let cells = '';
  for (let d = monOf(new Date(y, mo, 1)); d < end || d.getDay() !== 1; d.setDate(d.getDate() + 1)) {   // 월요일부터, 마지막 주는 일요일까지 채움
    const k = dayKey(d), list = byDay[k] ?? [], acts = [...new Set(list.map(i => dot(hist[i].activity ?? 'walk')))];
    cells += `<button class="cday${d.getMonth() !== mo ? ' out' : ''}${k === today ? ' today' : ''}${k === calSel ? ' sel' : ''}" data-d="${k}"
      aria-label="${d.getMonth() + 1}월 ${d.getDate()}일 기록 ${list.length}개"><span>${d.getDate()}</span><i>${acts.map(a => `<b style="background:${ACT_C[a]}"></b>`).join('')}</i></button>`;
  }
  // 고른 날의 기록
  const sel = new Date(calSel + 'T00:00'), selList = byDay[calSel] ?? [];
  const val = h => h.activity === 'video' ? `${VIEW[h.view]}모습 영상` : h.activity === 'cooper' ? `${Math.round(h.distance)} m` : h.activity === 'stairs' ? histNum(h) : h.cadence != null ? `${h.cadence.toFixed(0)} 걸음/분` : '';
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
    <div class="calsec">${sel.getMonth() + 1}월 ${sel.getDate()}일 기록</div>${stepsByDay[calSel] != null ? `<div class="sub">이날 걸음 수 <b>${stepsByDay[calSel].toLocaleString()}</b>걸음 (헬스 커넥트)</div>` : ''}${sleepByDay[calSel] ? `<div class="sub">그날 아침까지 잔 시간 <b>${Math.floor(sleepByDay[calSel] / 60)}시간 ${sleepByDay[calSel] % 60}분</b> (워치·삼성헬스)</div>` : ''}${recs}
    <div class="calsec">${thisWeek ? '이번 주' : `${shortDate(mon)}~${shortDate(sun)} 주`} 통계</div>
    <table class="wk"><tr class="sub"><td></td><td class="num">${thisWeek ? '이번 주' : '그 주'}</td><td class="num">전 주 대비</td></tr>
    ${row('측정 횟수', cur.n, prev.n, '회')}${row('걷기 케이던스 평균', cur.walkCad, prev.walkCad, '걸음/분')}${row('걷는 속도 평균', cur.speed, prev.speed, 'm/s', 2)}
    ${row('러닝 케이던스 평균', cur.runCad, prev.runCad, '걸음/분')}${row('슬로우 조깅', cur.jog, prev.jog, '분')}${row('영상 분석', cur.video, prev.video, '회')}</table>
    <button class="textlike" data-sharepick>공유 카드 만들기 ›</button>
    <details class="sub weekInfo"><summary>월~일 기록 · 연습 측정 제외 <span aria-label="설명 보기">ⓘ</span></summary>월요일~일요일 기록이에요(연습 측정 제외). 점수로 바꾸지 않고 잰 숫자만 모았어요. 날짜를 누르면 그날 기록과 그 주 통계가 보여요.</details>`;   // 공유 경고는 공유 판 안 (openShare)
}
$('week').addEventListener('click', e => {
  const m = e.target.closest('button[data-m]'), d = e.target.closest('.cday'), r = e.target.closest('.dayrec'), c = e.target.closest('button[data-card]');
  if (e.target.closest('[data-sharepick]')) openShare();
  else if (c) shareSummary(c.dataset.card);
  else if (m) { calMonth.setMonth(calMonth.getMonth() + +m.dataset.m); renderWeek(); loadSteps(); }
  else if (d) { calSel = d.dataset.d; const t = new Date(calSel + 'T00:00'); if (t.getMonth() !== calMonth.getMonth()) calMonth = new Date(t.getFullYear(), t.getMonth(), 1); renderWeek(); }
  else if (r) showRecord(+r.dataset.i);
});
// 요약 카드: 주간·월간(달력 점 그림) / 최고 기록 — 잰 숫자와 출처만, 점수·판정 없음
const CARD_C = { walk: '#008a6e', run: '#2f6fd1', slowrun: '#c46f1c', video: '#8a5cd1' };   // 화면 달력과 같은 색 (밝은 배경 대비 검증 통과)
const md = d => { d = new Date(d); return Number.isNaN(+d) ? '날짜 모름' : `${d.getMonth() + 1}/${d.getDate()}`; };
const plusDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const paceText = sp => { const s = Math.round(1000 / sp); return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`; };   // 초를 먼저 반올림해야 5'60" 같은 값이 안 나옴
function sumRows(st, month) {
  const rows = [{ k: '측정', v: `${st.n}회`, u: '', n: `측정한 날 ${st.days}일 · 연습 측정 제외` }];
  if (st.walkCad != null) rows.push({ k: '걷기 케이던스 평균', v: st.walkCad.toFixed(0), u: '걸음/분', n: '페리의 보행 분석 성인 평균 113 (남 111 / 여 117)' });
  if (st.speed != null) rows.push({ k: '걷는 속도 평균', v: st.speed.toFixed(2), u: 'm/s', n: '페리의 보행 분석 성인 평균 1.37' });
  if (st.jog) rows.push({ k: month ? '슬로우 조깅 합계' : '슬로우 조깅', v: st.jog.toFixed(0), u: '분', n: 'Ikenaga 2017 연구의 주간 조깅량 90분' });
  if (st.runCad != null) rows.push({ k: '러닝 케이던스 평균', v: st.runCad.toFixed(0), u: '걸음/분', n: '사람·속도마다 달라 기준선 없이 기록만' });
  return rows;
}
function calChart(start, end, mo) {                                       // 카드 아래 달력: 날짜마다 활동 종류별 점 + 색 설명
  const acts = {};
  for (const h of store.get('history', [])) { const a = h.activity ?? 'walk'; (acts[dayKey(h.date)] ??= new Set()).add(a === 'cooper' || a === 'easyrun' ? 'run' : a); }
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
  if (sp) rows.push({ k: '가장 빠른 걷는 속도', v: sp.speed.toFixed(2), u: 'm/s', n: `${md(sp.date)} · 페리의 보행 분석 성인 평균 1.37` });
  const lg = top(walk, h => h.activeS);
  if (lg) rows.push({ k: '가장 오래 걸은 측정', v: (lg.activeS / 60).toFixed(1), u: '분', n: `${md(lg.date)} · 케이던스 ${lg.cadence.toFixed(0)}걸음/분` });
  const rn = top(hist.filter(h => isRun(h) && h.speed), h => h.speed);
  if (rn) rows.push({ k: '가장 빠른 러닝 페이스', v: paceText(rn.speed), u: '/km', n: `${md(rn.date)} · GPS로 잰 참고값` });
  const wk = {}; for (const h of hist.filter(h => h.activity === 'slowrun')) { const k = dayKey(monOf(h.date)); wk[k] = (wk[k] ?? 0) + h.activeS / 60; }
  const bw = Object.entries(wk).sort((a, b) => b[1] - a[1])[0];
  if (bw) rows.push({ k: '한 주 슬로우 조깅 최다', v: bw[1].toFixed(0), u: '분', n: `${md(bw[0] + 'T00:00')} 주 · Ikenaga 2017 연구의 주간량 90분` });
  if (hist.length) rows.push({ k: '지금까지 측정한 날', v: `${new Set(hist.map(h => dayKey(h.date))).size}일`, u: '', n: `측정 ${hist.length}회 · 연습 측정 제외` });
  return rows;
}
async function shareSummary(kind) {
  const hist = store.get('history', []);
  let title = '스텝미러 요약', label, rows, chart;
  if (kind === 'best') { title = '스텝미러 최고 기록'; label = '지금까지 내 기록'; rows = bestRows(); }
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
  shareCanvas(await drawCard(title, label, rows.slice(0, max), chart), `스텝미러로 잰 내 기록 · https://${APP_URL}/`);
}
// 홈 요약 카드: 누르면 그 자리에서 한 줄 전체로 펼침(한 번에 하나, 다시 누르면 접힘) · '전체 결과 보기'는 예전처럼 showRecord
let openTile = null;
function bigSpark(vals, color) {
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), X = i => 4 + i * 292 / (vals.length - 1), Y = v => hi === lo ? 20 : 36 - 32 * (v - lo) / (hi - lo);
  return `<svg class="mbig" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true"><polyline points="${vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function openCard(t) {
  const n = t.vals.length, d = n > 1 ? t.vals[n - 1] - t.vals[n - 2] : null;
  return `<div class="mcard open" data-k="${t.k}">
    <button class="mtop mtoggle" data-k="${t.k}" aria-expanded="true"><span class="mlab">${t.label}</span><span class="mdate">${t.date} ⌃</span></button>
    <div class="mnum">${t.value}<small>${t.unit}</small></div>
    <div class="sub">${t.ref}</div>
    ${bigSpark(t.vals, t.color)}<div class="sub">${n > 1 ? `최근 ${n}번 · 지난번보다 ${d >= 0 ? '+' : ''}${d.toFixed(t.dp ?? 0)}` : '기록이 2번 이상 쌓이면 추세선이 보여요'}</div>
    <p class="sub" style="margin:10px 0 0">${t.about}</p>
    <button class="ghost" data-full="${t.i}">전체 결과 보기 ›</button></div>`;
}
function renderTiles() {
  const hist = store.get('history', []);
  const idx = f => hist.findIndex(f);
  const isWalk = h => (h.activity ?? 'walk') === 'walk';
  // 대표 값은 추세선(trendVals)처럼 연습 측정을 뺀 최근 기록, 연습뿐이면 연습 기록 (그날 첫 걷기는 늘 연습)
  const pick = f => { const j = idx(h => !h.practice && f(h)); return j >= 0 ? j : idx(f); };
  const iw = pick(isWalk), w = hist[iw];
  const wPrev = iw >= 0 ? hist.slice(iw + 1).find(h => isWalk(h) && !h.practice) : null;
  const is = pick(h => isWalk(h) && h.speed), sp = hist[is];
  const ir = pick(isRun), rn = hist[ir];
  const iv = pick(h => h.activity === 'video' && h.view === 'side' && h.r?.m), vd = hist[iv];
  const delta = (a, b) => b ? ` · ${a - b >= 0 ? '+' : ''}${(a - b).toFixed(0)}` : '';
  const md2 = d => d ? md(d) : '';
  // 타일 부제는 좁은 폰(320px)에서 잘리지 않게 짧게 · 케이던스 기준은 결과 화면처럼 성별 반영 (Perry 20장)
  const norm = (({ sex }) => sex === 'm' ? 111 : sex === 'f' ? 117 : 113)(store.get('profile', {}));
  const tiles = [
    { k: 'walkCad', label: '걷기 케이던스', color: 'var(--c-walk)', base: norm, h: w, i: iw, value: w?.cadence.toFixed(0), unit: '걸음/분', vals: trendVals('walkCad'),
      sub: w ? `페리 ${norm}${delta(w.cadence, wPrev?.cadence)}` : '측정 탭에서 걸어요',
      ref: `페리의 보행 분석 성인 평균 ${norm}걸음/분 (남 111 · 여 117) · 출처: Perry 20장`,
      about: '1분 동안 걸은 걸음 수예요. 휴대폰 센서로 발이 땅에 닿는 횟수를 세요.' },
    { k: 'walkSpeed', label: '걷기 속도', color: 'var(--c-walk)', base: 1.37, h: sp, i: is, value: sp?.speed.toFixed(2), unit: 'm/s', vals: trendVals('walkSpeed'), dp: 2,
      sub: sp ? '페리 1.37' : 'GPS·거리 입력 필요',
      ref: '페리의 보행 분석 성인 평균 1.37 m/s · 출처: Perry 20장',
      about: '1초 동안 걸어간 거리예요. GPS로 잰 거리나 직접 넣은 거리를 걸은 시간으로 나눠요.' },
    { k: 'runCad', label: '러닝 케이던스', color: 'var(--c-run)', h: rn, i: ir, value: rn?.cadence.toFixed(0), unit: '걸음/분', vals: trendVals('runCad'),
      sub: rn ? '기준선 없음 · 변화만' : '측정 탭 → 러닝',
      ref: '기준선 없음 · 내 기록의 변화만 봐요',
      about: '달릴 때 1분 동안의 걸음 수예요. 이 앱은 러닝 케이던스에 기준선을 두지 않고 내 기록끼리 비교해요.' },
    { k: 'knee', label: '유각기 무릎', color: 'var(--c-video)', base: 60, h: vd, i: iv, value: vd ? vd.r.m.kneeSwingMax.toFixed(0) : null, unit: '°', vals: trendVals('knee'),
      sub: vd ? '페리 약 60°' : '걸음걸이 탭 → 옆모습',
      ref: '페리의 보행 분석 기준 약 60° · 출처: Perry 9장',
      about: '발이 땅에서 떨어져 앞으로 나갈 때(유각기) 무릎이 가장 많이 굽혀진 각도예요. 옆모습 영상으로 재고, 정확도는 참고 수준이에요.' },
  ];
  if (!tiles.some(t => t.k === openTile && t.value != null)) openTile = null;
  $('tiles').innerHTML = tiles.map(t => ({ ...t, date: md2(t.h?.date) + (t.h?.practice ? ' 연습' : '') }))
    .map((t, i) => (i === 0 ? '<div class="grp">걷기</div>' : i === 2 ? '<div class="grp">러닝 · 영상</div>' : '') + (t.k === openTile ? openCard(t) : mcard(t))).join('');
  if (tiles.some(t => t.vals.length > 1)) sparkDrawn = true;
}
$('tiles').addEventListener('click', e => {
  if (e.target.closest('.term')) return;                                     // 용어 밑줄은 풀이만 열고 카드는 그대로
  const full = e.target.closest('[data-full]');
  if (full) return showRecord(+full.dataset.full);
  const t = e.target.closest('[data-k]');
  if (!t) return;
  const k = t.dataset.k;
  openTile = openTile === k ? null : k;
  renderTiles();                                                             // 새로 그리면 포커스가 사라지니 같은 카드에 다시 둠 (키보드·화면낭독)
  const again = $('tiles').querySelector(openTile ? '.open .mtoggle' : `.mcard[data-k="${k}"]`);
  again?.focus({ preventScroll: true });
  if (openTile) again.closest('.open').scrollIntoView({ block: 'nearest' });
});
function renderHome() {
  const hist = store.get('history', []);
  renderHomeTop();
  renderTiles();
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

// 변화 그래프: 선 하나 + 기준선/기준 범위(출처), 점을 누르면 값과 날짜
const TREND = {
  walkCad: { label: '걷기 케이던스', unit: '걸음/분', pick: h => (h.activity ?? 'walk') === 'walk' ? h.cadence : null,
    ref: () => ({ band: [111, 117], text: '회색 띠 = 페리의 보행 분석 평균 남 111~여 117걸음/분 (20장, 정상 범위가 아니라 두 평균값 사이)' }) },
  walkSpeed: { label: '걷는 속도', unit: 'm/s', dec: 2, pick: h => (h.activity ?? 'walk') === 'walk' ? h.speed ?? null : null, ref: () => ({ line: 1.37, text: '점선 = 페리의 보행 분석 성인 평균 1.37 m/s' }) },
  runCad: { label: '러닝 케이던스', unit: '걸음/분', pick: h => isRun(h) ? h.cadence : null, ref: () => ({ text: '러닝 케이던스는 사람·속도마다 달라 기준선 없이 변화만 봐요' }) },
  knee: { label: '영상: 유각기 무릎 굽힘', unit: '°', pick: h => h.activity === 'video' && h.view === 'side' ? h.r?.m?.kneeSwingMax ?? null : null, ref: () => ({ line: 60, text: '점선 = 페리의 보행 분석 기준 초기 유각 약 60° · 영상 각도는 같은 조건으로 찍어야 비교돼요' }) },
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

$('histBody').addEventListener('click', e => { const tr = e.target.closest('[data-i]'); if (lpFired) { lpFired = false; return; } if (tr) showRecord(+tr.dataset.i); });   // 길게 누른 뒤 손을 떼며 생기는 클릭은 무시
function showRecord(i) {
  const hist = store.get('history', []), h = hist[i];
  if (!h) return;
  const when = whenTxt(h.date);
  const act = h.activity ?? 'walk';
  const banner = `<div class="sub" style="margin-bottom:6px">지난 기록 다시 보기${act === 'video' ? ` · ${when}` : ''}</div>`;
  shownDate = h.date; route = h.route ?? null;
  // 지난 영상 기록엔 영상이 없어 사진도 숨김 (다른 영상 사진이 남지 않게)
  const del = `<button class="textlike delRec" data-delrec="${h.date}">이 기록 지우기</button>`;   // 기록 탭에서 연 결과에만 (디자인 팀 10/28)
  if (act === 'video') { setTab('video'); $('vcanvas').classList.add('hidden'); renderVideo(h.r); $('vresult').insertAdjacentHTML('afterbegin', banner); $('vresult').insertAdjacentHTML('beforeend', del); return; }
  setTab('measure');
  const prev = hist.slice(i + 1).find(x => !x.practice && (x.activity ?? 'walk') === act);
  if (act === 'slowrun') renderSlow(h, hist); else if (act === 'cooper') renderCooper(h); else if (act === 'stairs') renderStairs(h); else if (act === 'walk') render(h, prev); else renderRun(h, prev);
  $('result').insertAdjacentHTML('afterbegin', banner); $('result').insertAdjacentHTML('beforeend', del);
}

// ── 영상 분석 (옆·앞·뒤) ──
// 촬영 전 조건 확인 (디자인 팀 10/29, 교수님 아이디어 ①A): 누르면 켜지고 꺼지는 체크 5개(처음엔 모두 꺼짐, 방향마다 지난 선택 기억)
// 근거: Perry 『보행 분석』 17장 362쪽(걷는 길과 직각), 365쪽(초당 60장), 20장 439~440쪽(양 끝 2m 여유, 연습 한 번) — refs/video_shooting_conditions.md
const VCHECK = {
  side: ['휴대폰을 엉덩이 높이에 가로로 고정했어요 (줌 없이)', '걷는 길과 직각으로, 3~4m 떨어져 있어요', '화면 양 끝보다 2m 앞에서 출발해 2m 지나서 멈춰요',
    '밝은 곳, 몸에 붙는 옷, 화면에 나만 (비교하려면 지난번과 같게)', '찍기 전에 연습으로 한 번 걸어 봤어요'],
  front: ['휴대폰을 엉덩이 높이에 가로로 고정했어요 (줌 없이)', '휴대폰 정면에 서요', '6~8m 떨어진 곳에서 카메라 쪽으로 평소처럼 걸어와요',
    '밝은 곳, 몸에 붙는 옷, 화면에 나만 (비교하려면 지난번과 같게)', '찍기 전에 연습으로 한 번 걸어 봤어요'],
  back: ['휴대폰을 엉덩이 높이에 가로로 고정했어요 (줌 없이)', '휴대폰 바로 앞에서 출발해요', '6~8m 멀어지며 평소처럼 걸어가요',
    '밝은 곳, 몸에 붙는 옷, 화면에 나만 (비교하려면 지난번과 같게)', '찍기 전에 연습으로 한 번 걸어 봤어요'] };
// 위에서 본 배치 (옆 방향만): 걷는 길 점선, 화면에 담기는 곳(연초록), 양 끝 2m 여유, 휴대폰 → 길 수직 3~4m
const VFIG = `<svg viewBox="0 0 340 150" role="img" aria-label="위에서 본 촬영 배치: 휴대폰을 걷는 길과 직각으로 3~4m 떨어뜨리고, 화면에 담기는 곳 양 끝으로 2m씩 더 걸어요">
  <rect x="100" y="22" width="140" height="28" rx="6" fill="var(--accent)" opacity=".16"/><text x="170" y="16" font-size="11" text-anchor="middle" fill="currentColor">화면에 담기는 곳</text>
  <line x1="20" y1="36" x2="320" y2="36" stroke="currentColor" stroke-width="2" stroke-dasharray="6 5"/><path d="M312 31l8 5-8 5" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="58" y="64" font-size="11" text-anchor="middle" fill="currentColor" opacity=".75">2m 여유</text><text x="282" y="64" font-size="11" text-anchor="middle" fill="currentColor" opacity=".75">2m 여유</text>
  <line x1="170" y1="50" x2="170" y2="118" stroke="currentColor" stroke-width="1.5"/><path d="M170 50v8h8" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="180" y="92" font-size="11" fill="currentColor">3~4m · 직각</text>
  <rect x="150" y="118" width="40" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="182" cy="129" r="3" fill="currentColor"/><text x="140" y="133" font-size="11" text-anchor="end" fill="currentColor">휴대폰(가로)</text></svg>`;
function showVGuide() {
  const v = $('vview').value, on = store.get('vchecks', {})[v] ?? [];
  $('vfig').innerHTML = v === 'side' ? VFIG : '';
  $('vguide').innerHTML = VCHECK[v].map((x, i) => `<li><label><input type="checkbox" data-vc="${i}"${on[i] ? ' checked' : ''}><span>${x}</span></label></li>`).join('');
  document.querySelectorAll('[data-cloth]').forEach(c => c.setAttribute('aria-pressed', c.dataset.cloth === store.get('vcloth', null)));
}
$('vguide').addEventListener('change', e => { const c = e.target.closest('[data-vc]'); if (!c) return; const all = store.get('vchecks', {}), v = $('vview').value; (all[v] ??= [])[+c.dataset.vc] = c.checked; store.set('vchecks', all); });
document.querySelector('.vcloth').addEventListener('click', e => { const c = e.target.closest('[data-cloth]'); if (!c) return; store.set('vcloth', store.get('vcloth', null) === c.dataset.cloth ? null : c.dataset.cloth); showVGuide(); });
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
    const { frames, W, H, video, dur, processed, delegate, srcFps, bright } = await extractPose(file, r => prog(r, `영상 분석 중… ${Math.round(r * 100)}%`));
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
    await drawSnapshot($('vcanvas'), video, frames[Math.floor(frames.length / 2)], videoMarks(r));
    URL.revokeObjectURL(video.src);
    r.cond = shootCond(view, frames, r, srcFps, bright);                   // 이번 촬영 조건 (휴대폰 기록에만, 시트로 안 보냄)
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

// ── 이번 촬영 조건 (디자인 팀 10/29, 교수님 아이디어 ②B): 앱이 영상에서 잰 값 + 고른 옷·체크 수. 같은 방향 바로 전 영상과 나란히 ──
function shootCond(view, frames, r, srcFps, bright) {
  const sz = frames.map(f => { const ys = [29, 30, 31, 32].map(i => f.lm[i]?.y).filter(y => y != null); return ys.length && f.lm[0] ? Math.max(...ys) - f.lm[0].y : null; }).filter(x => x > 0).sort((a, b) => a - b);
  const checks = (store.get('vchecks', {})[view] ?? []).filter(Boolean).length;
  return { view, fps: srcFps, steps: view === 'side' ? r.diag?.contacts ?? null : r.fc?.n ?? null, size: sz.length ? Math.round(sz[Math.floor(sz.length / 2)] * 100) : null,
    bright: bright == null ? null : Math.round(bright), cloth: store.get('vcloth', null), checks };
}
// 다른 칸 표시 기준은 디자인 팀이 정한 '눈에 띄게 할 차이'이고 연구 근거는 아님: 방향·옷·초당 장수는 다르면, 사람 크기는 10%p, 밝기는 15 이상. 담긴 걸음은 표시 안 함
function condHtml(r) {
  const c = r.cond; if (!c) return '';
  const hist = store.get('history', []), me = hist.findIndex(h => h.date === shownDate);
  const prev = hist.slice(me + 1).find(h => h.activity === 'video' && h.view === c.view && h.r?.cond)?.r.cond, pd = prev && hist.slice(me + 1).find(h => h.r?.cond === prev);
  const VIEWN = { side: '옆', front: '앞', back: '뒤' }, CL = { tight: '몸에 붙는 옷', loose: '헐렁한 옷' };
  const rows = [['방향', x => VIEWN[x.view], (a, b) => a.view !== b.view], ['초당 장수', x => x.fps ? `${x.fps}장` : '알 수 없음', (a, b) => a.fps && b.fps && a.fps !== b.fps],
    [c.view === 'side' ? '담긴 발 닿기' : '담긴 보행 주기', x => x.steps ?? '-', () => false], ['사람 크기', x => x.size != null ? `${x.size}%` : '-', (a, b) => a.size != null && b.size != null && Math.abs(a.size - b.size) >= 10],
    ['밝기', x => x.bright != null ? `${x.bright}` : '-', (a, b) => a.bright != null && b.bright != null && Math.abs(a.bright - b.bright) >= 15], ['옷', x => CL[x.cloth] ?? '고르지 않음', (a, b) => a.cloth && b.cloth && a.cloth !== b.cloth],
    ['찍기 전 확인', x => `${x.checks ?? 0} / 5`, () => false]];
  const cell = (x, d) => d ? `<span class="vdiff">${x}</span>` : x;
  return `<div class="metric"><div class="mhead"><div><b>이번 촬영 조건</b></div></div><table class="vcond"><tr><th></th><th>이번</th>${prev ? `<th>${new Date(pd.date).getMonth() + 1}월 ${new Date(pd.date).getDate()}일</th>` : ''}</tr>
    ${rows.map(([k, f, diff]) => { const d = prev && diff(c, prev); return `<tr><td>${k}</td><td>${cell(f(c), d)}</td>${prev ? `<td>${cell(f(prev), d)}</td>` : ''}</tr>`; }).join('')}</table>
    <div class="sub" style="font-size:.75rem;margin-top:4px">초당 장수는 휴대폰이 재생하며 잰 값이라 실제와 다를 수 있어요 · 사람 크기 = 화면 높이에 대한 머리~발 길이 · 밝기 0~100 · 분석은 초당 30장으로 해요</div>
    <div class="sub" style="margin-top:6px">조건이 다르면 각도가 몇 도 달라질 수 있어요${c.fps && c.fps < 60 ? '<br>페리 기준 연구는 초당 60장으로 찍었어요 (『보행 분석』 365쪽)' : ''}</div>
    <div class="sub" style="font-size:.75rem">Lights, Cameras, Action, J Biomech 2026 · Pérez-de la Cruz, Sensors 2026</div></div>`;
}
function showV(html) {
  const el = $('vresult'); el.innerHTML = html;
  if (shownDate) el.querySelector('h2')?.insertAdjacentHTML('afterend', shareBtn(shownDate));
  el.insertAdjacentHTML('beforeend', glossList(markTerms(el)));
  if (shownDate) el.insertAdjacentHTML('beforeend', ctxBox(shownDate));
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
// 입각기 무릎 폄: 0°보다 더 펴지면(음수) "뒤로 젖혀짐"이라고 사실만 (영상 오차 약 4° 안은 0°로 봄)
const extTxt = a => a == null || Number.isNaN(a) ? '' : a < -4 ? `(0°보다 ${Math.round(-a)}° 더 펴짐 · 뒤로 젖혀짐)` : a < 0 ? '(거의 0°, 영상 오차 안)' : hw(a, 5, ['덜 펴도 됨', '더 펴야 함']);
// 보행 8단계: Perry 9장 표의 단계별 넓적다리·무릎·발목 각도 (나란히 보기의 기준 뼈대에 씀)
const PHASES = [   // [이름, 보행 주기 %, 넓적다리(앞 +), 무릎 굽힘, 발목(발등 +)]
  ['첫 닿기', 1, 20, 3, 0], ['체중 받기', 6, 20, 16, -10], ['중간 입각', 20, 0, 5, 5], ['말기 입각', 40, -20, 3, 10],
  ['유각 전', 55, 0, 40, -20], ['초기 유각', 67, 20, 60, -10], ['중간 유각', 79, 25, 30, 0], ['말기 유각', 93, 20, 3, 0]];
// 기준 걸음과 내 걸음 나란히: 왼쪽 = Perry 9장 표의 단계별 각도로 앱이 직접 그린 뼈대(책 그림 아님), 오른쪽 = 이번 영상 평균 곡선
// 단계 버튼으로 멈춰 비교함. 단계 사이 Perry 각도는 직선으로 이음(근사)
function perryAt(q, k) {   // k: 2 넓적다리, 3 무릎, 4 발목
  let i = -1; PHASES.forEach((p, j) => { if (p[1] <= q) i = j; });   // findLastIndex는 옛 휴대폰 브라우저에 없음
  const a = PHASES[i < 0 ? PHASES.length - 1 : i], b = PHASES[(i + 1) % PHASES.length];
  const qa = i < 0 ? a[1] - 100 : a[1], qb = b[1] <= qa ? b[1] + 100 : b[1];
  return a[k] + (b[k] - a[k]) * (q - qa) / (qb - qa);
}
// 걸음걸이 탭 '페리 기준 vs 나' 해부학 뼈 아바타 (디자인 팀 10/27 13:33, 법률 검토 19번): BodyParts3D·Z-Anatomy 뼈를 미리 렌더링한 그림(assets/bones, CC BY-SA)을
// 관절 각도에 맞춰 돌리고 이어 붙임. 옆 = 왼쪽 Perry 9장 표의 단계별 각도(단계 사이 직선 근사) / 오른쪽 이번 영상 평균 곡선. 앞·뒤 = 최근 앞·뒤 영상의 상위 10% 값
// '고관절' 숫자는 넓적다리 각도(수직선 기준, 골반 기울기 제외)라 새 숫자를 만들지 않음 → 화면 아래에 그 뜻을 적음
const OLD_PH = ['발뒤꿈치 닿기', '발바닥 닿기', '중간 디딤기', '발뒤꿈치 떼기', '발가락 떼기', '초기 흔들기', '중간 흔들기', '말기 흔들기'];   // 이 화면에서만 쓰는 전통 용어 (PHASES 순서, 사용자 10/27)
const OLD_EN = ['Heel Strike, 0~2%', 'Foot Flat, 2~12%', 'Mid Stance, 12~31%', 'Heel Off, 31~50%', 'Toe Off, 50~62%', 'Initial Swing, 62~75%', 'Mid Swing, 75~87%', 'Terminal Swing, 87~100%'];   // % = Perry 2장 구간
// 그림별 [폭, 높이, 관절 중심 픽셀 좌표] (assets/bones/bones.json, 1m = 600px). 오른쪽 다리 그림만 있고 왼쪽은 좌우로 뒤집어 씀
const BONE = {side:{pelvis:[103,141,{hipR:[60.2,97.2],hipL:[60.2,97.2],s1:[38.8,24.7]}],femur:[59,288,{hipR:[38.7,20.4],knee:[22.3,265.2]}],shank:[53,239,{knee:[24.5,-5.2],ankle:[23.2,224.4]}],foot:[149,58,{ankle:[40.2,15.7]}]},
  front:{pelvis:[174,141,{hipR:[36.3,97.2],hipL:[137.7,97.2],s1:[87.1,24.8]}],femur:[82,288,{hipR:[44.4,20.4],knee:[47.7,265.2]}],shank:[65,239,{knee:[33.7,-5.2],ankle:[37.2,224.4]}],foot:[68,58,{ankle:[49.7,15.8]}]},
  back:{pelvis:[174,141,{hipR:[137.7,97.2],hipL:[36.3,97.2],s1:[86.9,24.8]}],femur:[82,288,{hipR:[37.6,20.4],knee:[34.3,265.2]}],shank:[65,239,{knee:[31.3,-5.2],ankle:[27.8,224.4]}],foot:[68,58,{ankle:[18.3,15.8]}]}};
const BK = 0.19, HIPY = 76, GROUND = 175;                                  // 그림 1px = 화면 0.2, 고관절 높이, 바닥
const BTAG = { perry: '#5F5E5A', me: '#0F6E56' }, BHI = { perry: '#F1EFE8', me: '#9FE1CB' };
const rad = d => d * Math.PI / 180, sdeg = (x, y) => Math.atan2(y, x) * 180 / Math.PI;
const rot = ([x, y], a) => [x * Math.cos(rad(a)) - y * Math.sin(rad(a)), x * Math.sin(rad(a)) + y * Math.cos(rad(a))];
const add = (p, v) => [p[0] + v[0], p[1] + v[1]], f1 = n => n.toFixed(1);
const num = x => x == null || Number.isNaN(x) ? null : x;
let cmpCurves = null, cmpFM = null, cmpFC = null, cmpSideLatest = false;   // 옆 곡선 · 앞뒤 값(m) · 앞뒤 단계별 곡선(fc, v120부터) · 옆 곡선을 최근 옆 영상에서 빌려 왔는지
const cmpSt = { q: 0, view: 'side', playing: false, drawn: null, tab: null, last: 0, raf: 0 };   // 보행 주기 위치(%)·보기·재생 중인지
const CMP_T = 8000;                                                        // 재생할 때 한 주기 8초
// 단계 구간 = Perry 2장 (화면 % 글자·용어 풀이와 같음). PHASES[i][1]은 Perry 각도를 뽑은 지점이라 각도 보간(perryAt)에만 씀
const PH_START = [0, 2, 12, 31, 50, 62, 75, 87];
const phaseMid = i => PHASES[i][1];                                      // 단계 버튼 = Perry 9장 표의 그 단계 시점 1·6·20·40·55·67·79·93% (사용자 10/28: 거기선 표 값과 곡선 값이 정확히 같음)
const angAt = (who, q) => who === 'perry' ? [perryAt(q, 2), perryAt(q, 3), perryAt(q, 4)] : ['thigh', 'knee', 'ankle'].map(k => num(cmpCurves?.[k]?.[Math.round(q) % 101]));
// 그림 속 관절 a → b 벡터 (화면 단위, flip = 왼쪽 다리)
const bvec = (view, part, a, b, flip) => { const J = BONE[view][part][2]; return [(J[b][0] - J[a][0]) * BK * (flip ? -1 : 1), (J[b][1] - J[a][1]) * BK]; };
// 그림 한 장: 관절 j가 화면 점 p에 오고 a°만큼 돌림 (filter = 색: 나 초록 / 뒤쪽 다리 어둡게)
function bone(view, part, j, p, a, filt, flip = false) {
  const [w, h, J] = BONE[view][part];
  return `<g transform="translate(${f1(p[0])},${f1(p[1])}) rotate(${f1(a)})${flip ? ' scale(-1,1)' : ''}"><image href="assets/bones/${view}-${part}.webp" x="${f1(-J[j][0] * BK)}" y="${f1(-J[j][1] * BK)}" width="${f1(w * BK)}" height="${f1(h * BK)}"${filt ? ` filter="url(#${filt})"` : ''}/></g>`;
}
// 말풍선: 페리는 인물 왼쪽, 나는 오른쪽 (서로 안 겹치게)
function bubbles(who, items) {
  const W = 72, left = who === 'perry', bx = left ? 1 : 319 - W; let y = 0, out = '';
  for (const [name, p, v] of items) {
    y = Math.max(p[1], y + 26);
    out += `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${left ? bx + W : bx}" y2="${f1(y)}" stroke="${BTAG[who]}" stroke-width="1" opacity=".7"/>
      <rect x="${bx}" y="${f1(y - 11)}" width="${W}" height="22" rx="11" fill="${BTAG[who]}"/><text x="${bx + W / 2}" y="${f1(y + 4)}" font-size="12" font-weight="700" text-anchor="middle" fill="#fff">${name} ${v == null ? '–' : `${Math.round(v)}°`}</text>`;
  }
  return out;
}
const ground = x => `<ellipse cx="${x}" cy="${GROUND + 1}" rx="30" ry="4.5" fill="currentColor" opacity=".13"/>`;
const floorLines = `<line x1="0" x2="320" y1="${GROUND}" y2="${GROUND}" stroke="currentColor" opacity=".25"/><line x1="0" x2="320" y1="${GROUND + 8}" y2="${GROUND + 8}" stroke="currentColor" opacity=".12"/><line x1="0" x2="320" y1="${GROUND + 18}" y2="${GROUND + 18}" stroke="currentColor" opacity=".07"/>`;
// 옆 보기 다리: 넓적다리 각도 t(앞 +), 무릎 굽힘 k, 발목 an(발등 +). 화면 각도: 아래 = 90°, 걷는 방향(오른쪽)으로 기울면 작아짐
function sideLeg(hip, q, who, filt) {
  const [th, kn, an] = angAt(who, q), t = th ?? 0, k = kn ?? 0;
  const fv = bvec('side', 'femur', 'hipR', 'knee'), sv = bvec('side', 'shank', 'knee', 'ankle');
  const dF = 90 - t, dS = 90 - (t - k), rF = dF - sdeg(...fv), rS = dS - sdeg(...sv);
  const knee = add(hip, rot(fv, rF)), ankle = add(knee, rot(sv, rS));
  return { svg: (an == null ? '' : bone('side', 'foot', 'ankle', ankle, rS - an, filt)) + bone('side', 'shank', 'knee', knee, rS, filt) + bone('side', 'femur', 'hipR', hip, rF, filt),   // 발목 값이 없으면 발은 안 그림
    hip, knee, ankle, t, k, v: [th, kn, an] };
}
function sideFig(x, who, q, bub = true) {
  const hip = [x, HIPY], me = who === 'me';
  const far = sideLeg(hip, (q + 50) % 100, who, me ? 'bf-me-far' : 'bf-far'), near = sideLeg(hip, q, who, me ? 'bf-me' : null);   // 반대 다리 = 반 주기 어긋남, 뒤에 어둡게
  const s1 = add(hip, bvec('side', 'pelvis', 'hipR', 's1'));
  const arc = (c, a, b, r) => { const p = [c[0] + r * Math.sin(rad(a)), c[1] + r * Math.cos(rad(a))], e = [c[0] + r * Math.sin(rad(b)), c[1] + r * Math.cos(rad(b))];
    return `<path d="M${f1(p[0])},${f1(p[1])} A${r},${r} 0 0 ${b > a ? 0 : 1} ${f1(e[0])},${f1(e[1])}" fill="none" stroke="${BHI[who]}" stroke-width="2"/>`; };
  return ground(x) + `<line x1="${f1(s1[0])}" y1="${f1(s1[1])}" x2="${f1(s1[0] - 2)}" y2="${f1(s1[1] - 28)}" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".2"/>`
    + far.svg + bone('side', 'pelvis', 'hipR', hip, 0, me ? 'bf-me' : null) + near.svg
    + arc(near.hip, 0, near.t, 16) + arc(near.knee, near.t, near.t - near.k, 12)
    + (!bub ? '' : bubbles(who, [['고관절', near.hip, near.v[0]], ['무릎', near.knee, near.v[1]], ['발목', near.ankle, near.v[2]]]));
}
// 앞·뒤 보기: 왼발(주기 0~50%)·오른발(50~100%)을 번갈아 디딤. 디딜 때(체중 받기, 그 발 구간의 15% 지점)에 상위 10% 값까지 올라갔다 내려옴
// 앞에서 보면 거울처럼 몸 오른쪽이 화면 왼쪽, 뒤에서 보면 몸 왼쪽이 화면 왼쪽
const latestVid = (ok, f) => f(store.get('history', []).find(h => h.activity === 'video' && ok(h.view) && h.r && f(h.r))?.r ?? {}) ?? null;
const frontM = () => cmpFM;
function frontFig(x, who, q, view, m) {
  const sgn = view === 'front' ? 1 : -1, leftSt = q < 50, sL = leftSt ? 1 : -1, u = (q % 50) / 50;
  const w = u < 0.15 ? Math.sin(Math.PI / 2 * u / 0.15) : Math.cos(Math.PI / 2 * (u - 0.15) / 0.85), me = who === 'me';
  const val = (l, r) => (leftSt ? l : r) ?? 0;
  // 나: 단계별 곡선(fc)이 있으면 그 순간 잰 값(오른발 주기 qR), 없으면(옛 기록) 상위 10% 값을 디딜 때 가장 크게 맞춘 모양. 페리는 골반 약 4°만, 몸통·무릎은 기준값 없음
  const qR = Math.round((q + 50) % 100), fq = me && cmpFC ? k => cmpFC[k][qR] ?? 0 : null;
  const drop = fq ? (leftSt ? -1 : 1) * fq('tilt') : (me ? val(m.dropL, m.dropR) : 4) * w;   // tilt + = 왼쪽 골반 낮음 → 디딘 발 반대쪽이 내려간 각도로
  const valg = fq ? fq(leftSt ? 'valgusL' : 'valgusR') : me ? val(m.valgusL, m.valgusR) * w : 0;
  const lean = fq ? (leftSt ? 1 : -1) * fq('lean') : me ? val(m.leanL, m.leanR) * w : 0;   // 디딘 쪽으로 기운 각도 (lean + = 몸통 왼쪽)
  const P = BONE[view].pelvis[2], H = Math.abs(P.hipL[0] - P.hipR[0]) * BK;
  const stDir = sgn * sL;                                                   // 디딘 다리가 화면에서 놓인 쪽 (+1 오른쪽)
  const pivot = [x + stDir * H / 2, HIPY], rP = -stDir * drop;              // 안 디딘 쪽 골반이 내려가게 디딘 고관절을 축으로 돌림 (SVG는 y가 아래로 +)
  const other = add(pivot, rot([-stDir * H, 0], rP));
  const pel = bone(view, 'pelvis', leftSt ? 'hipL' : 'hipR', pivot, rP, me ? 'bf-me' : null);
  const leg = (hip, isStance, bodyLeft) => {
    const flip = bodyLeft, mdir = -sgn * (bodyLeft ? 1 : -1);               // 무릎 안쪽 = 화면에서 몸 가운데 쪽
    const vg = fq ? fq(bodyLeft ? 'valgusL' : 'valgusR') : isStance ? valg : 0, rF = -mdir * vg / 2, rS = mdir * vg / 2;
    const knee = add(hip, rot(bvec(view, 'femur', 'hipR', 'knee', flip), rF)), ankle = add(knee, rot(bvec(view, 'shank', 'knee', 'ankle', flip), rS));
    const filt = me ? (isStance ? 'bf-me' : 'bf-me-far') : (isStance ? null : 'bf-far');
    return { svg: bone(view, 'foot', 'ankle', ankle, rS, filt, flip) + bone(view, 'shank', 'knee', knee, rS, filt, flip) + bone(view, 'femur', 'hipR', hip, rF, filt, flip), knee };
  };
  const st = leg(pivot, true, leftSt), sw = leg(other, false, !leftSt);
  const s1 = add(pivot, rot([(P.s1[0] - P[leftSt ? 'hipL' : 'hipR'][0]) * BK, (P.s1[1] - P[leftSt ? 'hipL' : 'hipR'][1]) * BK], rP));
  const top = add(s1, [stDir * 30 * Math.sin(rad(lean)), -30 * Math.cos(rad(lean))]);   // 몸통은 옅은 척추선 기울기로만
  const mid = [(pivot[0] + other[0]) / 2, (pivot[1] + other[1]) / 2];
  return ground(x) + sw.svg + pel + st.svg
    + `<line x1="${f1(x - 26)}" x2="${f1(x + 26)}" y1="${HIPY}" y2="${HIPY}" stroke="currentColor" stroke-dasharray="3 3" opacity=".45"/>
      <line x1="${f1(pivot[0])}" y1="${f1(pivot[1])}" x2="${f1(other[0])}" y2="${f1(other[1])}" stroke="${BTAG[who]}" stroke-width="2"/>
      <line x1="${f1(s1[0])}" y1="${f1(s1[1])}" x2="${f1(top[0])}" y2="${f1(top[1])}" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".3"/>`
    + bubbles(who, me ? [['몸통', [(s1[0] + top[0]) / 2, (s1[1] + top[1]) / 2], lean], ['골반', mid, drop], ['무릎', st.knee, valg]] : [['골반', mid, drop]]);
}
function cmpScene(q, view) {
  const lab = (x, t, fs = 13) => `<text x="${x}" y="197" font-size="${fs}" text-anchor="middle" fill="currentColor" opacity=".75">${t}</text>`;   // 화면 첫 '페리'는 전체 이름 (사용자 10/28), 좁아서 12   // 이름은 각 인물 바로 아래
  const label = lab(96, '페리의 보행 분석 기준', 12) + lab(204, view === 'side' && cmpSideLatest ? '나 (최근 옆 영상)' : '나 (이번 영상)');
  if (view === 'side') return floorLines + sideFig(102, 'perry', q) + (cmpCurves ? sideFig(198, 'me', q) + label : lab(96, '페리의 보행 분석 기준', 12)
    + `<text x="230" y="100" font-size="12" text-anchor="middle" fill="currentColor" opacity=".7">옆 영상을 찍으면 보여요</text>`);
  const m = frontM();
  if (!m) return `<text x="160" y="100" font-size="14" text-anchor="middle" fill="currentColor" opacity=".7">앞·뒤 영상을 찍으면 보여요</text>`;
  return floorLines + frontFig(102, 'perry', q, view, m) + frontFig(198, 'me', q, view, m) + label;
}
function cmpTable(q) {                                                     // q = 보행 주기 위치(%): 단계 버튼은 그 단계 가운데, 재생·막대는 그 순간
  const p = [2, 3, 4].map(k => perryAt(q, k)), m = angAt('me', q);        // 페리·나 모두 같은 순간 q (단계 버튼은 Perry 표 시점이라 표 값 그대로 −10·60 등이 나옴, 검수팀·사용자 10/28)
  const cell = v => v == null ? '-' : `${Math.round(v)}°`, diff = (a, b) => a == null ? '-' : `${signed(Math.round(a) - Math.round(b))}°`;
  return `<tr><th>${OLD_PH[phaseIdx(q)]} <small class="sub">${q}%</small></th><th>페리</th><th>나</th><th>차이</th></tr>`   // 관절 하나 = 한 줄 (사용자 10/28, 앞·뒤 표와 같은 모양)
    + ['고관절', '무릎', '발목'].map((name, j) => `<tr><th>${name}</th><td>${cell(p[j])}</td><td>${cell(m[j])}</td><td>${diff(m[j], p[j])}</td></tr>`).join('');
}
function frontTable(q, m) {                                                   // 앞·뒤 표 = 오른발 주기 q% 순간 잰 값 (사용자 10/27: 상위 10% 값 대신)
  const c = v => v == null ? '-' : `${Math.round(v)}°`, fc = cmpFC, i = phaseIdx(q);
  const side = (v, a, b, tail = '') => Math.abs(v) < 0.5 ? '거의 수평' : `${v > 0 ? a : b} ${Math.abs(Math.round(v))}°${tail}`;
  const perryPel = i === 1 ? '왼쪽 약 4° 낮음' : i === 4 ? '오른쪽 약 4° 낮음' : '-';   // 체중 받기(오른발 2~12%, 왼발은 오른발 주기 50~62%) 때 반대쪽 골반 약 4°
  return fc ? `<tr><th>${OLD_PH[i]} <small class="sub">${q}%</small></th><th>페리</th><th>나</th></tr><tr><th>골반 좌우</th><td>${perryPel}</td><td>${side(fc.tilt[q], '왼쪽', '오른쪽', ' 낮음')}</td></tr>
    <tr><th>몸통 옆 기울기</th><td>기준값 없음</td><td>${side(fc.lean[q], '왼쪽으로', '오른쪽으로')}</td></tr><tr><th>무릎 안쪽 모임</th><td>기준값 없음</td><td>왼발 ${c(fc.valgusL[q])} · 오른발 ${c(fc.valgusR[q])}</td></tr>`
    : `<tr><td colspan="3" class="sub">${fc === null ? '걸음 주기(디딘 발이 바뀌는 순간)를 찾지 못해 단계별 값이 없어요. 4걸음 이상 보이게 다시 찍어 보세요' : '이 기록은 v120 전에 분석해서 단계별 값이 없어요. 같은 영상을 다시 고르거나 새로 찍어 분석하면 나와요'}</td></tr>`   // 새 기록은 fc: null, 옛 기록은 fc 키 없음
    + `<tr><th>대신 영상 전체 상위 10% 값</th><th>페리</th><th>나</th></tr><tr><th>골반 내려감</th><td>약 4°</td><td>왼발 ${c(m?.dropL)} · 오른발 ${c(m?.dropR)}</td></tr>
    <tr><th>몸통 옆 기울기</th><td>기준값 없음</td><td>왼쪽 ${c(m?.leanL)} · 오른쪽 ${c(m?.leanR)}</td></tr><tr><th>무릎 안쪽 모임</th><td>기준값 없음</td><td>왼발 ${c(m?.valgusL)} · 오른발 ${c(m?.valgusR)}</td></tr>`;   // 단계별 값이 없으면 표가 비지 않게 (사용자 10/27)
}
// 단계 버튼으로 멈춰 봄 (사용자 10/27: 재생 대신 입각기·유각기 막대 + 단계 버튼). 그림·표는 누른 단계 가운데 순간의 값
// 앞·뒤는 오른발 기준 보행 주기: frontFig는 q<50이 왼발 디딤이라 반 주기 밀어서 넘김 (오른발 입각기 = 0~60%)
const STANCE_N = 5;                                                        // PHASES 0~4 입각기(0~62%), 5~7 유각기
const phaseIdx = q => { let i = 0; PH_START.forEach((a, j) => { if (a <= q) i = j; }); return i; };
function cmpRender(box) {
  const st = cmpSt, side = st.view === 'side', q = st.q, i = phaseIdx(q);
  box.querySelector('.cmpScene').innerHTML = cmpScene(side ? q : (q + 50) % 100, st.view);
  box.querySelector('.cmpRange').value = Math.round(q);
  const qi = Math.round(q) % 100, m = side ? null : frontM();
  if (st.tab !== `${st.view}${qi}`) {                                      // 표는 1% 바뀔 때마다 그 순간 값으로
    st.tab = `${st.view}${qi}`;
    box.querySelector('.cmpTab').innerHTML = side ? cmpTable(qi) : m ? frontTable(qi, m) : '';
  }
  if (st.drawn === `${st.view}${i}`) return;                               // 단계 버튼·막대·이름은 단계가 바뀔 때만 (표는 위에서 1%마다)
  st.drawn = `${st.view}${i}`;
  box.querySelectorAll('[data-ph]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.ph === i));
  box.querySelectorAll('.gc > span').forEach((s, j) => s.classList.toggle('on', j === (i < STANCE_N ? 0 : 1)));
  box.querySelector('.phName').innerHTML = `${OLD_PH[i]} <small>(${OLD_EN[i]})</small>`;
  markTerms(box.querySelector('.phName'));                                 // 다시 쓴 단계 이름에 용어 풀이 밑줄 (누르면 뜻)
  if (side) {
    box.querySelector('.phN').textContent = `페리: ${PHASES[i][0]} · ${i + 1} / 8 단계`;
    box.querySelector('.cmpTabNote').textContent = (cmpSideLatest ? '옆: 가장 최근 옆 영상 값 · ' : '') + '페리·나 모두 표 맨 위 % 순간의 값이에요. 단계를 누르면 Perry 9장 표의 그 단계 시점으로 가요(재생하면 따라 바뀜)';
    return;
  }
  box.querySelector('.phN').textContent = `오른발 기준 · ${st.view === 'front' ? '앞에서 본 모습(거울처럼 반대)' : '뒤에서 본 모습'}`;
  box.querySelector('.cmpTabNote').textContent = m ? (cmpFC ? `단계는 오른발의 보행 주기예요(디딘 발이 왼발에서 오른발로 바뀌는 순간을 첫 닿기로 본 근사, 주기 ${cmpFC.n}개 평균). 오른발 유각기에는 왼발이 디뎌요. 그림과 표는 그 순간 잰 값이에요(재생하면 따라 바뀜). 영상 전체의 상위 10% 값은 아래 결과 카드에 있어요. 휴대폰 영상의 앞·뒤 단계별 각도는 검증 연구를 찾지 못했어요.`
    : '단계는 오른발의 보행 주기예요. 오른발 유각기에는 왼발이 디뎌요. 이 기록은 단계별 값이 없어 그림만 영상 전체의 상위 10% 값을 발을 디딜 때(체중 받기)에 가장 크게 맞춰 보여 줘요.') : '걸음걸이 탭에서 앞모습이나 뒷모습 영상을 분석하면 여기에 보여요.';
}
// 재생: 한 주기를 CMP_T 동안 돌림. 카드가 안 보이면(다른 탭) 일시정지
const playTxt = () => cmpSt.playing ? '❚❚ 일시정지' : '▶ 재생';
function cmpLoop(now) {
  const box = document.querySelector('.cmp');
  if (!cmpSt.playing || !box?.offsetParent) { cmpSt.raf = 0; if (cmpSt.playing) { cmpSt.playing = false; box && (box.querySelector('[data-cplay]').textContent = playTxt()); } return; }
  cmpSt.q = (cmpSt.q + (now - cmpSt.last) / CMP_T * 100) % 100; cmpSt.last = now;
  cmpRender(box); cmpSt.raf = requestAnimationFrame(cmpLoop);
}
// 뼈 그림 색: 페리 = 원래 상아색, 나 = 초록 기운, 뒤쪽 다리 = 어둡게 (그림은 한 벌, 색만 필터로 바꿈)
const BONE_DEFS = `<defs><filter id="bf-far"><feColorMatrix type="matrix" values=".7 0 0 0 0  0 .7 0 0 0  0 0 .7 0 0  0 0 0 1 0"/></filter>
  <filter id="bf-me"><feColorMatrix type="matrix" values=".2 .2 .2 0 0  .3 .3 .3 0 0  .27 .27 .27 0 0  0 0 0 1 0"/></filter>
  <filter id="bf-me-far"><feColorMatrix type="matrix" values=".14 .14 .14 0 0  .21 .21 .21 0 0  .19 .19 .19 0 0  0 0 0 1 0"/></filter></defs>`;
// 옆 결과: 이번 곡선 + 최근 앞·뒤 값 · 앞·뒤 결과: 이번 값(fm) + 최근 옆 곡선(없으면 페리만), 처음 보기는 영상 방향
function compareFigures(curves, fm = null, view = 'side', fc) {
  cmpCurves = curves ?? latestVid(v => v === 'side', r => r.curves);
  cmpSideLatest = !curves && !!cmpCurves;
  const fr = fm ? { m: fm, fc } : latestVid(v => v === 'front' || v === 'back', r => r.m ? r : null);   // 옆 결과에선 가장 최근 앞·뒤 기록 하나에서 m·fc를 같이
  cmpFM = fr?.m ?? null; cmpFC = fr?.fc;                                  // null(주기 못 찾음)과 undefined(옛 기록)를 구분해 둠
  cancelAnimationFrame(cmpSt.raf);
  Object.assign(cmpSt, { q: phaseMid(1), view, playing: false, drawn: null, tab: null, raf: 0 });   // 처음엔 체중 받기에 멈춘 채
  setTimeout(() => { const b = document.querySelector('.cmp'); if (b) cmpRender(b); });   // 화면에 넣은 뒤 그림·표를 보기(옆·앞·뒤)에 맞춤
  const chip = (attr, v, label, on) => `<button class="chip" ${attr}="${v}" aria-pressed="${on}">${label}</button>`;
  const phBtns = (a, b) => PHASES.slice(a, b).map((p, j) => chip('data-ph', a + j, OLD_PH[a + j], a + j === 1)).join('');
  return `<div class="cmp">
    <div class="cmpChips">${chip('data-view', 'side', '옆', view === 'side')}${chip('data-view', 'front', '앞', view === 'front')}${chip('data-view', 'back', '뒤', view === 'back')}</div>
    <svg class="chart cmpSvg" viewBox="0 0 320 204" role="img" aria-label="페리의 보행 분석 기준 걸음과 내 걸음 뼈 그림 비교">${BONE_DEFS}<g class="cmpScene">${cmpScene(view === 'side' ? phaseMid(1) : (phaseMid(1) + 50) % 100, view)}</g></svg>
    <div class="sub" style="font-size:.75rem">뼈 그림: BodyParts3D·Z-Anatomy 모델로 만듦 (CC BY-SA) · <a href="#" data-bonesrc>출처 보기</a></div>
    <div class="cmpCtl"><button class="chip" data-cplay>▶ 재생</button><input type="range" class="cmpRange" min="0" max="99" step="1" value="${phaseMid(1)}" aria-label="보행 주기 위치(%)"></div>
    <div class="gc" role="group" aria-label="보행 주기 단계"><span class="on">입각기 <small>0~62%</small></span><span>유각기 <small>62~100%</small></span>${phBtns(0, PHASES.length)}</div>
    <div class="cmpPh"><b class="phName">${OLD_PH[1]} <small>(${OLD_EN[1]})</small></b> <span class="sub phN">페리: ${PHASES[1][0]} · 2 / 8 단계</span></div>
    <table class="cmpTab">${cmpTable(phaseMid(1))}</table>
    <div class="sub cmpTabNote" style="font-size:.75rem">그림과 표는 누른 단계 가운데 순간의 값이에요</div>
    <div class="sub">걷는 방향 → · 옆: 왼쪽 = Perry 9장 표의 단계별 각도로 앱이 움직인 뼈 그림(단계 사이는 직선으로 이은 근사) · 오른쪽 = ${cmpSideLatest ? '가장 최근 옆 영상' : '이번 영상'} 평균 · '고관절' 숫자는 넓적다리가 수직선에서 앞(+)·뒤(−)로 기운 각도예요(골반 기울기는 빼고 잼) · 발목은 발등 쪽 +</div></div>`;
}
document.addEventListener('input', e => {                                // 막대를 끌면 멈추고 그 위치로
  if (!e.target.matches?.('.cmp .cmpRange')) return;
  const box = e.target.closest('.cmp');
  cmpSt.q = +e.target.value; cmpSt.playing = false; box.querySelector('[data-cplay]').textContent = playTxt();
  cmpRender(box);
});
document.addEventListener('click', e => {
  if (e.target.closest('[data-bonesrc]')) {                                // 출처 보기 → 홈 '이 앱의 근거' 카드의 뼈 그림 출처 펼침
    e.preventDefault(); setTab('home'); const d = $('boneSrc'); d.open = true; d.scrollIntoView({ block: 'center' }); return;
  }
  const b = e.target.closest('.cmp [data-view], .cmp [data-ph], .cmp [data-cplay]');
  if (!b) return;
  if (b.dataset.view) {
    cmpSt.view = b.dataset.view; cmpSt.drawn = cmpSt.tab = null;
    for (const x of b.parentElement.querySelectorAll('[data-view]')) x.setAttribute('aria-pressed', x === b);
  } else if ('cplay' in b.dataset) {
    cmpSt.playing = !cmpSt.playing; b.textContent = playTxt();
    if (cmpSt.playing) { cmpSt.last = performance.now(); cmpSt.raf = requestAnimationFrame(cmpLoop); }
    return;
  } else { cmpSt.q = phaseMid(+b.dataset.ph); cmpSt.playing = false; b.closest('.cmp').querySelector('[data-cplay]').textContent = playTxt(); }   // 단계를 누르면 멈추고 그 단계로
  cmpRender(b.closest('.cmp'));
});
function videoRecs(r) {
  const m = r.m, lim = '카메라 1대로 찍은 2D 영상이라 다리가 돌아가 있으면 굽힘 각도가 작게 찍혀요(Perry 17장). 원인 판단은 전문가에게.';
  if (r.view === 'side') return [
    recCard({ title: '유각기 무릎 굽힘 (발 들어 올리기)', calc: [`이번 − 페리의 보행 분석 기준 약 60° → ${dif(m.kneeSwingMax, 60, ['더 굽혀야 함', '덜 굽혀도 됨'])}`],
      facts: [`Perry 4·5장: 초기 유각에 무릎이 약 60° 굽혀져야${hw(m.kneeSwingMax, 60, BEND)} 발끝이 바닥에 걸리지 않음. 이 굽힘은 거의 근육 없이 관성으로 만들어짐`,
        'Perry 4장: 유각 전에 발목이 빠르게 발바닥굽힘 20°가 되면서 무릎 굽힘을 이끔',
        'Perry 5장: 초기 유각에 굽힘이 15°에 못 미치면 다리가 덜 나가고 발끝이 바닥에 끌릴 수 있음'], limit: lim, refs: ['perry9', 'perry17'] }),
    recCard({ title: '체중 받기 무릎 굽힘 (충격 흡수)', calc: [`이번 − 페리의 보행 분석 기준 약 16° → ${dif(m.kneeLoad, 16, ['더 굽혀야 함(충격 흡수)', '덜 굽혀도 됨'])} · 기준 범위 15~18°`],
      facts: [`Perry 4장: 발이 닿고 0.02초 만에 체중 60%가 실림. 무릎 약 15° 굽힘${hw(m.kneeLoad, 16, ['더 굽혀야 함', '덜 굽혀도 됨'])}, 발목 발바닥굽힘 10°, 반대쪽 골반 4° 내려감으로 충격을 흡수`,
        'Perry 5장: 이 굽힘은 허벅지 앞 근육(대퇴사두근)이 늘어나며 버티는 힘으로 무릎이 "뚝 꺾이지 않게 천천히" 조절해서 생겨요. 그 덕분에 바닥에서 받는 힘이 체중의 약 120%로 줄어요',
        'Perry 5장의 구분: 체중 받기 때 25° 넘게 굽으면 "굽힘 과다"로 봄'], limit: lim, refs: ['perry9', 'perry5'] }),
    recCard({ title: '입각기 무릎 펴기', calc: [m.kneeStanceMin < 0 ? `이번 최소 ${m.kneeStanceMin.toFixed(0)}° ${extTxt(m.kneeStanceMin)}` : `이번 최소 − 페리의 보행 분석 기준 약 5° → ${dif(m.kneeStanceMin, 5, ['덜 펴도 됨', '더 펴야 함'])}`],
      facts: [`Perry 5장: 말기 입각에 무릎이 약 5°까지 펴짐${extTxt(m.kneeStanceMin)}. 10° 이내로 펴지지 않으면 "폄 부족"으로 봄`, 'Perry 5장: 말기 유각에 덜 펴지면 걸음 길이가 짧아짐',
        ...(m.kneeStanceMin < -4 ? ['Perry 12장: 입각기에 무릎이 0°보다 더 펴져 뒤로 젖혀지는 것을 "과신전(반장슬)"이라고 해요. 원인은 여러 가지라 이 앱은 판단하지 않아요'] : [])],
      limit: lim, refs: ['perry9', ...(m.kneeStanceMin < -4 ? ['perry12'] : [])] }),
    recCard({ title: '넓적다리 뒤로 젖히기 (한걸음 길이)', grade: 'o', calc: [`뒤로 젖힘: 이번 − 페리의 보행 분석 기준 약 20° → ${dif(m.thighExt, 20, ['더 뒤로 젖혀야 함', '덜 젖혀도 됨'])}`, `앞으로 굽힘: 이번 − 페리의 보행 분석 기준 약 20° → ${dif(m.thighFlex, 20, ['더 앞으로 들어야 함', '덜 들어도 됨'])}`],
      facts: [`Perry 6장: 말기 입각에 넓적다리가 수직에서 뒤로 약 20° 젖혀짐${hw(m.thighExt, 20, ['더 뒤로 젖혀야 함', '덜 젖혀도 됨'])}`, 'Perry 6장: 이 젖힘이 부족하면 한걸음 길이가 짧아짐', 'Perry 6장: 첫 닿기 때 고관절 굽힘 약 30°(넓적다리 약 20°)는 미끄러짐과 안정성 사이의 최적 타협'],
      limit: lim + ' 넓적다리 각도는 영상 정확도가 낮은 편이에요(Wegner 2026).', refs: ['perry9', 'wegner2026'] }),
    recCard({ title: '발목 (밀어내기)', grade: 'o', calc: [`발등굽힘: 이번 − 페리의 보행 분석 기준 약 10° → ${dif(m.ankleDF, 10, ['더 발등 쪽으로 굽혀야 함(정강이를 앞으로)', '덜 굽혀도 됨'])}`, `발바닥굽힘: 이번 − 페리의 보행 분석 기준 약 20° → ${dif(m.anklePF, 20, ['더 발끝으로 밀어내야 함', '덜 밀어내도 됨'])}`],
      facts: ['Perry 4장: 뒤꿈치가 닿은 뒤에는 정강이 앞 근육이 발이 "탁" 떨어지지 않게 천천히 내려놓아요(뒤꿈치 흔들의자)', `Perry 4장: 말기 입각에 뒤꿈치가 들리며 발목 발등굽힘 약 10°${hw(m.ankleDF, 10, ['더 발등 쪽으로 굽혀야 함', '덜 굽혀도 됨'])}. 앞발을 축으로 굴러가는 이 동작(앞발 흔들의자)이 가장 강한 추진력`, 'Perry 4장: 중간 입각 30%까지 발등굽힘이 5° 이상 되는지 봄'],
      limit: lim + ' 발목 각도는 영상 정확도가 낮아요(Russo 2026, Cheng 2025).', refs: ['perry9', 'russo2026', 'cheng2025'] }),
  ];
  const lr = (a, b) => { if (a == null || b == null) return '-'; const d = Math.abs(a - b);
    return `|${a.toFixed(0)}° − ${b.toFixed(0)}°| = <b>${d.toFixed(0)}°</b> (${d <= 4 ? '좌우 비슷함' : d > 10 ? '좌우 차이 많이 남' : '좌우 차이 조금 남'})`; };
  return [
    recCard({ title: '골반 내려감 정도 (엉덩이 옆 근육)', grade: 'n', calc: [`왼발 디딜 때 − 페리의 보행 분석 기준 약 4° → ${dif(m.dropL, 4, ['덜 내려가는 편', '덜 내려가야 함(엉덩이 옆 근육으로 잡아 주기)'])}`, `오른발 디딜 때 − 페리의 보행 분석 기준 약 4° → ${dif(m.dropR, 4, ['덜 내려가는 편', '덜 내려가야 함(엉덩이 옆 근육으로 잡아 주기)'])}`, `좌우 차이 ${lr(m.dropL, m.dropR)}`],
      facts: [`Perry 4장: 체중 받기 때 반대쪽 골반이 약 4° 내려가며 충격을 나눠 받음 — 이번: 왼발 ${m.dropL == null ? '-' : hint(m.dropL - 4, ['덜 내려가는 편', '덜 내려가야 함'])}, 오른발 ${m.dropR == null ? '-' : hint(m.dropR - 4, ['덜 내려가는 편', '덜 내려가야 함'])}`, 'Perry 6·9장: 엉덩이 벌림근(중둔근 등)이 체중의 약 1.5배 힘으로 골반 처짐을 5° 이하로 잡아 줌'],
      limit: '휴대폰 앞·뒤 영상의 골반 각도는 검증 연구를 찾지 못했어요. 같은 조건으로 찍어 변화를 보세요.', refs: ['perry9'] }),
    recCard({ title: '왼쪽·오른쪽 비교', grade: 'n', calc: [`무릎 안쪽 모임 ${lr(m.valgusL, m.valgusR)}`, `몸통 옆 기울기 ${lr(m.leanL, m.leanR)}`],
      facts: ['Perry 책에는 이 두 각도의 영상 기준값이 없어서 숫자 기준 대신 좌우 차이와 이전 영상과의 변화로만 비교해요', 'Neumann 15장: 두 다리는 서로 의존해서, 한쪽 문제가 반대쪽 다리의 걸음에 나타나기도 함'],
      limit: '검증 안 됨. 원인 판단은 전문가에게.', refs: ['perry17', 'neumann15'] }),
  ];
}

// ── 한눈에 보기: 부위마다 색 점(영상 사진의 같은 색 동그라미) + 페리의 보행 분석 기준과의 차이를 숫자로 (판정 없이 사실만) ──
const PART = { pelvis: ['골반', 'var(--c-video)', '#8a5cd1'], thigh: ['넓적다리', 'var(--c-slow)', '#c46f1c'], knee: ['무릎', 'var(--c-walk)', '#008a6e'], ankle: ['발목', 'var(--c-run)', '#2f6fd1'], body: ['몸통', 'var(--sub)', '#69736f'], step: ['걸음', 'var(--sub)', '#69736f'] };
const partIcon = k => `<svg class="picon" viewBox="-2 -2 28 28" aria-hidden="true"><circle cx="12" cy="12" r="13" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="${PART_ICON[k]}" fill="${PART[k][1]}" fill-rule="${k === 'pelvis' ? 'evenodd' : 'nonzero'}"/></svg>`;
// d = 이번 − 기준, more/less = 기준보다 클 때/작을 때 말 (예: '더 굽혀짐' / '덜 굽혀짐')
const gapTxt = (d, more, less, unit = '°') => d == null || Number.isNaN(d) ? '-' : Math.round(d) === 0 ? '페리 기준과 같음' : `${Math.abs(Math.round(d))}${unit} ${d > 0 ? more : less}`;
function glance(rows, photo) {
  return `<div class="glance"><div class="ghead"><b>한눈에 보기</b><span class="sub">페리 기준과 차이</span></div>
    ${rows.map(({ part, what, big, now }) => `<div class="grow"><div class="gpart">${partIcon(part)}<span>${PART[part][0]} · ${what}</span></div><div class="gbig">${big}</div><div class="sub">${now}</div></div>`).join('')}
    <div class="sub" style="font-size:.75rem;margin-top:8px">${photo ? '그림 속 색칠한 곳이 그 부위예요. 위 사진에도 같은 그림 이름표를 붙였어요. ' : '그림 속 색칠한 곳이 그 부위예요. '}차이는 사실만 적었어요. 영상 각도는 약 3~5° 오차가 있고(Russo 2026), 원인 판단은 전문가에게.</div></div>`;
}
function lastSpeedRow() {                                                  // 영상엔 거리 기준(cm)이 없어 속도를 못 잼 → 센서·GPS로 잰 가장 최근 값을 같이 보여 줌
  const h = store.get('history', []).find(x => (x.activity ?? 'walk') === 'walk' && x.speed);
  const d = h && h.speed - 1.37;
  return h ? { part: 'step', what: '걷는 속도 (측정 탭 GPS)', big: Math.abs(d) < 0.005 ? '페리 기준과 같음' : `${Math.abs(d).toFixed(2)} m/s ${d > 0 ? '빠름' : '느림'}`, now: `${md(h.date)} 측정 ${h.speed.toFixed(2)} m/s · 페리의 보행 분석 성인 평균 1.37 m/s` }
    : { part: 'step', what: '걷는 속도', big: '-', now: '영상에는 거리 기준이 없어 속도를 못 재요. 측정 탭에서 GPS로 걸으면 여기 같이 보여요.' };
}
function glanceSide(r, photo) {
  const m = r.m, { sex } = store.get('profile', {}), norm = sex === 'm' ? 111 : sex === 'f' ? 117 : 113;
  return glance([
    { part: 'knee', what: '디딜 때 가장 펴진 각도', big: gapTxt(5 - m.kneeStanceMin, '더 펴짐', '덜 펴짐'), now: `이번 ${f0(m.kneeStanceMin)} · 페리의 보행 분석 기준 약 5°${m.kneeStanceMin < -4 ? ` · 0°보다 ${Math.round(-m.kneeStanceMin)}° 더 펴져 뒤로 젖혀짐` : ''}` },
    { part: 'knee', what: '발 디딜 때 굽힘(충격 흡수)', big: gapTxt(m.kneeLoad - 16, '더 굽혀짐', '덜 굽혀짐'), now: `이번 ${f0(m.kneeLoad)} · 페리의 보행 분석 기준 15~18°(가운데 16°와 비교)` },
    { part: 'knee', what: '발 들 때 굽힘', big: gapTxt(m.kneeSwingMax - 60, '더 굽혀짐', '덜 굽혀짐'), now: `이번 ${f0(m.kneeSwingMax)} · 페리의 보행 분석 기준 약 60°` },
    { part: 'thigh', what: '뒤로 젖혀진 각도', big: gapTxt(m.thighExt - 20, '더 젖혀짐', '덜 젖혀짐'), now: `이번 ${f0(m.thighExt)} · 페리의 보행 분석 기준 약 20° · 정확도 낮음` },
    { part: 'ankle', what: '발등 쪽 굽힘', big: gapTxt(m.ankleDF - 10, '더 굽혀짐', '덜 굽혀짐'), now: `이번 ${f0(m.ankleDF)} · 페리의 보행 분석 기준 약 10° · 정확도 낮음` },
    { part: 'step', what: '케이던스 (영상)', big: gapTxt(r.cadence - norm, '걸음/분 많음', '걸음/분 적음', ''), now: `이번 ${r.cadence.toFixed(0)}걸음/분 · 페리의 보행 분석 성인 평균 ${norm}` },
    lastSpeedRow()], photo);
}
// 골반 내려감 정도: 페리 기준 4° / 나 / 차이 (사용자 메모: '내려감'만 쓰면 헷갈림)
const dropTxt = a => a == null || Number.isNaN(a) ? '페리 기준 4° / 나 -' : (d => `페리 기준 4° / 나 ${Math.round(a)}°<br>차이 ${d > 0 ? '+' : ''}${d}°`)(Math.round(a) - 4);
function glanceFront(r, photo) {
  const m = r.m, t = m.tilt;
  const lr = (a, b, word) => a == null || b == null ? '-' : Math.round(a - b) === 0 ? '좌우 같음' : `${a > b ? '왼쪽' : '오른쪽'}이 ${Math.abs(Math.round(a - b))}° 더 ${word}`;
  return glance([
    { part: 'pelvis', what: '어느 쪽 골반이 높은지', big: t == null ? '-' : Math.round(t) === 0 ? '좌우 높이 같음' : `${t > 0 ? '오른쪽' : '왼쪽'}이 ${Math.abs(Math.round(t))}° 높음`, now: '걷는 동안 양쪽 엉덩이 점을 이은 선의 기울기(중앙값). 휴대폰이 기울게 찍히면 같이 기울어요' },
    { part: 'pelvis', what: '왼발 디딜 때 오른쪽 골반 내려감 정도', big: dropTxt(m.dropL), now: '한 발로 디딜 때 반대쪽 골반이 내려간 각도' },
    { part: 'pelvis', what: '오른발 디딜 때 왼쪽 골반 내려감 정도', big: dropTxt(m.dropR), now: '한 발로 디딜 때 반대쪽 골반이 내려간 각도' },
    { part: 'knee', what: '무릎 안쪽 모임', big: lr(m.valgusL, m.valgusR, '안쪽'), now: `왼 ${f0(m.valgusL)} · 오른 ${f0(m.valgusR)} · 페리의 보행 분석 기준값 없음` },
    { part: 'body', what: '몸통 옆 기울기', big: lr(m.leanL, m.leanR, '기욺').replace(/쪽이 (\d+)° 더/, '쪽으로 $1° 더'), now: `왼쪽으로 ${f0(m.leanL)} · 오른쪽으로 ${f0(m.leanR)}` },
    lastSpeedRow()], photo);
}
// 영상 사진 위 이름표: 옆 = 카메라 쪽 다리의 엉덩이(넓적다리)·무릎·발목, 앞·뒤 = 양쪽 골반·무릎
function videoMarks(r) {
  if (r.view === 'side') {
    const [hip, knee, ankle] = r.side === 'l' ? [23, 25, 27] : [24, 26, 28];
    return [[hip, 'thigh'], [knee, 'knee'], [ankle, 'ankle']].map(([i, part]) => ({ i, part, text: PART[part][0], color: PART[part][2] }));
  }
  const leftOnScreenLeft = r.view === 'back';                              // 뒤에서 찍으면 사람 왼쪽이 화면 왼쪽
  return [[23, '왼 골반', 'pelvis', leftOnScreenLeft], [24, '오른 골반', 'pelvis', !leftOnScreenLeft],
    [25, '왼 무릎', 'knee', leftOnScreenLeft], [26, '오른 무릎', 'knee', !leftOnScreenLeft]].map(([i, text, part, left]) => ({ i, text, part, color: PART[part][2], left }));
}

// 좌우 나란히 (본부 10/29): '왼 N / 오 N / 차이 N' — 판정 말 없이 숫자와 차이만
const lrTxt = (l, r, a = '왼', b = '오') => l == null && r == null ? '-' : `${a} ${f0(l)} / ${b} ${f0(r)}${l != null && r != null ? ` / 차이 ${Math.abs(Math.round(l) - Math.round(r))}°` : ''}`;
// 옆 영상: 카메라 쪽 다리 하나만 보여서, 반대쪽은 가장 최근의 반대쪽 옆 영상 값과 나란히. 디딤기·흔듦기 막대는 다리마다 (Perry 1장 표 1.1 약 60:40 선)
function sideLR(r) {
  const other = latestVid(v => v === 'side', x => x.side && x.side !== r.side && x.m ? x : null);
  const L = r.side === 'l' ? r : other, R = r.side === 'r' ? r : other, nm = s => s === 'l' ? '왼' : '오른';
  const bar = (x, s) => x?.m?.stancePct == null ? '' : `<div class="stside">${nm(s)}쪽 다리${x === r ? ' (이번 영상)' : ''}</div><div class="stbar" role="img" aria-label="디딤기 ${Math.round(x.m.stancePct)}%, 흔듦기 ${100 - Math.round(x.m.stancePct)}%"><b style="width:${x.m.stancePct.toFixed(1)}%">디딤기 ${Math.round(x.m.stancePct)}%</b><span>흔듦기 ${100 - Math.round(x.m.stancePct)}%</span><i style="left:60%"></i></div>`;
  const row = (label, k, unit) => { const l = L?.m?.[k], rr = R?.m?.[k], c = v => v == null || Number.isNaN(v) ? '-' : `${Math.round(v)}${unit}`;
    return `<tr><td>${label}</td><td>${c(l)}</td><td>${c(rr)}</td><td>${l != null && rr != null ? `${Math.abs(Math.round(l) - Math.round(rr))}${unit}` : '-'}</td></tr>`; };
  return metric({ title: '왼·오 나란히', value: r.m.stancePct != null ? `디딤기 ${Math.round(r.m.stancePct)}%` : '디딤기 값 없음(예전 영상)', unit: `${r.m.stancePct != null ? `흔듦기 ${100 - Math.round(r.m.stancePct)}% · ` : ''}${nm(r.side)}쪽 다리`, grade: 'n',
    body: bar(L, 'l') + bar(R, 'r') + `<div class="sub" style="font-size:.75rem;margin:4px 0 8px">세로선 = Perry 약 60:40 (보통 빠르기에서 62:38)</div>`
      + `<table class="lrtab"><tr><th></th><th>왼</th><th>오</th><th>차이</th></tr>${row('유각기 무릎 최대 굽힘', 'kneeSwingMax', '°')}${row('체중 받기 무릎 굽힘', 'kneeLoad', '°')}${row('디딤기 비율', 'stancePct', '%')}</table>`
      + `<div class="sub" style="font-size:.75rem;margin-top:6px">${other ? `${nm(other.side)}쪽 값은 가장 최근의 ${nm(other.side)}쪽 옆 영상이에요. 두 영상은 따로 찍어 걸음이 다를 수 있어요.` : `반대쪽(${nm(r.side === 'l' ? 'r' : 'l')}쪽)에서 옆모습을 찍으면 나란히 보여요.`}</div>`,
    why: ['옆 영상은 카메라 쪽 다리 하나만 잘 보여서, 왼·오는 각각 그쪽에서 찍은 영상으로 재요',
      '디딤기 = 첫 닿기(발이 엉덩이보다 가장 앞)부터 발가락 떼기(발끝이 엉덩이보다 가장 뒤)까지. 발가락 떼기를 이렇게 근사해서 실제보다 몇 % 길게 나올 수 있어요',
      'Perry 1장: 한 보행 주기에서 발이 닿아 있는 시간이 약 60%, 떠 있는 시간이 약 40%. 걷는 속도가 빠를수록 둘 다 짧아져요'],
    refs: ['perry1', 'perry9'], limit: '휴대폰 2D 영상의 디딤기 비율은 검증 연구를 찾지 못했어요. 같은 조건에서 찍은 영상끼리 비교해 보세요.' });
}
function renderVideo(r, dur) {
  let html = '';
  if (r.view === 'side') {
    const m = r.m;
    html += `<h2>영상 분석 결과 · 옆모습</h2><div class="sub">${r.side === 'l' ? '왼' : '오른'}쪽 다리(카메라 쪽) · 보행 주기 ${r.nCycles}개 평균 · 다리가 잡힌 장면 ${Math.round(r.validFrac * 100)}%</div>`;
    html += `<div class="metric"><div class="mhead"><div><b>페리의 보행 분석 기준 걸음과 나란히</b></div><span class="badge b-y">참고</span></div>${compareFigures(r.curves)}<div class="sub">무릎은 영상 오차 약 3~5°(참고), 넓적다리·발목은 정확도가 더 낮아요. 각도 값: ${REF.perry9}</div></div>`;
    html += glanceSide(r, dur != null);
    html += sideLR(r);
    html += metric({ title: '무릎 각도', value: f0(m.kneeSwingMax), unit: `유각기 최대 굽힘 (보행 주기 ${m.kneeSwingAt}%)`, grade: 'y',
      body: `${kneeChart(r.curves.knee)}<div class="calc">이번 값 / 페리의 보행 분석 기준<br>첫 닿기 ${f0(m.kneeIC)} / 0~5°<br>체중 받기 최대 ${f0(m.kneeLoad)} / 15~18°<br>입각기 최소 ${f0(m.kneeStanceMin)} / 약 5° ${extTxt(m.kneeStanceMin)}<br>유각기 최대 ${f0(m.kneeSwingMax)} / 약 60°(초기 유각)</div>`,
      why: ['무릎 각도 = 180° − (엉덩이·무릎·발목 세 점이 이루는 각). Perry 17장: 영상에서 가장 잘 잡히는 관절',
        'Russo 2026: 스마트폰 + 같은 종류의 자세 인식(MediaPipe)으로 무릎 굽힘 평균 오차 3.2~4.1°',
        'Wegner 2026: 무릎 곡선 모양은 잘 맞지만 정확한 절대 각도보다 같은 사람의 변화 추적에 알맞음',
        '첫 닿기는 "발이 엉덩이보다 가장 앞에 있는 순간"으로 근사해서 실제보다 몇 % 일찍 잡힐 수 있어요'],
      refs: ['perry9', 'perry17', 'russo2026', 'wegner2026'], cmp: { unit: '° (유각기 최대 굽힘)', fig: 'knee', rows: [{ ref: 60, mine: m.kneeSwingMax }] }, limit: '휴대폰 2D 영상이라 카메라 각도·거리에 따라 몇 도 달라질 수 있어요.' });
    html += metric({ title: '넓적다리 각도', value: f0(m.thighFlex), unit: `앞으로 최대 · 뒤로 최대 ${f0(m.thighExt)}`, grade: 'o',
      body: `<div class="calc">이번 값 / 페리의 보행 분석 기준<br>앞으로(굽힘) ${f0(m.thighFlex)} / 약 20°<br>뒤로(폄) ${f0(m.thighExt)} / 약 20°(말기 입각)</div>`,
      why: ['넓적다리 각도 = 수직선과 허벅지(엉덩이→무릎)가 이루는 각. 골반 움직임이 섞이지 않아 페리가 임상에서 권하는 지표',
        'Cheng 2025: 2D 영상의 엉덩관절 각도 오차는 5° 안쪽이지만, Wegner 2026에선 일치도가 낮았어요 → "부정확할 수 있음"'],
      refs: ['perry9', 'cheng2025', 'wegner2026'], limit: '휴대폰 2D 영상이라 카메라 각도·거리에 따라 몇 도 달라질 수 있어요.',
      cmp: { unit: '° (수직선 기준)', fig: 'thigh', rows: [{ label: '앞으로(굽힘)', ref: 20, mine: m.thighFlex }, { label: '뒤로(폄)', ref: 20, mine: m.thighExt }] } });
    html += metric({ title: '발목 각도', value: f0(m.ankleDF), unit: `입각기 최대 발등굽힘 · 최대 발바닥굽힘 ${f0(m.anklePF)}`, grade: 'o',
      body: `<div class="calc">이번 값 / 페리의 보행 분석 기준<br>발등굽힘 ${f0(m.ankleDF)} / 10°(말기 입각)<br>발바닥굽힘 ${f0(m.anklePF)} / 20°(유각 전)</div>`,
      why: ['발목 각도 = 정강이(무릎→발목)와 발(뒤꿈치→발끝) 사이 각도 − 90°',
        'Russo 2026, Cheng 2025: 영상의 발목 각도는 정확도가 낮음 → 참고만 하세요'],
      refs: ['perry9', 'russo2026', 'cheng2025'], limit: '휴대폰 2D 영상이라 카메라 각도·거리에 따라 몇 도 달라질 수 있어요.',
      cmp: { unit: '°', fig: 'ankle', rows: [{ label: '발등굽힘(말기 입각)', ref: 10, mine: m.ankleDF }, { label: '발바닥굽힘(유각 전)', ref: 20, mine: m.anklePF }] } });
    html += metric({ title: '영상으로 잰 케이던스', value: r.cadence.toFixed(0), unit: '걸음/분', grade: 'y',
      why: ['보행 주기 시간으로 계산(케이던스 = 120 ÷ 주기 초)', 'Wegner 2026: 2D 영상의 케이던스는 기준 장비와 일치도 높음(ICC 0.74~0.95 범위)'], refs: ['wegner2026', 'perry20'],
      cmp: { unit: '걸음/분', rows: [{ ref: (({ sex }) => sex === 'm' ? 111 : sex === 'f' ? 117 : 113)(store.get('profile', {})), mine: r.cadence }] } });
  } else {
    const m = r.m, side = r.view === 'front' ? '앞모습' : '뒷모습';
    const diff = (a, b) => a != null && b != null ? `좌우 차이 ${Math.abs(a - b).toFixed(0)}°` : '';
    html += `<h2>영상 분석 결과 · ${side}</h2><div class="sub">몸이 잡힌 장면 ${Math.round(r.validFrac * 100)}% · 앞·뒤 각도는 휴대폰 영상으로 검증된 연구를 찾지 못했어요. 골반 값은 다른 도구 연구에서 기준 장비와 차이가 커서 "부정확할 수 있음", 나머지는 "검증 안 됨"이에요. 같은 조건으로 찍어 좌우 비교·변화 추적에 쓰세요.</div>`;
    html += `<div class="metric"><div class="mhead"><div><b>페리의 보행 분석 기준 걸음과 나란히</b></div><span class="badge b-y">참고</span></div>${compareFigures(null, m, r.view, r.fc)}<div class="sub">앞·뒤 각도는 휴대폰 영상으로 검증된 연구를 찾지 못했어요. 페리의 보행 분석 기준 값: 골반 내려감 약 4°(체중 받기), 몸통·무릎은 기준값 없음. ${REF.perry9}</div></div>`;
    html += glanceFront(r, dur != null);
    html += metric({ title: '골반 내려감 정도 (반대쪽)', value: lrTxt(m.dropL, m.dropR), unit: '왼발 디딜 때 / 오른발 디딜 때', grade: 'o',
      body: `<div class="calc">한 발로 디딜 때 반대쪽 골반이 내려간 각도 (상위 10% 값)<br>${diff(m.dropL, m.dropR)}<br>페리의 보행 분석 기준: 체중 받기 때 반대쪽 골반 약 4°, 엉덩이 벌림근이 5° 이하로 제한</div>`,
      why: ['양쪽 엉덩이 점을 잇는 선이 수평에서 기운 각도', '입각기 다리는 "발목이 화면에서 더 아래에 있는 다리"로 근사', '뒤에서 찍은 영상의 골반 각도는 연구에서 기준 장비(VICON)와 차이가 컸어요(다른 자세 인식 도구 OpenPose로 한 연구)'], refs: ['perry9', 'ota2021'], limit: '휴대폰 2D 영상이라 카메라 각도·거리에 따라 몇 도 달라질 수 있어요.',
      cmp: { unit: '°', fig: 'pelvis', rows: [{ label: '왼발 디딜 때', ref: 4, mine: m.dropL }, { label: '오른발 디딜 때', ref: 4, mine: m.dropR }] } });
    html += metric({ title: '무릎 안쪽 모임', value: lrTxt(m.valgusL, m.valgusR), unit: '', grade: 'n',
      body: `<div class="calc">디딜 때 무릎이 엉덩이-발목 선보다 안쪽(+)·바깥쪽(−)으로 간 각도 (상위 10% 값)<br>${diff(m.valgusL, m.valgusR)}</div>`,
      why: ['페리의 책에는 이 각도의 영상 기준값이 없어요 → 기준값 없이 좌우만 비교', 'Perry 17장: 다리가 돌아가 있으면 카메라 1대의 각도는 실제와 달라질 수 있어요'], refs: ['perry17'] });
    html += metric({ title: '몸통 옆 기울기', value: lrTxt(m.leanL, m.leanR, '왼쪽으로', '오른쪽으로'), unit: '', grade: 'n',
      body: `<div class="calc">어깨 가운데와 엉덩이 가운데를 잇는 선이 수직에서 기운 각도 (상위 10% 값)</div>`, why: ['휴대폰 2D 영상의 정확도 연구는 찾지 못함'], refs: [] });
    html += metric({ title: '걸음 폭', value: m.width != null ? `골반 너비의 ${m.width.toFixed(2)}배` : '-', unit: '', grade: 'n',
      body: `<div class="sub">두 발목 사이 가로 거리 ÷ 양쪽 엉덩이 점 사이 거리 (중앙값). 참고: Neumann 15장 성인 걸음 폭 8~10cm</div>`,
      why: ['영상에는 cm 기준이 없어서 골반 너비에 대한 비율로만 보여 줘요'], refs: ['neumann15'] });
  }
  html += recSection(videoRecs(r), '레퍼런스로 본 걷는 법') + condHtml(r) + READ_GUIDE;
  html += `<div class="sub" style="margin-top:12px">이 결과는 의료 진단이 아니에요. 걸음이 걱정되면 전문가와 상담하세요. 영상은 저장되지 않았어요(계산된 숫자만 지난 기록에 남아요).</div>`;
  showV(html);
}

// ── 데모 (주소 끝에 ?demo=1): 휴대폰 없이 화면 확인용 가짜 신호 ──
if (new URLSearchParams(location.search).has('demo')) {
  window.__v = { renderVideo, analyzeSide, analyzeFrontal, makeCard };   // 영상 결과 화면 점검용
  $('demo').classList.remove('hidden');
  $('demo').addEventListener('click', () => {
    // 걷기 108, 러닝 165, 슬로우 러닝은 1분마다 조깅 165 / 걷기 110을 번갈아. 자동은 주소의 ?demo=walk|run (없으면 슬로우 러닝 신호)
    const sel = $('act').value, want = new URLSearchParams(location.search).get('demo');
    const act = sel === 'auto' ? (['walk', 'run'].includes(want) ? want : 'slowrun') : sel;
    const walkS = act === 'slowrun' ? 240 : 75, s = [], g = [];
    const cadAt = t => act === 'walk' ? 108 : act === 'slowrun' ? (Math.floor(t / 60) % 2 ? 110 : 165) : 165;
    let kk = 0;
    for (let i = 0; i < (walkS + 6) * 60; i++) {
      const t = i / 60, walking = t > 3 && t < 3 + walkS;
      if (walking) kk += cadAt(t - 3) / 60 / 60;
      const k = kk;
      const ph = k - Math.floor(k);
      const amp = walking && cadAt(t - 3) >= RUN_CAD ? 4 : 1;                // 달리기는 흔들림이 큼 (자동 구분 확인용)
      const a = 9.81 + (walking ? amp * ((Math.floor(k) % 2 ? 0.4 : 3.2) * Math.exp(-(((ph - .15) / .07) ** 2)) + 2 * Math.sin(Math.PI * k)) : 0) + (Math.random() - .5) * .3;
      s.push({ t: t * 1000, x: 0, y: a, z: 0 });
    }
    for (let t = 0; t <= walkS + 6; t++) {                                  // 1.3 m/s로 북쪽, 오차 ±5m
      const north = Math.min(Math.max(t - 3, 0), walkS) * 1.3 + (Math.random() - .5) * 10;
      g.push({ t: t * 1000, lat: 37.5 + north / 111320, lon: 127 + (Math.random() - .5) * 10 / 88300, acc: 6 });
    }
    finish(s, true, g);
  });
}

// ── 하루 걸음 수: 설치형 앱에서 헬스 커넥트(삼성헬스 등이 저장한 걸음 수)를 읽음, 휴대폰 밖으로 안 보냄 ──
const HS = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins.HealthSteps : null;
var stepsByDay = {}, sleepByDay = {}, stepsState = null;   // var: 달력이 먼저 그려져도 오류 없이 빈 값으로 보임
async function loadSteps() {
  if (!HS) return;
  try {
    stepsState = await HS.status();
    const y = calMonth.getFullYear(), mo = calMonth.getMonth(), today = new Date(), last = new Date(y, mo + 1, 7);   // 달력에 보이는 다음 달 첫 주까지
    const from = dayKey(monOf(new Date(y, mo, 1))), to = dayKey(last < today ? last : today);
    if (from <= to) {                                                       // 다음 달처럼 아직 안 온 날만 보이면 묻지 않음
      if (stepsState.granted) for (const d of (await HS.daily({ from, to })).days) stepsByDay[d.date] = d.steps;
      if (stepsState.sleep) for (const d of (await HS.sleepDaily({ from, to })).days) sleepByDay[d.date] = d.min;
    }
  } catch (e) { stepsState = { ...stepsState, error: String(e?.message || e) }; }
  renderSteps();
  if (document.body.dataset.tab === 'home') { renderWeek(); renderHomeTop(); }
}
function renderSteps() {
  if (!HS) return;                                                         // 웹앱(아이폰 포함)은 카드를 숨김
  $('stepsCard').hidden = false;
  const s = stepsState;
  if (!s) return ($('steps').innerHTML = '<div class="sub">불러오는 중…</div>');
  if (s.error) return ($('steps').innerHTML = `<div class="sub">걸음 수를 읽지 못했어요. (${s.error})</div>`);
  if (!s.available) return ($('steps').innerHTML = `<div class="sub">${s.needsUpdate ? '헬스 커넥트 앱을 플레이스토어에서 업데이트하면' : '이 휴대폰에서는 헬스 커넥트를 쓸 수 없어서'} 걸음 수를 가져올 수 없어요.</div>`);
  const ask = `<button id="stepsOk">헬스 커넥트 연결하기</button>`;
  if (!s.granted && !s.sleep && !s.heart) return ($('steps').innerHTML = `<div class="sub">삼성헬스(갤럭시 워치 포함) 등이 헬스 커넥트(안드로이드의 건강 데이터 창구)에 저장한 걸음 수·수면·심박수를 읽어 와요. 휴대폰 안에서만 쓰고 운영자에게 보내지 않아요.</div>${ask}`);
  const n = stepsByDay[dayKey(new Date())] ?? 0, sl = sleepByDay[dayKey(new Date())];
  const missing = [!s.granted && '걸음 수', !s.sleep && '수면', !s.heart && '심박수'].filter(Boolean);
  const week = Array.from({ length: 7 }, (_, k) => stepsByDay[dayKey(plusDays(new Date(), k - 6))] ?? 0);
  $('steps').innerHTML = (!s.granted ? '' : `<div class="mcard static"><div class="mtop"><span class="mlab">걸음 수</span><span class="mdate">오늘</span></div>
      <div class="mrow"><div class="mnum">${n.toLocaleString()}<small>걸음</small></div>${weekBars(week, 'var(--c-walk)')}</div>
      <div class="bar"><i style="width:${Math.min(100, n / 70)}%"></i></div>
      <div class="msub" style="margin-top:0">7,000걸음 대비 ${Math.round(n / 70)}% · Ding 2025 · 헬스 커넥트</div>
      <details class="msub"><summary>근거 보기</summary>Ding 2025 메타분석: 하루 2,000걸음 대비 7,000걸음에서 전체 사망 위험 47% 낮음. 관찰 연구라 인과관계는 아니고, 목표 처방도 아니에요. 계속 0이면 삼성헬스 → 설정 → 헬스 커넥트에서 걸음 수 공유를 켜 주세요.</details></div>`)
    + (s.sleep && sl ? mcard({ label: '수면', color: 'var(--c-video)', date: '지난밤', value: sl ? `${Math.floor(sl / 60)}<small>시간</small> ${sl % 60}` : null, unit: '분', sub: sl ? '워치·삼성헬스 기록 · 판정하지 않아요' : '워치를 차고 자면 기록돼요' }).replace('<button class="mcard"', '<div class="mcard static"').replace(/<\/button>$/, '</div>') : '')
    + (missing.length ? `<div class="msub" style="margin-top:8px">${missing.join('·')} 권한이 꺼져 있어요.</div>${ask}` : '');
}
$('steps').addEventListener('click', async e => { if (e.target.id === 'stepsOk' && await permIntro('introHC', ...INTRO_HC)) { try { await HS.request(); } catch {} loadSteps(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadSteps(); scheduleReminders(); } });

// ── 알아보기: 앱이 이미 쓰는 근거 문장을 주제별로 모음 (새 숫자 없음) ──
const LEARN = [
  ['케이던스는 무엇을 보여 주나요?', ['1분 동안 걷거나 달린 걸음 수예요. 발이 땅에 닿는 횟수를 세요.', 'Perry 20장: 성인 평균 113걸음/분 (남 111 / 여 117)', 'CADENCE-Adults(21~60세): 100걸음/분 ≈ 3 MET(중강도), 130 ≈ 6 MET(고강도)', 'CADENCE-Adults(61~85세): 100걸음/분 ≈ 3 MET(중강도), 110 ≈ 4 MET, 120 ≈ 5 MET'], '', ['perry20', 'cadenceAdults']],
  ['하루 7,000걸음', ['Ding 2025 메타분석(57개 연구): 하루 2,000걸음 대비 7,000걸음에서 전체 사망 위험 47% 낮음, 낙상 28%·치매 38% 낮음', '사망·낙상 등은 약 5,000~7,000걸음 이후 이득이 완만해짐'], '관찰 연구라 인과관계는 아님', ['ding2025']],
  ['러닝 케이던스를 5~10% 올린 연구', ['Heiderscheit 2011(취미 러너 45명, 같은 속도): +5%에서 무릎이 흡수하는 에너지 감소, +10%에서 엉덩관절 흡수와 엉덩관절 모음 각도·모멘트도 감소. 한걸음 길이·몸의 위아래 움직임·제동충격량·무릎 굽힘 정점 감소', 'Neumann 16장(책 p.795): 케이던스 10% 증가 → 입각기 무릎넙다리관절 힘 정점 14% 감소', 'Petri 2026 우산 고찰: 연구들의 주된 방법 = 케이던스 5~10%를 점진적으로 올리고 소리·화면 피드백을 서서히 줄이기'], 'Anderson 2022 메타분석: 손상 예방 효과는 아직 근거 부족. 대부분 단기 연구', ['heiderscheit', 'neumann16', 'petri2026', 'anderson2022']],
  ['느리게 달려도 될까요?', ['Lee 2014(55,137명, 평균 15년): 하루 5~10분, 시속 9.7km 미만으로 달려도 달리지 않는 사람보다 전체 사망 30%, 심혈관 사망 45% 낮음', 'Pedisic 2020 메타분석(232,149명): 달리기 참여 시 전체 사망 27% 낮음. 빈도·시간·속도·총량이 늘어도 추가 이득은 확인되지 않음'], '관찰 연구라 인과관계는 아님', ['lee2014', 'pedisic2019']],
  ['슬로우 러닝 (조깅 1분 + 걷기 1분)', ['Ikenaga 2017 무작위 연구(평균 70.8세, 81명): 걷기 속도의 조깅 1분 + 걷기 1분 반복, 주 90분 조깅 + 90분 걷기를 12주', '결과: 무산소역치(지구력) +15.7%(대조군 +4.9%), 앉았다 일어서기 +12.9%(대조군 +4.5%), 허벅지 근육 속 지방 감소'], '노인 대상 12주 소규모 연구', ['ikenaga2017']],
  ['영상으로 본 무릎 각도', ['Perry 4·5장: 초기 유각에 무릎이 약 60° 굽혀져야 발끝이 바닥에 걸리지 않음. 이 굽힘은 거의 근육 없이 관성으로 만들어짐', 'Perry 4장: 발이 닿고 0.02초 만에 체중 60%가 실림. 무릎 약 15° 굽힘으로 충격을 흡수', 'Perry 17장: 다리가 돌아가 있으면 카메라 1대의 각도는 실제와 달라질 수 있어요'], '휴대폰 카메라 1대의 각도는 참고값', ['perry9', 'perry17']],
  ['발이 굴러가는 흔들의자 3개', ['Perry 4장: 한 발이 땅을 딛는 동안 몸이 굴러가는 축이 3번 바뀌어요. 흔들의자 다리처럼 둥근 곳을 축으로 몸이 앞으로 굴러가서 덜컹거리지 않고 부드럽게 나아가요', '① 뒤꿈치 흔들의자(체중 받기): 뒤꿈치를 축으로 발바닥이 내려와요. 정강이 앞 근육이 발이 "탁" 떨어지지 않게 천천히 내려놓아요', '② 발목 흔들의자(중간 입각): 발은 바닥에 붙은 채 정강이가 앞으로 기울어요. 가자미근이 너무 빨리 넘어가지 않게 속도를 조절해요', '③ 앞발 흔들의자(말기 입각): 발가락 뿌리를 축으로 뒤꿈치가 들려요. 몸이 받침 밖으로 앞으로 떨어지며 걸음에서 가장 강한 추진력이 생겨요. 비복근·가자미근은 정강이가 너무 빨리 넘어가지 않게 늦춰요'], '영상의 발목 각도는 정확도가 낮아서 흔들의자를 직접 재지는 않아요', ['perry3', 'perry4']],
  ['걸음이 달라지는 원인 (교육용)', ['Perry 10장: 병은 달라도 걸음에 주는 영향은 몇 가지로 나뉘어요 — 관절 변형(굳음), 근력 약화, 감각 소실, 통증, 운동 조절 장애', '근력 약화: 감각과 조절이 괜찮으면 다른 동작으로 아주 잘 보완해요. 느리게 걷는 것도 보완 방법이에요', '감각 소실: 관절 위치를 잘 몰라서 무릎을 잠그거나 바닥을 세게 디디며 느리고 조심스럽게 걸어요', '통증: 관절이 부으면 압력이 가장 낮은 자세(무릎 굽힘 30~45° 등)로 굳어요'], '이 앱은 원인을 판단하지 않아요. 내 걸음이 어떤 경우인지는 전문가가 직접 봐야 알 수 있어요', ['perry10']],
];
$('learn').innerHTML = LEARN.map(([t, facts, limit, refs]) => `<details style="margin-top:10px"><summary>${t}</summary><ul class="sub" style="padding-left:18px;margin:6px 0">${facts.map(f => `<li>${f}</li>`).join('')}</ul>${limit ? `<div class="sub">한계: ${limit}</div>` : ''}<div class="sub" style="font-size:.75rem;margin-top:4px">출처: ${refs.map(k => REF[k]).join(' / ')}</div></details>`).join('');
markTerms($('learn'));
// ── 지표 사전: 앱 숫자의 뜻과 왜 보는지만 (연구 숫자는 '알아보기', 재는 방법은 '처음 쓰는 법'). 누르면 옆으로 넘기는 설명 카드 ──
const DICT = [
  { part: 'step', name: '케이던스', short: '1분 걸음 수', mean: '1분 동안 걸은 걸음 수예요. 휴대폰이 발이 땅에 닿는 흔들림을 세요.',
    why: '걷는 리듬을 숫자 하나로 보여 줘요. 같은 조건에서 여러 번 재면 변화가 보여요.', where: '홈 · 측정 결과 · 걸음걸이 탭(영상)' },
  { part: 'step', name: '걷기 속도', short: '1초에 가는 거리', mean: '1초 동안 걸어간 거리(m)예요. GPS나 직접 넣은 거리를 걸은 시간으로 나눠요.',
    why: '같은 길을 같은 방식으로 재면 내 걷는 속도가 어떻게 달라지는지 볼 수 있어요.', where: '홈 · 측정 결과(GPS나 거리 입력)' },
  { part: 'knee', name: '무릎 각도', short: '발 보낼 때 굽힘', mean: '발이 땅에서 떨어져 앞으로 갈 때(유각기) 무릎이 가장 많이 굽혀진 각도예요.',
    why: '발을 앞으로 보낼 때 무릎을 얼마나 굽히는지 숫자로 봐요. 페리의 보행 분석 기준과 나란히 볼 수 있어요.', where: '홈 · 걸음걸이 탭(옆모습 영상)' },
  { part: 'thigh', name: '넓적다리 각도', short: '허벅지 앞뒤 기울기', mean: '허벅지가 수직선에서 앞(굽힘)이나 뒤(폄)로 기운 각도예요.',
    why: '걸을 때 다리를 앞뒤로 얼마나 보내는지 봐요.', where: '걸음걸이 탭(옆모습 영상)' },
  { part: 'ankle', name: '발목 각도', short: '발끝 올리고 내리기', mean: '정강이와 발 사이 각도예요. 발끝이 정강이 쪽으로 올라가면 발등굽힘, 내려가면 발바닥굽힘이에요.',
    why: '발을 디디고 뗄 때 발목이 얼마나 움직이는지 봐요.', where: '걸음걸이 탭(옆모습 영상)' },
  { part: 'pelvis', name: '골반 내려감 정도', short: '좌우 높이 차이', mean: '한 발로 디딜 때 반대쪽 골반이 수평에서 내려간 각도예요.',
    why: '왼발로 디딜 때와 오른발로 디딜 때를 나란히 놓고 비교해요.', where: '걸음걸이 탭(앞·뒤모습 영상)' },
  { part: 'knee', name: '무릎 안쪽 모임', short: '디딜 때 무릎 방향', mean: '디딜 때 무릎이 엉덩이와 발목을 잇는 선보다 안쪽(+)이나 바깥쪽(−)으로 간 각도예요.',
    why: '왼쪽과 오른쪽을 비교해 봐요. 이 각도는 페리의 보행 분석 기준값이 없어요.', where: '걸음걸이 탭(앞·뒤모습 영상)' },
];
$('dict').innerHTML = DICT.map((d, i) => `<button class="dayrec" data-di="${i}"><span style="white-space:nowrap">${d.name}</span><span class="sub" style="text-align:right">${d.short} ›</span></button>`).join('');
$('dict').addEventListener('click', e => { const b = e.target.closest('[data-di]'); if (b) openDict(+b.dataset.di); });
// ── 해 볼 만한 프로그램: 연구에서 쓴 방식으로 바로 측정 화면 열기 (처방·목표가 아님) ──
const PROGS = [
  { act: 'slowrun', name: '슬로우 러닝', badges: ['처음', '1분씩 번갈아'], text: '조깅 1분 + 걷기 1분을 번갈아 해요 · Ikenaga 2017 연구 방식' },
  { act: 'cooper', name: '12분 달리기 기록', badges: ['한 번'], text: '12분 동안 간 거리와 페이스만 재요' },
  { act: 'video', name: '10초 걸음걸이 영상', badges: ['10초'], text: '옆모습을 찍어 페리의 보행 분석 기준과 나란히 봐요' },
];
$('progs').innerHTML = PROGS.map((p, i) => `<button class="dayrec" data-pi="${i}" style="flex-direction:column;align-items:flex-start;gap:4px">
  <span><b>${p.name}</b> ${p.badges.map(b => `<span class="badge b-n">${b}</span>`).join(' ')}</span><span class="sub">${p.text} ›</span></button>`).join('');
$('progs').addEventListener('click', e => {
  const b = e.target.closest('[data-pi]'); if (!b) return;
  const { act } = PROGS[+b.dataset.pi];
  if (act === 'video') return (setTab('video'), scrollTo(0, 0));
  $('act').value = act; store.set('act', act); showAct(); showSetSum(); setTab('measure'); $('start').scrollIntoView({ block: 'center' });
});
function openDict(start) {
  const o = document.createElement('div');
  o.id = 'dictOv'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', '지표 사전');
  o.innerHTML = `<div class="dsheet"><div class="dtrack">${DICT.map(d => `<section class="dcard">${partIcon(d.part)}<h3>${d.name}</h3><p>${d.mean}</p>
      <b>왜 보나요?</b><p>${d.why}</p><b>어디서 보나요?</b><p>${d.where}</p></section>`).join('')}</div>
    <div class="ddots" aria-hidden="true">${DICT.map(() => '<i></i>').join('')}</div>
    <div class="drow"><button class="ghost" data-dx="skip">건너뛰기</button><button data-dx="next">다음</button></div>
    <div class="sr" aria-live="polite"></div></div>`;
  document.body.append(o);
  for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = true;      // 열린 동안 Tab이 뒤 화면으로 빠지지 않게
  const tr = o.querySelector('.dtrack'), cur = () => Math.round(tr.scrollLeft / tr.clientWidth), last = DICT.length - 1;
  let shown = -1;
  const sync = () => {
    const c = cur(); if (c === shown) return; shown = c;
    o.querySelectorAll('.ddots i').forEach((e, k) => e.classList.toggle('on', k === c));
    o.querySelectorAll('.dcard').forEach((e, k) => { e.inert = k !== c; });             // 화면낭독은 지금 카드만 읽음
    o.querySelector('.sr').textContent = `${c + 1}/${DICT.length} ${DICT[c].name}`;
    o.querySelector('[data-dx=next]').textContent = c === last ? '닫기' : '다음';
  };
  const close = () => { for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = false; o.remove(); $('dict').querySelector(`[data-di="${start}"]`)?.focus(); };
  tr.scrollLeft = start * tr.clientWidth; sync();
  tr.addEventListener('scroll', sync, { passive: true });
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-dx]');
    if (e.target === o || b?.dataset.dx === 'skip' || (b?.dataset.dx === 'next' && cur() === last)) return close();
    if (b) { const n = cur() + 1; tr.scrollTo({ left: n * tr.clientWidth, behavior: 'smooth' }); setTimeout(sync, 400); }   // scroll 이벤트가 안 와도 표시가 따라오게
  });
  o.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  o.querySelector('[data-dx=next]').focus();
}

// ── 측정 알림: 고른 요일·시간에 이번 주 기록 알림 (설치형 앱, 앱을 열거나 기록할 때마다 숫자를 새로 넣어 다시 예약) ──
const LN = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins.LocalNotifications : null;
const WDAYS = ['일', '월', '화', '수', '목', '금', '토'];                     // 알림 요일 번호: 1 = 일요일 … 7 = 토요일
async function scheduleReminders() {
  if (!LN) return;
  const r = store.get('remind', { days: [], time: '19:00' });
  try {
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    if (!r.days.length) return;
    const { cur } = weekSummary(store.get('history', [])), [hour, minute] = r.time.split(':').map(Number);
    const body = `이번 주 측정 ${cur.n}회 · 슬로우 조깅 ${weekSlowJogMin(store.get('history', [])).toFixed(0)}/90분 (앱을 마지막으로 연 때 기준)`;
    await LN.schedule({ notifications: r.days.map(d => ({ id: 100 + d, title: '스텝미러', body, schedule: { on: { weekday: d, hour, minute }, allowWhileIdle: true } })) });
  } catch (e) { $('remindNote').textContent = `알림을 예약하지 못했어요. (${e?.message || e})`; }
}
function renderRemind() {
  if (!LN) return;
  $('remindCard').hidden = false;
  const r = store.get('remind', { days: [], time: '19:00' });
  $('remindDays').innerHTML = [2, 3, 4, 5, 6, 7, 1].map(d => `<button class="chip" data-d="${d}" aria-pressed="${r.days.includes(d)}">${WDAYS[d - 1]}</button>`).join('');
  $('remindTime').value = r.time;
  $('remindNote').textContent = r.days.length ? `${[2, 3, 4, 5, 6, 7, 1].filter(d => r.days.includes(d)).map(d => WDAYS[d - 1]).join('·')}요일 ${r.time}에 알려 줘요.` : '알림이 꺼져 있어요. 요일을 고르고 저장하세요.';
}
$('remindDays').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); });
$('remindSave').addEventListener('click', async () => {
  const days = [...$('remindDays').querySelectorAll('.chip[aria-pressed="true"]')].map(b => +b.dataset.d);
  if (days.length) { const p = await LN.requestPermissions().catch(() => ({})); if (p.display !== 'granted') return alert('알림 권한을 허용해야 알림을 보낼 수 있어요.'); }
  store.set('remind', { days, time: $('remindTime').value || '19:00' });
  renderRemind(); scheduleReminders();
});
renderRemind();
loadSteps();
// ── 홈 위쪽 '한 달에 한 번, 내 걸음 거울' (디자인 팀 시안 C 수정본, 사용자 10/28): 거울 카드 · 한 달 점검 · 걸음 수업/오늘 걸음 ──
const SHOOT_NOTE = { perry: '옆에서 평소처럼 걷는 모습을 찍어요. 결과에서 페리의 보행 분석 기준 뼈대와 나란히 보여요.',
  shoes: '신기 전과 신은 뒤 한 번씩 찍어요. 같은 곳에서 같은 거리를 걸으면 비교하기 쉬워요.',
  run: '옆에서 천천히 달리는 모습을 찍어요. 페리의 보행 분석 기준은 걷기 기준이라 달리기 값은 내 기록끼리 비교해요.' };
function goShoot(note, open) {                                             // 걸음걸이 탭 촬영 화면, 옆모습으로
  $('vview').value = 'side'; store.set('vview', 'side'); showVGuide(); syncPicks();
  if (note) $('vguide').insertAdjacentHTML('afterbegin', `<li><b>${SHOOT_NOTE[note]}</b></li>`);
  setTab('video');
  const d = open && $(open); if (d) d.open = true;
  (d || $('vsetup')).scrollIntoView({ block: 'start' });
}
const vids = () => store.get('history', []).map((h, i) => ({ h, i, d: new Date(h.date) })).filter(x => x.h.activity === 'video' && !Number.isNaN(+x.d));
let mirrorCurves = null;                                                   // 홈 그림의 내 옆 곡선 (renderHomeTop에서 한 번만 읽음 — 매 프레임 기록 전체를 읽지 않게, 검수팀)
function mirrorSvg(q) {                                                    // 걸음걸이 탭 옆 보기 그림을 작게 (말풍선 없이), 내 옆 영상이 없으면 점선 사람
  const side = mirrorCurves, keep = cmpCurves;
  cmpCurves = side;                                                        // angAt이 읽는 곡선을 잠깐 바꿨다 되돌림 (걸음걸이 탭 카드 값은 그대로)
  const me = side ? sideFig(198, 'me', q, false) : `<g fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" opacity=".35"><circle cx="198" cy="52" r="10"/><path d="M198 64v40M198 104l-10 60M198 104l10 60M198 74l-14 22M198 74l14 22"/></g>`;
  const svg = `<svg viewBox="52 30 196 156" role="img" aria-label="페리의 보행 분석 기준 뼈대와 내 뼈대가 나란히 걷는 그림">${BONE_DEFS}${floorLines}${sideFig(102, 'perry', q, false)}${me}</svg>`;
  cmpCurves = keep; return svg;
}
let mirrorQ = 0, mirrorLast = 0, mirrorRaf = 0;
function mirrorLoop(now) {
  const box = $('mirrorFig');
  if (!box?.offsetParent) { mirrorRaf = 0; return; }                       // 홈이 안 보이면 멈춤
  mirrorRaf = requestAnimationFrame(mirrorLoop);
  if (mirrorLast && now - mirrorLast < 40) return;                         // 초당 약 25번만 다시 그림 (저사양 폰 배터리·발열)
  mirrorQ = (mirrorQ + (now - (mirrorLast || now)) / CMP_T * 100) % 100; mirrorLast = now;
  box.innerHTML = mirrorSvg(mirrorQ);
}
function renderHomeTop() {
  mirrorCurves = latestVid(v => v === 'side', r => r.curves);
  const v = vids(), today = new Date(), mon = [3, 2, 1, 0].map(k => new Date(today.getFullYear(), today.getMonth() - k, 1));
  const sameM = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const last = v[0], left = last ? Math.ceil((+last.d + 30 * 864e5 - +today) / 864e5) : null;
  const prev = last && (v.find(x => !sameM(x.d, last.d)) ?? v[1]);
  const pair = prev ? (sameM(prev.d, last.d) ? '최근 두 영상' : `${prev.d.getMonth() + 1}월과 ${last.d.getMonth() + 1}월`) : '';
  $('homeTop').innerHTML = `<div class="card mirror">
      <div id="mirrorFig">${mirrorSvg(mirrorQ || phaseMid(1))}</div>
      <div class="mlabs"><span>페리의 보행 분석 기준</span><span>나</span></div>
      <button data-shoot="" class="mshoot"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/></svg>내 걸음 비춰 보기</button>
      <div class="mrows"><button data-shoot="perry">페리 기준과 비교<span>›</span></button><button data-shoot="shoes">새 신발 전후<span>›</span></button><button data-shoot="run">달릴 때 무릎<span>›</span></button></div>
      <div class="mfoot"><span class="sub">혼자 찍기 어렵다면</span><span><a href="#" data-open="vSolo">폰 세우는 법</a> · <a href="#" data-open="vHelper">가족이 찍어 주기</a></span></div></div>
    <div class="card"><div class="chk"><div class="mdots" aria-label="최근 4개월 영상 점검">${mon.map(m => `<div><i class="${v.some(x => sameM(x.d, m)) ? 'on' : ''}"></i>${m.getMonth() + 1}월</div>`).join('')}</div>
      <div class="chkLeft">${!last ? '첫 점검을 해 보세요' : left > 0 ? `${left}일 남음` : '점검할 때예요'}</div></div>
      <div class="sub" style="margin-top:6px">한 달에 한 번, 옆모습 영상으로 내 걸음을 비춰 봐요${last ? ` · 마지막 ${last.d.getMonth() + 1}월 ${last.d.getDate()}일` : ''}</div>
      ${pair ? `<a href="#" class="textlike" style="text-align:left;padding:8px 0 0;text-decoration:none" data-pair="${prev.i},${last.i}">${pair} 나란히 보기 ›</a>` : ''}</div>
`;
  $('lessonCard').innerHTML = `<button class="mcard" data-lesson><div class="mtop"><span class="mlab">걸음 수업 · 30초</span><span class="mdate">›</span></div><div style="font-weight:700;margin-top:6px">발이 굴러가는 흔들의자 3개</div><div class="msub">근육 그림으로 보는 한 걸음</div></button>`;   // 그림과 같은 주제로 고정 (디자인 팀 10/28, 날마다 바뀌던 사전 항목은 뺌)
  // 이번 주 카드: 월~일 그날 활동 색 점 + 측정 횟수 · 걷기 케이던스 평균 (달력과 같은 점 색)
  const mon0 = monOf(today), hist = store.get('history', []), tk = dayKey(today), cur = weekSummary(hist).cur;
  $('wkDots').innerHTML = ['월', '화', '수', '목', '금', '토', '일'].map((wd, k) => { const dk = dayKey(plusDays(mon0, k)), acts = [...new Set(hist.filter(h => dayKey(h.date) === dk).map(h => { const a = h.activity ?? 'walk'; return a === 'cooper' || a === 'easyrun' ? 'run' : a === 'stairs' ? 'walk' : a; }))];
    return `<div class="${dk === tk ? 'today' : ''}">${wd}<i>${acts.map(a => `<b style="background:${ACT_C[a] ?? ACT_C.run}"></b>`).join('')}</i></div>`; }).join('');
  $('wkLine').textContent = `측정 ${cur.n}회${cur.walkCad != null ? ` · 걷기 케이던스 평균 ${Math.round(cur.walkCad)}` : ''}`;
  if (!mirrorRaf && !matchMedia('(prefers-reduced-motion: reduce)').matches) { mirrorLast = 0; mirrorRaf = requestAnimationFrame(mirrorLoop); }
  learnFigStart();
}
// 하위 화면(달력과 통계·배우기·프로그램과 알림): 오른쪽에서 밀려 들어옴, ‹·브라우저/휴대폰 뒤로 가기로 홈
var subOpen = null;   // var: setTab·gaitBack이 먼저 불려도 오류 없이
function openSub(id) {
  const el = $(id); subOpen = id; el.hidden = false; el.scrollTop = 0;
  void el.offsetWidth; el.classList.add('in');                            // 보이게 한 뒤 한 번 배치를 계산해야 밀려 들어오는 움직임이 보임
  history.pushState({ sub: id }, ''); markTerms(el); el.querySelector('.spBack').focus({ preventScroll: true });
}
function closeSub(back = true) {
  if (!subOpen) return;
  const el = $(subOpen), id = subOpen; subOpen = null; el.classList.remove('in');
  setTimeout(() => { if (subOpen !== id) el.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
  document.querySelector(`[data-sub="${id}"]`)?.focus({ preventScroll: true });
  if (back && history.state?.sub) history.back();                          // 열 때 넣은 기록 한 칸을 되돌림
}
document.addEventListener('click', e => { const s = e.target.closest('[data-sub]'), b = e.target.closest('.spBack'); if (s) openSub(s.dataset.sub); else if (b) closeSub(); });
addEventListener('popstate', () => { if (subOpen && history.state?.sub !== subOpen) closeSub(false); });   // 새로고침 전에 남은 다른 {sub} 칸으로 돌아가도 닫히게 (검수팀)
if (history.state?.sub || history.state?.pickSheet) history.replaceState(null, '');   // 새로고침하면 판·하위 화면은 닫힌 채라 남은 기록 칸을 비움 (뒤로 가기가 한 번 헛돌지 않게)
// 걸음 수업 판: 근육 그림(assets/muscle, 보행 주기 2% 간격 50장)을 캔버스로 반복 재생 + 주기에 맞는 자막·단계 막대 (디자인 팀 10/28, 법률 검토 20번)
// 투명 WebP를 캔버스에 그려 밝은·어두운 화면 모두 바탕이 자연스럽고 사파리에서도 재생됨. 이용자 측정값과는 연결하지 않음
const LESSON_N = 50, LESSON_MS = 111;                                      // 한 걸음 약 5.6초 (근육 영상 시안과 같은 빠르기)
const LESSON_SUB = [[0, '① 뒤꿈치 흔들의자 · 정강이 앞 근육이 발이 ‘탁’ 떨어지지 않게 천천히 내려놓아요'],
  [12, '② 발목 흔들의자 · 가자미근이 정강이가 너무 빨리 넘어가지 않게 붙잡아요'],
  [31, '③ 앞발 흔들의자 · 뒤꿈치가 들리며 몸이 앞으로 떨어져요(걸음에서 가장 강한 추진력). 종아리 근육은 정강이가 너무 빨리 넘어가지 않게 늦춰요'],   // Perry 3장: 추진력은 몸무게가 받침 밖으로 떨어지며 생김, 근육은 늦춤
  [50, '④ 유각 전 · 체중이 반대 발로 넘어가고, 발가락 관절을 축으로 발목이 펴지며 무릎이 굽어요'],
  [62, '흔들기 · 발이 바닥에서 떨어져 앞으로 가요']];
function openLesson() {
  const o = document.createElement('div');
  o.id = 'lessonOv'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', '걸음 수업');
  o.innerHTML = `<div class="dsheet lesson"><div class="lhead"><div><div class="sub" style="font-size:.75rem">걸음 수업 · 30초</div><h3>발이 굴러가는 흔들의자 3개</h3></div><button class="lx" data-lx="close" aria-label="닫기">✕</button></div>
    <div class="lfig"><canvas width="480" height="403" role="img" aria-label="페리의 보행 분석 기준 걸음에서 정강이·발 근육의 길이가 바뀌는 그림"></canvas><button class="chip lplay" data-lx="play"></button></div>
    <p class="lsub"></p>
    <div class="gc" aria-label="보행 주기 단계"><span>입각기 <small>0~62%</small></span><span>유각기 <small>62~100%</small></span>${OLD_PH.map(n => `<b class="chip">${n}</b>`).join('')}</div>
    <button class="textlike" data-lx="more" style="text-align:left;padding-left:0">더 알아보기 ›</button>
    <p class="lfine">근육 그림: BodyParts3D·Z-Anatomy 모델로 만듦 (CC BY-SA) · <a href="#" data-bonesrc>출처 보기 ›</a><br>페리의 보행 분석 기준: Perry 『Gait Analysis』 3장·4장·9장 · 근육 모양은 각도에 맞춘 근사예요 · 일반적인 걸음 정보이며 진료를 대신하지 않아요</p></div>`;
  document.body.append(o);
  for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = true;
  const cv = o.querySelector('canvas'), g = cv.getContext('2d'), imgs = [], btn = o.querySelector('[data-lx=play]');
  let k = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, timer = 0, shownSub = -1, shownPh = -1;
  for (let i = 0; i < LESSON_N; i++) { const im = new Image(); im.src = `assets/muscle/m${String(i).padStart(2, '0')}.webp`; if (i === 0) im.onload = () => draw(); imgs.push(im); }
  const draw = () => {
    const im = imgs[k]; if (im.complete && im.naturalWidth) { g.clearRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height); }
    const q = k * 2, s = LESSON_SUB.reduce((a, x, j) => q >= x[0] ? j : a, 0), ph = phaseIdx(q);
    if (s !== shownSub) { shownSub = s; o.querySelector('.lsub').textContent = LESSON_SUB[s][1]; }
    if (ph !== shownPh) { shownPh = ph; o.querySelectorAll('.gc > .chip').forEach((c, j) => c.setAttribute('aria-pressed', j === ph)); o.querySelectorAll('.gc > span').forEach((c, j) => c.classList.toggle('on', j === (ph < 5 ? 0 : 1))); }
  };
  const tick = () => { if (playing) { k = (k + 1) % LESSON_N; draw(); } };
  const setBtn = () => { btn.textContent = playing ? '❚❚ 일시정지' : '▶ 재생'; };
  const close = () => { clearInterval(timer); for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = false; o.remove(); $('lessonCard').querySelector('[data-lesson]')?.focus(); };
  setBtn(); draw(); timer = setInterval(tick, LESSON_MS);
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-lx]');
    if (e.target === o || b?.dataset.lx === 'close' || e.target.closest('[data-bonesrc]')) return close();   // 출처 보기는 판을 닫고 홈 '이 앱의 근거'로 (아래 공용 처리)
    if (b?.dataset.lx === 'play') { playing = !playing; setBtn(); }
    else if (b?.dataset.lx === 'more') { close(); const d = [...$('learn').querySelectorAll('details')].find(x => x.querySelector('summary').textContent === '발이 굴러가는 흔들의자 3개'); if (d) { d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }   // '알아보기'의 같은 글
  });
  o.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  o.querySelector('[data-lx=close]').focus();
}
$('lessonCard').addEventListener('click', e => { if (e.target.closest('[data-lesson]')) openLesson(); });

// ── 뛰기 전 몸 풀기 · 뛴 뒤 정리 운동 판 (디자인 팀 10/29, 법률 검토 22번 통과) ──
// 시간·방법: Kisner 『운동치료총론』 개정8판 4장 113쪽(정적 신장 30초)·7장 298~299쪽(준비·정리 5~10분), NASM-CPT 7장 146~147쪽·8장 166~168쪽
// 그림: assets/exercise/<이름>.webp = 투명 움직이는 WebP(5초 고리), <이름>-still.webp = 멈춘 그림(움직임 줄이기 설정). Human Base Meshes(CC0)로 직접 자세를 만들어 렌더 (scratchpad bl_scripts/render_ex2.py)
// 이용자 측정값과 연결하지 않고 효과를 말하지 않음 (법률 22번)
const EX = {
  warm: { title: '뛰기 전 몸 풀기', sub: '천천히 시작해서 조금씩 빠르게 해요', time: '약 7분', items: [
    ['brisk', '빠르게 걷기', '2분', '팔을 흔들며 평소보다 조금 빠르게 걸어요'],
    ['march', '무릎 들어 걷기', '10번', '무릎을 번갈아 앞으로 들며 걸어요'],
    ['swing', '다리 앞뒤 흔들기', '좌우 10번', '벽을 짚고 한쪽 다리를 앞뒤로 가볍게 흔들어요'],
    ['ankle', '발목 돌리기', '좌우 10번', '발끝을 바닥에 대고 천천히 원을 그려요'],
    ['heel', '뒤꿈치 들기', '10번', '발끝으로 섰다가 천천히 내려와요'],
    ['jog', '천천히 달리기', '2분', '걷는 속도로 가볍게 뛰다가 조금씩 속도를 올려요']] },
  cool: { title: '뛴 뒤 정리 운동', sub: '당기는 느낌이 들 때까지, 아프지 않은 범위에서 늘여요', line: '튕기지 말고 멈춘 채로 늘여요', when: '뛴 직후 몸이 따뜻할 때, 천천히 걷기 다음에 해요 · 일주일에 2~5번', time: '약 7분', items: [   // when: Kisner 4장 115·123쪽(신장 전 몸 데우기, 주 2~5회)
    ['slowwalk', '천천히 걷기', '3분', '숨이 고를 때까지 천천히 걸어요'],
    ['calf', '종아리 늘이기', '좌우 30초 × 2', '벽을 짚고 한 발을 뒤로 빼요. 뒤꿈치를 붙인 채 무릎 펴서 30초, 살짝 굽혀서 30초', 1],
    ['quad', '허벅지 앞 늘이기', '좌우 30초', '벽을 짚고 한 발목을 잡아, 골반을 뒤로 말며 허벅지 앞을 늘여요', 1],
    ['ham', '허벅지 뒤 늘이기', '좌우 30초', '앉아서 해 보고, 편하면 낮은 계단에 발을 올려 서서 해요', 1, 'ham1'],   // 6번째 = 목록 그림 이름 (1단계)
    ['glute', '엉덩이 늘이기', '좌우 30초', '의자에 앉아 한 발목을 반대 무릎에 올리고 허리를 편 채 숙여요', 1]] },
};
// 동작 상세 (디자인 팀 시안 A 10/29, 법률 23번): 3D 보기 + 카드 4개. 정리 운동 근육·자세는 Kisner 20·22장, 준비 운동은 7장 298쪽 원칙 (사용자 규칙: Kisner가 기준)
// [시간·횟수, 자세, 순서, 늘어나는 곳(정리)·주로 움직이는 곳(준비), 추가 주의, 처음 보는 각도(theta°: 0 = 앞, −90 = 몸 오른쪽)]
const EXD = {
  brisk: ['2분', '선 자세', ['바르게 서서 팔을 앞뒤로 흔들며 걸어요.', '평소보다 조금 빠르게, 말은 할 수 있을 정도로 걸어요.', '2분 동안 이어서 걸어요.'], '다리 전체와 팔', [], -60],
  march: ['10번', '선 자세', ['바르게 서요.', '한쪽 무릎을 앞으로 들며 반대 팔을 앞으로 흔들어요.', '내려놓고 반대쪽도 해요. 양쪽을 합쳐 10번 해요.'], '허벅지 앞(대퇴사두근)과 엉덩이 앞(장요근)', [], -60],
  swing: ['좌우 10번', '벽 짚기', ['벽 옆에 서서 한 손으로 벽을 짚어요.', '벽에서 먼 쪽 다리를 앞뒤로 가볍게 흔들어요.', '10번 한 뒤 돌아서서 반대쪽도 해요.'], '엉덩이 관절 주변', ['몸통은 세운 채, 다리를 세게 차올리지 않아요'], -60],
  ankle: ['좌우 10번', '선 자세', ['한 발의 발끝을 바닥에 대요.', '발목으로 천천히 원을 그려요.', '10번 한 뒤 반대쪽도 해요.'], '발목', [], -60],
  heel: ['10번', '선 자세(필요하면 벽 짚기)', ['발을 어깨너비로 벌리고 서요.', '발끝으로 천천히 올라섰다가', '천천히 내려와요. 10번 해요.'], '종아리(비복근·가자미근)', [], -60],
  jog: ['2분', '선 자세', ['걷는 속도로 가볍게 뛰기 시작해요.', '조금씩 속도를 올려요.', '2분 뒤 측정을 시작해요.'], '다리 전체와 팔', [], -60],
  slowwalk: ['3분', '선 자세', ['달리기를 멈추고 천천히 걸어요.', '숨이 고를 때까지 3분 동안 걸어요.'], '다리 전체 (늘어나는 곳 없음)', [], -60],
  calf: ['좌우 각 30초씩 두 자세(무릎 펴서 / 살짝 굽혀서)', '벽 짚기', ['벽을 마주 보고 서서 두 손을 벽에 대요.', '한 발을 앞으로 내딛고, 뒤 발의 뒤꿈치를 바닥에 평평하게 붙여요. 뒤 발끝은 살짝 안쪽을 향하게 해요.', '뒤 무릎을 편 채, 종아리가 당길 때까지 몸을 벽 쪽으로 천천히 기울여 30초 있어요.', '이번엔 뒤 무릎을 살짝 굽혀 30초 더 있어요. 반대쪽도 같게 해요.'], '무릎을 펴면 비복근, 살짝 굽히면 가자미근 (비복근은 무릎과 발목 두 관절을 지나서 무릎을 펴야 늘어나요)', [], -120],
  quad: ['좌우 각 30초', '벽이나 의자 짚기', ['벽 옆에 서서 한 손으로 벽을 짚어요.', '벽에서 먼 쪽 무릎을 굽혀 같은 쪽 손으로 발목을 잡아요.', '엉덩이를 살짝 앞으로 밀어 골반을 뒤로 말고, 허벅지를 몸 뒤쪽으로 살짝 보내 허벅지 앞이 당길 때까지 있어요.', '멈춘 채로 30초 있다가 천천히 내려놓아요. 반대쪽도 같게 해요.'], '무릎을 굽힌 채 허벅지를 몸 뒤로 보낼 때 대퇴직근 (무릎과 엉덩관절 두 관절을 지나요)', ['허리를 뒤로 젖히지 않아요'], -90],   // 옆: 허벅지가 몸통 선 뒤로 가는 게 보이게
  ham: ['좌우 각 30초', '1단계 의자 2개 · 2단계 낮은 계단', ['낮은 계단이나 의자 앞에 서서 한쪽 발뒤꿈치를 올려요.', '올린 다리의 무릎은 편 채, 등을 곧게 펴요.', '허리를 말지 말고 엉덩이에서 몸통을 앞으로 숙여 허벅지 뒤가 당길 때까지 있어요.', '멈춘 채로 30초 있다가 천천히 일어나요. 반대쪽도 같게 해요.'], '무릎을 편 채 엉덩이부터 숙일 때 햄스트링 (무릎과 엉덩관절 두 관절을 지나요)', ['발끝에 손을 대려고 등을 둥글게 말지 않아요'], -120],
  glute: ['좌우 각 30초', '의자에 앉기', ['의자에 앉아 두 발을 바닥에 대요.', '한 발목을 반대쪽 무릎 위에 올려 다리로 4자를 만들어요.', '허리를 편 채 상체를 앞으로 숙여 엉덩이 뒤쪽이 당길 때까지 있어요.', '멈춘 채로 30초 있다가 천천히 일어나 앉아요. 반대쪽도 같게 해요.'], '4자를 만든 채 허리 펴고 숙일 때 엉덩이 뒤쪽(대둔근·중둔근)', [], -130],
};
// 포인트 카드 (디자인 팀 10/29): 자세 요령(tip)을 위에, 안전 문구(safe)를 아래에. 정리 운동 = '스트레칭 포인트', 준비 운동·천천히 걷기 = '운동 포인트'
const EX_CAU = { warm: { tip: ['천천히 시작해서 조금씩 빠르게 해요', '숨이 너무 차면 속도를 줄여요'], safe: ['통증이 있거나 어지러우면 멈춰요'] },
  cool: { tip: ['튕기지 말고 멈춘 채로 늘여요', '당기는 느낌까지만, 아프지 않은 범위에서 해요', '숨을 참지 말고 편하게 쉬어요'],
    safe: ['통증이 있거나 어지러우면 멈춰요', '관절을 억지로 꺾지 않아요', '붓거나 다친 곳은 늘이지 않아요', '다음 날까지 아프면 다음엔 더 약하게 해요'] },   // 뒤 3줄: Kisner 4장 125쪽
  walk: { tip: [], safe: ['통증이 있거나 어지러우면 멈춰요'] } };
const EX_FINE = '일반적인 운동 안내이며 치료·재활을 대신하지 않아요. 통증이 있거나 어지러우면 멈추고 전문가와 상담하세요.<br>참고한 자료: 운동치료총론 개정8판 4·7·20·22장, NASM-CPT 7·8장';
// 보기 도구 model-viewer 4.4.0(Apache-2.0, vendor/)은 처음 상세를 열 때만 불러옴. 본 3D 파일·보기 도구는 'ex3d' 저장소에 넣어 오프라인에서도 열리게 (sw.js가 지우지 않음)
let mvReady = null, exTick = 0, exTL = null;   // exTick: 정리 운동 시간표 타이머 (이전/다음으로 넘어가도 하나만 남게)
const exTimeline = () => exTL ??= fetch('assets/exercise3d/timeline.json').then(r => r.json()).catch(() => { exTL = null; return {}; });
const pwl = (pts, f) => { if (f <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (f <= pts[i][0]) { const [f0, v0] = pts[i - 1], [f1, v1] = pts[i]; return v0 + (v1 - v0) * (f - f0) / (f1 - f0); } return pts[pts.length - 1][1]; };   // 꺾은선
const EX_HOLD = { brisk: 0.4, march: 1.2, swing: 0.6, ankle: 1.2, heel: 1.2, jog: 0.4, slowwalk: 0.2, calf: 5.0, quad: 6.0, ham: 5.5, ham1: 5.5, glute: 5.5 };   // 정리 운동은 멈춤 시작 3초 뒤(조건이 다 갖춰진 장면)
// 단계가 있는 동작 (디자인 팀 10/29, Kisner 879~880쪽·그림 4.10B·20.18): 3D 위 칩을 눌러 바꿈(자동으로 넘어가지 않음), 처음엔 1단계
const EX_STAGES = { ham: [
  { label: '1 앉아서', glb: 'ham1', steps: ['의자 끝에 앉아 한 다리를 앞 의자에 뻗고, 반대 발은 바닥에 둬요.', '허리를 편 채 엉덩이에서 몸통을 앞으로 숙여 허벅지 뒤가 당길 때까지 30초 있어요.'] },
  { label: '2 서서', glb: 'ham', steps: ['1단계가 편하면, 낮은 계단에 발뒤꿈치를 올리고 무릎을 펴요.', '등을 곧게 편 채 엉덩이부터 숙여 당길 때까지 30초 있어요. 반대쪽도 같게 해요.'] }] };
// 바른 자세·틀린 자세 (2단계를 바로 옆에서 본 정지 그림, 틀린 그림엔 근육 강조 없음). Kisner 880쪽(등 말지 않기)·125쪽(당기는 느낌까지만)
const EX_CMP = { ham: '<div class="card"><div class="excmp"><figure><img src="assets/exercise/ham-good.webp" alt="바른 자세: 등을 편 채 엉덩이부터 숙인 모습" width="150" height="175"><figcaption class="exok">○ 등 펴고 엉덩이부터</figcaption></figure>'
  + '<figure><img src="assets/exercise/ham-bad.webp" alt="틀린 자세: 발끝을 잡으려 등을 둥글게 만 모습" width="150" height="175"><figcaption><span class="exno">× 발끝 잡으려 등 말기</span></figcaption></figure></div>'
  + '<p class="sub" style="margin:6px 0 0">숙이는 정도는 사람마다 달라요. 당기는 느낌까지만 해요.</p></div>' };   // 움직임 줄이기면 이 순간(초)에 멈춰 보여 줌
const exCache = urls => caches?.open('ex3d').then(c => Promise.all(urls.map(u => c.match(u).then(h => h || c.add(u))))).catch(() => {});
const MUS_LIN = [0.392, 0.032, 0.048], MUS_PALE = [0.89, 0.60, 0.56];   // 근육 빨강 #a8323e(선형) · 조건 전 피부에 가까운 연분홍 #f2cbc5(불투명 35%, 디자인 팀 10/29)
function openExDetail(kind, i) {
  const list = EX[kind].items, [k, name] = list[i], [dose, pose, steps, area, extra, theta] = EXD[k], cool = kind === 'cool' && k !== 'slowwalk';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, mus = ['calf', 'quad', 'ham', 'glute'].includes(k);
  mvReady ??= import('./vendor/model-viewer-4.4.0.min.js').catch(e => { mvReady = null; throw e; });
  const stages = EX_STAGES[k], glb0 = stages ? stages[0].glb : k;
  exCache(['vendor/model-viewer-4.4.0.min.js', 'assets/exercise3d/timeline.json', `assets/exercise3d/${glb0}.glb`, ...(EX_CMP[k] ? ['assets/exercise/ham-good.webp', 'assets/exercise/ham-bad.webp'] : [])]);
  clearInterval(exTick); $('exDet')?.remove();
  const o = document.createElement('div');
  o.id = 'exDet'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', name);
  const VIEW3 = { side: -90, back: 180, front: 0 };
  o.innerHTML = `<div class="sphead"><button class="spBack" data-exd="back" aria-label="목록으로">‹</button><h2>${name}</h2></div>
    <div class="d3">${['calf', 'quad', 'ham', 'glute'].includes(k) ? `<div class="d3stage${stages ? ' low' : ''}" hidden></div><div class="d3hold" hidden><svg viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9"/><circle cx="11" cy="11" r="9"/></svg>멈춘 채로 30초 <small>(그림은 6초로 줄였어요)</small></div>` : ''}${stages ? `<div class="d3chips">${stages.map((s, j) => `<button class="chip" data-stage="${j}" aria-pressed="${j === 0}">${s.label}</button>`).join('')}</div>` : ''}<model-viewer src="assets/exercise3d/${glb0}.glb" alt="${name} 3D 모형, 손가락으로 밀어 돌려 볼 수 있어요" camera-controls touch-action="pan-y" disable-pan interaction-prompt="none"
      camera-orbit="${theta}deg 80deg auto" shadow-intensity="1" shadow-softness="0.3" environment-image="neutral" exposure="1.05" ${reduce ? '' : 'autoplay'}></model-viewer>
      <div class="d3bar"><span>${['side', 'back', 'front'].map(v => `<button class="chip" data-view="${v}">${{ side: '옆', back: '뒤', front: '앞' }[v]}</button>`).join('')}</span><button class="chip" data-exd="play">${reduce ? '▶ 동작 보기' : '❚❚ 동작 멈춤'}</button></div></div>
    <p class="lfine" style="margin-top:4px">3D 모형: Human Base Meshes(CC0)${mus ? ' · BodyParts3D · Z-Anatomy 근육(CC BY-SA)' : ''}으로 만듦 · <a href="#" data-exd="src">출처 보기 ›</a></p>
    <div class="card"><h3>시간·횟수·자세</h3><p>${dose} · ${pose}</p></div>
    <div class="card"><h3>이렇게 해요</h3><ol class="exsteps">${(stages ? stages[0].steps : steps).map(s => `<li>${s}</li>`).join('')}</ol></div>${EX_CMP[k] ?? ''}
    <div class="card"><h3>${cool ? '<span class="exleg" style="margin:0"><i aria-hidden="true"></i></span>늘어나는 곳' : '주로 움직이는 곳'}</h3><p>${area}</p></div>
    ${(c => `<div class="card"><h3>${cool ? '스트레칭 포인트' : '운동 포인트'}</h3><ul class="exsteps">${[...c.tip, ...extra, ...c.safe].map(s => `<li>${s}</li>`).join('')}</ul></div>`)(EX_CAU[cool ? 'cool' : kind === 'warm' ? 'warm' : 'walk'])}
    <p class="lfine">${EX_FINE}</p>
    <div class="exnav">${i > 0 ? `<button class="ghost" data-exd="prev">‹ ${list[i - 1][1]}</button>` : '<span></span>'}${i < list.length - 1 ? `<button class="ghost" data-exd="next">${list[i + 1][1]} ›</button>` : ''}</div>`;
  document.body.append(o);
  $('exOv').inert = true;
  requestAnimationFrame(() => o.classList.add('in')); setTimeout(() => o.classList.add('in'), 30);   // 오른쪽에서 들어옴 (숨은 창에서 rAF가 안 돌 때도)
  const mv = o.querySelector('model-viewer'), playBtn = o.querySelector('[data-exd=play]');
  // 처음부터 오프라인이라 보기 도구나 3D 파일을 못 받으면: 목록 그림 + 안내 한 줄 (디자인 팀 10/29: 빈 칸·오류 없이)
  const fallback = () => { const d3 = o.querySelector('.d3'); if (!d3 || d3.dataset.fb) return; d3.dataset.fb = 1;
    d3.innerHTML = `<picture><source srcset="assets/exercise/${k}-still.webp" media="(prefers-reduced-motion: reduce)"><img src="assets/exercise/${k}.webp" alt="${name} 동작 그림" style="display:block;margin:0 auto;width:208px;height:242px"></picture><p class="sub" style="text-align:center;margin:4px 0 0">인터넷에 연결되면 3D로 볼 수 있어요</p>`; };
  mvReady.catch(fallback); mv.addEventListener('error', fallback);
  let userCam = false, musM = {};                                                   // 손으로 돌렸거나 옆·뒤·앞을 누르면 자동 각도 바꾸기를 멈춤
  mv.addEventListener('camera-change', e => { if (e.detail?.source === 'user-interaction') userCam = true; });
  const setView = v => { userCam = true; mv.cameraOrbit = `${VIEW3[v]}deg 80deg auto`; o.querySelectorAll('[data-view]').forEach(c => c.setAttribute('aria-pressed', c.dataset.view === v)); };
  // 반투명 피부는 바깥 한 겹만 (디자인 팀 10/29: 관절 구 이음이 겹쳐 비치지 않게): 피부 깊이만 먼저 쓰는 복제(색 없음)를 붙이고, 근육은 그보다 먼저 그림
  // ponytail: model-viewer 안쪽 three.js 장면(Symbol 'scene')을 직접 만짐 → model-viewer 버전을 올리면 다시 확인
  mv.addEventListener('load', () => {
    const sc = mv[Object.getOwnPropertySymbols(mv).find(s => s.description === 'scene')], skins = []; musM = {};
    sc?.traverse(m => { if (!m.isMesh || !m.material.name || m.material.isShaderMaterial || m.userData.dep) return; m.userData.dep = 1;   // glTF 재질만(그림자 판·흐림 셰이더 제외), 한 번만 (검수팀 10/29)
      if (m.material.name.startsWith('mus_')) { m.renderOrder = -2; Object.assign(m.material, { blending: 5, blendSrc: 204, blendDst: 205, blendSrcAlpha: 201, blendDstAlpha: 205, blendEquation: 100, needsUpdate: true }); musM[m.material.name] = m; }   // 불투명 단계에 남긴 채 알파 섞기(CustomBlending 색: SrcAlpha·1−SrcAlpha, 알파: One·1−SrcAlpha = 화면 합성과 맞는 'over', 안 그러면 하얗게 뜸) → 피부 깊이 복제(-1)보다 먼저 그려짐
      else if (m.material.transparent) skins.push(m); else m.renderOrder = -4; });   // 벽·상자는 근육보다 먼저 (옅은 근육이 깊이를 안 써서 뒤 벽에 덮이지 않게)
    for (const m of skins) {
      const d = new m.constructor(m.geometry, m.material.clone());
      Object.assign(d.material, { colorWrite: false, transparent: false, depthWrite: true }); d.renderOrder = -1; m.add(d); m.material.depthWrite = true;
    }
    if (reduce) { mv.play(); setTimeout(() => { mv.currentTime = EX_HOLD[mv.src.match(/(\w+)\.glb$/)?.[1]] ?? EX_HOLD[k]; setTimeout(() => mv.pause(), 120); }, 60); }   // 움직임 줄이기: 선 자세 대신 늘이는(움직이는) 순간을 멈춰 보여 줌 (멈춘 채로 시간만 옮기면 안 그려져서 0.1초만 재생 후 멈춤)
  });
  // 정리 운동 시간표 (assets/exercise3d/timeline.json, Blender 렌더와 같은 값): 단계 글, 조건이 갖춰질 때만 진해지는 근육 색, 멈춤 표시(6초 동안 차는 고리 = 실제 30초)
  // 근거: Kisner 114·116·124쪽(천천히 들어가 멈춘 채 유지), 877~880·1042쪽(두 관절근은 두 관절 조건이 다 맞을 때 늘어남) — 디자인 팀 10/29
  const tlTick = TL => () => {
    const name = mv.src.match(/(\w+)\.glb$/)?.[1], tl = TL[name]; if (!tl) return;
    const f = (mv.currentTime || 0) * 10, mats = mv.model?.materials ?? [];
    for (const [nm, pts] of Object.entries(tl.mus)) {
      const m = mats.find(x => x.name === 'mus_' + nm), t = pwl(pts, f), me = musM['mus_' + nm];
      m?.pbrMetallicRoughness.setBaseColorFactor([...MUS_PALE.map((p, j) => p + (MUS_LIN[j] - p) * t), 0.35 + 0.65 * t]);   // 조건 전 옅게 35% → 다 맞으면 진하게 100%
      if (me) { const deep = t > 0.9; me.material.depthWrite = deep; me.renderOrder = deep ? -3 : -2; }   // 진한 근육을 먼저 그려 옅은 근육(가자미근 위 비복근 등) 너머로 비쳐 보이게
    }
    const lab = o.querySelector('.d3stage'), txt = tl.labels.find(([a, b]) => f >= a && f < b)?.[2] ?? '';
    if (lab && lab.textContent !== txt) { lab.textContent = txt; lab.hidden = !txt; }
    const h = tl.holds.find(([a, b]) => f >= a && f < b), hb = o.querySelector('.d3hold');
    if (hb) { hb.hidden = !h; if (h) hb.querySelector('circle:last-child').style.strokeDashoffset = (56.5 * (1 - (f - h[0]) / (h[1] - h[0]))).toFixed(1); }
    if (name === 'calf' && !userCam) { const side = f >= 80 && f < 155; if (side !== (mv.dataset.side === '1')) { mv.dataset.side = side ? '1' : ''; mv.cameraOrbit = `${side ? -140 : theta}deg 80deg auto`; } }   // 무릎 굽힘과 종아리 뒤가 보이게 뒤쪽 옆에서
  };
  if (['calf', 'quad', 'ham', 'glute'].includes(k)) exTimeline().then(TL => { if (o.isConnected) exTick = setInterval(tlTick(TL), 100); });
  const close = () => { clearInterval(exTick); o.remove(); if ($('exOv')) { $('exOv').inert = false; $('exOv').querySelectorAll('.exlist li')[i]?.querySelector('button, [tabindex]')?.focus(); } };
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-exd], [data-view], [data-stage]');
    if (!b) return;
    if (b.dataset.view) return setView(b.dataset.view);
    if (b.dataset.stage) {                                                 // 단계 바꾸기: 3D와 '이렇게 해요'만 바뀜
      const st = stages[+b.dataset.stage]; mv.src = `assets/exercise3d/${st.glb}.glb`; exCache([mv.src.replace(location.origin + '/', '')]);
      o.querySelector('.exsteps').innerHTML = st.steps.map(s => `<li>${s}</li>`).join('');
      o.querySelectorAll('[data-stage]').forEach(c => c.setAttribute('aria-pressed', c === b)); return;
    }
    const a = b.dataset.exd;
    if (a === 'back') close();
    else if (a === 'play') { if (mv.paused) { mv.play(); playBtn.textContent = '❚❚ 동작 멈춤'; } else { mv.pause(); playBtn.textContent = '▶ 동작 보기'; } }
    else if (a === 'prev' || a === 'next') openExDetail(kind, i + (a === 'next' ? 1 : -1));
    else if (a === 'src') { e.preventDefault(); close(); $('exOv')?.querySelector('[data-ex=close]')?.click(); setTab('home'); const s = $('boneSrc'); s.open = true; s.scrollIntoView({ block: 'center' }); }
  });
  o.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  o.querySelector('[data-exd=back]').focus();
}

function openEx(kind, fromHome = false) {
  const d = EX[kind], o = document.createElement('div');
  o.id = 'exOv'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', d.title);
  o.innerHTML = `<div class="dsheet lesson"><div class="lhead"><div><div class="sub" style="font-size:.75rem">${d.time}</div><h3>${d.title}</h3></div><button class="lx" data-ex="close" aria-label="닫기">✕</button></div>
    <p class="sub" style="margin:4px 0 0">${d.sub}</p>${d.when ? `<p class="sub" style="margin:2px 0 0">${d.when}</p>` : ''}${d.line ? `<p style="margin:4px 0 0;font-weight:600">${d.line}</p>` : ''}
    ${d.items.some(x => x[4]) ? '<p class="exleg"><i aria-hidden="true"></i>늘어나는 곳 <span class="sub">· 해부학 그림에서 흔히 쓰는 근육 색이에요</span></p>' : ''}
    <ol class="exlist">${d.items.map(([k, name, dose, how, , img = k], i) => `<li><button class="exrow" data-exi="${i}" aria-label="${name} 자세히 보기"></button><picture><source srcset="assets/exercise/${img}-still.webp" media="(prefers-reduced-motion: reduce)"><img src="assets/exercise/${img}.webp" alt="${name} 동작 그림" width="128" height="149" loading="lazy"></picture>
      <div><b>${name}</b> <span class="exdose">${dose}</span><p>${how}</p></div><span class="exgo" aria-hidden="true">›</span></li>`).join('')}</ol>
    ${kind === 'warm' && !fromHome ? '<button data-ex="start">측정 시작</button>' : ''}
    <p class="lfine">${EX_FINE} · <a href="#" data-ex="src">출처 보기 ›</a></p></div>`;
  exCache(d.items.flatMap(([k, , , , , img = k]) => [`assets/exercise/${img}.webp`, `assets/exercise/${img}-still.webp`]));   // 목록 그림도 오프라인에서
  const back = document.activeElement;
  document.body.append(o);
  for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = true;
  const close = () => { for (const el of [document.querySelector('main'), $('tabbar')]) el.inert = false; o.remove(); };
  o.addEventListener('click', e => {
    const r = e.target.closest('[data-exi]');
    if (r) return openExDetail(kind, +r.dataset.exi);
    const b = e.target.closest('[data-ex]');
    if (e.target === o || b?.dataset.ex === 'close') { close(); back?.focus?.(); }
    else if (b?.dataset.ex === 'start') { close(); $('start').click(); }   // 몸 풀기 뒤 바로 측정 (평소 시작 버튼과 같은 흐름)
    else if (b?.dataset.ex === 'src') { e.preventDefault(); close(); setTab('home'); const s = $('exSrc'); s.open = true; s.scrollIntoView({ block: 'center' }); }
  });
  o.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('exDet')) { close(); back?.focus?.(); } });
  o.querySelector('[data-ex=close]').focus();
}
$('warmBtn').addEventListener('click', () => openEx('warm'));
$('exCard').addEventListener('click', e => { const b = e.target.closest('[data-exopen]'); if (b) openEx(b.dataset.exopen, true); });   // 홈 '배워 보기'에서도 (본부 10/29). 여기선 [측정 시작] 없음 — 배우는 화면에서 바로 측정이 시작되지 않게
$('result').addEventListener('click', e => { if (e.target.closest('[data-ex=cool]')) openEx('cool'); });
$('homeTop').addEventListener('click', e => {
  const s = e.target.closest('[data-shoot]'), o = e.target.closest('[data-open]'), p = e.target.closest('[data-pair]'), l = e.target.closest('[data-lesson]');
  if (s) goShoot(s.dataset.shoot);
  else if (o) { e.preventDefault(); goShoot('', o.dataset.open); }
  else if (p) {                                                           // ponytail: 두 기록을 한 화면에 겹쳐 보기는 아직 — 기록 탭에서 두 줄을 표시만
    e.preventDefault(); setTab('records');
    const rows = p.dataset.pair.split(',').map(i => $('histBody').querySelector(`[data-i="${i}"]`)).filter(Boolean);
    rows.forEach(r => { r.style.outline = '2px solid var(--accent)'; setTimeout(() => { r.style.outline = ''; }, 4000); });
    rows[0]?.scrollIntoView({ block: 'center' });
    if (rows.length < 2) showRecord(+p.dataset.pair.split(',')[0]);        // 기록 탭은 최근 20개만 그려서 옛 영상이 없으면 그 기록을 바로 엶
  } else if (l) openDict(+l.dataset.lesson);
});
// 홈 '배워 보기' 카드의 걷는 근육 그림: 걸음 수업과 같은 50장, 정강이·발 부분만 잘라 그 장면의 다리 가운데를 따라감 (그림은 고관절 고정이라 다리가 앞뒤로 움직임)
const LEARN_CX = [374, 369, 358, 342, 327, 311, 296, 280, 264, 248, 231, 215, 198, 182, 166, 150, 134, 118, 103, 92, 81, 86, 91, 96, 98, 105, 112, 126, 140, 154, 168, 183, 197, 210, 222, 236, 248, 262, 288, 319, 340, 348, 354, 360, 366, 370, 374, 375, 374, 374];   // 장면마다 아래 70% 다리의 가운데 x (480px 그림 기준)
let learnImgs = null, learnK = 10, learnT = 0;
function learnFigDraw() {
  const cv = $('learnFig'), im = learnImgs[learnK]; if (!im.complete || !im.naturalWidth) return;
  const sh = 343, sw = Math.round(sh * 96 / 116), sx = Math.max(0, Math.min(480 - sw, LEARN_CX[learnK] - sw / 2));   // 위 60px(넓적다리 흐림)은 빼고 상자 비율로
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(im, sx, 60, sw, sh, 0, 0, cv.width, cv.height);
}
function learnFigStart() {
  if (!learnImgs) learnImgs = Array.from({ length: LESSON_N }, (_, i) => { const im = new Image(); im.src = `assets/muscle/m${String(i).padStart(2, '0')}.webp`; if (i === 10) im.onload = learnFigDraw; return im; });
  learnFigDraw();
  if (learnT || matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // 움직임 줄이기 = 20% 장면에 멈춤
  learnT = setInterval(() => {
    if (!$('learnFig').offsetParent) { clearInterval(learnT); learnT = 0; return; }   // 홈이 안 보이면 멈춤 (홈으로 오면 renderHomeTop이 다시 켬)
    learnK = (learnK + 1) % LESSON_N; learnFigDraw();
  }, LESSON_MS);
}
homeReady = true;
// ── 측정 이어 하기: 측정 중에 전화·카톡 등으로 앱(페이지)이 다시 열린 경우 ──
(async function resumeRec() {
  const rec = store.get('rec', null);
  if (!rec?.startWall) return;
  // 3시간이 넘은 측정도 버리지 않고 그때까지 잰 것으로 저장 (민원팀 10/28)
  $('act').value = rec.act; showAct(); setTab('measure');
  if (Native && rec.native) {                                              // 설치형 앱: 측정 서비스는 계속 도는 중 → 측정 화면만 다시 띄움
    const { alive, ended } = await Native.peek({ sec: 1 }).catch(() => ({}));   // 0.12 이하 앱은 alive를 안 줌 → 예전처럼 살아 있다고 봄
    if (ended) { t0 = rec.startWall; return stopRec(false, ended); }       // 서비스가 스스로 끝냄(오래 걷지 않음·3시간·알림 끝내기) → 저장
    if (Date.now() - rec.startWall > MAX_REC_S * 1000) { t0 = rec.startWall; return stopRec(false, 'maxEnd'); }   // 0.15 이하 앱은 서비스가 스스로 안 끝냄 → 3시간 넘으면 여기서 저장하고 끝냄 (예전엔 기록을 통째로 버림, 검수팀)
    if (alive === false) { t0 = rec.startWall; return stopRec(true); }      // 휴대폰이 앱을 정리함 → 파일에 남은 값으로 바로 결과
    document.body.classList.add('recording');
    $('setup').classList.add('hidden'); $('result').classList.add('hidden'); $('rec').classList.remove('hidden');
    return runRec(rec.act);
  }
  const snap = store.get('recSnap', null);                                 // 웹: 페이지가 닫혔음 → 나가기 직전까지 저장한 값으로 분석
  store.set('rec', null); store.set('recSnap', null);
  if (!snap?.s?.length) return;
  $('pos').value = snap.pos; $('dmode').value = snap.dmode; gpsDenied = snap.gpsDenied; hiddenDuringRec = true;
  showSetSum();                                                            // 접힌 설정 요약도 이어 받은 위치·거리 방법으로 (다음 측정이 이 값으로 잼)
  finish(snap.s.map(([t, m]) => ({ t, x: m, y: 0, z: 0, mag: true })), false, snap.g || []);   // mag: 크기 값뿐 → 센서 원본으로는 저장 안 함
  $('result').insertAdjacentHTML('afterbegin', `<div class="warn" style="font-size:1rem"><b>웹(브라우저)으로 측정해서 끊겼어요.</b> 나가기 직전까지의 기록으로 분석했어요. 웹은 다른 앱으로 가면 측정이 멈춰요. 설치형 안드로이드 앱은 다른 앱을 써도 계속 측정돼요.
    ${/Android/.test(navigator.userAgent) ? '<a class="btnlike" href="install.html">설치형 앱 받기</a>' : ''}</div>`);   // 검수팀 제안 d
})();
let savedTab = null; try { savedTab = sessionStorage.getItem('tab'); sessionStorage.removeItem('tab'); } catch {}
if (document.body.dataset.tab === 'home') setTab(savedTab || 'home');   // 측정 이어 하기로 이미 측정 탭을 열었으면 그대로, 새 버전 새로고침이면 보던 탭으로
// 새 화면 버전이 적용되면 한 번 새로고침 (옛 화면이 남지 않게)
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  // 새 버전: sw.js는 네트워크 먼저라 앱을 열 때 화면은 대개 이미 최신 → 화면 버전(APP_VERSION)이 새 sw VERSION과 다를 때만(오프라인으로 열었던 경우 등) 새로고침.
  // 그때도 쓰는 도중엔 안 하고(탭을 누르다 홈으로 튕겼음) 화면을 떠날 때, 측정 중(카운트다운 포함)엔 안 함. 보던 탭은 기억
  let swNew = false;
  const swReload = () => { if (!swNew || !document.hidden || window.__reloaded || t0 || document.body.classList.contains('recording')) return; window.__reloaded = true; try { sessionStorage.setItem('tab', document.body.dataset.tab); } catch {} location.reload(); };
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (!had) return;
    try { const v = (await (await fetch('sw.js', { cache: 'no-store' })).text()).match(/VERSION = '([^']+)'/)?.[1]; if (!v || v === APP_VERSION) return; } catch { return; }
    swNew = true; swReload();
  });
  document.addEventListener('visibilitychange', swReload);
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
}
// 웹인지 설치형인지 + 버전 (검수팀 제안 c). 앱 버전은 0.14부터 네이티브가 알려 줌, 그 전 앱은 버전 없이
$('appver').textContent = Native ? `설치형 앱 · 화면 ${APP_VERSION}` : `웹(브라우저) · 화면 ${APP_VERSION}`;
$('recMode').textContent = Native ? '설치형 앱 · 화면 꺼도 돼요' : '웹 · 화면을 켜 두세요';   // 웹인지 설치형인지 스스로 구분 (아버님 민원, v86)
$('recMode').classList.toggle('web', !Native);
if (Native) (async () => { try { const { version } = await Native.info(); if (version) $('appver').textContent = `설치형 앱 ${version} · 화면 ${APP_VERSION}`; } catch {} })();
syncPicks();                                                               // 처음 불러온 select 값(지난 선택)을 고르기 줄에 반영
