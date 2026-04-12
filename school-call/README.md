# 🔔 학교 선생님 실시간 호출 시스템

AES-256 End-to-End 암호화 기반의 학교용 실시간 호출 PWA 시스템입니다.

## 📁 파일 구조

```
/
├── index.html            ← 메인 진입점 (모드 선택)
├── sender/               ← 송신부 (호출하는 기기)
│   └── index.html        
├── receiver/             ← 수신부 (호출 받는 기기)
│   └── index.html        
├── backend/              ← Node.js 백엔드
│   └── server.js
│   └── package.json
│   └── Dockerfile
│   └── docker-compose.yml
│   └── .env.relay
│   └── .env.mirror
```

---

## 🚀 배포 방법

### 1. 프론트엔드 (GitHub Pages)

1. 이 저장소를 GitHub에 Push
2. **Settings → Pages → Source: main branch / root** 선택
3. `https://[username].github.io/[repo-name]/` 으로 접속

### 2. 백엔드 (Oracle Cloud — Docker)

백엔드 서버는 두 가지 모드가 존재합니다.

#### 2.1. relay 모드

클라이언트 간 이벤트를 중계하는 기본 서버 모드. 로컬 단독 운영 또는 Cloud VPS 배포 시 사용.

```bash
# (Nginx 포함 전체 실행)
docker compose up -d --build

# (백엔드만 실행)
docker compose up -d school-call --build
```

#### 2.2. mirror 모드

relay로 동작하면서, 외부 relay 서버(Cloud VPS 등)에 동일 신호를 복제 전송하는 서버 모드. 내부망과 외부망을 동시에 지원해야 할 때 사용.

```bash
# (Nginx 포함 전체 실행)
MODE_ENV=mirror docker compose up -d --build

# (백엔드만 실행)
MODE_ENV=mirror docker compose up -d school-call --build
```

---

## ⚙️ 사용 방법

### 설정 (최초 1회)

| 항목 | 설명 |
|------|------|
| 서버 주소 | `https://your-server.com` (백엔드 주소) |
| Room ID | 송신부와 수신부가 **동일**해야 함 |
| PIN 번호 | 암호화 키 — 송신부와 수신부가 **동일**해야 함 |

### 송신부 (iPad 1 — 교문/현관)
1. `sender/index.html` 접속 → 설정 입력 후 저장
2. 선생님 탭 선택 → **[호출]** 버튼 클릭
3. Wake Lock으로 화면 꺼짐 자동 방지

### 수신부 (iPad 2 — 교무실)
1. `receiver/index.html` 접속 → 설정 입력 후 저장
2. **[알람 활성화 및 시작]** 버튼 클릭 (오디오 권한 획득)
3. 호출 수신 시 자동 알람 — **[확인]** 버튼으로 해제

---

## 🔒 보안

- **AES-256 암호화**: PIN을 SHA-256으로 해싱하여 암호화 키 생성
- **복호화 실패 무시**: 잘못된 PIN으로 보낸 신호는 자동 무시 (장난 방지)
- **서버는 중계만**: 서버는 암호화된 데이터를 그대로 전달(릴레이)만 하므로 내용을 볼 수 없음
