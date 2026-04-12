'use strict';

const {mirrorToCloud} = require('./mirror/forward');

/**
 * 도배 방지용 rate-limit 맵
 * key 형식: `${socket.id}_call` / `${socket.id}_ack`
 */
const rateLimitMap = new Map();

const ROOM_ID_MAX_LEN = 50;
const PAYLOAD_MAX_LEN = 500;
const RATE_LIMIT_MS = 1000;

/**
 * 소켓 이벤트 핸들러를 등록합니다.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io-client').Socket | null} mirrorSocket
 */
const registerSocketHandlers = (io, socket, mirrorSocket) => {

    // ── join-room ───────────────────────────────────
    socket.on('join-room', (roomId) => {
        if (typeof roomId !== 'string' || roomId.length > ROOM_ID_MAX_LEN) {
            console.warn(`[WARN] [CLIENT] Invalid Room ID | ID: ${socket.id}`);
            return;
        }

        socket.join(roomId);
        const count = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;

        console.log(`[INFO] [CLIENT] Room Joined | ID: ${socket.id} | Room: ${roomId} | Members: ${count}`);
        socket.emit('joined', {roomId, members: count});

        // [Mirror] Cloud에도 동일 roomId로 join → 미러링 경로 확보
        mirrorToCloud(mirrorSocket, 'join-room', roomId);
    });

    // ── send-call ───────────────────────────────────
    socket.on('send-call', (data) => {
        if (!data || typeof data !== 'object') return;
        const {roomId, payload} = data;

        if (
            typeof roomId !== 'string' || roomId.length > ROOM_ID_MAX_LEN ||
            typeof payload !== 'string' || payload.length > PAYLOAD_MAX_LEN
        ) {
            console.warn(`[WARN] [CLIENT] Invalid Data Blocked | ID: ${socket.id} | Event: send-call`);
            return;
        }

        const now = Date.now();
        const key = socket.id + '_call';
        if (now - (rateLimitMap.get(key) || 0) < RATE_LIMIT_MS) {
            console.warn(`[WARN] [CLIENT] Rate Limited | ID: ${socket.id} | Event: send-call`);
            return;
        }
        rateLimitMap.set(key, now);

        console.log(`[INFO] [RELAY] Message Relayed | From: ${socket.id} | To Room: ${roomId} | Size: ${payload.length}B`);

        // 1. 로컬 룸 브로드캐스트
        //    roomId를 페이로드에 포함 → Mirror 서버가 Cloud에서 수신 시 roomId 식별 가능
        socket.to(roomId).emit('receive-call', {roomId, payload});

        // 2. [Mirror] Cloud로 복제 전송
        mirrorToCloud(mirrorSocket, 'send-call', {roomId, payload});
    });

    // ── send-ack ────────────────────────────────────
    socket.on('send-ack', (data) => {
        if (!data || typeof data !== 'object') return;
        const {roomId, payload} = data;

        if (
            typeof roomId !== 'string' || roomId.length > ROOM_ID_MAX_LEN ||
            typeof payload !== 'string' || payload.length > PAYLOAD_MAX_LEN
        ) {
            console.warn(`[WARN] [CLIENT] Invalid Data Blocked | ID: ${socket.id} | Event: send-ack`);
            return;
        }

        const now = Date.now();
        const key = socket.id + '_ack';
        if (now - (rateLimitMap.get(key) || 0) < RATE_LIMIT_MS) {
            console.warn(`[WARN] [CLIENT] Rate Limited | ID: ${socket.id} | Event: send-ack`);
            return;
        }
        rateLimitMap.set(key, now);

        // 1. 로컬 룸 브로드캐스트
        socket.to(roomId).emit('receive-ack', {roomId, payload});

        // 2. [Mirror] Cloud로 복제 전송
        mirrorToCloud(mirrorSocket, 'send-ack', {roomId, payload});
    });

    // ── disconnect ──────────────────────────────────
    socket.on('disconnect', () => {
        rateLimitMap.delete(socket.id + '_call');
        rateLimitMap.delete(socket.id + '_ack');
        console.log(`[INFO] [CLIENT] Disconnected | ID: ${socket.id}`);
    });

    // ── error ───────────────────────────────────────
    socket.on('error', (err) => {
        console.error(`[ERROR] [CLIENT] Socket Error | ID: ${socket.id} | Reason: ${err.message}`);
    });
};

module.exports = {registerSocketHandlers};
