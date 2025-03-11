const { Client } = require('@notionhq/client');
const logger = require('./logger');
const express = require('express');
const router = express.Router();
const { formatResponse } = require('./utils');
require('dotenv').config();

const notionClient = new Client({
    auth: process.env.NOTION_API_KEY,
    notionVersion: '2022-06-28',
    fetch: (url, init) => {
        // 기본 헤더에 캐시 방지 헤더 추가
        const headers = {
            ...init.headers,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };

        return fetch(url, {
            ...init,
            headers
        });
    }
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
        throw error;
    }
}

// 페이지 ID 추출 함수
function extractPageId(notionUrl) {
    try {
        if (!notionUrl || typeof notionUrl !== 'string') {
            throw new Error('유효한 URL이 필요합니다.');
        }

        const decodedUrl = decodeURIComponent(notionUrl);
        const matches = decodedUrl.match(/([a-zA-Z0-9]{32})|([a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12})/);
        
        if (!matches) {
            throw new Error('유효한 Notion 페이지 ID를 찾을 수 없습니다.');
        }

        return matches[0];
    } catch (error) {
        throw error;
    }
}

const notionRoutes = {
    // Notion 속성 조회
    getProperty: async (req, res) => {
        try {
            const { pageId, propertyId, format = 'json' } = req.body;
            logger.debug('Request: getProperty ' + JSON.stringify({ pageId, propertyId, format }));
            
            if (!pageId || !propertyId) {
                throw new Error('pageId와 propertyId가 필요합니다.');
            }

            const response = await getProperty(pageId, propertyId);
            logger.debug('Response: ' + JSON.stringify(response));
            formatResponse(res, response, format);
        } catch (error) {
            const errorResponse = { success: false, error: error.message };
            logger.error('Error: ' + JSON.stringify(errorResponse));
            formatResponse(res, errorResponse, req.body?.format);
        }
    },

    // Notion 속성 업데이트
    updateProperty: async (req, res) => {
        try {
            const { pageId, propertyName, propertyValue, format = 'json' } = req.body;
            logger.debug('Request: updateProperty ' + JSON.stringify({ pageId, propertyName, propertyValue, format }));
            
            if (!pageId || !propertyName || propertyValue === undefined) {
                throw new Error('pageId, propertyName과 propertyValue가 필요합니다.');
            }

            await updateProperty(pageId, propertyName, propertyValue);
            const response = { success: true };
            logger.debug('Response: ' + JSON.stringify(response));
            formatResponse(res, response, format);
        } catch (error) {
            const errorResponse = { success: false, error: error.message };
            logger.error('Error: ' + JSON.stringify(errorResponse));
            formatResponse(res, errorResponse, req.body?.format);
        }
    },

    // 페이지 ID 추출
    extractPageId: async (req, res) => {
        try {
            const { url, format = 'json' } = req.body;
            logger.debug('Request: extractPageId ' + JSON.stringify({ url, format }));
            
            if (!url) {
                throw new Error('URL이 필요합니다.');
            }

            const pageId = extractPageId(url);
            const response = { success: true, pageId };
            logger.debug('Response: ' + JSON.stringify(response));
            formatResponse(res, response, format);
        } catch (error) {
            const errorResponse = { success: false, error: error.message };
            logger.error('Error: ' + JSON.stringify(errorResponse));
            formatResponse(res, errorResponse, req.body?.format);
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