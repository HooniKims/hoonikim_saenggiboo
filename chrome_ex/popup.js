document.addEventListener('DOMContentLoaded', () => {
    updateStatus();

    // Refresh Button
    document.getElementById('refresh-btn').addEventListener('click', updateStatus);

    // Clear Button
    document.getElementById('clear-btn').addEventListener('click', () => {
        chrome.storage.local.clear(() => {
            updateStatus();
            alert('모든 데이터가 삭제되었습니다.');
        });
    });

    // Fetch Buttons
    document.getElementById('fetch-gwasetuk-btn').addEventListener('click', () => {
        sendMessageToContentScript({ action: 'fetch_data', type: 'gwasetuk' });
    });

    document.getElementById('fetch-haengbal-btn').addEventListener('click', () => {
        sendMessageToContentScript({ action: 'fetch_data', type: 'haengbal' });
    });

    // Fill Buttons
    document.getElementById('fill-gwasetuk-btn').addEventListener('click', () => {
        sendMessageToContentScript({ action: 'start_autofill', type: 'gwasetuk' });
    });

    document.getElementById('fill-haengbal-btn').addEventListener('click', () => {
        sendMessageToContentScript({ action: 'start_autofill', type: 'haengbal' });
    });
});

function updateStatus() {
    chrome.storage.local.get(['gwasetuk_data', 'haengbal_data'], (result) => {
        const gwasetukCount = result.gwasetuk_data ? result.gwasetuk_data.length : 0;
        const haengbalCount = result.haengbal_data ? result.haengbal_data.length : 0;

        document.getElementById('gwasetuk-count').textContent = `${gwasetukCount}명`;
        document.getElementById('haengbal-count').textContent = `${haengbalCount}명`;
    });
}

function sendMessageToContentScript(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;

        const tabId = tabs[0].id;

        // Try sending message first
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                // Connection failed (script not loaded or context invalidated)
                console.log('Connection failed, attempting to inject script...', chrome.runtime.lastError.message);

                // Inject content script dynamically
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content_script.js']
                }, () => {
                    if (chrome.runtime.lastError) {
                        // Real failure (e.g. restricted page)
                        alert('페이지를 새로고침하거나 확장 프로그램을 사용할 수 없는 페이지입니다.\n' + chrome.runtime.lastError.message);
                    } else {
                        // Injection success, retry message
                        chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
                            handleResponse(retryResponse, message);
                        });
                    }
                });
            } else {
                handleResponse(response, message);
            }
        });
    });
}

function handleResponse(response, message) {
    if (response && response.status === 'success') {
        if (message.action === 'fetch_data') {
            alert(`데이터를 성공적으로 가져왔습니다. (${response.count}명)`);
            updateStatus();
        }
    } else if (response && response.status === 'error') {
        alert(`오류: ${response.message}`);
    }
}
