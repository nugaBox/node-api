FROM node:23.6-alpine

# SSH 서버 및 Git 설치
RUN apk add --no-cache openssh git \
    && ssh-keygen -A

# SSH 설정
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config \
    && sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config \
    && sed -i 's/#StrictModes yes/StrictModes no/' /etc/ssh/sshd_config \
    && echo "LogLevel DEBUG3" >> /etc/ssh/sshd_config

# 작업 디렉토리 설정
WORKDIR /usr/src/node-api

# SSH 디렉토리 생성
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh && \
    git config --global core.fileMode false

# PM2 전역 설치
RUN npm install -g pm2

# 프로젝트 파일 복사
COPY . .

# Git 저장소 초기화
RUN git init && \
    git remote add origin https://github.com/nugaBox/node-api.git

# 앱 의존성 설치
WORKDIR /usr/src/node-api/app
RUN npm install

# SSH 및 앱 포트 노출
EXPOSE 2222 3000

# SSH 서버 시작 후 앱 실행 (PM2 사용)
CMD chmod 600 /root/.ssh/authorized_keys && /usr/sbin/sshd -D & cd /usr/src/node-api/app && npm install && pm2-runtime start app.js --name node-api 