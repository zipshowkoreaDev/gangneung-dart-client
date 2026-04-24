# Gangneung Dart

실시간 다트 룰렛 게임 프로젝트입니다.  
모바일 컨트롤러, 대형 디스플레이, 관리자 QR 발급, QR 세션 인증까지 하나의 Next.js 앱 안에서 운영합니다.

---

## 목적

- 플레이어는 모바일에서 QR 인증 후 대기열에 참가합니다.
- 상위 4명이 한 게임 세션을 구성합니다.
- 각 플레이어는 자신의 턴에 자이로 센서로 조준하고 다트를 던집니다.
- 디스플레이는 대기열, 조준점, 투척 결과, 점수, 종료 결과를 실시간으로 표시합니다.

---

## 앱 구성

```text
app/
  admin/qr/        관리자 QR 생성 페이지
  auth/[token]/    QR 세션 인증 후 모바일로 리다이렉트
  mobile/          플레이어 컨트롤러
  display/         현장 디스플레이
```

각 앱의 역할은 분리되어 있습니다.

- `admin`: 현장 운영자가 접속 QR을 생성하고 대기열 초기화를 요청합니다.
- `auth`: QR 토큰 형식을 검증하고 세션을 `sessionStorage`에 저장합니다.
- `mobile`: 이름 입력, 대기열 참여, 게임 참여, 자이로 조준/투척을 담당합니다.
- `display`: observer로 연결되어 대기열과 게임 상태를 시각화합니다.

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
3. 필요 시 `reset-queue`로 전체 대기열 초기화를 요청합니다.

### 2. 인증

1. 플레이어가 QR을 스캔하면 `auth/[token]`로 진입합니다.
2. 토큰 형식을 검사합니다.
3. 유효하면 세션을 저장하고 `/mobile?room={room}`으로 이동합니다.
4. 유효하지 않으면 인증 실패 화면을 보여줍니다.

### 3. 모바일 대기열

1. 플레이어가 이름을 입력합니다.
2. 모션 권한을 요청합니다.
3. 소켓 연결 후 `join-queue`를 전송합니다.
4. 모바일은 `status-queue`를 주기적으로 받아 자신의 위치를 추적합니다.
5. 대기열 상위 4명은 이번 게임 참가 후보가 됩니다.
6. 1번 플레이어는 host가 되며 30초 안에 게임 시작을 승인할 수 있습니다.
7. 4명이 모두 모이면 같은 상위 4명으로 게임 세션이 구성됩니다.

### 4. 게임 시작

1. host가 `start-game`을 요청하거나 상위 4명 기준으로 게임 시작 조건이 충족됩니다.
2. 서버/클라이언트는 `game-started`를 기준으로 같은 참가자 집합을 확정합니다.
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
4. 디스플레이는 우승 오버레이와 랭킹 반영을 수행합니다.
5. 디스플레이는 연결을 끊지 않고 다음 `game-started`를 기다립니다.

---

## 소켓 설계 원칙

이 프로젝트의 핵심 원칙은 아래 4가지입니다.

### 1. 소켓은 싱글톤

- 클라이언트는 `shared/socket.ts`의 단일 Socket.IO 인스턴스를 재사용합니다.
- `autoConnect: false`로 두고 각 앱이 필요한 시점에 직접 연결합니다.
- 연결 시 `query.room`, `query.name`을 함께 설정합니다.

### 2. 큐와 게임을 분리

- `status-queue`, `join-queue`, `leave-queue`는 로비/대기열 단계입니다.
- `aim-update`, `throw-dart`, `aim-off`, `finish-game`은 게임 단계입니다.
- display는 observer로서 두 단계를 모두 구독하지만, 제어권은 mobile/admin 쪽에 있습니다.

### 3. display는 observer

- display는 room 상태를 관찰하고 렌더링합니다.
- 게임 종료 후 room 관찰을 끊지 않습니다.
- 다음 게임이 시작되면 `game-started`를 기준으로 내부 상태만 초기화합니다.

### 4. 클라이언트는 복구 가능해야 함

- 재연결 시 `status-queue` 재요청
- 필요 시 `leave-queue -> join-queue` 재진입
- host stale 상황에서는 `reset-queue` 기반 복구
- 페이지 이탈/언마운트 시 `leave-queue`, `leaveRoom` 정리

---

## 소켓 이벤트

### 큐/로비 이벤트

| 이벤트 | 송신 주체 | 목적 |
|------|------|------|
| `join-queue` | mobile | 대기열 참가 |
| `leave-queue` | mobile | 대기열 이탈 |
| `status-queue` | mobile, display | 현재 대기열 스냅샷 요청/수신 |
| `joinedRoom` | server | 현재 room 참가자 목록 전달 |
| `roomPlayerCount` | server | room 인원 수 전달 |
| `roomFull` | server | 정원 초과 안내 |
| `reset-queue` | admin, recovery flow | 대기열/진행 상태 초기화 |

### 게임 진행 이벤트

| 이벤트 | 송신 주체 | 목적 |
|------|------|------|
| `start-game` | mobile host | 게임 시작 요청 |
| `game-started` | server/host flow | 참가자 집합 확정, 게임 시작 알림 |
| `aim-update` | mobile | 조준 좌표 전송 |
| `throw-dart` | mobile | 투척 결과 전송 |
| `aim-off` | mobile | 턴 종료 알림 |
| `finish-game` | mobile host | 게임 종료 점수 집계 요청 |
| `game-result` | server | 플레이어별 승패/랭크 전달 |
| `game-finished` | server | 게임 종료 브로드캐스트 |

### 이벤트별 실제 사용 방식

- `aim-update`
  - 대기열 단계에서는 `registration`, `queueRegistration` 플래그로 참가자 존재를 알려주는 용도로도 사용됩니다.
  - 게임 단계에서는 실제 조준 좌표를 보냅니다.
- `aim-off`
  - `totalThrows >= 3`일 때 해당 플레이어 턴 종료로 취급합니다.
- `game-result`
  - 모바일은 본인 결과 화면에 사용합니다.
  - display는 최종 종료 UI의 핵심 기준보다 보조 결과 이벤트에 가깝습니다.
- `game-finished`
  - display와 mobile 모두 세션 종료 기준으로 사용합니다.

---

## room / slot 모델

공용 정의:

- 기본 room: `lib/room.ts`의 `DEFAULT_ROOM`
- 최대 플레이어 수: `MAX_PLAYERS = 4`
- slot: `1 | 2 | 3 | 4`

운영 규칙:

1. 대기열 상위 4명이 이번 게임 참가자입니다.
2. queue position `0..3`이 slot `1..4`가 됩니다.
3. 게임 중 색상, 점수판, 조준점은 slot 기준으로 맞춥니다.
4. display는 `slot`, `socketId`, alias를 함께 관리하지만 최종 시각 표현은 slot 기준입니다.

---

## 모바일 플로우 상세

### 진입

- `auth`에서 세션이 저장되어야 진입 가능
- 이름 입력
- 모션 권한 요청
- `connectAndJoinQueue()`

### 대기열

- `status-queue` heartbeat
- host 승인 대기
- stale host 감지 시 자동 복구
- 대기열 타임아웃 시 자동 이탈

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
- 종료 카운트다운 후 `leaveQueue`, `leaveRoom`, 센서 정리

---

## 디스플레이 플로우 상세

### 연결

- room observer로 연결
- `status-queue`를 주기적으로 요청
- `joinedRoom`, `roomPlayerCount`, `status-queue`로 대기열 표시

### 게임 시작

- `game-started` 수신 시 이전 세션 상태 제거
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
- 소켓 연결은 유지
- 다음 `game-started`를 기다림

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

- 페이지 이탈 시 `leave-queue` 최대 전송
- 재연결 시 큐 재정합 시도
- room full 시 모바일 진입 차단
- host가 응답하지 않으면 stale host 복구 수행
- display는 다음 게임을 위해 연결 유지
- 모바일은 게임 종료 후 cleanup을 명시적으로 수행

---

## 수동 테스트 문서

- `docs/SPEC.md`: 프로젝트 스펙 문서
- `docs/manual-tests/01_socket_test_script.html`: 수동 소켓 테스트 페이지

---

## 현재 구조 판단

지금 구조는 아래 원칙으로 유지하는 것이 맞습니다.

- `app`: 제품 라우트와 UI
- `lib`: 공용 도메인 로직
- `shared`: 공용 인프라
- `docs`: 스펙과 수동 테스트
- `__tests__`: 테스트 코드

추가 리팩터링은 디렉토리 재배치보다, 큰 파일을 점진적으로 줄이는 방향이 우선입니다.

- `app/mobile/page.tsx`
- `app/display/hooks/useDisplaySocket.ts`

