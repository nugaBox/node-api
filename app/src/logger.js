const fs = require('fs');
const path = require('path');
require('dotenv').config();

// app/logs 디렉토리로 로그 경로 설정
const logDir = path.resolve(__dirname, '..', 'logs');
const logFilename = process.env.LOG_FILENAME || 'app.log';
const logLevel = process.env.LOG_LEVEL || 'info';

// 로그 레벨 우선순위
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    error: 2
};

// 로그 디렉토리가 없으면 생성
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function formatLogMessage(level, message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = typeof message === 'object' ? JSON.stringify(message) : message;
    return `[${timestamp}] ${level}: ${formattedMessage}`;
}

function shouldLog(messageLevel) {
    return LOG_LEVELS[messageLevel] >= LOG_LEVELS[logLevel];
}

const logger = {
    info: (message) => {
        if (shouldLog('info')) {
            const logMessage = formatLogMessage('INFO', message);
            fs.appendFileSync(path.join(logDir, logFilename), logMessage + '\n');
            console.log(logMessage);
        }
    },
    error: (message) => {
        if (shouldLog('error')) {
            const logMessage = formatLogMessage('ERROR', message);
            fs.appendFileSync(path.join(logDir, logFilename), logMessage + '\n');
            console.error(logMessage);
        }
    },
    debug: (message) => {
        if (shouldLog('debug')) {
            const logMessage = formatLogMessage('DEBUG', message);
            fs.appendFileSync(path.join(logDir, logFilename), logMessage + '\n');
            console.debug(logMessage);
        }
    }
};

// API 요청/응답 로깅 미들웨어
const apiLogger = (req, res, next) => {
    const originalJson = res.json;
    
    const requestLog = `${req.method} ${req.originalUrl}`;
    logger.info(requestLog);
    
    if (Object.keys(req.body).length > 0) {
        logger.debug(`Request Body: ${JSON.stringify(req.body)}`);
    }

    res.json = function(data) {
        logger.debug(`Response: ${JSON.stringify(data)}`);
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