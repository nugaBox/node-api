require('dotenv').config({ override: true });
const express = require('express');
const logger = require('./src/logger');
const { router: notionRouter } = require('./src/notion');
const { router: financialRouter } = require('./src/financial');
const { apiLogger } = require('./src/logger');

const app = express();
const port = process.env.PORT || 3000;

// 프록시 신뢰 설정
app.set('trust proxy', true);

// CORS 설정
app.use((req, res, next) => {
    // 허용할 도메인 설정 (환경변수로 관리 가능)
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 보안 헤더 설정
app.use((req, res, next) => {
    // HTTPS 강제 리다이렉트 (프록시 환경에서)
    if (req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // 기타 보안 헤더
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// JSON 파싱 미들웨어
app.use(express.json());

// API 로깅 미들웨어
app.use(apiLogger);

// Bearer 토큰 인증 미들웨어
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: '인증 토큰이 필요합니다.' 
        });
    }

    if (token.trim() !== process.env.API_KEY.trim()) {
        return res.status(403).json({ 
            success: false, 
            error: '유효하지 않은 토큰입니다.' 
        });
    }

    next();
};

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
    logger.info(`서버가 포트 ${port}에서 실행중입니다!`);
}); 