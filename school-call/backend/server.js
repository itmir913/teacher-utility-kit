const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const crypto = require('crypto');

// ── 실행 모드 확인 ─────────────────────────────────
// relay : 순수 중계 서버 (Cloud VPS)
// mirror: 중계 + Cloud로 신호 복제 재전송 (라즈베리파이)
const MODE = process.env.MODE || 'relay';
const isMirrorMode = MODE === 'mirror';

if (MODE !== 'relay' && MODE !== 'mirror') {
    console.error(`[ERROR] [SYSTEM] Invalid MODE: "${MODE}". Use "relay" or "mirror".`);
    console.error(`[ERROR] [SYSTEM] Server Shutting Down`);
    process.exit(1);
}

console.log(`[INFO] [SYSTEM] Server Started | MODE: ${isMirrorMode ? 'MIRROR (Raspberry Pi)' : 'RELAY (Cloud VPS)'}`);

// ── 시간대 설정 ───────────────────────────────────
const TIME_ZONE = 'Asia/Seoul';
// API JSON 응답용 시간 함수 (콘솔 로그에는 사용하지 않음)
const getCurrentTime = () => new Date().toLocaleString('ko-KR', {timeZone: TIME_ZONE});

// ── 서버 및 앱 초기화 ──────────────────────────────
const app = express();
const server = http.createServer(app);

// ── 환경변수 및 보안 설정 ──────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];
const mirrorSecretKey = process.env.MIRROR_SECRET_KEY
    ? process.env.MIRROR_SECRET_KEY
    : '';

// Mirror 모드: 라즈베리파이 핫스팟 내 사설 IP 대역 전체 허용
const PRIVATE_IP_REGEX = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;

const isOriginAllowed = (origin) => {
    if (!origin) return false;
    if (origin.startsWith('http://localhost')
        || origin.startsWith('http://127.0.0.1')) return true;
    if (isMirrorMode && PRIVATE_IP_REGEX.test(origin)) return true;
    return allowedOrigins.includes(origin);
};

// ── Socket.IO 서버 설정 ───────────────────────────
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Origin이 없는 경우(서버 간 통신) 일단 CORS 정책 자체는 통과시킴
            if (!origin) return callback(null, true);
            isOriginAllowed(origin) ? callback(null, true) : callback(new Error('CORS 차단됨'));
        },
        methods: ['GET', 'POST'],
    },
    allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        // Origin이 없으면 서버 간 통신이므로 일단 HTTP 연결 허용 (이후 io.use에서 토큰 정밀 검증)
        if (!origin || isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            console.warn(`[WARN] [SECURITY] Connection Blocked | IP: ${req.socket.remoteAddress} | Origin: ${origin || 'Unknown'}`);
            callback(null, false);
        }
    },
    pingTimeout: parseInt(process.env.PING_TIMEOUT, 10) || 5000,
    pingInterval: parseInt(process.env.PING_INTERVAL, 10) || 25000,
    upgradeTimeout: parseInt(process.env.UPGRADE_TIMEOUT, 10) || 10000,
    maxHttpBufferSize: parseInt(process.env.MAX_HTTP_BUFFER_SIZE, 10) || 1024,
    transports: ['websocket', 'polling'],
});

// ── 강력한 보안 인증 미들웨어 (Socket.IO 전용) ─────────
io.use((socket, next) => {
    const origin = socket.handshake.headers.origin;

    // 1. 일반 웹 브라우저를 통한 접속 (도메인 검증)
    if (origin && isOriginAllowed(origin)) {
        return next();
    }

    // 2. 서버 대 서버 (S2S) 통신 -> HMAC 해시 + 타임스탬프 검증
    const {timestamp, signature} = socket.handshake.auth || {};

    if (mirrorSecretKey && timestamp && signature) {
        const now = Date.now();
        const timeDiff = Math.abs(now - parseInt(timestamp, 10));

        // 타임스탬프가 60초(60000ms) 이내인 경우만 허용 (재전송 공격 방지)
        if (timeDiff <= 60000) {
            // 서버 측에서 동일한 방식으로 서명 생성
            const expectedSignature = crypto
                .createHmac('sha256', mirrorSecretKey)
                .update(String(timestamp))
                .digest('hex');

            // 생성된 서명과 클라이언트가 보낸 서명이 일치하는지 확인
            // 타이밍 공격(Timing Attack)을 방지하기 위해 timingSafeEqual 사용
            if (
                signature.length === expectedSignature.length &&
                crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
            ) {
                return next(); // 인증 성공!
            }
        } else {
            console.warn(`[WARN] [SECURITY] Handshake Expired | IP: ${socket.handshake.address} | TimeDiff: ${timeDiff}ms`);
        }
    }

    // 3. 둘 다 통과하지 못하면 연결 강제 드롭
    console.warn(`[WARN] [SECURITY] Handshake Failed | IP: ${socket.handshake.address} | Reason: Invalid Auth or Origin`);
    return next(new Error('인증 실패: 허용되지 않은 접근입니다.'));
});

// ── 도배 방지 맵 ──────────────────────────────────
const rateLimitMap = new Map();

// ── Mirror 클라이언트 (mirror 모드 전용) ──────────────
// Cloud VPS에 socket.io-client로 접속하여 로컬 이벤트를 복제 전송합니다.
let mirrorSocket = null;

if (isMirrorMode) {
    const {io: ioClient} = require('socket.io-client');
    let CLOUD_URL = process.env.CLOUD_URL ? process.env.CLOUD_URL.trim() : '';

    if (!CLOUD_URL) {
        console.error('[ERROR] [MIRROR] Missing CLOUD_URL | Cloud mirroring disabled');
    } else {
        mirrorSocket = ioClient(CLOUD_URL, {
            transports: ['websocket', 'polling'],
            auth: (cb) => {
                // 매 접속(재접속 포함) 시마다 새로운 동적 서명 생성
                const timestamp = Date.now();
                const signature = crypto
                    .createHmac('sha256', mirrorSecretKey)
                    .update(String(timestamp))
                    .digest('hex');

                // 생성된 시간과 서명을 서버로 전송
                cb({timestamp, signature});
            },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30000,
            randomizationFactor: 0.3,
            timeout: 10000,
        });

        mirrorSocket.on('connect', () => {
            console.log(`[INFO] [MIRROR] Cloud Connected | Target: ${CLOUD_URL} | ID: ${mirrorSocket.id}`);
            // 연결만 맺고 룸 join은 하지 않음.
            // 로컬 클라이언트가 join-room을 호출할 때 동일 roomId로 Cloud에도 join함.
        });

        // ── 재연결 시 활성 룸 복구 ──────────────────────────
        // Cloud 연결이 끊어졌다 복구되면, 로컬에 현재 연결된 모든 룸을
        // Cloud에 다시 join하여 미러링 경로 복원
        mirrorSocket.on('reconnect', (attempt) => {
            console.log(`[INFO] [MIRROR] Cloud Reconnected | Attempts: ${attempt}`);

            // socket.id 형식의 개인 룸을 제외하고 실제 서비스 룸만 추출
            const activeRooms = [...io.sockets.adapter.rooms.keys()].filter(
                (roomId) => !io.sockets.adapter.sids.has(roomId)
            );

            if (activeRooms.length === 0) {
                console.log(`[INFO] [MIRROR] No active rooms to recover`);
                return;
            }

            console.log(`[INFO] [MIRROR] Recovering Active Rooms | Rooms: [${activeRooms.join(', ')}]`);
            for (const roomId of activeRooms) {
                try {
                    mirrorSocket.emit('join-room', roomId);
                    console.log(`[INFO] [MIRROR] Room Rejoined | Room: ${roomId}`);
                } catch (err) {
                    console.error(`[ERROR] [MIRROR] Room Rejoin Failed | Room: ${roomId} | Reason:`, err.description || err);
                }
            }
        });

        mirrorSocket.on('disconnect', (reason) => {
            console.warn(`[WARN] [MIRROR] Connection Lost | Reason: ${reason}`);
        });

        mirrorSocket.on('connect_error', (err) => {
            console.warn(`[WARN] [MIRROR] Connection Error | Reason:`, err.description || err);
        });

        mirrorSocket.on('reconnect_attempt', (attempt) => {
            console.log(`[INFO] [MIRROR] Reconnecting... | Attempt: ${attempt}`);
        });
    }
}

/**
 * Cloud로 이벤트를 안전하게 미러링합니다.
 * 연결이 끊긴 상태면 조용히 무시하여 로컬 중계는 항상 정상 작동합니다.
 */
const mirrorToCloud = (event, data) => {
    if (!isMirrorMode || !mirrorSocket) return;

    try {
        if (!mirrorSocket.connected) {
            console.warn(`[WARN] [MIRROR] Event Skipped (Not Connected) | Event: ${event}`);
            return;
        }
        mirrorSocket.emit(event, data);
    } catch (err) {
        console.error(`[ERROR] [MIRROR] Event Emit Failed | Event: ${event} | Reason: ${err.message}`);
    }
};

// ── 기본 라우트 ───────────────────────────────────
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        mode: MODE,
        version: '2026-04-11',
        time: getCurrentTime(),
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        mode: MODE,
        ...(isMirrorMode && {cloudConnected: mirrorSocket?.connected ?? false}),
    });
});

// ── 소켓 이벤트 핸들링 ──────────────────────────────
io.on('connection', (socket) => {
    console.log(`[INFO] [CLIENT] Connected | ID: ${socket.id}`);

    socket.on('join-room', (roomId) => {
        if (typeof roomId !== 'string' || roomId.length > 50) {
            console.warn(`[WARN] [CLIENT] Invalid Room ID | ID: ${socket.id}`);
            return;
        }
        socket.join(roomId);
        const count = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;

        console.log(`[INFO] [CLIENT] Room Joined | ID: ${socket.id} | Room: ${roomId} | Members: ${count}`);
        socket.emit('joined', {roomId, members: count});

        // [Mirror] Cloud에도 동일 roomId로 join → 미러링 경로 확보
        mirrorToCloud('join-room', roomId);
    });

    socket.on('send-call', (data) => {
        if (!data || typeof data !== 'object') return;
        const {roomId, payload} = data;

        if (
            typeof roomId !== 'string' ||
            typeof payload !== 'string' ||
            roomId.length > 50 ||
            payload.length > 500
        ) {
            console.warn(`[WARN] [CLIENT] Invalid Data Blocked | ID: ${socket.id} | Event: send-call`);
            return;
        }

        const now = Date.now();
        const key = socket.id + '_call';
        if (now - (rateLimitMap.get(key) || 0) < 1000) {
            console.warn(`[WARN] [CLIENT] Rate Limited | ID: ${socket.id} | Event: send-call`);
            return;
        }
        rateLimitMap.set(key, now);

        console.log(`[INFO] [RELAY] Message Relayed | From: ${socket.id} | To Room: ${roomId} | Size: ${payload.length}B`);

        // 1. 로컬 룸 내 브로드캐스트
        socket.to(roomId).emit('receive-call', {payload});

        // 2. [Mirror] Cloud로 동일 신호 복제 전송
        mirrorToCloud('send-call', {roomId, payload});
    });

    socket.on('send-ack', (data) => {
        if (!data || typeof data !== 'object') return;
        const {roomId, payload} = data;

        if (
            typeof roomId !== 'string' ||
            typeof payload !== 'string' ||
            roomId.length > 50 ||
            payload.length > 500
        ) {
            console.warn(`[WARN] [CLIENT] Invalid Data Blocked | ID: ${socket.id} | Event: send-ack`);
            return;
        }

        const now = Date.now();
        const key = socket.id + '_ack';
        if (now - (rateLimitMap.get(key) || 0) < 1000) {
            console.warn(`[WARN] [CLIENT] Rate Limited | ID: ${socket.id} | Event: send-ack`);
            return;
        }
        rateLimitMap.set(key, now);

        // 1. 로컬 룸 내 브로드캐스트
        socket.to(roomId).emit('receive-ack', {payload});

        // 2. [Mirror] Cloud로 동일 신호 복제 전송
        mirrorToCloud('send-ack', {roomId, payload});
    });

    socket.on('disconnect', () => {
        rateLimitMap.delete(socket.id + '_call');
        rateLimitMap.delete(socket.id + '_ack');
        console.log(`[INFO] [CLIENT] Disconnected | ID: ${socket.id}`);
    });

    socket.on('error', (err) => {
        console.error(`[ERROR] [CLIENT] Socket Error | ID: ${socket.id} | Reason: ${err.message}`);
    });
});

// ── 서버 실행 ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[INFO] [SYSTEM] Server Running | MODE: ${MODE} | PORT: ${PORT}`);
});
