const { notionClient, formatPropertyValue } = require('./notion');
const { formatResponse } = require('./utils');
const logger = require('./logger');
const express = require('express');
const router = express.Router();
require('dotenv').config();

// 한글 금액을 숫자로 변환하는 함수
function koreanAmountToNumber(koreanAmount) {
    try {
        const matches = koreanAmount.match(/(\d+)([만억조])?/);
        if (!matches) return 0;

        const number = parseInt(matches[1]);
        const unit = matches[2];

        switch (unit) {
            case '만': return number * 10000;
            case '억': return number * 100000000;
            case '조': return number * 1000000000000;
            default: return number;
        }
    } catch (error) {
        logger.error('금액 변환 중 오류: ' + error.message);
        return 0;
    }
}

// 실적 충족 여부 확인 함수
async function checkExpenseStatus(cardAlias, pageId) {
    try {
        const page = await notionClient.pages.retrieve({ page_id: pageId });
        
        const lastMonthText = page.properties['전월실적']?.rich_text?.[0]?.text?.content || '0';
        const lastMonthAmount = koreanAmountToNumber(lastMonthText);
        const currentExpense = page.properties['금월지출']?.number || 0;
        
        return {
            lastMonth: lastMonthAmount,
            currentExpense: currentExpense,
            isAchieved: currentExpense >= lastMonthAmount,
            status: currentExpense >= lastMonthAmount ? '충족' : '부족',
            remaining: lastMonthAmount - currentExpense
        };
    } catch (error) {
        logger.error('실적 확인 중 오류 발생: ' + error.message);
        throw error;
    }
}

// 카드별 페이지 ID 가져오기 함수
function getPageIdByCard(cardId) {
    const envKey = `CARD_${cardId.toUpperCase()}`;
    const pageId = process.env[envKey];
    if (!pageId) {
        throw new Error(`${cardId} 카드에 대한 페이지 ID가 설정되지 않았습니다.`);
    }
    return pageId;
}

// 카드 이름 가져오기 함수
function getCardName(cardId) {
    const envKey = `CARD_${cardId.toUpperCase()}_NAME`;
    const cardName = process.env[envKey];
    if (!cardName) {
        throw new Error(`${cardId} 카드에 대한 이름이 설정되지 않았습니다.`);
    }
    return cardName;
}

// 카드 현황 문자열 생성 함수
function formatCardStatus(cardName, currentExpense, lastMonthText, status, remaining) {
    let statusText = `${cardName} : ${currentExpense.toLocaleString()}원 / ${lastMonthText}`;
    
    if (status === '부족') {
        statusText += ` (${status}, ${remaining.toLocaleString()}원 남음)`;
    } else {
        statusText += ` (${status})`;
    }
    
    return statusText;
}

// 등록된 모든 카드 ID 가져오기 함수
function getAllCardIds() {
    const cardIds = [];
    Object.keys(process.env).forEach(key => {
        if (key.startsWith('CARD_') && !key.endsWith('_NAME')) {
            // CARD_SHINHAN 형태의 키에서 SHINHAN 부분만 추출
            const cardId = key.replace('CARD_', '').toLowerCase();
            cardIds.push(cardId);
        }
    });
    return cardIds;
}

// 카드 현황 문자열 생성 함수 (이모지 추가)
function formatCardStatusWithEmoji(cardName, currentExpense, lastMonthText, status, remaining) {
    let statusText = `💳 ${cardName} : ${currentExpense.toLocaleString()}원 / ${lastMonthText}`;
    
    if (status === '부족') {
        statusText += ` (${status}, ${remaining.toLocaleString()}원 남음)`;
    } else {
        statusText += ` (${status})`;
    }
    
    return statusText;
}

// API 라우트 핸들러들
const financialRoutes = {
    // 카드 금월지출 조회 API
    getExpense: async (req, res) => {
        try {
            const { cardId, format = 'json' } = req.body;
            if (!cardId) {
                throw new Error('cardId가 필요합니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const page = await notionClient.pages.retrieve({ page_id: pageId });
            const expense = page.properties['금월지출']?.number || 0;
            
            formatResponse(res, { success: true, expense }, format);
        } catch (error) {
            logger.error('금월지출 조회 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 카드 금월지출 업데이트 API
    updateExpense: async (req, res) => {
        try {
            const { cardId, value, format = 'json' } = req.body;
            if (!cardId) {
                throw new Error('cardId가 필요합니다.');
            }
            if (!value) {
                throw new Error('업데이트할 값이 필요합니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const formattedValue = formatPropertyValue('금월지출', value);
            
            await notionClient.pages.update({
                page_id: pageId,
                properties: {
                    '금월지출': formattedValue
                }
            });
            
            formatResponse(res, { success: true }, format);
        } catch (error) {
            logger.error('금월지출 업데이트 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 카드 전월실적 조회 API
    getLastPerformance: async (req, res) => {
        try {
            const { cardId, format = 'json' } = req.body;
            if (!cardId) {
                throw new Error('cardId가 필요합니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const page = await notionClient.pages.retrieve({ page_id: pageId });
            
            // 전월실적 속성 가져오기
            const formattedLastPerformance = page.properties['전월실적']?.rich_text?.[0]?.text?.content || '0';
            const numericLastPerformance = koreanAmountToNumber(formattedLastPerformance);
            
            formatResponse(res, {
                success: true,
                formattedLastPerformance,
                lastPerformance: numericLastPerformance
            }, format);
        } catch (error) {
            logger.error('실적 조회 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 카드 전월실적 충족 확인 API
    checkLastPerformance: async (req, res) => {
        try {
            const { cardId, format = 'json' } = req.body;
            if (!cardId) {
                throw new Error('cardId가 필요합니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const status = await checkExpenseStatus(cardId, pageId);
            
            formatResponse(res, {
                success: true,
                status: status.status,  // '충족' 또는 '부족'
                isAchieved: status.isAchieved,
                lastMonth: status.lastMonth,
                currentExpense: status.currentExpense,
                remaining: status.remaining
            }, format);
        } catch (error) {
            logger.error('상태 확인 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 카드 전월실적 남은 금액 조회 API
    getMonthRemaining: async (req, res) => {
        try {
            const { cardId, format = 'json' } = req.body;
            if (!cardId) {
                throw new Error('cardId가 필요합니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const status = await checkExpenseStatus(cardId, pageId);
            
            const remainingAmount = Math.max(0, status.remaining);
            
            formatResponse(res, {
                success: true,
                remaining: remainingAmount,
                formattedRemaining: remainingAmount.toLocaleString() + '원'
            }, format);
        } catch (error) {
            logger.error('남은 금액 조회 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 카드 월별 현황 조회 API
    getCardStatus: async (req, res) => {
        try {
            const { cardId, format = 'json' } = req.body;
            if (!cardId) {
                throw new Error('cardId가 필요합니다.');
            }

            // 카드 정보 조회
            const pageId = getPageIdByCard(cardId);
            const cardName = getCardName(cardId);
            const page = await notionClient.pages.retrieve({ page_id: pageId });
            
            // 전월실적 및 금월지출 정보 가져오기
            const lastMonthText = page.properties['전월실적']?.rich_text?.[0]?.text?.content || '0';
            const currentExpense = page.properties['금월지출']?.number || 0;
            const lastMonthAmount = koreanAmountToNumber(lastMonthText);
            
            // 상태 확인
            const status = currentExpense >= lastMonthAmount ? '충족' : '부족';
            const remaining = Math.max(0, lastMonthAmount - currentExpense);
            
            // 응답 데이터 생성
            const statusText = formatCardStatus(cardName, currentExpense, lastMonthText, status, remaining);
            
            if (format === 'plain') {
                formatResponse(res, { statusText }, format);
            } else {
                formatResponse(res, {
                    success: true,
                    cardName,
                    currentExpense,
                    lastMonthText,
                    lastMonthAmount,
                    status,
                    remaining,
                    statusText
                }, format);
            }
        } catch (error) {
            logger.error('카드 현황 조회 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 전체 카드 월별 현황 조회 API
    getAllCardStatus: async (req, res) => {
        try {
            const { format = 'json' } = req.body;
            const cardIds = getAllCardIds();
            
            let totalExpense = 0;
            const cardStatuses = [];
            
            // 각 카드별 현황 조회
            for (const cardId of cardIds) {
                const pageId = getPageIdByCard(cardId);
                const cardName = getCardName(cardId);
                const page = await notionClient.pages.retrieve({ page_id: pageId });
                
                const lastMonthText = page.properties['전월실적']?.rich_text?.[0]?.text?.content || '0';
                const currentExpense = page.properties['금월지출']?.number || 0;
                const lastMonthAmount = koreanAmountToNumber(lastMonthText);
                
                const status = currentExpense >= lastMonthAmount ? '충족' : '부족';
                const remaining = Math.max(0, lastMonthAmount - currentExpense);
                
                totalExpense += currentExpense;
                
                const statusText = formatCardStatusWithEmoji(cardName, currentExpense, lastMonthText, status, remaining);
                cardStatuses.push({
                    cardId,
                    cardName,
                    currentExpense,
                    lastMonthText,
                    lastMonthAmount,
                    status,
                    remaining,
                    statusText
                });
            }
            
            if (format === 'plain') {
                let plainText = cardStatuses.map(status => status.statusText).join('\n');
                plainText += '\n-------------';  // 구분선 추가
                plainText += `\n✳️ 합계 : ${totalExpense.toLocaleString()}원`;  // 이모지 변경
                formatResponse(res, { statusText: plainText }, format);
            } else {
                formatResponse(res, {
                    success: true,
                    cardStatuses,
                    totalExpense,
                    formattedTotalExpense: totalExpense.toLocaleString() + '원'
                }, format);
            }
        } catch (error) {
            logger.error('전체 카드 현황 조회 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    }
};

// 라우트 설정
router.post('/get-expense', financialRoutes.getExpense);
router.post('/update-expense', financialRoutes.updateExpense);
router.post('/get-last-performance', financialRoutes.getLastPerformance);
router.post('/check-last-performance', financialRoutes.checkLastPerformance);
router.post('/get-month-remaining', financialRoutes.getMonthRemaining);
router.post('/get-card-status', financialRoutes.getCardStatus);
router.post('/get-all-card-status', financialRoutes.getAllCardStatus);

module.exports = {
    router
}; 