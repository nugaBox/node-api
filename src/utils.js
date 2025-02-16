const { Client } = require('@notionhq/client');
require('dotenv').config();

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

// 페이지 ID 추출 함수
function extractPageId(notionUrl) {
    try {
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

// 카드별 페이지 ID 가져오기 함수
function getPageIdByCard(cardAlias) {
    const envKey = `CARD_${cardAlias.toUpperCase()}`;
    const pageId = process.env[envKey];
    if (!pageId) {
        throw new Error(`${cardAlias} 카드에 대한 페이지 ID가 설정되지 않았습니다.`);
    }
    return pageId;
}

module.exports = {
    notion,
    getPageProperty,
    updatePageProperty,
    extractPageId,
    getPageIdByCard
}; 