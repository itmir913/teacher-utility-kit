'use strict';

const {isMirrorMode} = require('../config');

/**
 * mirrorSocket이 연결된 경우 Cloud로 이벤트를 전송합니다.
 * 연결이 끊긴 경우 조용히 무시하여 로컬 중계는 항상 정상 동작합니다.
 *
 * @param {import('socket.io-client').Socket | null} mirrorSocket
 * @param {string} event
 * @param {unknown} data
 */
const mirrorToCloud = (mirrorSocket, event, data) => {
    if (!isMirrorMode || !mirrorSocket) return;

    if (!mirrorSocket.connected) {
        console.warn(`[WARN] [MIRROR] Event Skipped (Not Connected) | Event: ${event}`);
        return;
    }

    try {
        mirrorSocket.emit(event, data);
    } catch (err) {
        console.error(`[ERROR] [MIRROR] Event Emit Failed | Event: ${event} | Reason: ${err.message}`);
    }
};

/**
 * Cloud → Local 포워딩 수신자를 설정합니다.
 *
 * Cloud의 다른 클라이언트(혹은 다른 Mirror 서버)가 보낸 신호가
 * Cloud 릴레이를 통해 mirrorSocket으로 내려오면,
 * 이를 로컬 룸의 클라이언트에게 재전달합니다.
 *
 * ┌─────────────┐   send-call    ┌──────────────┐   receive-call   ┌──────────────┐
 * │  Remote     │ ─────────────► │  Cloud VPS   │ ───────────────► │  mirrorSocket│
 * │  Client B   │                │  (relay)     │                  │  (RPi)       │
 * └─────────────┘                └──────────────┘                  └──────┬───────┘
 *                                                                         │ io.to(roomId)
 *                                                                         ▼
 *                                                                  ┌──────────────┐
 *                                                                  │  Local       │
 *                                                                  │  Client A    │
 *                                                                  └──────────────┘
 *
 * 전제: Cloud 릴레이가 receive-call / receive-ack 페이로드에 roomId를 포함해야 합니다.
 *       handlers.js의 브로드캐스트 포맷: { roomId, payload }
 *
 * @param {import('socket.io-client').Socket} mirrorSocket
 * @param {import('socket.io').Server} io
 */
const setupCloudReceiver = (mirrorSocket, io) => {
    if (!isMirrorMode || !mirrorSocket) return;

    // ── Cloud → Local: call 신호 수신 ──────────────────
    mirrorSocket.on('receive-call', ({roomId, payload} = {}) => {
        if (typeof roomId !== 'string' || typeof payload !== 'string') {
            console.warn('[WARN] [MIRROR] Invalid receive-call from Cloud | Missing roomId or payload');
            return;
        }

        const localRoom = io.sockets.adapter.rooms.get(roomId);
        if (!localRoom || localRoom.size === 0) {
            // 로컬에 해당 룸의 클라이언트가 없으면 전달 불필요
            return;
        }

        console.log(`[INFO] [MIRROR] Cloud→Local Forwarded | Event: receive-call | Room: ${roomId} | Size: ${payload.length}B`);
        io.to(roomId).emit('receive-call', {roomId, payload});
    });

    // ── Cloud → Local: ack 신호 수신 ───────────────────
    mirrorSocket.on('receive-ack', ({roomId, payload} = {}) => {
        if (typeof roomId !== 'string' || typeof payload !== 'string') {
            console.warn('[WARN] [MIRROR] Invalid receive-ack from Cloud | Missing roomId or payload');
            return;
        }

        const localRoom = io.sockets.adapter.rooms.get(roomId);
        if (!localRoom || localRoom.size === 0) {
            return;
        }

        console.log(`[INFO] [MIRROR] Cloud→Local Forwarded | Event: receive-ack | Room: ${roomId} | Size: ${payload.length}B`);
        io.to(roomId).emit('receive-ack', {roomId, payload});
    });

    console.log('[INFO] [MIRROR] Cloud→Local receiver registered');
};

module.exports = {mirrorToCloud, setupCloudReceiver};
