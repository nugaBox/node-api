const { Client } = require('@notionhq/client');
const logger = require('./logger');
const express = require('express');
const router = express.Router();
const { formatResponse } = require('./utils');
require('dotenv').config();

const notionClient = new Client({
    auth: process.env.NOTION_API_KEY
});

// 페이지 속성 조회 함수
async function getProperty(pageId, propertyId) {
    try {
        const response = await notionClient.pages.properties.retrieve({
            page_id: pageId,
            property_id: propertyId
        });
        return response;
    } catch (error) {
        logger.error('페이지 속성 조회 중 오류 발생:', error);
        throw error;
    }
}

// 속성 값 형식 변환 함수
function formatPropertyValue(propertyName, value) {
    let convertedValue = value;
    
    if (typeof value === 'string') {
        if (!isNaN(value)) {
            convertedValue = Number(value);
        } 
        else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
            convertedValue = value.toLowerCase() === 'true';
        }
    }
    
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

// 페이지 속성 업데이트 함수
async function updateProperty(pageId, propertyName, propertyValue) {
    try {
        const formattedValue = formatPropertyValue(propertyName, propertyValue);
        const response = await notionClient.pages.update({
            page_id: pageId,
            properties: {
                [propertyName]: formattedValue
            }
        });
        return response;
    } catch (error) {
        logger.error('페이지 속성 업데이트 중 오류 발생:', error);
        throw error;
    }
}

// 페이지 ID 추출 함수
function extractPageId(notionUrl) {
    try {
        logger.debug(`원본 URL: ${notionUrl}`);
        
        // URL 디코딩
        const decodedUrl = decodeURIComponent(notionUrl);
        logger.debug(`디코딩된 URL: ${decodedUrl}`);
        
        // 32자 또는 UUID 형식의 ID 추출
        const matches = decodedUrl.match(/([a-zA-Z0-9]{32})|([a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12})/);
        logger.debug(`정규식 매칭 결과: ${JSON.stringify(matches)}`);
        
        if (matches) {
            logger.debug(`추출된 페이지 ID: ${matches[0]}`);
            return matches[0];
        }
        
        // 매칭되는 ID가 없는 경우
        throw new Error('유효한 Notion 페이지 ID를 찾을 수 없습니다.');
    } catch (error) {
        logger.error('페이지 ID 추출 중 오류 발생:', error);
        throw error;
    }
}

const notionRoutes = {
    // Notion 속성 조회
    getProperty: async (req, res) => {
        try {
            const { pageId, propertyId, format = 'json' } = req.body;
            
            if (!pageId || !propertyId) {
                throw new Error('pageId와 propertyId가 필요합니다.');
            }

            const response = await getProperty(pageId, propertyId);
            formatResponse(res, response, format);
        } catch (error) {
            logger.error('속성 조회 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // Notion 속성 업데이트
    updateProperty: async (req, res) => {
        try {
            const { pageId, propertyName, propertyValue, format = 'json' } = req.body;
            
            if (!pageId || !propertyName || propertyValue === undefined) {
                throw new Error('pageId, propertyName과 propertyValue가 필요합니다.');
            }

            await updateProperty(pageId, propertyName, propertyValue);
            formatResponse(res, { success: true }, format);
        } catch (error) {
            logger.error('속성 업데이트 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 페이지 ID 추출
    extractPageId: async (req, res) => {
        try {
            logger.debug('extractPageId 핸들러 시작');
            const { url, format = 'json' } = req.body;
            logger.debug(`요청 body: ${JSON.stringify(req.body)}`);
            logger.debug(`추출된 url: ${url}`);
            
            if (!url) {
                throw new Error('URL이 필요합니다.');
            }

            // URL이 문자열인지 확인
            logger.debug(`URL 타입: ${typeof url}`);
            if (typeof url !== 'string') {
                throw new Error('URL은 문자열이어야 합니다.');
            }

            const pageId = extractPageId(url);
            logger.debug(`추출 성공, pageId: ${pageId}`);
            formatResponse(res, { success: true, pageId }, format);
        } catch (error) {
            logger.error('페이지 ID 추출 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    }
};

// 라우트 설정
router.post('/get-property', notionRoutes.getProperty);
router.post('/update-property', notionRoutes.updateProperty);
router.post('/extract-page-id', notionRoutes.extractPageId);

module.exports = {
    notionClient,
    getProperty,
    updateProperty,
    extractPageId,
    formatPropertyValue,
    router
}; 