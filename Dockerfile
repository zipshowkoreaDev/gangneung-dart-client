# 베이스 이미지 설정
FROM node:22-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

RUN chown -R node:node /app

# package.json과 lock 파일 복사
COPY package.json package-lock.json ./
COPY postcss.config.mjs ./

# 의존성 설치
RUN npm cache clean --force
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci

# 소스 코드 복사
COPY . .

# 빌드 인자로 환경변수 받기
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}

# 3000번 포트 개방
EXPOSE 3000

# Next.js 빌드 (프로덕션 환경변수를 사용함)
RUN npm run build

# Next.js 서버 실행 (프로덕션용)
CMD ["npm", "run", "start"]
