// 구글 Apps Script 수신 코드 (script.google.com 단독 프로젝트 '걸음분석 수신')
// 배포 → 새 배포 → 웹 앱, 실행: 나, 액세스: 모든 사용자 → 나온 주소를 app.js의 ENDPOINT에 넣기
const SHEET_ID = '19EJCFgAhHS5fOHbgu9CGx41WdPrWYRENbywh0AJbrKU';   // '걸음분석 수집' 시트 (운영자 계정에서만 열림)
const KEYS = ['receipt', 'date', 'appVersion', 'cadence', 'steps', 'activeS', 'regularity', 'speed', 'stepLength',
  'distance', 'position', 'practice', 'warnings', 'ageGroup', 'sex', 'os'];

const FB_KEYS = ['receipt', 'date', 'appVersion', 'os', 'src', 'text'];   // 건의함 (처리방침 2-1번) + 마지막 칸 '사진'(드라이브 파일 주소)
const PHOTO_FOLDER = '걸음분석 건의 사진';                               // 운영자 드라이브의 비공개 폴더 (없으면 만듦)

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
    if (sh.getLastRow() === 0) sh.appendRow(['받은 날(UTC)', ...FB_KEYS, '사진']);
    sh.appendRow([new Date().toISOString().slice(0, 10), ...FB_KEYS.map(k => clean(d[k], k === 'text' ? 1000 : 60)), savePhotos(d).join(' ')]);
    return ContentService.createTextOutput('ok');
  }
  const sheet = book.getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(['받은 날(UTC)', ...KEYS]);
  sheet.appendRow([new Date().toISOString().slice(0, 10), ...KEYS.map(k => clean(d[k], 60))]);
  return ContentService.createTextOutput('ok');
}
