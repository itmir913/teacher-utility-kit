'use strict';

const crypto = require('crypto');
const {CLOUD_URL, MIRROR_SECRET_KEY} = require('../config');

let mirrorSocket = null;

/**
 * Cloud VPS에 mirrorSocket을 연결합니다.
 * io 인스턴스를 받아 재연결 시 활성 룸을 복구합니다.
 *
 * @param {import('socket.io').Server} io
 * @returns {import('socket.io-client').Socket | null}
 */
const connectMirrorSocket = (io) => {
    if (!CLOUD_URL) {
        console.error('[ERROR] [MIRROR] Missing CLOUD_URL | Cloud mirroring disabled');
        return null;
    }

    const {io: ioClient} = require('socket.io-client');

    mirrorSocket = ioClient(CLOUD_URL, {
        transports: ['websocket', 'polling'],
        auth: (cb) => {
            // 매 (재)연결마다 새 서명 생성 → 리플레이 공격 방지
            const timestamp = Date.now();
            const signature = crypto
                .createHmac('sha256', MIRROR_SECRET_KEY)
                .update(String(timestamp))
                .digest('hex');
            cb({timestamp, signature});
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        randomizationFactor: 0.3,
        timeout: 10000,
    });

    // ── 연결 성공 ───────────────────────────────────
    mirrorSocket.on('connect', () => {
        console.log(`[INFO] [MIRROR] Cloud Connected | Target: ${CLOUD_URL} | ID: ${mirrorSocket.id}`);
    });

    // ── 재연결 성공: 활성 룸 복구 ─────────────────────
    mirrorSocket.on('reconnect', (attempt) => {
        console.log(`[INFO] [MIRROR] Cloud Reconnected | Attempts: ${attempt}`);

        // socket.id 형식의 개인 룸을 제외하고 실제 서비스 룸만 추출
        const activeRooms = [...io.sockets.adapter.rooms.keys()].filter(
            (roomId) => !io.sockets.adapter.sids.has(roomId)
        );

        if (activeRooms.length === 0) {
            console.log('[INFO] [MIRROR] No active rooms to recover');
            return;
        }

        console.log(`[INFO] [MIRROR] Recovering Rooms | Rooms: [${activeRooms.join(', ')}]`);
        for (const roomId of activeRooms) {
            try {
                mirrorSocket.emit('join-room', roomId);
                console.log(`[INFO] [MIRROR] Room Rejoined | Room: ${roomId}`);
            } catch (err) {
                console.error(`[ERROR] [MIRROR] Room Rejoin Failed | Room: ${roomId} | Reason:`, err.message);
            }
        }
    });

    mirrorSocket.on('disconnect', (reason) => {
        console.warn(`[WARN] [MIRROR] Connection Lost | Reason: ${reason}`);
    });

    mirrorSocket.on('connect_error', (err) => {
        console.warn('[WARN] [MIRROR] Connection Error | Reason:', err.description || err.message);
    });

    mirrorSocket.on('reconnect_attempt', (attempt) => {
        console.log(`[INFO] [MIRROR] Reconnecting... | Attempt: ${attempt}`);
    });

    return mirrorSocket;
};

const getMirrorSocket = () => mirrorSocket;

module.exports = {connectMirrorSocket, getMirrorSocket};
