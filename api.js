require('dotenv').config();
const { Client } = require('@notionhq/client');

// .env 파일에서 환경 변수 로드
console.log('환경변수 확인:', {
  NOTION_API_KEY: process.env.NOTION_API_KEY?.slice(0, 10) + '...', // 보안을 위해 일부만 출력
  PORT: process.env.PORT
});

const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

// 페이지 속성 조회 함수
async function getPageProperty(pageId, propertyId) {
  try {
    const response = await notion.pages.properties.retrieve({
      page_id: pageId,
      property_id: propertyId
    });
    return response;
  } catch (error) {
    console.error('페이지 속성 조회 중 오류 발생:', error);
    throw error;
  }
}

// 페이지 속성 업데이트 함수
async function updatePageProperty(pageId, propertyName, propertyValue) {
  try {
    const response = await notion.pages.update({
      page_id: pageId,
      properties: {
        [propertyName]: propertyValue
      }
    });
    return response;
  } catch (error) {
    console.error('페이지 속성 업데이트 중 오류 발생:', error);
    throw error;
  }
}

// Express를 사용한 API 엔드포인트 생성
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// 페이지 속성 조회 API
app.get('/api/property/:pageId/:propertyId', async (req, res) => {
  try {
    const { pageId, propertyId } = req.params;
    const property = await getPageProperty(pageId, propertyId);
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 페이지 속성 업데이트 API
app.get('/api/update-property/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    const { propertyName, propertyValue } = req.query;
    
    // propertyValue를 적절한 형식으로 변환
    const formattedValue = formatPropertyValue(propertyName, propertyValue);
    
    const response = await updatePageProperty(pageId, propertyName, formattedValue);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 속성 값 형식 변환 함수
function formatPropertyValue(propertyName, value) {
  // 문자열로 들어온 값을 적절한 타입으로 변환
  let convertedValue = value;
  
  // 숫자 문자열인 경우 숫자로 변환
  if (typeof value === 'string') {
    if (!isNaN(value)) {
      convertedValue = Number(value);
    } 
    // 불리언 문자열인 경우 불리언으로 변환
    else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
      convertedValue = value.toLowerCase() === 'true';
    }
  }
  
  // 속성 타입에 따라 적절한 형식으로 변환
  switch (typeof convertedValue) {
    case 'string':
      return { rich_text: [{ text: { content: convertedValue } }] };
    case 'number':
      return { number: convertedValue };
    case 'boolean':
      return { checkbox: convertedValue };
    default:
      return convertedValue;
  }
}

// 페이지 ID 추출 함수 추가
function extractPageId(notionUrl) {
  try {
    // URL에서 마지막 부분 추출
    const matches = notionUrl.match(/([a-zA-Z0-9]{32})|([a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12})/);
    if (matches) {
      return matches[0];
    }
    throw new Error('유효한 Notion 페이지 ID를 찾을 수 없습니다.');
  } catch (error) {
    console.error('페이지 ID 추출 중 오류 발생:', error);
    throw error;
  }
}

// 페이지 ID 추출 API 엔드포인트 추가
app.get('/api/extract-page-id', (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다.' });
    }
    const pageId = extractPageId(url);
    res.json({ pageId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 카드별 페이지 ID 가져오기 함수
function getPageIdByCard(cardAlias) {
  const envKey = `CARD_${cardAlias.toUpperCase()}`;
  /*
  console.log('카드 환경변수 조회:', {
    requestedCard: cardAlias,
    envKey: envKey,
    pageId: process.env[envKey]
  });
  */
  
  const pageId = process.env[envKey];
  if (!pageId) {
    throw new Error(`${cardAlias} 카드에 대한 페이지 ID가 설정되지 않았습니다.`);
  }
  return pageId;
}

// 금월지출 속성 조회 API 수정
app.get('/api/card/:cardAlias/expense', async (req, res) => {
  try {
    const { cardAlias } = req.params;
    const pageId = getPageIdByCard(cardAlias);
    
    // 전체 페이지 정보를 가져와서 금월지출 속성 찾기
    const page = await notion.pages.retrieve({ page_id: pageId });
    const expense = page.properties['금월지출']?.number || 0;
    
    // 단순 텍스트 응답으로 변경 (단축어에서 바로 사용 가능)
    if (req.query.format === 'text') {
      res.type('text').send(expense.toString());
    } else {
      // 기존 JSON 응답 유지 (다른 용도로 사용 가능)
      res.json({ 
        success: true,
        expense: expense
      });
    }
  } catch (error) {
    console.error('금월지출 조회 중 오류 발생:', error);
    if (req.query.format === 'text') {
      res.type('text').status(500).send(error.message);
    } else {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
});

// 금월지출 속성 업데이트 API 수정
app.get('/api/card/:cardAlias/expense/update', async (req, res) => {
  try {
    const { cardAlias } = req.params;
    const { value } = req.query;
    
    if (!value) {
      throw new Error('업데이트할 값이 필요합니다.');
    }

    const pageId = getPageIdByCard(cardAlias);
    const formattedValue = formatPropertyValue('금월지출', value);
    
    await updatePageProperty(pageId, '금월지출', formattedValue);
    
    // 단순 텍스트 응답으로 변경
    if (req.query.format === 'text') {
      res.type('text').send('성공');
    } else {
      // 기존 JSON 응답 유지
      res.json({ success: true });
    }
  } catch (error) {
    console.error('금월지출 업데이트 중 오류 발생:', error);
    if (req.query.format === 'text') {
      res.type('text').status(500).send('실패: ' + error.message);
    } else {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
});

// 테스트용 API 엔드포인트 추가
app.get('/api/test-auth', async (req, res) => {
  try {
    // 간단한 API 호출로 인증 테스트
    const response = await notion.users.me();
    res.json({
      success: true,
      user: response
    });
  } catch (error) {
    console.error('Notion API 인증 테스트 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: error.code
    });
  }
});

// 한글 금액을 숫자로 변환하는 함수
function koreanAmountToNumber(koreanAmount) {
  try {
    // 숫자와 단위를 분리하는 정규식
    const matches = koreanAmount.match(/(\d+)([만억조])?/);
    if (!matches) return 0;

    const number = parseInt(matches[1]);
    const unit = matches[2];

    // 단위에 따른 곱수 적용
    switch (unit) {
      case '만':
        return number * 10000;
      case '억':
        return number * 100000000;
      case '조':
        return number * 1000000000000;
      default:
        return number;
    }
  } catch (error) {
    console.error('금액 변환 중 오류:', error);
    return 0;
  }
}

// 전월실적 속성 조회 API
app.get('/api/card/:cardAlias/last-month', async (req, res) => {
  try {
    const { cardAlias } = req.params;
    const pageId = getPageIdByCard(cardAlias);
    
    // 전체 페이지 정보를 가져와서 전월실적 속성 찾기
    const page = await notion.pages.retrieve({ page_id: pageId });
    const lastMonthText = page.properties['전월실적']?.rich_text?.[0]?.text?.content || '0';
    
    // 한글 금액을 숫자로 변환
    const lastMonthAmount = koreanAmountToNumber(lastMonthText);
    
    // 단순 텍스트 응답으로 변경 (단축어에서 바로 사용 가능)
    if (req.query.format === 'text') {
      res.type('text').send(lastMonthAmount.toString());
    } else {
      // JSON 응답
      res.json({ 
        success: true,
        lastMonth: {
          text: lastMonthText,
          amount: lastMonthAmount
        }
      });
    }
  } catch (error) {
    console.error('전월실적 조회 중 오류 발생:', error);
    if (req.query.format === 'text') {
      res.type('text').status(500).send(error.message);
    } else {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
});

// 실적 충족 여부 확인 함수
async function checkExpenseStatus(cardAlias) {
  try {
    const pageId = getPageIdByCard(cardAlias);
    const page = await notion.pages.retrieve({ page_id: pageId });
    
    // 전월실적 가져오기 (텍스트 -> 숫자 변환)
    const lastMonthText = page.properties['전월실적']?.rich_text?.[0]?.text?.content || '0';
    const lastMonthAmount = koreanAmountToNumber(lastMonthText);
    
    // 금월지출 가져오기
    const currentExpense = page.properties['금월지출']?.number || 0;
    
    return {
      lastMonth: lastMonthAmount,
      currentExpense: currentExpense,
      isAchieved: currentExpense >= lastMonthAmount,
      status: currentExpense >= lastMonthAmount ? '충족' : '부족',
      remaining: lastMonthAmount - currentExpense
    };
  } catch (error) {
    console.error('실적 확인 중 오류 발생:', error);
    throw error;
  }
}

// 실적 충족 여부 확인 API
app.get('/api/card/:cardAlias/status', async (req, res) => {
  try {
    const { cardAlias } = req.params;
    const status = await checkExpenseStatus(cardAlias);
    
    // 단순 텍스트 응답 (단축어용)
    if (req.query.format === 'text') {
      if (req.query.detail === 'true') {
        // 상세 정보를 포함한 텍스트 응답
        const remainingText = status.remaining > 0 
          ? `남은 금액: ${status.remaining.toLocaleString()}원`
          : `초과 금액: ${Math.abs(status.remaining).toLocaleString()}원`;
        
        res.type('text').send(
          `상태: ${status.status}\n` +
          `전월실적: ${status.lastMonth.toLocaleString()}원\n` +
          `금월지출: ${status.currentExpense.toLocaleString()}원\n` +
          remainingText
        );
      } else {
        // 단순 상태만 응답
        res.type('text').send(status.status);
      }
    } else {
      // JSON 응답
      res.json({
        success: true,
        status: status
      });
    }
  } catch (error) {
    console.error('상태 확인 중 오류 발생:', error);
    if (req.query.format === 'text') {
      res.type('text').status(500).send(error.message);
    } else {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
});

// 남은 금액 조회 API
app.get('/api/card/:cardAlias/remaining', async (req, res) => {
  try {
    const { cardAlias } = req.params;
    const status = await checkExpenseStatus(cardAlias);
    
    // 남은 금액 계산 (0 이하면 0으로 표시)
    const remainingAmount = Math.max(0, status.remaining);
    
    // 단순 텍스트 응답 (단축어용)
    if (req.query.format === 'text') {
      // 천 단위 구분 기호와 '원' 추가
      const formattedAmount = remainingAmount > 0 
        ? `${remainingAmount.toLocaleString()}원`
        : '0원';
      
      res.type('text').send(formattedAmount);
    } else {
      // JSON 응답
      res.json({
        success: true,
        remaining: remainingAmount,
        formattedRemaining: remainingAmount.toLocaleString() + '원'
      });
    }
  } catch (error) {
    console.error('남은 금액 조회 중 오류 발생:', error);
    if (req.query.format === 'text') {
      res.type('text').status(500).send(error.message);
    } else {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
});

app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다`);
}); 