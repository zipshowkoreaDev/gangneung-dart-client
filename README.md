# Gangneung Dart

실시간 다트 체험 운영 앱입니다. QR 인증, 모바일 조준, 디스플레이 진행, 랭킹 관리를 하나의 Next.js 앱에서 함께 제공합니다.

- `display`: 대형 화면에서 게임 진행, 점수, 랭킹, 승자 오버레이를 표시
- `mobile`: 플레이어가 QR 인증 후 입장해 자이로 센서로 조준하고 투척
- `admin/qr`: 운영용 QR 발급 및 방 세션 종료
- `auth/[token]`: QR 토큰을 검증하고 모바일 세션을 발급

기본 진입점인 `/`는 현재 `display` 화면을 그대로 렌더링합니다.

---

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Socket.IO Client
- React Three Fiber / Drei / Three.js
- Vitest + Testing Library
- Zustand

---

## 라우트 개요

| 경로 | 역할 |
| --- | --- |
| `/` | 디스플레이 메인 화면 (`app/display/page.tsx`) |
| `/display` | 디스플레이 전용 진입 경로 |
| `/mobile` | 모바일 컨트롤러 |
| `/admin/qr` | 운영용 QR 생성, URL 복사, 방 종료 |
| `/auth/[token]` | QR 토큰 검증 후 `sessionStorage`에 세션 저장, `/mobile`로 리다이렉트 |

---

## 핵심 플로우

### 1. QR 발급과 인증

1. 운영자가 `/admin/qr`에서 세션 URL을 생성합니다.
2. URL 형식은 `/auth/{token}?room={room}` 입니다.
3. 사용자가 QR을 스캔하면 `app/auth/[token]/page.tsx`가 토큰 형식을 검증합니다.
4. 유효하면 `sessionStorage`에 토큰과 시각을 저장하고 `/mobile?room={room}`으로 이동합니다.
5. 유효하지 않으면 인증 실패 화면을 표시합니다.

세션 저장 로직은 [lib/session.ts](/abs/path/D:/gangneung-dart/lib/session.ts)에 있으며, 탭 단위로 저장되고 24시간 후 만료됩니다.

### 2. 모바일 로비와 게임 시작

1. 플레이어는 `/mobile`에서 이름을 입력합니다.
2. 모션/방향 센서 권한을 요청합니다.
3. `useLobby`가 소켓에 `query.room`, `query.name`을 설정하고 `joinRoom`을 전송합니다.
4. 방 인원 스냅샷은 `joinedRoom` 이벤트로 동기화됩니다.
5. 최대 4명까지만 이번 게임 후보가 되며, 첫 번째 플레이어가 host입니다.
6. host는 30초 안에 `startGame`을 전송할 수 있습니다.
7. 대기 시간 2분이 지나면 자동 이탈합니다.

구현 위치:

- [app/mobile/page.tsx](/abs/path/D:/gangneung-dart/app/mobile/page.tsx)
- [app/mobile/hooks/socket/useLobby.ts](/abs/path/D:/gangneung-dart/app/mobile/hooks/socket/useLobby.ts)

### 3. 모바일 투척

1. 자신의 차례가 되면 `useGyroscope`가 센서를 활성화합니다.
2. 조준 중에는 `aim-update`를 연속 전송합니다.
3. 투척 감지 시 `throw-dart`를 전송합니다.
4. 3회 투척이 끝나면 `aim-off`를 전송하고 턴 종료 상태로 전환합니다.
5. 모든 플레이어가 끝나면 host가 `finish-game`을 전송합니다.

센서와 점수 계산 관련 구현:

- [app/mobile/hooks/useGyroscope.ts](/abs/path/D:/gangneung-dart/app/mobile/hooks/useGyroscope.ts)
- [app/mobile/hooks/socket/useMobileSocket.ts](/abs/path/D:/gangneung-dart/app/mobile/hooks/socket/useMobileSocket.ts)
- [lib/score.ts](/abs/path/D:/gangneung-dart/lib/score.ts)

### 4. 디스플레이

1. 디스플레이는 observer처럼 소켓 이벤트를 구독합니다.
2. `joinedRoom`과 `roomPlayerCount`로 로비 상태를 유지합니다.
3. `aim-update`, `dart-thrown`, `aim-off`를 받아 조준점, 점수판, 다트 상태를 갱신합니다.
4. `game-finished`를 받으면 우승자 오버레이와 일일 랭킹을 표시합니다.
5. 결과 카운트다운이 끝나면 `disconnect-room`을 전송해 방 세션을 정리합니다.

구현 위치:

- [app/display/page.tsx](/abs/path/D:/gangneung-dart/app/display/page.tsx)
- [app/display/hooks/useDisplaySocket.ts](/abs/path/D:/gangneung-dart/app/display/hooks/useDisplaySocket.ts)
- [app/display/hooks/useDisplayGameSession.ts](/abs/path/D:/gangneung-dart/app/display/hooks/useDisplayGameSession.ts)

---

## 소켓 구조

공용 소켓 인스턴스는 [shared/socket.ts](/abs/path/D:/gangneung-dart/shared/socket.ts) 하나를 사용합니다.

특징:

- `autoConnect: false`
- `polling`, `websocket` 둘 다 허용
- 클라이언트가 연결 시점마다 `query.room`, `query.name`을 직접 설정
- `forceNew: true`

### 현재 코드에서 사용하는 주요 이벤트

| 이벤트 | 송신 주체 | 용도 |
| --- | --- | --- |
| `joinRoom` | mobile | 로비 참가 |
| `joinedRoom` | server | 참가자 목록 스냅샷 |
| `roomPlayerCount` | server | 현재 인원 수 |
| `roomFull` | server | 정원 초과 안내 |
| `startGame` | mobile host | 게임 시작 요청 |
| `statusUpdate` | server | `pending` / `play` / `finish` 상태 동기화 |
| `gameStarted` | server | 게임 시작 신호 |
| `aim-update` | mobile | 조준 좌표 및 플레이어 등록 동기화 |
| `throw-dart` | mobile | 투척 이벤트 송신 |
| `dart-thrown` | server | 디스플레이/클라이언트 반영용 투척 이벤트 |
| `aim-off` | mobile | 턴 종료 또는 연결 해제 반영 |
| `finish-game` | mobile host | 최종 점수 집계 요청 |
| `game-result` | server | 모바일 개인 결과 |
| `game-finished` | server | 디스플레이 결과/랭킹 처리 |
| `disconnect-room` | display, admin | 방 세션 정리 |

주의:

- 현재 구현은 README 초안에 있던 `join-queue`, `leave-queue` 계열 이벤트를 사용하지 않습니다.
- 모바일은 `throw-dart`를 보내고, 디스플레이는 서버가 다시 브로드캐스트한 `dart-thrown`을 소비합니다.

---

## 점수 모델

점수는 고정 10/20/30/50 체계가 아니라 실제 다트보드처럼 구역과 섹터값을 함께 사용합니다.

- `INNER_BULL`, `OUTER_BULL`: 고정 점수
- `SINGLE`: 섹터값
- `DOUBLE`: 섹터값 x 2
- `TRIPLE`: 섹터값 x 3
- `MISS`: 0점

모바일은 `lib/score.ts`를 기준으로 적중 결과를 계산합니다. 디스플레이는 3D 씬에서 측정한 현재 보드 중심/반지름을 반영해 [app/display/lib/displayScoring.ts](/abs/path/D:/gangneung-dart/app/display/lib/displayScoring.ts)로 다시 계산할 수 있습니다.

---

## 랭킹 정책

랭킹은 브라우저 `localStorage`에 저장됩니다.

- 저장 키: `dart-ranking`
- 보관 개수: Top 3
- 정렬 기준: 점수 내림차순, 동점이면 최신 기록 우선
- 만료 시점: 로컬 자정

구현 위치:

- [lib/ranking.ts](/abs/path/D:/gangneung-dart/lib/ranking.ts)
- [app/display/hooks/useRankings.ts](/abs/path/D:/gangneung-dart/app/display/hooks/useRankings.ts)

---

## 디렉터리 구조

```text
app/
  admin/qr/            운영용 QR 발급 페이지
  auth/[token]/        QR 세션 인증
  display/             대형 화면 UI, 게임 시각화, 3D 씬
  mobile/              모바일 컨트롤러, 센서 입력, 게임 플로우
  shared/              앱 간 공유 타입
lib/                   공용 도메인 로직, 점수/세션/랭킹/타이밍
shared/                공용 인프라 (소켓)
public/
  models/              3D 다트/룰렛 모델
  sound/               타격/투척 효과음
docs/                  명세서, 수동 테스트 문서
__tests__/             Vitest 테스트
```

특히 먼저 보면 좋은 파일:

- [app/mobile/page.tsx](/abs/path/D:/gangneung-dart/app/mobile/page.tsx)
- [app/display/page.tsx](/abs/path/D:/gangneung-dart/app/display/page.tsx)
- [app/mobile/hooks/socket/useLobby.ts](/abs/path/D:/gangneung-dart/app/mobile/hooks/socket/useLobby.ts)
- [app/mobile/hooks/socket/useMobileSocket.ts](/abs/path/D:/gangneung-dart/app/mobile/hooks/socket/useMobileSocket.ts)
- [app/display/hooks/useDisplaySocket.ts](/abs/path/D:/gangneung-dart/app/display/hooks/useDisplaySocket.ts)
- [lib/score.ts](/abs/path/D:/gangneung-dart/lib/score.ts)
- [lib/session.ts](/abs/path/D:/gangneung-dart/lib/session.ts)
- [lib/room.ts](/abs/path/D:/gangneung-dart/lib/room.ts)

---

## 로컬 실행

### 요구 사항

- Node.js 22 이상 권장
- npm

### 설치 및 실행

```bash
npm install
npm run dev
```

브라우저 기본 주소:

- `http://localhost:3000/`
- `http://localhost:3000/display`
- `http://localhost:3000/mobile`
- `http://localhost:3000/admin/qr`

### 주요 스크립트

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:run
npm run test:coverage
```

---

## 환경 변수

| 변수 | 필수 여부 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_SOCKET_URL` | 권장 | Socket.IO 서버 주소. 미설정 시 기본값 `https://socket-relay.zipshowkorea.com/dart` 사용 |
| `NEXT_PUBLIC_ROOM` | 선택 | 기본 방 이름. 미설정 시 `zipshow` 사용 |
| `NEXT_PUBLIC_BASE_URL` | 선택 | QR 생성 시 사용할 기준 URL. 서버 렌더링 및 운영 도메인 고정에 사용 |

`.env.local` 예시:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000/dart
NEXT_PUBLIC_ROOM=zipshow
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## 테스트

현재 테스트는 유틸리티와 주요 훅 중심입니다.

- `lib/session.ts`
- `lib/score.ts`
- `lib/room.ts`
- `lib/ranking.ts`
- `lib/displayName.ts`
- `app/mobile/hooks/useNameInputFlow.ts`
- `app/mobile/hooks/useRadiusParam.ts`
- `app/mobile/hooks/useProfanityCheck.ts`
- `app/display/hooks/useDisplayState.ts`
- `app/display/hooks/useRankings.ts`
- `app/display/components/CountdownDisplay` 관련 동작

실행:

```bash
npm run test:run
```

문서:

- [docs/SPEC.md](/abs/path/D:/gangneung-dart/docs/SPEC.md)
- [docs/manual-tests/01_socket_test_script.html](/abs/path/D:/gangneung-dart/docs/manual-tests/01_socket_test_script.html)

---

## 배포 관련 파일

- [Dockerfile](/abs/path/D:/gangneung-dart/Dockerfile)
- [docker-compose.yml](/abs/path/D:/gangneung-dart/docker-compose.yml)
- [Jenkinsfile](/abs/path/D:/gangneung-dart/Jenkinsfile)

현재 `Dockerfile`은 빌드 시 `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SOCKET_URL`을 `ARG`로 주입받아 Next.js 프로덕션 빌드를 수행합니다.

---

## 개발 시 참고 사항

- 모바일 진입은 QR 세션 유효성에 의존합니다. 세션이 없으면 `/mobile`에서 접근 거부 화면이 먼저 표시됩니다.
- 로비와 게임 상태가 모두 같은 소켓 인스턴스를 재사용하므로, 연결 해제 타이밍을 건드릴 때는 `useLobby`, `useMobileSocket`, `useDisplayGameSession`을 함께 확인해야 합니다.
- 랭킹은 서버 저장이 아니라 디스플레이 브라우저 로컬 저장입니다. 운영 환경에서 디스플레이 브라우저를 바꾸면 랭킹도 초기화됩니다.
- 기본 홈(`/`)이 `display`를 렌더링하므로, 일반 사용자 랜딩 페이지를 별도로 만들 계획이라면 라우팅 구조를 먼저 재검토해야 합니다.
