const express = require('express');
const http = require('http');
const {Server} = require('socket.io');

// ── 시간대 설정 ───────────────────────────────────
const TIME_ZONE = 'Asia/Seoul';
const getCurrentTime = () => new Date().toLocaleString('ko-KR', {timeZone: TIME_ZONE});

// ── 서버 및 앱 초기화 ──────────────────────────────
const app = express();
const server = http.createServer(app);

// ── 환경변수 및 보안 설정 ──────────────────────────
// 운영 도메인만 환경변수에서 가져옴
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];

// [보안 로직 통합] 출처 허용 여부를 판별하는 헬퍼 함수
const isOriginAllowed = (origin) => {
    if (!origin) return false; // Origin이 없거나 null인 경우 (로컬 파일 실행 등) 차단

    // 1. 로컬 개발 환경 허용 (포트 번호 무관)
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return true;
    }

    // 2. 운영 환경 도메인 체크
    return allowedOrigins.includes(origin);
};

// ── Socket.IO 설정 ────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // CORS Preflight 단계에서 허용 여부 체크
            if (isOriginAllowed(origin)) {
                callback(null, true);
            } else {
                callback(new Error('CORS 차단됨'));
            }
        },
        methods: ['GET', 'POST']
    },
    // 웹소켓 업그레이드 전 핸드셰이크 요청 직접 검사
    allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        if (isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            console.warn(`[보안 차단]\t${origin || 'Unknown'}\tIP: ${req.connection.remoteAddress}`);
            callback(null, false);
        }
    },
    pingTimeout: parseInt(process.env.PING_TIMEOUT, 10) || 5000,
    pingInterval: parseInt(process.env.PING_INTERVAL, 10) || 25000,
    upgradeTimeout: parseInt(process.env.UPGRADE_TIMEOUT, 10) || 10000,
    maxHttpBufferSize: parseInt(process.env.MAX_HTTP_BUFFER_SIZE, 10) || 1024,
    transports: ['websocket', 'polling'],
});

// ── 기본 라우트 ───────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        version: '2026-04-10 02:40',
        time: getCurrentTime()
    });
});

app.get('/health', (req, res) => {
    res.json({status: 'healthy'});
});

// 🛡️ 도배 방지를 위한 메모리 맵 (Socket ID 기준)
const rateLimitMap = new Map();

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
    });

    socket.on('send-call', (data) => {
        if (!data || typeof data !== 'object') return;
        const {roomId, payload} = data;

        if (typeof roomId !== 'string' || typeof payload !== 'string' || roomId.length > 50 || payload.length > 500) {
            console.warn(`[차단]\t${socket.id}\t비정상 데이터 (send-call)`);
            return;
        }

        // 도배 방지 (1초 쿨다운)
        const now = Date.now();
        if (now - (rateLimitMap.get(socket.id) || 0) < 1000) {
            console.warn(`[도배]\t${socket.id}\t호출 과다`);
            return;
        }
        rateLimitMap.set(socket.id, now);

        console.log(`[중계]\t${socket.id}\t→ 룸: ${roomId}\t(Payload: ${payload.length})\t— ${getCurrentTime()}`);
        socket.to(roomId).emit('receive-call', {payload});
    });

    socket.on('send-ack', (data) => {
        if (!data || typeof data !== 'object') return;
        const {roomId, payload} = data;

        if (typeof roomId !== 'string' || typeof payload !== 'string' || roomId.length > 50 || payload.length > 500) {
            console.warn(`[차단]\t${socket.id}\t비정상 데이터 (send-ack)`);
            return;
        }

        const now = Date.now();
        if (now - (rateLimitMap.get(socket.id + '_ack') || 0) < 1000) {
            console.warn(`[도배]\t${socket.id}\t응답 과다`);
            return;
        }
        rateLimitMap.set(socket.id + '_ack', now);

        socket.to(roomId).emit('receive-ack', {payload});
    });

    socket.on('disconnect', () => {
        rateLimitMap.delete(socket.id);
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
    console.log(`\n✅ 서버 가동 중\tPORT: ${PORT}\n`);
    console.log(`TIME: ${getCurrentTime()}\n\n`);
});