const { notion } = require('./utils');
const logger = require('./logger');

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
        const page = await notion.pages.retrieve({ page_id: pageId });
        
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

// API 라우트 핸들러들
const cardRoutes = {
    // 금월지출 조회 API
    getExpense: async (req, res) => {
        try {
            const { cardAlias } = req.params;
            const pageId = getPageIdByCard(cardAlias);
            
            const page = await notion.pages.retrieve({ page_id: pageId });
            const expense = page.properties['금월지출']?.number || 0;
            
            if (req.query.format === 'text') {
                res.type('text').send(expense.toString());
            } else {
                res.json({ success: true, expense: expense });
            }
        } catch (error) {
            logger.error('금월지출 조회 중 오류 발생: ' + error.message);
            if (req.query.format === 'text') {
                res.type('text').status(500).send(error.message);
            } else {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    },

    // 금월지출 업데이트 API
    updateExpense: async (req, res) => {
        try {
            const { cardAlias } = req.params;
            const { value } = req.query;
            
            if (!value) {
                throw new Error('업데이트할 값이 필요합니다.');
            }

            const pageId = getPageIdByCard(cardAlias);
            const formattedValue = formatPropertyValue('금월지출', value);
            
            await notion.pages.update({
                page_id: pageId,
                properties: {
                    '금월지출': formattedValue
                }
            });
            
            if (req.query.format === 'text') {
                res.type('text').send('성공');
            } else {
                res.json({ success: true });
            }
        } catch (error) {
            logger.error('금월지출 업데이트 중 오류 발생: ' + error.message);
            if (req.query.format === 'text') {
                res.type('text').status(500).send('실패: ' + error.message);
            } else {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    },

    // 실적 상태 확인 API
    getStatus: async (req, res) => {
        try {
            const { cardAlias } = req.params;
            const pageId = getPageIdByCard(cardAlias);
            const status = await checkExpenseStatus(cardAlias, pageId);
            
            if (req.query.format === 'text') {
                if (req.query.detail === 'true') {
                    const remainingText = status.remaining > 0 
                        ? `남은 금액: ${status.remaining.toLocaleString()}원`
                        : `초과 금액: ${Math.abs(status.remaining).toLocaleString()}원`;
                    
                    res.type('text').send(
                        `상태: ${status.status}\n` +
                        `전월실적: ${status.lastMonth.toLocaleString()}원\n` +
                        `금월지출: ${status.currentExpense.toLocaleString()}원\n` +
                        remainingText
                    );
                } else {
                    res.type('text').send(status.status);
                }
            } else {
                res.json({ success: true, status: status });
            }
        } catch (error) {
            logger.error('상태 확인 중 오류 발생: ' + error.message);
            if (req.query.format === 'text') {
                res.type('text').status(500).send(error.message);
            } else {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    },

    // 남은 금액 조회 API
    getRemaining: async (req, res) => {
        try {
            const { cardAlias } = req.params;
            const pageId = getPageIdByCard(cardAlias);
            const status = await checkExpenseStatus(cardAlias, pageId);
            
            const remainingAmount = Math.max(0, status.remaining);
            
            if (req.query.format === 'text') {
                const formattedAmount = remainingAmount > 0 
                    ? `${remainingAmount.toLocaleString()}원`
                    : '0원';
                
                res.type('text').send(formattedAmount);
            } else {
                res.json({
                    success: true,
                    remaining: remainingAmount,
                    formattedRemaining: remainingAmount.toLocaleString() + '원'
                });
            }
        } catch (error) {
            logger.error('남은 금액 조회 중 오류 발생: ' + error.message);
            if (req.query.format === 'text') {
                res.type('text').status(500).send(error.message);
            } else {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    }
};

module.exports = {
    formatPropertyValue,
    koreanAmountToNumber,
    checkExpenseStatus,
    cardRoutes
}; 