const { notionClient, formatPropertyValue } = require('./notion');
const { formatResponse } = require('./utils');
const logger = require('./logger');
const express = require('express');
const router = express.Router();
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// YAML 설정 파일 로드 함수
function loadConfig() {
    try {
        const configPath = path.join(__dirname, 'financial.yml');
        const fileContents = fs.readFileSync(configPath, 'utf8');
        return yaml.load(fileContents);
    } catch (error) {
        logger.error('설정 파일 로드 중 오류: ' + error.message);
        throw error;
    }
}

// 설정 로드
const config = loadConfig();

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
    const paymentConfig = config.payment[cardId.toLowerCase()];
    if (!paymentConfig || !paymentConfig.page_id) {
        throw new Error(`${cardId} 카드에 대한 페이지 ID가 설정되지 않았습니다.`);
    }
    return paymentConfig.page_id;
}

// 카드 이름 가져오기 함수
function getCardName(cardId) {
    const paymentConfig = config.payment[cardId.toLowerCase()];
    if (!paymentConfig || !paymentConfig.name) {
        throw new Error(`${cardId} 카드에 대한 이름이 설정되지 않았습니다.`);
    }
    return paymentConfig.name;
}

// 등록된 신용카드 ID 가져오기 함수
function getCreditCardIds() {
    return Object.entries(config.payment)
        .filter(([_, info]) => info.type === 'credit_card')
        .map(([id, _]) => id.toUpperCase());
}

// 등록된 모든 결제수단 ID 가져오기 함수
function getAllPaymentIds() {
    return Object.keys(config.payment).map(id => id.toUpperCase());
}

// 결제수단 타입 확인 함수
function getPaymentType(cardId) {
    const paymentConfig = config.payment[cardId.toLowerCase()];
    if (!paymentConfig || !paymentConfig.type) {
        throw new Error(`${cardId} 결제수단에 대한 타입이 설정되지 않았습니다.`);
    }
    return paymentConfig.type;
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

// 연월 문자열을 Notion 관계형 페이지 ID로 변환하는 함수
async function getMonthRelationId(yearMonth) {
    try {
        // yearMonth 형식: "2025_03"
        const [year, month] = yearMonth.split('_');
        const monthTitle = `${year}년 ${parseInt(month)}월`;
        
        // 월별 가계부 데이터베이스에서 해당 월 페이지 검색
        const response = await notionClient.databases.query({
            database_id: config.database.monthly_expense.id,
            filter: {
                property: "연월구분",
                title: {
                    equals: monthTitle
                }
            }
        });

        if (response.results.length === 0) {
            throw new Error(`${monthTitle} 페이지를 찾을 수 없습니다.`);
        }

        return response.results[0].id;
    } catch (error) {
        logger.error('월별 relation ID 조회 중 오류: ' + error.message);
        throw error;
    }
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

            // 신용카드만 실적 조회 가능
            if (getPaymentType(cardId) !== 'credit_card') {
                throw new Error('신용카드만 전월실적을 조회할 수 있습니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const page = await notionClient.pages.retrieve({ page_id: pageId });
            
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

            // 신용카드만 실적 확인 가능
            if (getPaymentType(cardId) !== 'credit_card') {
                throw new Error('신용카드만 전월실적을 확인할 수 있습니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const status = await checkExpenseStatus(cardId, pageId);
            
            formatResponse(res, {
                success: true,
                status: status.status,
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

            // 신용카드만 실적 확인 가능
            if (getPaymentType(cardId) !== 'credit_card') {
                throw new Error('신용카드만 전월실적 남은 금액을 조회할 수 있습니다.');
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

            // 신용카드만 현황 조회 가능
            if (getPaymentType(cardId) !== 'credit_card') {
                throw new Error('신용카드만 월별 현황을 조회할 수 있습니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const cardName = getCardName(cardId);
            const page = await notionClient.pages.retrieve({ page_id: pageId });
            
            const lastMonthText = page.properties['전월실적']?.rich_text?.[0]?.text?.content || '0';
            const currentExpense = page.properties['금월지출']?.number || 0;
            const lastMonthAmount = koreanAmountToNumber(lastMonthText);
            
            const status = currentExpense >= lastMonthAmount ? '충족' : '부족';
            const remaining = Math.max(0, lastMonthAmount - currentExpense);
            
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
            const cardIds = getCreditCardIds(); // 신용카드만 조회
            
            let totalExpense = 0;
            const cardStatuses = [];
            
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
                plainText += '\n-------------';
                plainText += `\n✳️ 합계 : ${totalExpense.toLocaleString()}원`;
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
    },

    // 카드 사용내역 추가 API
    addExpense: async (req, res) => {
        try {
            const { 
                지출명, 
                카테고리명, 
                금액, 
                누구, 
                연월, 
                카드, 
                비고,
                format = 'json' 
            } = req.body;

            if (!지출명 || !카테고리명 || !금액 || !누구 || !연월 || !카드) {
                throw new Error('필수 입력값이 누락되었습니다.');
            }

            const monthRelationId = await getMonthRelationId(연월);
            const cardRelationId = getPageIdByCard(카드);

            // 사용내역 추가
            const response = await notionClient.pages.create({
                parent: {
                    database_id: config.database.expense.id
                },
                properties: {
                    "상세내역": {
                        title: [{ text: { content: 지출명 } }]
                    },
                    "구분": {
                        select: { name: "지출" }
                    },
                    "지출항목": {
                        select: { name: 카테고리명 }
                    },
                    "금액": {
                        number: parseInt(금액)
                    },
                    "누구": {
                        select: { name: 누구 }
                    },
                    "월별 통계 지출 relation": {
                        relation: [{ id: monthRelationId }]
                    },
                    "결제 수단": {
                        relation: [{ id: cardRelationId }]
                    },
                    "비고": 비고 ? {
                        rich_text: [{ text: { content: 비고 } }]
                    } : undefined
                }
            });

            // 신용카드인 경우 금월지출 자동 업데이트
            if (getPaymentType(카드) === 'credit_card') {
                try {
                    // 현재 금월지출 조회
                    const page = await notionClient.pages.retrieve({ page_id: cardRelationId });
                    const currentExpense = page.properties['금월지출']?.number || 0;
                    
                    // 새로운 금액 계산 및 업데이트
                    const newExpense = currentExpense + parseInt(금액);
                    await notionClient.pages.update({
                        page_id: cardRelationId,
                        properties: {
                            '금월지출': {
                                number: newExpense
                            }
                        }
                    });

                    logger.info(`${카드} 카드의 금월지출이 ${currentExpense.toLocaleString()}원에서 ${newExpense.toLocaleString()}원으로 업데이트되었습니다.`);
                } catch (updateError) {
                    logger.error(`금월지출 자동 업데이트 중 오류 발생: ${updateError.message}`);
                    // 금월지출 업데이트 실패는 전체 트랜잭션을 실패시키지 않음
                }
            }

            formatResponse(res, {
                success: true,
                message: '사용내역이 추가되었습니다.',
                pageId: response.id
            }, format);
        } catch (error) {
            logger.error('사용내역 추가 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 월별 페이지 존재 여부 확인 API
    checkMonthPage: async (req, res) => {
        try {
            const { yearmonth, format = 'json' } = req.body;
            
            if (!yearmonth) {
                throw new Error('yearmonth가 필요합니다.');
            }

            if (!/^\d{4}_\d{2}$/.test(yearmonth)) {
                throw new Error('yearmonth 형식이 올바르지 않습니다. (예: 2024_03)');
            }

            const [year, month] = yearmonth.split('_');
            const monthTitle = `${year}년 ${parseInt(month)}월`;

            const response = await notionClient.databases.query({
                database_id: config.database.monthly_expense.id,
                filter: {
                    property: "연월구분",
                    title: {
                        equals: monthTitle
                    }
                }
            });

            if (response.results.length === 0) {
                formatResponse(res, {
                    success: false,
                    message: `해당 월이 없습니다. Notion에서 [한 달 생성]을 실행하세요`
                }, format);
            } else {
                formatResponse(res, {
                    success: true
                }, format);
            }
        } catch (error) {
            logger.error('월별 페이지 확인 중 오류 발생: ' + error.message);
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 이번 달 가계부 페이지 정보 조회 API
    getCurrentMonthPage: async (req, res) => {
        try {
            const { format = 'json' } = req.body;
            
            const now = new Date();
            const yearmonth = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const [year, month] = yearmonth.split('_');
            const monthTitle = `${year}년 ${parseInt(month)}월`;

            const response = await notionClient.databases.query({
                database_id: config.database.monthly_expense.id,
                filter: {
                    property: "연월구분",
                    title: {
                        equals: monthTitle
                    }
                }
            });

            if (response.results.length === 0) {
                formatResponse(res, {
                    success: false,
                    message: `이번 달(${monthTitle}) 페이지가 없습니다. Notion에서 [한 달 생성]을 실행하세요`
                }, format);
            } else {
                const pageId = response.results[0].id;
                const pageUrl = `https://www.notion.so/codenuga/${year}-${parseInt(month)}-${pageId}`;
                
                if (format === 'plain') {
                    formatResponse(res, { 
                        text: `${pageId}\n${pageUrl}` 
                    }, format);
                } else {
                    formatResponse(res, {
                        success: true,
                        pageId,
                        pageUrl,
                        monthTitle,
                        yearmonth
                    }, format);
                }
            }
        } catch (error) {
            logger.error('이번 달 페이지 정보 조회 중 오류 발생: ' + error.message);
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
router.post('/add-expense', financialRoutes.addExpense);
router.post('/check-month-page', financialRoutes.checkMonthPage);
router.post('/get-current-month-page', financialRoutes.getCurrentMonthPage);

module.exports = {
    router
}; 