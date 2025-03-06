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

# 작업 디렉토리 설정 및 Git 저장소 클론
WORKDIR /usr/src
RUN git clone https://github.com/nugaBox/node-api.git app && \
    cd app && \
    git config --global core.fileMode false

# SSH 디렉토리 생성
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh

WORKDIR /usr/src/app

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
CMD chmod 600 /root/.ssh/authorized_keys && /usr/sbin/sshd -D & cd /usr/src/app && npm install && pm2-runtime start app.js --name node-api 