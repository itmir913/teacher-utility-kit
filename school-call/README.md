# 🔔 학교 실시간 호출 시스템

AES-256 End-to-End 암호화 기반의 학교용 실시간 호출 PWA 시스템입니다.

## 📁 파일 구조

```
/
├── index.html            ← 메인 진입점 (모드 선택)
├── sender/
│   └── index.html        ← 송신부 (호출하는 기기)
├── receiver/
│   └── index.html        ← 수신부 (호출 받는 기기)
├── assets/               ← (선택) MP3 벨소리 폴더
│   ├── bell1.mp3
│   ├── bell2.mp3
│   ├── bell3.mp3
│   └── bell4.mp3
├── server.js             ← Node.js 백엔드
├── package.json
└── Dockerfile
```

---

## 🚀 배포 방법

### 1. 프론트엔드 (GitHub Pages)

1. 이 저장소를 GitHub에 Push
2. **Settings → Pages → Source: main branch / root** 선택
3. `https://[username].github.io/[repo-name]/` 으로 접속

### 2. 백엔드 (Oracle Cloud — Docker)

```bash
# 1. 서버에 파일 복사 (server.js, package.json, Dockerfile)
scp server.js package.json Dockerfile ubuntu@[서버IP]:~/school-call/

# 2. Docker 빌드 및 실행
cd ~/school-call
docker build -t school-call-server .
docker run -d \
  --name school-call \
  -p 3000:3000 \
  --restart unless-stopped \
  school-call-server

# 3. 서버 동작 확인
curl http://[서버IP]:3000/health
```

#### 방화벽 설정 (Oracle Cloud)
Oracle Cloud 콘솔 → VCN → 보안 목록 → 수신 규칙에서 **TCP 3000 포트** 열기

#### HTTPS 설정 (필수 — GitHub Pages는 HTTPS)
Nginx + Let's Encrypt를 앞단에 두거나, Caddy를 사용하세요:

```bash
# Caddy 예시 (caddy 설치 후)
# /etc/caddy/Caddyfile
your-domain.com {
    reverse_proxy localhost:3000
}
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

---

## 🎵 벨소리 커스터마이징

`/assets/` 폴더에 `bell1.mp3` ~ `bell4.mp3` 파일을 넣으면 자동으로 사용됩니다.  
파일이 없으면 Web Audio API로 합성된 벨소리가 재생됩니다.
