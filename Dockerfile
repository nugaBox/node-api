FROM node:23.6-alpine

# SSH 서버 및 Git 설치
RUN apk add --no-cache openssh git \
    && ssh-keygen -A \
    && echo "root:Docker!" | chpasswd

# SSH 설정
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# SSH 키 디렉토리 생성 및 Git 설정
RUN mkdir -p ~/.ssh && \
    chmod 700 ~/.ssh && \
    git config --global core.fileMode false

# PM2 전역 설치
RUN npm install -g pm2

# 앱 의존성 설치
COPY app/package*.json ./
RUN npm install

# 앱 소스 복사
COPY app .

# SSH 및 앱 포트 노출
EXPOSE 2222 3000

# SSH 서버 시작 후 앱 실행 (PM2 사용)
CMD /usr/sbin/sshd && cd /usr/src/app && npm install && pm2-runtime start app.js --name node-api 