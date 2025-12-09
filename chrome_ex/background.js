// Background Service Worker
// Currently minimal, but can be used for more complex state management if needed.

chrome.runtime.onInstalled.addListener(() => {
    console.log('나이스 자동입력 도우미 확장 프로그램이 설치되었습니다.');
});
