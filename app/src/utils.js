// 응답 포맷 처리 함수
function formatResponse(res, data, format = 'json') {
    if (format === 'plain') {
        // 데이터 타입에 따른 텍스트 변환
        let plainText = '';
        if (typeof data === 'object') {
            if (data.statusText) {  // 카드 현황 텍스트 처리 추가
                plainText = data.statusText;
            } else if (data.type) {
                // Notion API 응답 처리
                switch (data.type) {
                    case 'number':
                        plainText = data.number?.toString() || '0';
                        break;
                    case 'rich_text':
                        plainText = data.rich_text?.[0]?.text?.content || '';
                        break;
                    case 'checkbox':
                        plainText = data.checkbox?.toString() || 'false';
                        break;
                    default:
                        plainText = JSON.stringify(data[data.type]);
                }
            } else if (data.pageId) {
                plainText = data.pageId;
            } else if (data.expense !== undefined) {
                plainText = data.expense.toString();
            } else if (data.formattedLastPerformance !== undefined) {
                plainText = data.formattedLastPerformance;
            } else if (data.status !== undefined) {  // status 처리 추가
                plainText = data.status;
            } else if (data.remaining !== undefined) {
                plainText = data.formattedRemaining || data.remaining.toString();
            } else if (data.success !== undefined) {
                plainText = data.success ? 'success' : 'failed';
                if (!data.success && data.error) {
                    plainText += `: ${data.error}`;
                }
            } else {
                plainText = JSON.stringify(data);
            }
        } else {
            plainText = String(data);
        }
        res.type('text').send(plainText);
    } else {
        res.json(data);
    }
}

module.exports = {
    formatResponse
}; 