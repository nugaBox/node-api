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

### Docker Compose 실행

```bash
# Docker Compose 실행
docker-compose up -d
```

#### docker-compose.yml 예제

```yaml
version: "3.8"
services:
  node-api:
    build: .
    container_name: node-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./app:/usr/src/app
      - /usr/src/app/node_modules
    environment:
      - NODE_ENV=production
    command: sh -c "npm install && node app.js"
```

#### Dockerfile 예제

```dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

COPY app/package*.json ./

RUN npm install

COPY app .

EXPOSE 3000

CMD ["sh", "-c", "npm install && node app.js"]
```

이 설정의 주요 특징:

- 컨테이너 시작 시 항상 `npm install` 실행
- 볼륨 마운트로 로컬 소스 코드 변경 실시간 반영
- `node_modules`는 컨테이너 내부에서 관리
- 환경 변수와 포트 설정 가능
