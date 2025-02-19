FROM node:23.6

RUN ping -c 4 8.8.8.8

WORKDIR /usr/src/app

# 패키지 파일 복사 및 의존성 설치
COPY package.json package-lock.json ./
RUN ls -al /usr/src/app
RUN npm install

# 소스 코드 복사
COPY . .

# 로그 디렉토리 생성
RUN mkdir -p logs

# 포트 설정
EXPOSE 3000

# 앱 실행
CMD ["npm", "start"]