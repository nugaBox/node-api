require('dotenv').config();
const express = require('express');
const logger = require('./src/logger');
const { router: notionRouter } = require('./src/notion');
const { router: financialRouter } = require('./src/financial');
const { apiLogger } = require('./src/logger');

const app = express();
const port = process.env.PORT || 3000;

// JSON 파싱 미들웨어
app.use(express.json());

// Bearer 토큰 인증 미들웨어
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];  // Bearer {token}

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: '인증 토큰이 필요합니다.' 
        });
    }

    // 환경변수에 설정된 API 키와 비교
    if (token !== process.env.API_KEY) {
        return res.status(403).json({ 
            success: false, 
            error: '유효하지 않은 토큰입니다.' 
        });
    }

    next();
};

// API 로깅 미들웨어 적용
app.use(apiLogger);

// 모든 API 라우트에 인증 미들웨어 적용
app.use('/notion', authenticateToken, notionRouter);
app.use('/financial', authenticateToken, financialRouter);

// 기본 에러 핸들러
app.use((err, req, res, next) => {
    logger.error('서버 에러: ' + err.message);
    res.status(500).json({ success: false, error: err.message });
});

// 서버 시작
app.listen(port, () => {
    logger.info(`서버가 포트 ${port}에서 실행중입니다.`);
}); 