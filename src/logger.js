const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 기본 로그 디렉토리 설정
const logDir = process.env.LOG_DIR || 'logs';
// 기본 로그 파일명 설정
const logFilename = process.env.LOG_FILENAME || 'app.log';
// 로그 레벨 설정 (debug, info, error)
const logLevel = process.env.LOG_LEVEL || 'info';

// 로그 레벨 우선순위
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    error: 2
};

// 로그 디렉토리가 없으면 생성
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

function formatLogMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${level}: ${message}\n`;
}

function shouldLog(messageLevel) {
    return LOG_LEVELS[messageLevel] >= LOG_LEVELS[logLevel];
}

const logger = {
    info: (message) => {
        if (shouldLog('info')) {
            const logMessage = formatLogMessage('INFO', message);
            fs.appendFileSync(path.join(logDir, logFilename), logMessage);
            console.log(message);
        }
    },
    error: (message) => {
        if (shouldLog('error')) {
            const logMessage = formatLogMessage('ERROR', message);
            fs.appendFileSync(path.join(logDir, logFilename), logMessage);
            console.error(message);
        }
    },
    debug: (message) => {
        if (shouldLog('debug')) {
            const logMessage = formatLogMessage('DEBUG', message);
            fs.appendFileSync(path.join(logDir, logFilename), logMessage);
            console.debug(message);
        }
    }
};

// API 요청/응답 로깅 미들웨어
const apiLogger = (req, res, next) => {
    // 원본 json 메소드 저장
    const originalJson = res.json;
    
    // 요청 로깅
    logger.debug('--- API 요청 시작 ---');
    logger.info(`Request: ${req.method} ${req.originalUrl}`);
    if (Object.keys(req.body).length > 0) {
        logger.info(`Request Body: ${JSON.stringify(req.body)}`);
    }
    if (Object.keys(req.query).length > 0) {
        logger.info(`Request Query: ${JSON.stringify(req.query)}`);
    }

    // json 메소드 오버라이드하여 응답 로깅
    res.json = function(data) {
        logger.info(`Response: ${JSON.stringify(data)}`);
        logger.debug('--- API 요청 종료 ---');
        return originalJson.call(this, data);
    };

    next();
};

module.exports = {
    info: logger.info,
    error: logger.error,
    debug: logger.debug,
    apiLogger
}; 