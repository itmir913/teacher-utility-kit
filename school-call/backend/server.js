const cluster = require('cluster');
const os = require('os');
const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const {createAdapter} = require('@socket.io/cluster-adapter');

// ── 클러스터 모드: CPU 코어 수만큼 워커 생성 ─────────────
if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;
    console.log(`\n🖥️  CPU 코어 수: ${numCPUs}개 — 워커 ${numCPUs}개 생성`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code) => {
        console.warn(`[워커 ${worker.process.pid} 종료] 코드: ${code} — 재시작`);
        cluster.fork(); // 워커가 죽으면 자동 재시작
    });

    return; // Primary는 여기서 종료
}

// ── 이하는 각 워커에서 실행 ──────────────────────────────
const app = express();
const server = http.createServer(app);

// Node.js 기본 이벤트 리스너 경고 임계값 상향
require('events').EventEmitter.defaultMaxListeners = 0;

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,      // 60초 응답 없으면 연결 해제
    pingInterval: 25000,     // 25초마다 핑
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,  // 메시지 최대 크기 1MB
    transports: ['websocket', 'polling'],
    adapter: createAdapter(), // 클러스터 워커 간 메시지 공유
});

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: '학교 실시간 호출 시스템 서버 가동 중',
        time: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({status: 'healthy'});
});

io.on('connection', (socket) => {
    console.log(`[연결] ${socket.id} — ${new Date().toLocaleString('ko-KR')}`);

    // 룸 입장
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        const count = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
        console.log(`[룸 입장] ${socket.id} → 룸 "${roomId}" (현재 ${count}명)`);
        socket.emit('joined', {roomId, members: count});
    });

    // 암호화된 호출 중계 (발신 → 수신)
    socket.on('send-call', (data) => {
        const {roomId, payload} = data;
        if (!roomId || !payload) return;
        console.log(`[호출 중계] 룸 "${roomId}" — payload 길이: ${payload.length}`);
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
        console.log(`[연결 해제] ${socket.id}`);
    });

    socket.on('error', (err) => {
        console.error(`[소켓 오류] ${socket.id}:`, err.message);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ 서버 실행 중: http://0.0.0.0:${PORT}`);
    console.log(`   시작 시각: ${new Date().toLocaleString('ko-KR')}\n`);
});