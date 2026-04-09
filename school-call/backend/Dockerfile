# ─── 빌드 스테이지 ───────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# 패키지 파일만 먼저 복사하여 레이어 캐시 활용
COPY package*.json ./

# npm ci 대신 npm install 사용 (lock 파일이 없을 때)
# --omit=dev는 개발용 의존성(devDependencies)을 제외합니다.
RUN npm install --omit=dev

# ─── 실행 스테이지 ───────────────────────────────────────────
FROM node:18-alpine

# 보안: root 대신 node 사용자로 실행
USER node

WORKDIR /app

# 빌드 스테이지에서 node_modules 복사
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# 소스 파일 복사
COPY --chown=node:node server.js ./

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
