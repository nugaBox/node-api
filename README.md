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
GET /api/extract-page-id?url=https://www.notion.so/example-page-id
```

#### 응답 예시:

```json
{
  "pageId": "example-page-id"
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
