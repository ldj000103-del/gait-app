// 구글 Apps Script 수신 코드 (script.google.com 단독 프로젝트 '걸음분석 수신')
// 배포 → 새 배포 → 웹 앱, 실행: 나, 액세스: 모든 사용자 → 나온 주소를 app.js의 ENDPOINT에 넣기
const SHEET_ID = '19EJCFgAhHS5fOHbgu9CGx41WdPrWYRENbywh0AJbrKU';   // '걸음분석 수집' 시트 (운영자 계정에서만 열림)
const KEYS = ['receipt', 'date', 'appVersion', 'cadence', 'steps', 'activeS', 'regularity', 'speed', 'stepLength',
  'distance', 'position', 'practice', 'warnings', 'ageGroup', 'sex', 'os'];

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  // 누구나 보낼 수 있는 주소라 정해진 칸만, 짧게, 수식으로 해석되지 않게 저장
  const row = KEYS.map(k => {
    const v = d[k];
    if (typeof v === 'number') return isFinite(v) ? v : '';
    const s = String(v ?? '').slice(0, 60);
    return /^[=+\-@]/.test(s) ? "'" + s : s;
  });
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(['받은 날(UTC)', ...KEYS]);
  sheet.appendRow([new Date().toISOString().slice(0, 10), ...row]);
  return ContentService.createTextOutput('ok');
}
