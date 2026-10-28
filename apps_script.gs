// 구글 Apps Script 수신 코드 (script.google.com 단독 프로젝트 '제목 없는 프로젝트') · 받은 날은 서울 날짜
// 배포 → 새 배포 → 웹 앱, 실행: 나, 액세스: 모든 사용자 → 나온 주소를 app.js의 ENDPOINT에 넣기
const SHEET_ID = '19EJCFgAhHS5fOHbgu9CGx41WdPrWYRENbywh0AJbrKU';   // '걸음분석 수집' 시트 (운영자 계정에서만 열림)
const KEYS = ['receipt', 'date', 'appVersion', 'cadence', 'steps', 'activeS', 'regularity', 'speed', 'stepLength',
  'distance', 'position', 'practice', 'warnings', 'ageGroup', 'sex', 'os'];

const FB_KEYS = ['receipt', 'date', 'appVersion', 'os', 'src', 'text'];   // 건의함 (처리방침 2-1번) + 마지막 칸 '사진'(드라이브 파일 주소)
const RESULT_SHEET = '시트1';                                             // 측정 결과 탭 (이름으로 찾음: 탭 순서가 바뀌어도 다른 탭에 섞이지 않게)
const PHOTO_FOLDER = '걸음분석 건의 사진';                               // 운영자 드라이브의 비공개 폴더 (없으면 만듦)

// 매일 새벽 4시 purgeOld 예약 (편집기에서 한 번 실행. 맨 위에 둬야 실행 칸에서 기본으로 골라짐)
function setupDailyPurge() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'purgeOld').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('purgeOld').timeBased().everyDays(1).atHour(4).create();
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);                  // 드라이브 권한도 이때 함께 받고, 사진 폴더를 미리 만들어 둠
  if (!it.hasNext()) DriveApp.createFolder(PHOTO_FOLDER);
}

// 누구나 보낼 수 있는 주소라 정해진 칸만, 짧게, 수식으로 해석되지 않게 저장
function clean(v, n) {
  if (typeof v === 'number') return isFinite(v) ? v : '';
  const s = String(v ?? '').slice(0, n);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// 사진은 3장까지, 한 장 3MB(base64 약 4MB)까지만 JPEG로 저장. 파일 이름 = 접수번호-번호.jpg
function savePhotos(d) {
  if (!Array.isArray(d.photos) || !d.photos.length) return [];
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER), folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
  const id = String(d.receipt || 'K-?').replace(/[^\w-]/g, '').slice(0, 20);
  return d.photos.slice(0, 3).filter(b => typeof b === 'string' && b.length < 4e6)
    .map((b, i) => folder.createFile(Utilities.newBlob(Utilities.base64Decode(b), 'image/jpeg', `${id}-${i + 1}.jpg`)).getUrl());
}

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const book = SpreadsheetApp.openById(SHEET_ID);
  if (d.kind === 'feedback') {                                       // 건의함: '건의' 탭에 따로, 글은 1000자까지
    const sh = book.getSheetByName('건의') || book.insertSheet('건의');
    if (sh.getLastRow() === 0) sh.appendRow(['받은 날', ...FB_KEYS, '사진']);
    let urls = '';
    try { urls = savePhotos(d).join(' '); } catch (err) { urls = '사진 저장 실패: ' + String(err).slice(0, 50); }   // 드라이브가 실패해도 글은 남김
    sh.appendRow([Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), ...FB_KEYS.map(k => clean(d[k], k === 'text' ? 1000 : 60)), urls]);
    return ContentService.createTextOutput('ok');
  }
  if (d.kind === 'delete') {                                         // 앱에서 기록을 지우며 '익명 결과도 지워 달라고 요청하기'를 고른 경우 (처리방침 6번)
    const rc = String(d.receipt || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 16), sh = book.getSheetByName(RESULT_SHEET);
    if (rc && sh && sh.getLastRow() > 1) {
      const col = KEYS.indexOf('receipt') + 2, vals = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
      let n = 0;
      for (let i = vals.length - 1; i >= 0; i--) {                   // 아래에서 위로 (줄 번호가 안 밀리게)
        const v = vals[i][0];                                         // 숫자만인 접수번호(01234567 등)는 시트가 숫자로 바꿔 저장함 → 숫자로도 비교 (검수팀)
        if (String(v) === rc || (typeof v === 'number' && v === Number(rc))) { sh.deleteRow(i + 2); n++; }
      }
      console.log('delete request', n);                               // 삭제 요청 수만 기록 (이상한 대량 요청을 알아채려고, 접수번호는 남기지 않음)
    }
    return ContentService.createTextOutput('ok');
  }
  const sheet = book.getSheetByName(RESULT_SHEET) || book.insertSheet(RESULT_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(['받은 날', ...KEYS]);
  sheet.appendRow([Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), ...KEYS.map(k => clean(d[k], 60))]);
  return ContentService.createTextOutput('ok');
}

// 처리방침 3번 보유 기간 지키기: 측정 결과 3년, 건의 글 1년, 건의 사진 90일이 지나면 지움 (사진은 휴지통이 아니라 영구 삭제)
// 매일 한 번 돌도록 setupDailyPurge()를 편집기에서 한 번 실행해 두면 됨
function purgeOld() {
  const now = Date.now(), day = 864e5;
  const book = SpreadsheetApp.openById(SHEET_ID);
  const trim = (sh, days) => {
    if (!sh || sh.getLastRow() < 2) return;
    const dates = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (let i = dates.length - 1; i >= 0; i--) {                     // 아래에서 위로 지워야 줄 번호가 안 밀림
      const t = new Date(dates[i][0]).getTime();
      if (t && now - t > days * day) sh.deleteRow(i + 2);
    }
  };
  trim(book.getSheetByName(RESULT_SHEET), 3 * 365);
  trim(book.getSheetByName('건의'), 365);
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  if (it.hasNext()) {
    const files = it.next().getFiles();
    while (files.hasNext()) { const f = files.next(); if (now - f.getDateCreated().getTime() > 90 * day) Drive.Files.remove(f.getId()); }
  }
}
