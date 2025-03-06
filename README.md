# Node API

이 프로젝트는 Node.js 기반의 REST API 서비스입니다.

## 기능

- Notion 페이지 속성 조회 및 업데이트
- 카드별 금월지출 조회 및 업데이트
- 카드별 전월실적 조회 및 충족 여부 확인
- 카드별 남은 실적 금액 조회
- 전체 카드 현황 조회 (실적 충족 상태 및 총 지출액)
- 카드 사용내역 추가 (자동 금월지출 업데이트)
- 월별 가계부 페이지 존재 여부 확인
- 이번 달 가계부 페이지 정보 조회

## 설정 파일

### 환경 변수 설정 (.env)

```plaintext
# 서버 설정
PORT=3000
LOG_DIR=logs
LOG_FILENAME=app.log
LOG_LEVEL=debug  # debug, info, error
API_KEY=your_api_key_here
ALLOWED_ORIGINS=https://your-domain.com

# notion
NOTION_API_KEY=your_notion_api_key
```

### Financial 설정 (app/src/financial.yml)

`financial.js`에서 이용하는 설정 정보를 관리하는 YAML 파일입니다.

```yaml
database:
  monthly_expense:
    name: 월별 가계부
    id: your_database_id
  expense:
    name: 월별 가계부 세부내역
    id: your_database_id

payment:
  card1: # 결제수단 ID (소문자)
    type: credit_card # 결제수단 유형 : credit_card(신용카드), check_card(체크카드), cash(현금)
    page_id: notion_page_id
    name: 신용카드1
  card2:
    type: check_card
    page_id: notion_page_id
    name: 체크카드1
  cash:
    type: cash
    page_id: notion_page_id
    name: 현금
```

## 설치 및 실행

```bash
# 프로젝트 클론
git clone https://github.com/nugabox/node-api.git
cd node-api

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 수정

# financial.yml 설정
cp app/src/financial.yml.example app/src/financial.yml
# financial.yml 파일 수정

# 서버 실행
node app/app.js
```

## API 엔드포인트

모든 API 요청은 다음 헤더가 필요합니다:

- `Content-Type: application/json`
- `Authorization: Bearer your_api_key`

### Notion API

| 메소드 | 엔드포인트                | 설명                          | 요청 본문                                                                                     | 응답 형식  |
| ------ | ------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| POST   | `/notion/get-property`    | 페이지 속성 조회              | `{ "pageId": "...", "propertyId": "...", "format": "json\|plain" }`                           | JSON/Plain |
| POST   | `/notion/update-property` | 페이지 속성 업데이트          | `{ "pageId": "...", "propertyName": "...", "propertyValue": "...", "format": "json\|plain" }` | JSON/Plain |
| POST   | `/notion/extract-page-id` | Notion URL에서 페이지 ID 추출 | `{ "url": "...", "format": "json\|plain" }`                                                   | JSON/Plain |

### Financial API

| 메소드 | 엔드포인트                          | 설명                         | 요청 본문                                                                                                                                          | 응답 형식  |
| ------ | ----------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| POST   | `/financial/get-expense`            | 카드 금월지출 조회           | `{ "cardId": "...", "format": "json\|plain" }`                                                                                                     | JSON/Plain |
| POST   | `/financial/update-expense`         | 카드 금월지출 업데이트       | `{ "cardId": "...", "value": "...", "format": "json\|plain" }`                                                                                     | JSON/Plain |
| POST   | `/financial/get-last-performance`   | 카드 전월실적 조회           | `{ "cardId": "...", "format": "json\|plain" }`                                                                                                     | JSON/Plain |
| POST   | `/financial/check-last-performance` | 카드 전월실적 충족 확인      | `{ "cardId": "...", "format": "json\|plain" }`                                                                                                     | JSON/Plain |
| POST   | `/financial/get-month-remaining`    | 카드 전월실적 남은 금액 조회 | `{ "cardId": "...", "format": "json\|plain" }`                                                                                                     | JSON/Plain |
| POST   | `/financial/get-card-status`        | 카드 월별 현황 조회          | `{ "cardId": "...", "format": "json\|plain" }`                                                                                                     | JSON/Plain |
| POST   | `/financial/get-all-card-status`    | 전체 카드 현황 조회          | `{ "format": "json\|plain" }`                                                                                                                      | JSON/Plain |
| POST   | `/financial/add-expense`            | 카드 사용내역 추가           | `{ "지출명": "...", "카테고리명": "...", "금액": "...", "누구": "...", "연월": "YYYY_MM", "카드": "...", "비고": "...", "format": "json\|plain" }` | JSON/Plain |
| POST   | `/financial/check-month-page`       | 월별 페이지 존재 여부 확인   | `{ "yearmonth": "YYYY_MM", "format": "json\|plain" }`                                                                                              | JSON/Plain |
| POST   | `/financial/get-current-month-page` | 이번 달 페이지 정보 조회     | `{ "format": "json\|plain" }`                                                                                                                      | JSON/Plain |

### 응답 형식

1. JSON 형식 (기본값):

```json
{
    "success": true,
    "data": { ... }  // 또는 에러 시: "error": "에러 메시지"
}
```

2. Plain 텍스트 형식:

```
성공 시: 데이터 값
실패 시: failed: 에러 메시지
```

## 로깅

- 모든 API 요청과 응답이 로그 파일에 기록됩니다
- 로그 파일: `{LOG_DIR}/{LOG_FILENAME}`
- 로그 레벨: LOG_LEVEL 환경변수로 설정 (debug, info, error)

## 배포

### SSH 키 설정

1. **로컬에서 SSH 키 생성**:

```bash
# 프로젝트 루트 디렉토리에서
mkdir -p .ssh
cd .ssh

# ED25519 키 생성
ssh-keygen -t ed25519 -f deploy_key -C "deploy@node-api"
# 비밀번호는 입력하지 않음 (엔터)

# 권한 설정
chmod 600 deploy_key       # 비공개 키
chmod 644 deploy_key.pub   # 공개 키

# authorized_keys 파일 생성
cp deploy_key.pub authorized_keys
```

2. **GitHub Secrets 설정**:

- GitHub 저장소의 Settings > Secrets and variables > Actions로 이동
- 'New repository secret' 클릭
- Name: `DEPLOY_SSH_KEY`
- Value: `.ssh/deploy_key` 파일의 내용 전체 복사하여 붙여넣기

3. **SSH 연결 테스트**:

```bash
# 로컬에서 컨테이너로 SSH 연결 테스트
ssh -i .ssh/deploy_key -p 2222 root@localhost

# 원격 서버의 컨테이너로 연결 테스트
ssh -i .ssh/deploy_key -p 2222 root@your-domain.com
```

### Docker Compose 실행

```bash
# Docker Compose 실행
docker-compose up -d
```

#### docker-compose.yml

```yaml
version: "3.8"
services:
  node-api:
    build: .
    container_name: node-api
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "2222:2222" # SSH 포트
    volumes:
      - ./app:/usr/src/node-api/app
      - /usr/src/node-api/app/node_modules
      - ./.ssh/authorized_keys:/root/.ssh/authorized_keys:ro # SSH 키 마운트
    environment:
      - NODE_ENV=production
      - TZ=Asia/Seoul
    env_file:
      - app/.env
    mem_limit: 1g
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### Dockerfile

```dockerfile
FROM node:23.6-alpine

# SSH 서버 및 Git 설치
RUN apk add --no-cache openssh git \
    && ssh-keygen -A

# SSH 설정
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config \
    && sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config \
    && sed -i 's/#StrictModes yes/StrictModes no/' /etc/ssh/sshd_config

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

WORKDIR /usr/src/node-api/app
RUN npm install

EXPOSE 2222 3000

CMD chmod 600 /root/.ssh/authorized_keys && /usr/sbin/sshd -D & cd /usr/src/node-api/app && npm install && pm2-runtime start app.js --name node-api
```

### GitHub Actions 배포

GitHub Actions를 통한 자동 배포가 설정되어 있습니다. `main` 브랜치에 push하면 자동으로 배포가 시작됩니다.

배포 프로세스:

1. SSH 키를 사용하여 컨테이너에 접속
2. Git 저장소에서 최신 코드를 가져옴
3. 의존성 설치 및 PM2로 앱 재시작

주의사항:

- SSH 키 파일의 권한 설정이 올바른지 확인 (600)
- GitHub Secrets에 SSH 키가 올바르게 등록되었는지 확인
- 컨테이너의 SSH 포트(2222)가 외부에서 접근 가능한지 확인
