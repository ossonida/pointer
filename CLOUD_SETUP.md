# Score Counter 클라우드 연결

현재 상태: 게임 기록 저장·게임별 통계는 로그인 없이 브라우저에서 동작합니다. Firebase 설정이 없으면 Google 로그인은 안내만 표시합니다. BGG 서버 주소가 없으면 BGG 검색 페이지를 새 탭으로 엽니다. 실제 외부 연결을 완료했다고 표시하지 않습니다.

## 1. Google 로그인과 기록 저장

1. Firebase Console에서 프로젝트와 웹 앱을 만듭니다.
2. Authentication → Sign-in method에서 Google을 활성화하고 지원 이메일을 지정합니다. Settings → Authorized domains에 `ossonida.github.io`를 추가합니다.
3. Firestore Database를 만듭니다. 테스트 모드로 공개하지 말고, 이 저장소의 `firestore.rules`를 Rules 탭에 복사해 게시합니다. 사용자별 `users/{uid}/plays/{playId}` 외에는 모두 차단합니다.
4. 프로젝트 설정 → 웹 앱의 `firebaseConfig` 객체를 `firebase-config.js`의 `null` 자리에 넣습니다. 이 웹 설정은 공개용입니다. 서비스 계정 JSON이나 BGG 토큰은 여기에 넣지 마세요.
5. GitHub Pages 배포 후 Google 로그인과 기록 저장을 확인합니다. 앱은 로그인한 사용자별 기록을 분리합니다. 로그인 전의 기록은 “이 기기 기록을 계정에 저장”을 눌러 명시적으로 복사합니다.

예시 구조(실제 값은 Firebase Console에서 복사):

```js
export const firebaseConfig = {
  apiKey: '웹 앱 API 키',
  authDomain: '프로젝트ID.firebaseapp.com',
  projectId: '프로젝트ID',
  appId: '웹 앱 ID'
};
export const bggSearchUrl = '';
```

로그인 후 저장은 우선 현재 기기에 기록합니다. 온라인에서 계정에 동기화하며, 실패한 기록은 저장 대기로 남겨 재시도합니다. “클라우드 동기화” 또는 온라인 복귀 시 다시 시도합니다. 클라우드 기록은 로그인/동기화 시 불러오며 다른 기기의 변경이 실시간으로 반영되는 방식은 아닙니다. 기록의 “점수 불러오기”를 누르면 현재 플레이어와 점수를 복원합니다. 같은 이름은 통계에서 같은 사람으로 집계하므로 서로 다른 사람은 다른 닉네임을 사용하세요. 공동 승리는 각 플레이어에게 승리 1회를 부여하며 협력 게임은 승률에서 제외합니다.

## 2. BGG API 검색 연결(선택)

BGG 공식 XML API의 현재 이용 조건에 따라 앱 등록/승인 및 API 토큰이 필요할 수 있습니다. 토큰을 발급받은 뒤 서버에 보관합니다. 토큰 없이 브라우저에 직접 요청하거나 임의 프록시를 사용하지 않습니다.

Firebase Cloud Functions 배포에는 Blaze 요금제와 결제 계정이 필요할 수 있습니다. 비용/쿼터와 BGG 이용 조건을 확인한 후 본인 프로젝트에 배포하세요. 아래 명령은 환경 준비 후 직접 실행할 수 있습니다.

```sh
cd functions
npm install
cd ..
npx firebase-tools login
npx firebase-tools functions:secrets:set BGG_API_TOKEN --project 실제프로젝트ID
npx firebase-tools deploy --only functions:score-bgg,firestore:rules --project 실제프로젝트ID
```

배포된 `bggSearch` HTTPS URL을 `firebase-config.js`의 `bggSearchUrl`에 넣습니다. 서버는 Firebase 로그인 토큰을 확인하고, 게임명 검색 결과의 이름·ID·연도만 반환합니다. BGG 토큰은 Secret Manager에만 보관하며 웹에 전송하지 않습니다. Firebase 웹 설정이나 저장소에는 서비스 계정 비밀 키를 올리지 마세요. 새 사용자가 가입 가능한 앱에서는 인증만으로 비용 남용을 완전히 막을 수 없으므로 공개 출시 전 App Check/쿼터/요청 제한을 추가로 검토하세요.

## 3. 검증

- 로그인하지 않은 상태에서 게임명·날짜·승리 조건·점수를 저장하고, 새로고침 후 기록 유지 확인.
- 높은/낮은 점수 승리, 공동 승리, 협력 게임의 통계 확인.
- 서로 다른 Google 계정은 상대의 기록을 읽거나 쓰지 못하는지 Firestore Rules Simulator에서 확인.
- 로그인 → 기기 기록 복사 → 다른 기기 로그인 → 동일 기록 조회 확인.
- 네트워크 중단 시 저장 대기, 온라인 복귀 후 동기화, 로그아웃 시 비로그인 기록으로 전환 확인.
- BGG 검색 실패/토큰 오류에도 직접 게임명 입력과 저장이 가능한지 확인.

BGG 기존 플레이 기록 가져오기와 BGG로 기록 내보내기는 이번 구현에 포함하지 않았습니다. 별도 인증/API 지원과 중복 기록 처리를 확인한 뒤 추가해야 합니다.

이전에 플레이스토어 등록용으로 “데이터 수집 없음”을 설정했다면 Google Analytics 및 Google 로그인/Firestore 사용에 맞춰 개인정보처리방침과 데이터 보안 설문을 갱신해야 합니다.
