FROM node:23.6-alpine

WORKDIR /usr/src/app

# 기본 패키지 설치 (python3, make, g++)
RUN apk add --no-cache python3 make g++

# 패키지 파일 복사 및 의존성 설치
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# 소스 코드 복사
COPY . .

# 로그 디렉토리 생성
RUN mkdir -p logs

# 포트 설정
EXPOSE 3000

# 앱 실행
CMD ["npm", "start"] 