const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logDirectory = process.env.LOG_DIRECTORY;
const logFilename = process.env.LOG_FILENAME;

// 로그 디렉토리가 없으면 생성
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

function formatLogMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${level}: ${message}\n`;
}

const logger = {
    info: (message) => {
        const logMessage = formatLogMessage('INFO', message);
        fs.appendFileSync(path.join(logDirectory, logFilename), logMessage);
        console.log(message);
    },
    error: (message) => {
        const logMessage = formatLogMessage('ERROR', message);
        fs.appendFileSync(path.join(logDirectory, logFilename), logMessage);
        console.error(message);
    },
    debug: (message) => {
        const logMessage = formatLogMessage('DEBUG', message);
        fs.appendFileSync(path.join(logDirectory, logFilename), logMessage);
        console.debug(message);
    }
};

module.exports = logger; 