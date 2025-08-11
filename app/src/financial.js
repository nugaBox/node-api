const { notionClient, formatPropertyValue } = require('./notion');
const { formatResponse } = require('./utils');
const express = require('express');
const router = express.Router();
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
require('dotenv').config();

// YAML 설정 파일 로드 함수
function loadConfig() {
    try {
        const configPath = path.join(__dirname, 'financial.yml');
        const fileContents = fs.readFileSync(configPath, 'utf8');
        return yaml.load(fileContents);
    } catch (error) {
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
        return 0;
    }
}

// "yyyy. MM. dd." 형태의 문자열을 ISO 날짜(YYYY-MM-DD)로 변환
function parseKoreanDateDots(dateString) {
    try {
        if (!dateString || typeof dateString !== 'string') return null;
        const match = dateString.trim().match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);
        if (!match) return null;
        const year = Number(match[1]);
        const month = String(Number(match[2])).padStart(2, '0');
        const day = String(Number(match[3])).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (_) {
        return null;
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
        const [year, month] = yearMonth.split('_');
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
            throw new Error(`${monthTitle} 페이지를 찾을 수 없습니다.`);
        }

        return response.results[0].id;
    } catch (error) {
        throw error;
    }
}

// 이번달 추가지출 합계 조회 함수
async function getCurrentMonthExtraExpense() {
    try {
        const now = new Date();
        const yearmonth = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthRelationId = await getMonthRelationId(yearmonth);

        const response = await notionClient.databases.query({
            database_id: config.database.expense.id,
            filter: {
                and: [
                    {
                        property: "구분",
                        select: {
                            equals: "지출"
                        }
                    },
                    {
                        property: "고정지출 여부",
                        checkbox: {
                            equals: false
                        }
                    },
                    {
                        property: "월별 통계 지출 relation",
                        relation: {
                            contains: monthRelationId
                        }
                    }
                ]
            }
        });

        return response.results.reduce((sum, page) => {
            return sum + (page.properties['금액']?.number || 0);
        }, 0);
    } catch (error) {
        throw error;
    }
}

// 지출내역 알림 함수
async function sendExpenseNotification(지출명, 카테고리명, 금액, 누구, 비고) {
    try {
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        // 현재 월 페이지 정보 가져오기
        const yearmonth = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
        logger.debug('현재 연월: ' + yearmonth);
        
        const monthRelationId = await getMonthRelationId(yearmonth);
        logger.debug('월별 페이지 ID: ' + monthRelationId);
        
        // 페이지 정보 조회
        const monthPage = await notionClient.pages.retrieve({ 
            page_id: monthRelationId
        });
        
        // 각 속성 ID 확인
        const 수입_ID = monthPage.properties['수입'].id;
        const 지출_ID = monthPage.properties['지출'].id;
        const 잔액_ID = monthPage.properties['잔액'].id;
        const 지출예산_ID = monthPage.properties['지출 예산'].id;

        // 각 속성 개별 조회
        const [수입Response, 지출Response, 잔액Response, 지출예산Response] = await Promise.all([
            notionClient.pages.properties.retrieve({ page_id: monthRelationId, property_id: 수입_ID }),
            notionClient.pages.properties.retrieve({ page_id: monthRelationId, property_id: 지출_ID }),
            notionClient.pages.properties.retrieve({ page_id: monthRelationId, property_id: 잔액_ID }),
            notionClient.pages.properties.retrieve({ page_id: monthRelationId, property_id: 지출예산_ID })
        ]);

        logger.debug('수입 속성 응답:\n' + JSON.stringify(수입Response, null, 2));
        logger.debug('지출 속성 응답:\n' + JSON.stringify(지출Response, null, 2));
        logger.debug('잔액 속성 응답:\n' + JSON.stringify(잔액Response, null, 2));
        logger.debug('지출 예산 속성 응답:\n' + JSON.stringify(지출예산Response, null, 2));
        
        // 추가지출 합계 조회
        const extraExpense = await getCurrentMonthExtraExpense();
        logger.debug('추가지출 합계: ' + extraExpense);
        
        // 값 추출
        const monthlyImport = 수입Response.property_item?.rollup?.number || 0;
        const monthlyExpense = 지출Response.property_item?.rollup?.number || 0;
        const monthlyBalance = 잔액Response.formula?.number || 0;
        const monthlyBudget = 지출예산Response.number || 0;
        const monthlyBudgetBalance = monthlyBudget - extraExpense;

        logger.debug('계산된 값:\n' + JSON.stringify({
            monthlyImport,
            monthlyExpense,
            monthlyBalance,
            monthlyBudget,
            monthlyBudgetBalance
        }, null, 2));

        const message = `🔔 [${누구}]의 지출내역 추가\n💬 지출내역 : ${카테고리명}/${지출명}${비고 ? ` (${비고})` : ''}\n💸 지출금액 : ${금액.toLocaleString()}원\n📅 지출일시 : ${dateStr}\n-------------------------------\n#️⃣ 추가지출 합계 : ${extraExpense.toLocaleString()}원\n⏸️ 추가지출 예산잔액 : ${monthlyBudget.toLocaleString()}원 중 ${monthlyBudgetBalance.toLocaleString()}원\n-------------------------------\n➕ 금월 수입 예상 : ${(monthlyImport).toLocaleString()}원\n➖ 금월 지출 예상 : ${monthlyExpense.toLocaleString()}원\n🟰 금월 잔액 예상 : ${monthlyBalance.toLocaleString()}원`;

        await notionClient.comments.create({
            parent: { page_id: config.page.expense_alrim.id },
            rich_text: [{
                type: 'text',
                text: { content: message }
            }]
        });

        return true;
    } catch (error) {
        logger.error('알림 전송 실패: ' + error.message);
        logger.error('에러 상세: ' + JSON.stringify(error, null, 2));
        return false;
    }
}

// API 라우트 핸들러들
const financialRoutes = {
    // 카드 금월지출 조회 API
    getExpense: async (req, res) => {
        try {
            const { cardId, format = 'json' } = req.body;
            logger.debug('Request: getExpense ' + JSON.stringify({ cardId, format }));

            if (!cardId) {
                throw new Error('cardId가 필요합니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const page = await notionClient.pages.retrieve({ page_id: pageId });
            const expense = page.properties['금월지출']?.number || 0;
            
            const response = { success: true, expense };
            logger.debug('Response: ' + JSON.stringify(response));
            formatResponse(res, response, format);
        } catch (error) {
            const errorResponse = { success: false, error: error.message };
            logger.error('Error: ' + JSON.stringify(errorResponse));
            formatResponse(res, errorResponse, req.body.format);
        }
    },

    // 카드 금월지출 업데이트 API
    updateExpense: async (req, res) => {
        try {
            const { cardId, value, format = 'json' } = req.body;
            logger.debug('Request: updateExpense ' + JSON.stringify({ cardId, value, format }));

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
            
            const response = { success: true };
            logger.debug('Response: ' + JSON.stringify(response));
            formatResponse(res, response, format);
        } catch (error) {
            const errorResponse = { success: false, error: error.message };
            logger.error('Error: ' + JSON.stringify(errorResponse));
            formatResponse(res, errorResponse, req.body.format);
        }
    },

    // 카드 전월실적 조회 API
    getLastPerformance: async (req, res) => {
        try {
            const { cardId, format = 'json' } = req.body;
            logger.debug('Request: getLastPerformance ' + JSON.stringify({ cardId, format }));

            if (!cardId) {
                throw new Error('cardId가 필요합니다.');
            }

            if (getPaymentType(cardId) !== 'credit_card') {
                throw new Error('신용카드만 전월실적을 조회할 수 있습니다.');
            }

            const pageId = getPageIdByCard(cardId);
            const page = await notionClient.pages.retrieve({ page_id: pageId });
            
            const formattedLastPerformance = page.properties['전월실적']?.rich_text?.[0]?.text?.content || '0';
            const numericLastPerformance = koreanAmountToNumber(formattedLastPerformance);
            
            const response = {
                success: true,
                formattedLastPerformance,
                lastPerformance: numericLastPerformance
            };
            logger.debug('Response: ' + JSON.stringify(response));
            formatResponse(res, response, format);
        } catch (error) {
            const errorResponse = { success: false, error: error.message };
            logger.error('Error: ' + JSON.stringify(errorResponse));
            formatResponse(res, errorResponse, req.body.format);
        }
    },

    // 카드 전월실적 충족 확인 API
    checkLastPerformance: async (req, res) => {
        try {
            const { cardId, format = 'json' } = req.body;
            if (!cardId) {
                throw new Error('cardId가 필요합니다.');
            }

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
            formatResponse(res, { success: false, error: error.message }, req.body.format);
        }
    },

    // 전체 카드 월별 현황 조회 API
    getAllCardStatus: async (req, res) => {
        try {
            const { format = 'json' } = req.body;
            const cardIds = getCreditCardIds();
            
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
                언제,
                format = 'json' 
            } = req.body;

            logger.debug('Request: addExpense ' + JSON.stringify(req.body));

            if (!지출명 || !카테고리명 || !금액 || !누구 || !연월 || !카드) {
                throw new Error('필수 입력값이 누락되었습니다.');
            }

            const monthRelationId = await getMonthRelationId(연월);
            const cardRelationId = getPageIdByCard(카드);
            const parsedAmount = parseInt(금액);

            const transactionDateISO = parseKoreanDateDots(언제);

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
                        number: parsedAmount
                    },
                    "누구": {
                        select: { name: 누구 }
                    },
                    "거래일자": transactionDateISO ? {
                        date: { start: transactionDateISO }
                    } : undefined,
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

            if (getPaymentType(카드) === 'credit_card') {
                try {
                    const page = await notionClient.pages.retrieve({ page_id: cardRelationId });
                    const currentExpense = page.properties['금월지출']?.number || 0;
                    const newExpense = currentExpense + parsedAmount;
                    
                    await notionClient.pages.update({
                        page_id: cardRelationId,
                        properties: {
                            '금월지출': {
                                number: newExpense
                            }
                        }
                    });
                } catch (updateError) {
                    logger.error('금월지출 업데이트 실패: ' + updateError.message);
                }
            }

            await sendExpenseNotification(지출명, 카테고리명, parsedAmount, 누구, 비고);

            const responseData = {
                success: true,
                message: '사용내역이 추가되었습니다.',
                pageId: response.id
            };
            
            logger.debug('Response: ' + JSON.stringify(responseData));
            formatResponse(res, responseData, format);
        } catch (error) {
            const errorResponse = { success: false, error: error.message };
            logger.error('Error: ' + JSON.stringify(errorResponse));
            formatResponse(res, errorResponse, req.body.format);
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
                const cleanedPageId = pageId.replace('-', '');
                const pageUrl = `https://www.notion.so/codenuga/${year}-${parseInt(month)}-${cleanedPageId}`;
                
                if (format === 'plain') {
                    formatResponse(res, { 
                        text: `${pageUrl}` 
                    }, format);
                } else {
                    formatResponse(res, {
                        success: true,
                        pageUrl,
                        monthTitle,
                        yearmonth
                    }, format);
                }
            }
        } catch (error) {
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