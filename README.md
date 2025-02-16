# Notion API 연동 서비스

이 프로젝트는 Notion API를 활용하여 특정 페이지의 속성을 조회하고 업데이트할 수 있는 Node.js 기반의 REST API 서비스입니다.

## 기능

- Notion 페이지의 속성 조회
- Notion 페이지의 속성 업데이트
- Notion URL에서 페이지 ID 추출
- 카드 별 금월 지출 및 전월 실적 조회
- 카드 실적 충족 여부 확인
- Notion API 인증 테스트

## 환경 변수 설정 (.env)

이 프로젝트는 환경 변수 파일(`.env`)을 사용하여 API 키 및 설정을 관리합니다.

```plaintext
NOTION_API_KEY=your_notion_api_key
PORT=3000
CARD_EXAMPLE=notion_page_id
```

## 설치 및 실행 방법

### 1. 프로젝트 클론 및 의존성 설치

```bash
git clone https://github.com/your-repo/notion-api-service.git
cd notion-api-service
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 위의 예제에 따라 환경 변수를 설정합니다.

### 3. 서버 실행

```bash
node api.js
```

또는

```bash
npm start
```

## API 엔드포인트

### 1. Notion 페이지 속성 조회

```http
GET /api/property/:pageId/:propertyId
```

#### 응답 예시:

```json
{
  "object": "property_item",
  "type": "number",
  "number": 10000
}
```

### 2. Notion 페이지 속성 업데이트

```http
GET /api/update-property/:pageId?propertyName=속성명&propertyValue=값
```

#### 응답 예시:

```json
{
  "success": true
}
```

### 3. Notion URL에서 페이지 ID 추출

```http
GET /notion/extract-page-id
```

Query Parameters:
- url: Notion 페이지 URL (필수)

응답 예시:
```json
{
  "success": true,
  "pageId": "4c3dbc01ab1d46fead08f2d9e58b766b"
}
```

### 4. 카드별 금월 지출 조회

```http
GET /api/card/:cardAlias/expense
```

#### 응답 예시:

```json
{
  "success": true,
  "expense": 50000
}
```

### 5. 카드별 전월 실적 조회

```http
GET /api/card/:cardAlias/last-month
```

#### 응답 예시:

```json
{
  "success": true,
  "lastMonth": {
    "text": "50만",
    "amount": 500000
  }
}
```

### 6. 카드 실적 충족 여부 확인

```http
GET /api/card/:cardAlias/status
```

#### 응답 예시:

```json
{
  "success": true,
  "status": {
    "lastMonth": 500000,
    "currentExpense": 450000,
    "isAchieved": false,
    "status": "부족",
    "remaining": 50000
  }
}
```

### 7. Notion API 인증 테스트

```http
GET /api/test-auth
```

#### 응답 예시:

```json
{
  "success": true,
  "user": { "id": "user-id", "name": "User Name" }
}
```

## 라이선스

MIT 라이선스로 자유롭게 사용 가능합니다.

# Notion Card API

신용카드 실적 관리를 위한 Notion API 서버입니다.

## 기능

- 금월 지출 조회/업데이트
- 실적 달성 상태 확인
- 남은 실적 금액 조회

## 시작하기

### 필수 조건

- Docker
- Docker Compose
- Notion API Key
- Notion 데이터베이스 페이지 ID

### 설치

1. 환경 변수 설정

  ```bash
  cp .env.example .env
  ```

  .env 파일을 열어 필요한 값들을 설정합니다:
  ```
  NOTION_API_KEY=your_notion_api_key
  PORT=3000

  # 카드별 페이지 ID
  CARD_SHINHAN=your_page_id
  CARD_HYUNDAI=your_page_id
  CARD_BC=your_page_id
  CARD_LOTTE=your_page_id

  # 로깅 설정
  LOG_DIRECTORY=logs
  LOG_FILENAME=app.log
  LOG_LEVEL=info
  ```

2. Docker 컨테이너 실행

  ```bash
  docker-compose up -d
  ```

## API 엔드포인트

### Notion 유틸리티 API

#### 페이지 속성 조회

```http
GET /notion/:pageId/:propertyId
```

응답 예시:
```json
{
  "object": "property_item",
  "type": "number",
  "number": 10000
}
```

#### 페이지 속성 업데이트

```http
POST /notion/:pageId
```

요청 본문:
```json
{
  "propertyName": "금월지출",
  "propertyValue": 50000
}
```

응답 예시:
```json
{
  "success": true,
  "message": "속성이 업데이트되었습니다"
}
```

#### 페이지 ID 추출

```http
GET /notion/extract-page-id
```

Query Parameters:
- url: Notion 페이지 URL (필수)

응답 예시:
```json
{
  "success": true,
  "pageId": "4c3dbc01ab1d46fead08f2d9e58b766b"
}
```

### 카드 관리 API

#### 금월 지출 조회

```http
GET /card/:cardAlias/expense
```

- cardAlias: shinhan, hyundai, bc, lotte
- Query Parameters:
  - format: 'text' (선택적)

응답 예시:
```json
{
  "success": true,
  "expense": 450000
}
```

텍스트 형식 응답:
```
450000
```

#### 금월 지출 업데이트

```http
GET /card/:cardAlias/expense/update
```

Query Parameters:
- value: 업데이트할 금액 (필수)
- format: 'text' (선택적)

응답 예시:
```json
{
  "success": true
}
```

텍스트 형식 응답:
```
성공
```

#### 실적 상태 확인

```http
GET /card/:cardAlias/status
```

Query Parameters:
- format: 'text' (선택적)
- detail: 'true' (선택적)

응답 예시:
```json
{
  "success": true,
  "status": {
    "lastMonth": 500000,
    "currentExpense": 450000,
    "isAchieved": false,
    "status": "부족",
    "remaining": 50000
  }
}
```

상세 텍스트 형식 응답:
```
상태: 부족
전월실적: 500,000원
금월지출: 450,000원
남은 금액: 50,000원
```

#### 남은 금액 조회

```http
GET /card/:cardAlias/remaining
```

Query Parameters:
- format: 'text' (선택적)

응답 예시:
```json
{
  "success": true,
  "remaining": 50000,
  "formattedRemaining": "50,000원"
}
```

텍스트 형식 응답:
```
50,000원
```

## 유틸리티 함수

### 금액 변환

한글로 된 금액을 숫자로 변환합니다. (예: "50만" → 500000)

지원하는 단위:
- 만 (10,000)
- 억 (100,000,000)
- 조 (1,000,000,000,000)

### 속성 값 형식 변환

다양한 타입의 값을 Notion API에 맞는 형식으로 변환합니다:
- 문자열 → rich_text
- 숫자 → number
- 불리언 → checkbox

## 로깅

- 로그 파일: `app.log`
- 로그 레벨: info, error, debug
- 시간대: Asia/Seoul

## 기술 스택

- Node.js 23.6
- Express
- Notion API
- Docker
- Docker Compose

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.
