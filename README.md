# Node API

이 프로젝트는 Node.js 기반의 REST API 서비스입니다.

## 기능

- Notion 페이지 속성 조회 및 업데이트
- 카드별 금월지출 조회 및 업데이트
- 카드별 전월실적 조회
- 카드별 실적 충족 여부 확인
- 카드별 남은 실적 금액 조회

## 환경 변수 설정 (.env)

```plaintext
# 서버 설정
PORT=3000
LOG_DIR=logs
LOG_FILENAME=app.log
LOG_LEVEL=debug  # debug, info, error
API_KEY=your_api_key_here

# notion
NOTION_API_KEY=your_notion_api_key

# financial
CARD_SHINHAN=notion_page_id
CARD_HYUNDAI=notion_page_id
CARD_BC=notion_page_id
CARD_LOTTE=notion_page_id
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

# 서버 실행
node app.js
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

| 메소드 | 엔드포인트                          | 설명                         | 요청 본문                                                      | 응답 형식  |
| ------ | ----------------------------------- | ---------------------------- | -------------------------------------------------------------- | ---------- |
| POST   | `/financial/get-expense`            | 카드 금월지출 조회           | `{ "cardId": "...", "format": "json\|plain" }`                 | JSON/Plain |
| POST   | `/financial/update-expense`         | 카드 금월지출 업데이트       | `{ "cardId": "...", "value": "...", "format": "json\|plain" }` | JSON/Plain |
| POST   | `/financial/get-last-performance`   | 카드 전월실적 조회           | `{ "cardId": "...", "format": "json\|plain" }`                 | JSON/Plain |
| POST   | `/financial/check-last-performance` | 카드 전월실적 충족 확인      | `{ "cardId": "...", "format": "json\|plain" }`                 | JSON/Plain |
| POST   | `/financial/get-month-remaining`    | 카드 전월실적 남은 금액 조회 | `{ "cardId": "...", "format": "json\|plain" }`                 | JSON/Plain |

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
