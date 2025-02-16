FROM node:23.6-alpine

WORKDIR /usr/src/app

# 패키지 파일 복사
COPY package*.json ./

# 패키지 설치
RUN npm install

# 소스 복사
COPY . .

# 포트 설정
EXPOSE ${PORT}

# 앱 실행
CMD ["npm", "start"] 