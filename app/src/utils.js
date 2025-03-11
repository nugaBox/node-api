const logger = require('./logger');

// 응답 포맷 처리 함수
function formatResponse(res, data, format = 'json') {
    try {
        if (format === 'plain') {
            let plainText = '';
            if (typeof data === 'object' && data !== null) {
                if (data.statusText) {
                    plainText = data.statusText;
                } else if (data.type) {
                    switch (data.type) {
                        case 'number':
                            plainText = (data.number ?? 0).toString();
                            break;
                        case 'rich_text':
                            plainText = data.rich_text?.[0]?.text?.content || '';
                            break;
                        case 'checkbox':
                            plainText = (data.checkbox ?? false).toString();
                            break;
                        default:
                            plainText = JSON.stringify(data[data.type] || '');
                    }
                } else if (data.pageId) {
                    plainText = data.pageId;
                } else if (data.expense !== undefined) {
                    plainText = data.expense.toString();
                } else if (data.formattedLastPerformance !== undefined) {
                    plainText = data.formattedLastPerformance;
                } else if (data.status !== undefined) {
                    plainText = data.status;
                } else if (data.remaining !== undefined) {
                    plainText = data.formattedRemaining || data.remaining.toString();
                } else if (data.success !== undefined) {
                    plainText = data.success ? 'success' : 'failed';
                    if (!data.success && data.error) {
                        plainText += `: ${String(data.error)}`;
                    }
                } else {
                    plainText = JSON.stringify(data);
                }
            } else {
                plainText = String(data || '');
            }
            
            res.type('text').send(plainText);
        } else {
            res.json(data || {});
        }
    } catch (error) {
        logger.error('Response formatting error: ' + error.message);
        res.status(500).json({
            success: false,
            error: 'Internal server error during response formatting'
        });
    }
}

module.exports = {
    formatResponse
}; 