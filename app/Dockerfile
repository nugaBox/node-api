FROM node:23.6-alpine

WORKDIR /usr/src/app

# 전체 소스 코드와 node_modules 복사
COPY . .

# 로그 디렉토리 생성
RUN mkdir -p logs

# 포트 설정
EXPOSE 3000

# 앱 실행 (npm install 없이)
CMD ["node", "app.js"]