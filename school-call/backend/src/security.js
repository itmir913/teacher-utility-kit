'use strict';

const crypto = require('crypto');
const {ALLOWED_ORIGINS, MIRROR_SECRET_KEY, isMirrorMode} = require('./config');

// 라즈베리파이 핫스팟 내 사설 IP 대역
const PRIVATE_IP_REGEX = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;

/**
 * 요청 오리진이 허용된 출처인지 확인합니다.
 * @param {string|undefined} origin
 * @returns {boolean}
 */
const isOriginAllowed = (origin) => {
    if (!origin) return false;
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
    if (PRIVATE_IP_REGEX.test(origin)) return true;
    return ALLOWED_ORIGINS.includes(origin);
};

/**
 * HMAC-SHA256 서명이 유효한지 검증합니다.
 * @param {string} timestamp
 * @param {string} signature
 * @returns {{ valid: boolean, reason?: string }}
 */
const verifyHmac = (timestamp, signature) => {
    if (!MIRROR_SECRET_KEY || !timestamp || !signature) {
        return {valid: false, reason: 'Missing credentials'};
    }

    const now = Date.now();
    const timeDiff = Math.abs(now - parseInt(timestamp, 10));

    // 60초 초과 시 재전송 공격으로 간주
    if (timeDiff > 60000) {
        return {valid: false, reason: `Handshake Expired (TimeDiff: ${timeDiff}ms)`};
    }

    const expectedSignature = crypto
        .createHmac('sha256', MIRROR_SECRET_KEY)
        .update(String(timestamp))
        .digest('hex');

    // 타이밍 공격 방지
    const isValid =
        signature.length === expectedSignature.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    return isValid ? {valid: true} : {valid: false, reason: 'Signature mismatch'};
};

/**
 * Socket.IO 인증 미들웨어를 반환합니다.
 * 1순위: 허용된 오리진 (일반 웹 클라이언트)
 * 2순위: HMAC 서명 (S2S 서버 간 통신)
 */
const createAuthMiddleware = () => (socket, next) => {
    const origin = socket.handshake.headers.origin;

    // 1. 일반 웹 클라이언트
    if (origin && isOriginAllowed(origin)) {
        return next();
    }

    // 2. S2S: HMAC 검증
    const {timestamp, signature} = socket.handshake.auth || {};
    const {valid, reason} = verifyHmac(timestamp, signature);

    if (valid) {
        socket.data.isMirrorClient = true; // 미러 서버 소켓임을 표시
        return next();
    }

    console.warn(
        `[WARN] [SECURITY] Handshake Failed | IP: ${socket.handshake.address}` +
        ` | Reason: ${reason || 'Invalid Auth or Origin'}`
    );
    return next(new Error('Error: Invalid Auth or Origin'));
};

/**
 * Socket.IO CORS 설정 객체를 반환합니다.
 */
const createCorsOptions = () => ({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // 서버 간 통신
        isOriginAllowed(origin) ? callback(null, true) : callback(new Error('CORS 차단됨'));
    },
    methods: ['GET', 'POST'],
});

/**
 * Socket.IO allowRequest 핸들러를 반환합니다.
 */
const createAllowRequest = () => (req, callback) => {
    const origin = req.headers.origin;
    if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
    } else {
        console.warn(
            `[WARN] [SECURITY] Connection Blocked | IP: ${req.socket.remoteAddress}` +
            ` | Origin: ${origin || 'Unknown'}`
        );
        callback(null, false);
    }
};

module.exports = {
    isOriginAllowed,
    verifyHmac,
    createAuthMiddleware,
    createCorsOptions,
    createAllowRequest,
};
