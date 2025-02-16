require('dotenv').config();
const express = require('express');
const logger = require('./src/logger');
const { notion, getPageProperty, updatePageProperty, extractPageId, getPageIdByCard } = require('./src/utils');
const { cardRoutes } = require('./src/financial');

const app = express();
const port = process.env.PORT || 3000;

// JSON 파싱 미들웨어
app.use(express.json());

// Notion 유틸리티 API 라우트
app.get('/notion/:pageId/:propertyId', async (req, res) => {
    try {
        const { pageId, propertyId } = req.params;
        const response = await getPageProperty(pageId, propertyId);
        res.json(response);
    } catch (error) {
        logger.error('속성 조회 중 오류 발생: ' + error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/notion/:pageId', async (req, res) => {
    try {
        const { pageId } = req.params;
        const { propertyName, propertyValue } = req.body;
        
        if (!propertyName || propertyValue === undefined) {
            throw new Error('propertyName과 propertyValue가 필요합니다.');
        }

        await updatePageProperty(pageId, propertyName, propertyValue);
        res.json({ 
            success: true, 
            message: "속성이 업데이트되었습니다" 
        });
    } catch (error) {
        logger.error('속성 업데이트 중 오류 발생: ' + error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/notion/extract-page-id', (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            throw new Error('URL 파라미터가 필요합니다.');
        }

        const pageId = extractPageId(url);
        res.json({ 
            success: true, 
            pageId: pageId 
        });
    } catch (error) {
        logger.error('페이지 ID 추출 중 오류 발생: ' + error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 카드 관리 API 라우트
app.get('/card/:cardAlias/expense', cardRoutes.getExpense);
app.get('/card/:cardAlias/expense/update', cardRoutes.updateExpense);
app.get('/card/:cardAlias/status', cardRoutes.getStatus);
app.get('/card/:cardAlias/remaining', cardRoutes.getRemaining);

// 기본 에러 핸들러
app.use((err, req, res, next) => {
    logger.error('서버 에러: ' + err.message);
    res.status(500).json({ success: false, error: err.message });
});

// 서버 시작
app.listen(port, () => {
    logger.info(`서버가 포트 ${port}에서 실행중입니다.`);
}); 