const express = require('express');
const http = require('http');
const {Server} = require('socket.io');

// ── 실행 모드 확인 ─────────────────────────────────
// relay : 순수 중계 서버 (Cloud VPS)
// mirror: 중계 + Cloud로 신호 복제 재전송 (라즈베리파이)
const MODE = process.env.MODE || 'relay';
const isMirrorMode = MODE === 'mirror';

if (MODE !== 'relay' && MODE !== 'mirror') {
    console.error(`❌ 알 수 없는 MODE: "${MODE}". "relay" 또는 "mirror"로 설정해주세요.\n`);
    console.error(`서버를 종료합니다.\n`)
    process.exit(1);
}

console.log(`🚀 실행 모드: ${isMirrorMode
    ? '🪞 MIRROR (라즈베리파이)'
    : '📡 RELAY (Cloud VPS)'}\n`);

// ── 시간대 설정 ───────────────────────────────────
const TIME_ZONE = 'Asia/Seoul';
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
            console.warn(`[보안 차단]\t${origin}\tIP: ${req.socket.remoteAddress}`);
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
        return next(); // 허용된 도메인이면 통과!
    }

    // 2. 서버 대 서버 (S2S) 통신 -> 시크릿 키 검증
    const clientToken = socket.handshake.auth?.token;
    if (mirrorSecretKey && clientToken === mirrorSecretKey) {
        return next(); // 비밀키가 완벽히 일치하면 통과!
    }

    // 3. 둘 다 통과하지 못하면 연결 강제 드롭
    console.warn(`[인증 실패]\tIP: ${socket.handshake.address}\t(비정상 접근 또는 시크릿 키 불일치)`);
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
        console.error('❌ [Mirror] CLOUD_URL 환경변수가 설정되지 않았거나 공백입니다. Cloud 미러링이 비활성화됩니다.');
    } else {
        mirrorSocket = ioClient(CLOUD_URL, {
            transports: ['websocket', 'polling'],
            auth: {
                token: mirrorSecretKey
            },
            reconnection: true,
            reconnectionAttempts: Infinity, // 무한 재시도
            reconnectionDelay: 2000,        // 초기 재연결 대기 2초
            reconnectionDelayMax: 30000,    // 최대 30초 간격으로 back-off
            randomizationFactor: 0.3,
            timeout: 10000,
        });

        mirrorSocket.on('connect', () => {
            console.log(`✅ [Mirror] Cloud 연결 성공\tsocket_id: ${mirrorSocket.id}\t— ${getCurrentTime()}`);
            // 연결만 맺고 룸 join은 하지 않음.
            // 로컬 클라이언트가 join-room을 호출할 때 동일 roomId로 Cloud에도 join함.
        });

        // ── 재연결 시 활성 룸 복구 ──────────────────────────
        // Cloud 연결이 끊어졌다 복구되면, 로컬에 현재 연결된 모든 룸을
        // Cloud에 다시 join하여 미러링 경로를 복원합니다.
        mirrorSocket.on('reconnect', (attempt) => {
            console.log(`🔄 [Mirror] Cloud 재연결 성공 (${attempt}회 시도)\t— ${getCurrentTime()}`);

            // socket.id 형식의 개인 룸을 제외하고 실제 서비스 룸만 추출
            const activeRooms = [...io.sockets.adapter.rooms.keys()].filter(
                (roomId) => !io.sockets.adapter.sids.has(roomId)
            );

            if (activeRooms.length === 0) {
                console.log(`[Mirror] 복구할 활성 룸 없음`);
                return;
            }

            console.log(`[Mirror] 활성 룸 복구 시작: [${activeRooms.join(', ')}]`);
            for (const roomId of activeRooms) {
                try {
                    mirrorSocket.emit('join-room', roomId);
                    console.log(`[Mirror] 룸 재입장\t→ ${roomId}`);
                } catch (err) {
                    console.error(`[Mirror] 룸 재입장 실패 (${roomId}):`, err.description || err);
                }
            }
        });

        mirrorSocket.on('disconnect', (reason) => {
            console.warn(`⚠️  [Mirror] Cloud 연결 끊김 (${reason})\t— ${getCurrentTime()}`);
        });

        mirrorSocket.on('connect_error', (err) => {
            console.warn(`⚠️  [Mirror] Cloud 연결 오류 (${getCurrentTime()}):`, err.description || err);
        });

        mirrorSocket.on('reconnect_attempt', (attempt) => {
            console.log(`🔄 [Mirror] Cloud 재연결 시도 중... (${attempt}회)\t— ${getCurrentTime()}`);
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
            console.warn(`[Mirror → Cloud 건너뜀] 연결 없음 — 이벤트: ${event}`);
            return;
        }
        mirrorSocket.emit(event, data);
    } catch (err) {
        console.error(`[Mirror → Cloud 오류] ${err.message}\t이벤트: ${event}`);
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
    console.log(`[연결]\t${socket.id}\t— ${getCurrentTime()}`);

    socket.on('join-room', (roomId) => {
        if (typeof roomId !== 'string' || roomId.length > 50) {
            console.warn(`[위험]\t${socket.id}\t비정상 룸 ID`);
            return;
        }
        socket.join(roomId);
        const count = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
        console.log(`[입장]\t${socket.id}\t→ 룸: ${roomId}\t(인원: ${count})\t— ${getCurrentTime()}`);
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
            console.warn(`[차단]\t${socket.id}\t비정상 데이터 (send-call)`);
            return;
        }

        const now = Date.now();
        const key = socket.id + '_call';
        if (now - (rateLimitMap.get(key) || 0) < 1000) {
            console.warn(`[도배]\t${socket.id}\t호출 과다`);
            return;
        }
        rateLimitMap.set(key, now);

        console.log(`[중계]\t${socket.id}\t→ 룸: ${roomId}\t(Payload: ${payload.length}B)\t— ${getCurrentTime()}`);

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
            console.warn(`[차단]\t${socket.id}\t비정상 데이터 (send-ack)`);
            return;
        }

        const now = Date.now();
        const key = socket.id + '_ack';
        if (now - (rateLimitMap.get(key) || 0) < 1000) {
            console.warn(`[도배]\t${socket.id}\t응답 과다`);
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
        console.log(`[해제]\t${socket.id}\t— ${getCurrentTime()}`);
    });

    socket.on('error', (err) => {
        console.error(`[오류]\t${socket.id}\t${err.message}\t— ${getCurrentTime()}`);
    });
});

// ── 서버 실행 ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 서버 가동 중\tMODE: ${MODE}\tPORT: ${PORT}\n`);
    console.log(`TIME: ${getCurrentTime()}\n`);
});