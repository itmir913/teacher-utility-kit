'use strict';

const express = require('express');
const http = require('http');
const {Server} = require('socket.io');

const {
    PORT, isMirrorMode,
    PING_TIMEOUT, PING_INTERVAL,
    UPGRADE_TIMEOUT, MAX_HTTP_BUFFER_SIZE
} = require('./src/config');

const {
    createAuthMiddleware,
    createCorsOptions,
    createAllowRequest
} = require('./src/security');

const {connectMirrorSocket} = require('./src/mirror/client');
const {setupCloudReceiver} = require('./src/mirror/forward');
const {registerSocketHandlers} = require('./src/handlers');
const {registerRoutes} = require('./src/routes');

// ── Express / HTTP 서버 ────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.IO 초기화 ───────────────────────────────
const io = new Server(server, {
    cors: createCorsOptions(),
    allowRequest: createAllowRequest(),
    pingTimeout: PING_TIMEOUT,
    pingInterval: PING_INTERVAL,
    upgradeTimeout: UPGRADE_TIMEOUT,
    maxHttpBufferSize: MAX_HTTP_BUFFER_SIZE,
    transports: ['websocket', 'polling'],
});

// ── 인증 미들웨어 등록 ─────────────────────────────
io.use(createAuthMiddleware());

// ── Mirror 클라이언트 초기화 (Mirror 모드 전용) ────────
//    io를 먼저 만든 뒤 넘겨야 reconnect 시 룸 복구 가능
const mirrorSocket = isMirrorMode ? connectMirrorSocket(io) : null;

// ── Cloud → Local 양방향 수신자 등록 ─────────────────
//    mirrorSocket이 Cloud에서 receive-call/ack 수신 시
//    로컬 룸 클라이언트로 포워딩
setupCloudReceiver(mirrorSocket, io);

// ── HTTP 라우트 등록 ───────────────────────────────
registerRoutes(app, mirrorSocket);

// ── 소켓 이벤트 핸들러 등록 ────────────────────────
io.on('connection', (socket) => {
    console.log(`[INFO] [CLIENT] Connected | ID: ${socket.id}`);
    registerSocketHandlers(io, socket, mirrorSocket);
});

// ── 서버 시작 ─────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[INFO] [SYSTEM] Server Running | MODE: ${isMirrorMode ? 'MIRROR' : 'RELAY'} | PORT: ${PORT}`);
});
