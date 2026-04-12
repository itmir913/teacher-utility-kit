'use strict';

const {MODE, TIME_ZONE, isMirrorMode} = require('./config');

const getCurrentTime = () => new Date().toLocaleString('ko-KR', {timeZone: TIME_ZONE});

/**
 * Express 라우트를 등록합니다.
 *
 * @param {import('express').Application} app
 * @param {import('socket.io-client').Socket | null} mirrorSocket
 */
const registerRoutes = (app, mirrorSocket) => {
    app.get('/', (_req, res) => {
        res.status(200).json({
            status: 'healthy',
            mode: MODE,
            version: '2026-04-11',
            time: getCurrentTime(),
            ...(isMirrorMode && {
                mirrorInfo: {
                    connected: mirrorSocket?.connected || false,
                    targetUrl: process.env.CLOUD_URL?.trim() || 'Unknown',
                    socketId: mirrorSocket?.id || 'Not connected yet',
                },
            }),
        });
    });

    app.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'healthy',
            mode: MODE,
            ...(isMirrorMode && {cloudConnected: mirrorSocket?.connected ?? false}),
        });
    });
};

module.exports = {registerRoutes};
