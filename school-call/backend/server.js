const express = require('express');
const http = require('http');
const {Server} = require('socket.io');

// ── 시간대 설정 ───────────────────────────────────
const TIME_ZONE = 'Asia/Seoul'; // 원하는 시간대 상수로 선언
// 현재 시간을 지정된 시간대에 맞게 문자열로 반환하는 헬퍼 함수
const getCurrentTime = () => new Date().toLocaleString('ko-KR', {timeZone: TIME_ZONE});

// ── 서버 및 앱 초기화 ──────────────────────────────
const app = express();
const server = http.createServer(app);

// ── 환경변수 초기화 ──────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];
const pingTimeout = parseInt(process.env.PING_TIMEOUT, 10) || 60000;
const pingInterval = parseInt(process.env.PING_INTERVAL, 10) || 25000;
const upgradeTimeout = parseInt(process.env.UPGRADE_TIMEOUT, 10) || 10000;
const maxHttpBufferSize = parseInt(process.env.MAX_HTTP_BUFFER_SIZE, 10) || 1024;

// ── Socket.IO 설정 ────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST']
    },
    pingTimeout: pingTimeout,
    pingInterval: pingInterval,
    upgradeTimeout: upgradeTimeout,
    maxHttpBufferSize: maxHttpBufferSize,
    transports: ['websocket', 'polling'],
});

// ── 기본 라우트 ───────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: '학교 실시간 호출 시스템 서버 가동 중',
        time: getCurrentTime()
    });
});

app.get('/health', (req, res) => {
    res.json({status: 'healthy'});
});

// ── 소켓 이벤트 핸들링 ──────────────────────────────
io.on('connection', (socket) => {
    // ✅ 로그에도 시간대 동일하게 적용
    console.log(`[연결] ${socket.id} — ${getCurrentTime()}`);

    // 룸 입장
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        const count = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
        console.log(`[룸 입장] ${socket.id} → 룸 "${roomId}" (현재 ${count}명) — ${getCurrentTime()}`);
        socket.emit('joined', {roomId, members: count});
    });

    // 암호화된 호출 중계 (발신 → 수신)
    socket.on('send-call', (data) => {
        const {roomId, payload} = data;
        if (!roomId || !payload) return;
        console.log(`[호출 중계] 룸 "${roomId}" — payload 길이: ${payload.length} — ${getCurrentTime()}`);
        // 발신자를 제외한 같은 룸의 모든 수신자에게 전달
        socket.to(roomId).emit('receive-call', {payload});
    });

    // 확인 응답 중계 (수신 → 발신)
    socket.on('send-ack', (data) => {
        const {roomId, payload} = data;
        if (!roomId || !payload) return;
        socket.to(roomId).emit('receive-ack', {payload});
    });

    socket.on('disconnect', () => {
        console.log(`[연결 해제] ${socket.id} — ${getCurrentTime()}`);
    });

    socket.on('error', (err) => {
        console.error(`[소켓 오류] ${socket.id}:`, err.message, `— ${getCurrentTime()}`);
    });
});

// ── 서버 실행 ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ 서버 실행 중: http://0.0.0.0:${PORT}`);
    console.log(`   시작 시각: ${getCurrentTime()}\n`);
});