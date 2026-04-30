# Gangneung Dart

실시간 다트 룰렛 게임 프로젝트입니다.  
모바일 컨트롤러, 대형 디스플레이, 관리자 QR 발급, QR 세션 인증까지 하나의 Next.js 앱 안에서 운영합니다.

---

## 목적

- 플레이어는 모바일에서 QR 인증 후 room에 참가합니다.
- 최대 4명이 한 게임 세션을 구성합니다.
- 각 플레이어는 자신의 턴에 자이로 센서로 조준하고 다트를 던집니다.
- 디스플레이는 로비 참가자, 조준점, 투척 결과, 점수, 종료 결과를 실시간으로 표시합니다.

---

## 앱 구성

```text
app/
  admin/qr/        관리자 QR 생성 페이지
  auth/[token]/    QR 세션 인증 후 모바일로 리다이렉트
  mobile/          플레이어 컨트롤러
  display/         현장 디스플레이
```

- `admin`: 현장 운영자가 접속 QR을 생성하고 방 종료를 요청합니다.
- `auth`: QR 토큰 형식을 검증하고 세션을 `sessionStorage`에 저장합니다.
- `mobile`: 이름 입력, room 참가, 게임 참여, 자이로 조준/투척을 담당합니다.
- `display`: observer로 연결되어 로비와 게임 상태를 시각화합니다.

---

## 프로젝트 구조

```text
app/                 Next.js 라우트와 앱 UI
lib/                 공용 도메인 로직
shared/              공용 인프라
public/              3D 모델, 이미지, 사운드
docs/                스펙, 수동 테스트 문서
__tests__/           테스트 코드
```

주요 공용 파일:

- `shared/socket.ts`: Socket.IO 클라이언트 싱글톤
- `lib/room.ts`: 기본 room, 최대 플레이어 수, slot 계산
- `lib/session.ts`: QR 세션 저장/검증
- `lib/gameTiming.ts`: 턴/결과 표시 타이밍 상수
- `lib/score.ts`: 조준 좌표 기반 점수 계산

---

## 실행

```bash
npm install
npm run dev
```

환경 변수:

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SOCKET_URL` | 소켓 서버 URL |
| `NEXT_PUBLIC_ROOM` | 기본 room 이름 |

---

## 엔드투엔드 플로우

### 1. 관리자

1. `admin/qr`에서 QR URL을 생성합니다.
2. URL에는 `/auth/{token}?room={room}` 형식의 세션 진입 주소가 들어갑니다.
3. 필요 시 `disconnect-room`으로 현재 room 세션을 종료합니다.

### 2. 인증

1. 플레이어가 QR을 스캔하면 `auth/[token]`로 진입합니다.
2. 토큰 형식을 검사합니다.
3. 유효하면 세션을 저장하고 `/mobile?room={room}`으로 이동합니다.
4. 유효하지 않으면 인증 실패 화면을 보여줍니다.

### 3. 모바일 로비

1. 플레이어가 이름을 입력합니다.
2. 모션 권한을 요청합니다.
3. 소켓 연결 후 `joinRoom`으로 room 참가를 시도합니다.
4. room이 가득 찼으면 `roomFull`을 받아 진입을 막습니다.
5. `joinedRoom` 기준 상위 4명이 이번 게임 참가 후보가 됩니다.
6. 1번 플레이어는 host가 되며 30초 안에 게임 시작을 승인할 수 있습니다.

### 4. 게임 시작

1. host가 `startGame`을 요청합니다.
2. 서버/클라이언트는 `gameStarted`를 기준으로 같은 참가자 집합을 확정합니다.
3. 각 모바일은 자신의 `slot`과 참가자 목록을 받아 게임 상태로 전환합니다.
4. 디스플레이는 기존 게임 상태를 비우고 새 세션 UI로 초기화합니다.

### 5. 턴 진행

1. 자기 차례인 모바일만 자이로 센서와 투척 UI를 활성화합니다.
2. 모바일은 조준 중 `aim-update`를 전송합니다.
3. 투척 시 `throw-dart`를 전송합니다.
4. 3투 종료 시 `aim-off`를 전송합니다.
5. 디스플레이는 조준점, 다트, 점수판을 실시간 반영합니다.

### 6. 게임 종료

1. 모든 플레이어가 종료되면 host가 `finish-game`을 전송합니다.
2. 서버는 `game-result`, `game-finished`를 브로드캐스트합니다.
3. 모바일은 결과 화면과 종료 카운트다운을 보여줍니다.
4. 디스플레이는 우승 오버레이와 랭킹을 표시합니다.
5. 결과 표시가 끝나면 디스플레이가 `disconnect-room`을 호출해 room 전체를 비웁니다.
6. 다음 참가자는 새 연결로 다시 `joinRoom` 합니다.

---

## 소켓 설계 원칙

### 1. 소켓은 싱글톤

- 클라이언트는 `shared/socket.ts`의 단일 Socket.IO 인스턴스를 재사용합니다.
- `autoConnect: false`로 두고 각 앱이 필요한 시점에 직접 연결합니다.
- 연결 시 `query.room`, `query.name`을 함께 설정합니다.

### 2. room 자체를 로비로 사용

- 큐 이벤트(`join-queue`, `leave-queue`, `status-queue`)에는 의존하지 않습니다.
- 모바일은 `joinRoom`으로 참가를 시도하고, 서버는 `roomFull`로 정원 초과를 알립니다.
- 로비 참가자 목록은 `joinedRoom`, `roomPlayerCount`를 기준으로 동기화합니다.

### 3. display는 observer

- display는 room 상태를 관찰하고 렌더링합니다.
- 게임 종료 후 결과 화면을 보여준 뒤 `disconnect-room`으로 room 세션 정리를 트리거합니다.
- 다음 게임은 새로 입장한 참가자들로 다시 시작합니다.

### 4. 세션은 종료 시 완전히 비움

- 게임 종료 후 현재 room의 연결을 모두 끊어 다음 세션과 섞이지 않게 합니다.
- 페이지 이탈/언마운트 시 소켓 연결 정리와 room 상태 초기화를 수행합니다.
- 모바일은 `roomFull`과 `disconnect` 이후 초기 상태로 되돌아갈 수 있어야 합니다.

---

## 소켓 이벤트

### 로비/room 이벤트

| 이벤트 | 송신 주체 | 목적 |
|------|------|------|
| `joinRoom` | mobile | room 참가 시도 |
| `joinedRoom` | server | 현재 room 참가자 목록 전달 |
| `roomPlayerCount` | server | room 인원 수 전달 |
| `roomFull` | server | 정원 초과 안내 |
| `disconnect-room` | display, admin | room 전체 세션 종료 |

### 게임 진행 이벤트

| 이벤트 | 송신 주체 | 목적 |
|------|------|------|
| `startGame` | mobile host | 게임 시작 요청 |
| `gameStarted` | server/host flow | 참가자 집합 확정, 게임 시작 알림 |
| `aim-update` | mobile | 조준 좌표 전송 |
| `throw-dart` | mobile | 투척 결과 전송 |
| `aim-off` | mobile | 턴 종료 알림 |
| `finish-game` | mobile host | 게임 종료 점수 집계 요청 |
| `game-result` | server | 플레이어별 승패/랭크 전달 |
| `game-finished` | server | 게임 종료 브로드캐스트 |

### 이벤트별 실제 사용 방식

- `aim-update`
  - 게임 시작 등록과 실시간 조준 좌표 전송에 사용됩니다.
- `aim-off`
  - `totalThrows >= 3`일 때 해당 플레이어 턴 종료로 취급합니다.
- `game-result`
  - 모바일은 본인 결과 화면에 사용합니다.
- `game-finished`
  - display와 mobile 모두 세션 종료 기준으로 사용합니다.
- `disconnect-room`
  - 결과 화면 종료 후 현재 room의 모든 연결을 정리합니다.

---

## room / slot 모델

공용 정의:

- 기본 room: `lib/room.ts`의 `DEFAULT_ROOM`
- 최대 플레이어 수: `MAX_PLAYERS = 4`
- slot: `1 | 2 | 3 | 4`

운영 규칙:

1. `joinedRoom` 참가자 목록의 앞 4명이 이번 게임 참가자입니다.
2. room 내 위치 `0..3`이 slot `1..4`가 됩니다.
3. 게임 중 색상, 점수판, 조준점은 slot 기준으로 맞춥니다.
4. display는 `slot`, `socketId`, alias를 함께 관리하지만 최종 시각 표현은 slot 기준입니다.

---

## 모바일 플로우 상세

### 진입

- `auth`에서 세션이 저장되어야 진입 가능
- 이름 입력
- 모션 권한 요청
- `joinRoom` 시도

### 로비

- `joinedRoom`, `roomPlayerCount`로 참가자 표시
- host 승인 대기
- 로비 타임아웃 시 자동 이탈
- `roomFull` 수신 시 진입 실패 처리

### 게임

- `useMobileSocket`이 slot 기준으로 게임 등록
- 자기 차례면 센서 시작
- `aim-update` 연속 송신
- `throw-dart` 최대 3회
- `aim-off`로 턴 종료
- 모든 플레이어 종료 후 host가 `finish-game`

### 종료

- `game-result`
- `game-finished`
- 종료 카운트다운 후 소켓 정리, 센서 정리
- 이후 room 전체 종료는 `disconnect-room`에 맡김

---

## 디스플레이 플로우 상세

### 연결

- room observer로 연결
- `joinedRoom`, `roomPlayerCount`로 로비 상태 표시

### 게임 시작

- `gameStarted` 수신 시 이전 세션 상태 제거
- 점수판, 조준점, 다트 상태 초기화
- 새 게임 세션 UI 시작

### 진행

- `aim-update`: 조준점 갱신
- `throw-dart`: 점수 반영, 다트 연출
- `aim-off`: 플레이어 턴 종료 처리
- 점수판은 slot 기준 색상/정렬 유지

### 종료

- `game-finished` 수신 시 결과 오버레이 표시
- 랭킹 저장/갱신
- 결과 카운트다운 종료 후 `disconnect-room`

---

## 점수와 좌표 처리

- 모바일은 자이로 기준 조준 좌표를 계산합니다.
- `lib/score.ts`가 디스플레이 중심 좌표와 룰렛 반지름 기준으로 점수를 계산합니다.
- 디스플레이는 3D 씬의 중심점과 반지름을 사용해 최종 적중 구역을 계산합니다.

점수 규칙:

| 구역 | 점수 |
|------|------|
| Bull | 50 |
| Triple | 30 |
| Double | 20 |
| Single | 10 |
| Miss | 0 |

---

## 안정화 / 예외 처리

- 페이지 이탈 시 소켓 연결 정리
- room full 시 모바일 진입 차단
- display는 결과 화면 종료 후 room 전체 연결 정리
- 모바일은 게임 종료 후 cleanup을 명시적으로 수행
- 다음 게임 참가자는 항상 새 세션으로 다시 입장

---

## 수동 테스트 문서

- `docs/SPEC.md`: 프로젝트 스펙 문서
- `docs/manual-tests/01_socket_test_script.html`: 수동 소켓 테스트 페이지

---

## 현재 구조 판단

- `app`: 제품 라우트와 UI
- `lib`: 공용 도메인 로직
- `shared`: 공용 인프라
- `docs`: 스펙과 수동 테스트
- `__tests__`: 테스트 코드

추가 리팩터링은 디렉토리 재배치보다, 큰 파일을 점진적으로 줄이는 방향이 우선입니다.

- `app/mobile/page.tsx`
- `app/display/hooks/useDisplaySocket.ts`
