'use strict';

const MODE = process.env.MODE || 'relay';
const isMirrorMode = MODE === 'mirror';

if (MODE !== 'relay' && MODE !== 'mirror') {
    console.error(`[ERROR] [SYSTEM] Invalid MODE: "${MODE}". Use "relay" or "mirror".`);
    console.error(`[ERROR] [SYSTEM] Server Shutting Down`);
    process.exit(1);
}

console.log(`[INFO] [SYSTEM] Server Started | MODE: ${isMirrorMode ? 'MIRROR' : 'RELAY'}`);

module.exports = {
    MODE,
    isMirrorMode,

    PORT: parseInt(process.env.PORT, 10) || 3000,
    TIME_ZONE: 'Asia/Seoul',

    // 허용 오리진 목록 (쉼표 구분)
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
        : [],

    // S2S HMAC 서명 키
    MIRROR_SECRET_KEY: process.env.MIRROR_SECRET_KEY || '',

    // Mirror 모드 전용: Cloud VPS 주소
    CLOUD_URL: process.env.CLOUD_URL ? process.env.CLOUD_URL.trim() : '',

    // Socket.IO 튜닝값
    PING_TIMEOUT: parseInt(process.env.PING_TIMEOUT, 10) || 5000,
    PING_INTERVAL: parseInt(process.env.PING_INTERVAL, 10) || 25000,
    UPGRADE_TIMEOUT: parseInt(process.env.UPGRADE_TIMEOUT, 10) || 10000,
    MAX_HTTP_BUFFER_SIZE: parseInt(process.env.MAX_HTTP_BUFFER_SIZE, 10) || 1024,
};
