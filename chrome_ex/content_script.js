// Content Script

// Prevent duplicate injection
if (window.hasAceContentScript) {
    // Already loaded, do nothing or just log
    // console.log('Content script already loaded');
} else {
    window.hasAceContentScript = true;

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'fetch_data') {
            fetchData(request.type).then(count => {
                sendResponse({ status: 'success', count: count });
            }).catch(err => {
                sendResponse({ status: 'error', message: err.message });
            });
            return true; // Async response
        } else if (request.action === 'start_autofill') {
            startAutoFill(request.type);
            sendResponse({ status: 'started' });
        }
    });
}

// 1. Fetch Data Logic
async function fetchData(type) {
    let students = [];

    // Selectors based on the Web App structure
    // We look for the student cards. The structure is:
    // .section-card -> input[placeholder="이름"] (Name)
    // .section-card -> textarea[placeholder="AI 생성 결과가 여기에 표시됩니다."] (Result)

    const cards = document.querySelectorAll('.section-card');

    cards.forEach(card => {
        const nameInput = card.querySelector('input[placeholder="이름"]');
        const resultTextarea = card.querySelector('textarea[placeholder="AI 생성 결과가 여기에 표시됩니다."]');

        if (nameInput && resultTextarea) {
            const name = nameInput.value.trim();
            const result = resultTextarea.value.trim();

            if (name && result) {
                students.push({ name, result });
            }
        }
    });

    if (students.length === 0) {
        throw new Error('가져올 데이터가 없습니다. 학생 이름과 생성된 결과가 있는지 확인해주세요.');
    }

    // Save to storage
    const storageKey = type === 'gwasetuk' ? 'gwasetuk_data' : 'haengbal_data';
    await chrome.storage.local.set({ [storageKey]: students });

    return students.length;
}

// 2. Auto Fill Logic
async function startAutoFill(type) {
    const storageKey = type === 'gwasetuk' ? 'gwasetuk_data' : 'haengbal_data';
    const data = await chrome.storage.local.get(storageKey);
    const students = data[storageKey];

    if (!students || students.length === 0) {
        alert('저장된 데이터가 없습니다. 먼저 데이터를 가져오세요.');
        return;
    }

    // NEW APPROACH: Find student rows by name matching
    // First click on the starting textarea to begin

    // Check if user is already focused on an input
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        if (confirm(`현재 선택된 칸부터 '${students[0].name}' 학생의 데이터를 입력하시겠습니까?`)) {
            processAutoFillByName(students, type);
            return;
        }
    }

    // Show floating banner
    showFloatingBanner(`자동 입력 준비 완료! (${students.length}명)\n첫 번째 학생의 입력 칸을 클릭하세요.`);

    // Add one-time click/focus listener to start the process
    const startHandler = (e) => {
        const target = e.target;
        // Check if target is an input or textarea
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            e.preventDefault();

            // Remove listener to prevent multiple starts
            document.removeEventListener('focus', startHandler, true);
            document.removeEventListener('click', startHandler, true);

            removeFloatingBanner();

            if (confirm(`'${students[0].name}' 학생부터 입력을 시작하시겠습니까?`)) {
                processAutoFillByName(students, type);
            }
        }
    };

    // Use capturing phase to catch focus early
    document.addEventListener('focus', startHandler, true);
    document.addEventListener('click', startHandler, true);
}

// NEW: Process autofill by finding student names in the grid
async function processAutoFillByName(students, type = 'gwasetuk') {
    let successCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    // Helper function to simulate mouse events
    function simulateClick(element, type = 'click') {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const event = new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y
        });
        element.dispatchEvent(event);
    }

    // Helper function to simulate keyboard event
    function simulateKeyEvent(element, eventType, key, keyCode) {
        const event = new KeyboardEvent(eventType, {
            key: key,
            code: key,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
            composed: true
        });
        element.dispatchEvent(event);
    }

    // Helper to scroll grid container
    function scrollGridTo(scrollPos) {
        const scrollContainer = document.querySelector('.cl-grid-body') ||
            document.querySelector('.cl-scrollbar') ||
            document.querySelector('[class*="scroll"]');
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollPos;
            return true;
        }
        return false;
    }

    function scrollGridDown(amount = 100) {
        const scrollContainer = document.querySelector('.cl-grid-body') ||
            document.querySelector('.cl-scrollbar') ||
            document.querySelector('[class*="scroll"]');
        if (scrollContainer) {
            scrollContainer.scrollTop += amount;
            return scrollContainer.scrollTop;
        }
        return -1;
    }

    // Helper to check if a cell/textarea is readonly (disabled)
    // Based on actual NEIS structure: cl-readonly class, readonly attribute, aria-readonly
    function isCellReadonly(cell) {
        if (!cell) return true;

        // Check if the cell itself or parent has cl-readonly class
        const controlWrapper = cell.closest('.cl-control') || cell.querySelector('.cl-control');
        if (controlWrapper && controlWrapper.classList.contains('cl-readonly')) {
            console.log('Cell is readonly: has cl-readonly class');
            return true;
        }

        // Check for readonly attribute on textarea
        const textarea = cell.querySelector('textarea') || (cell.tagName === 'TEXTAREA' ? cell : null);
        if (textarea) {
            if (textarea.hasAttribute('readonly') || textarea.readOnly) {
                console.log('Cell is readonly: textarea has readonly attribute');
                return true;
            }
            if (textarea.getAttribute('aria-readonly') === 'true') {
                console.log('Cell is readonly: aria-readonly is true');
                return true;
            }
            // Check aria-label for "읽기전용"
            const ariaLabel = textarea.getAttribute('aria-label') || '';
            if (ariaLabel.includes('읽기전용')) {
                console.log('Cell is readonly: aria-label contains 읽기전용');
                return true;
            }
        }

        // Check for disabled-related keywords in row
        const row = cell.closest('.cl-grid-row');
        if (row) {
            if (row.classList.contains('cl-disabled') || row.classList.contains('disabled')) {
                return true;
            }
            const ariaLabel = row.getAttribute('aria-label') || '';
            const disabledKeywords = ['장기결석', '정원 외', '학적관리', '제적', '전출', '휴학', '읽기전용'];
            for (const keyword of disabledKeywords) {
                if (ariaLabel.includes(keyword)) {
                    console.log(`Cell is readonly: row has keyword "${keyword}"`);
                    return true;
                }
            }
        }

        return false;
    }

    // Find student row by name - search all visible rows for the student name
    // NEIS uses <div class="cl-text" style="display: table-cell;">이름</div> for names
    async function findStudentRow(studentName, lastRowIndex = 0) {
        const allRows = document.querySelectorAll('.cl-grid-row');

        for (const row of allRows) {
            const rowIndex = parseInt(row.getAttribute('data-rowindex'), 10);
            if (isNaN(rowIndex) || rowIndex <= lastRowIndex) continue;

            // Method 1: Check div.cl-text elements with display: table-cell (name cells)
            const nameCells = row.querySelectorAll('div.cl-text');
            for (const nameCell of nameCells) {
                const style = window.getComputedStyle(nameCell);
                // Name cells have display: table-cell
                if (style.display === 'table-cell') {
                    const cellText = nameCell.textContent.trim();
                    if (cellText === studentName) {
                        console.log(`✓ Found student "${studentName}" in row ${rowIndex} (via div.cl-text)`);
                        return { row, rowIndex };
                    }
                }
            }

            // Method 2: Fallback - check row innerText and aria-label
            const rowText = row.innerText || '';
            const ariaLabel = row.getAttribute('aria-label') || '';
            if (rowText.includes(studentName) || ariaLabel.includes(studentName)) {
                console.log(`✓ Found student "${studentName}" in row ${rowIndex} (via innerText/aria)`);
                return { row, rowIndex };
            }
        }

        return null;
    }

    // Activate the textarea in the row (세부능력 및 특기사항 or 행동특성 column)
    async function activateTextareaInRow(row, rowIndex, type = 'gwasetuk') {
        const cells = row.querySelectorAll('.cl-grid-cell');
        if (cells.length === 0) {
            console.log(`Row ${rowIndex}: No cells found`);
            return null;
        }

        console.log(`Row ${rowIndex}: Found ${cells.length} cells. Searching for editable textarea...`);

        // Strategy 1: Check if textarea already exists in any cell (could be already active)
        let existingTextarea = row.querySelector('textarea.cl-text:not([readonly])');
        if (existingTextarea && !existingTextarea.readOnly) {
            console.log(`Row ${rowIndex}: Found existing editable textarea`);
            existingTextarea.scrollIntoView({ behavior: 'instant', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 100));
            existingTextarea.focus();
            return existingTextarea;
        }

        // Strategy 2: Find the textarea control cell (has cl-textarea class but NOT cl-readonly)
        let targetCell = null;
        for (let i = cells.length - 1; i >= 0; i--) {
            const cell = cells[i];
            const control = cell.querySelector('.cl-control.cl-textarea');
            if (control && !control.classList.contains('cl-readonly')) {
                targetCell = cell;
                console.log(`Row ${rowIndex}: Found editable textarea control in cell ${i}`);
                break;
            }
        }
        // Strategy 3: If not found, search ALL cells for any textarea control
        if (!targetCell) {
            console.log(`Row ${rowIndex}: Searching all ${cells.length} cells for textarea control...`);
            for (let i = cells.length - 1; i >= 0; i--) {
                const cell = cells[i];
                const control = cell.querySelector('.cl-control.cl-textarea');
                if (control) {
                    // Found a textarea control (might be readonly), check if usable
                    const isReadonly = control.classList.contains('cl-readonly');
                    console.log(`Row ${rowIndex}: Found cl-textarea in cell ${i}, readonly=${isReadonly}`);
                    if (!isReadonly) {
                        targetCell = cell;
                        console.log(`Row ${rowIndex}: Using cell ${i} (found via full search)`);
                        break;
                    }
                }
            }
        }

        // Strategy 4: Look for any cell with target keywords in aria-label
        // 과세특: '세부능력', '특기사항' / 행발: '행동특성', '종합의견', '행동', '특성'
        if (!targetCell) {
            const gwasetukKeywords = ['세부능력', '특기사항'];
            const haengbalKeywords = ['행동특성', '종합의견', '행동', '특성'];
            const keywords = type === 'haengbal' ? haengbalKeywords : gwasetukKeywords;

            for (let i = cells.length - 1; i >= 0; i--) {
                const cell = cells[i];
                const ariaLabel = cell.getAttribute('aria-label') || '';
                if (keywords.some(kw => ariaLabel.includes(kw))) {
                    console.log(`Row ${rowIndex}: Found cell ${i} via aria-label (type=${type}): "${ariaLabel.substring(0, 30)}..."`);
                    targetCell = cell;
                    break;
                }
            }
        }

        // Final fallback: Use last cell that might contain editable content
        if (!targetCell) {
            // For 8-cell rows, textarea might be in cell 6 or 7
            const fallbackIdx = cells.length >= 8 ? cells.length - 2 : Math.min(cells.length - 1, 5);
            targetCell = cells[fallbackIdx];
            console.log(`Row ${rowIndex}: Using cell ${fallbackIdx} as final fallback (${cells.length} cells)`);
        }

        // Check if this cell is readonly - try Tab navigation instead of skipping
        if (isCellReadonly(targetCell)) {
            console.log(`Row ${rowIndex}: Target cell is readonly. Trying Tab navigation from previous row...`);

            // Try Tab navigation from current textarea
            const prevTextarea = document.querySelector('textarea.cl-text:not([readonly])');
            if (prevTextarea) {
                const expectedRow = rowIndex + 1; // aria-label uses 1-based indexing

                // Press Tab to move to next editable cell
                prevTextarea.focus();
                await new Promise(resolve => setTimeout(resolve, 100));

                simulateKeyEvent(prevTextarea, 'keydown', 'Tab', 9);
                simulateKeyEvent(prevTextarea, 'keyup', 'Tab', 9);
                await new Promise(resolve => setTimeout(resolve, 500));

                // Check if we got a new textarea with correct row
                const newTextarea = document.querySelector('textarea.cl-text:not([readonly])');
                if (newTextarea) {
                    const ariaLabel = newTextarea.getAttribute('aria-label') || '';
                    const match = ariaLabel.match(/(\d+)행/);
                    const newRow = match ? parseInt(match[1]) : 0;

                    console.log(`Row ${rowIndex}: After Tab, textarea at row ${newRow} (expected ${expectedRow})`);

                    if (newRow === expectedRow) {
                        console.log(`Row ${rowIndex}: ✓ Reached target via Tab from readonly cell!`);
                        return newTextarea;
                    }
                }
            }

            console.log(`Row ${rowIndex}: Tab navigation from readonly cell failed. Skipping...`);
            return null;
        }

        // Row should already be scrolled to center by main loop, just ensure cell is visible
        await new Promise(resolve => setTimeout(resolve, 100));

        // CRITICAL: Force-close any currently active textarea before trying to activate new one
        // This is especially important after encountering disabled rows (장기결석 등)
        if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') {
            console.log(`Row ${rowIndex}: Force-closing previous textarea with Tab key (saves data)...`);

            // Use Tab key instead of ESC to save data and move to next cell
            // ESC key cancels the edit and loses data!
            simulateKeyEvent(document.activeElement, 'keydown', 'Tab', 9);
            simulateKeyEvent(document.activeElement, 'keyup', 'Tab', 9);
            await new Promise(resolve => setTimeout(resolve, 300));

            // Blur the textarea
            if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') {
                document.activeElement.blur();
            }
            await new Promise(resolve => setTimeout(resolve, 300));

            // Click on an empty area of the grid to fully reset edit state
            const gridBody = document.querySelector('.cl-grid-body');
            if (gridBody) {
                simulateClick(gridBody, 'click');
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Extra wait for NEIS to fully process the close
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Try multiple activation methods
        // Save reference to previous active element to detect change
        const previousActiveElement = document.activeElement;

        // Special handling for 8-cell rows (after disabled rows like 장기결석)
        // These rows need different activation strategy
        const is8CellRow = cells.length >= 8;
        if (is8CellRow) {
            console.log(`Row ${rowIndex}: Detected 8-cell row (post-disabled). Using Tab navigation strategy...`);

            // NEW STRATEGY: Use Tab key navigation from current textarea
            // This lets NEIS handle scrolling automatically

            // Step 1: Find current active textarea
            let currentTextarea = document.querySelector('textarea.cl-text:not([readonly])');

            if (currentTextarea) {
                const currentAriaLabel = currentTextarea.getAttribute('aria-label') || '';
                const currentRowMatch = currentAriaLabel.match(/(\d+)행/);
                const currentRow = currentRowMatch ? parseInt(currentRowMatch[1]) : 0;
                const expectedRow = rowIndex + 1; // aria-label uses 1-based indexing

                console.log(`Row ${rowIndex}: Current textarea at row ${currentRow}, need to reach row ${expectedRow}`);

                // Step 2: Press Tab repeatedly until we reach the target row
                const maxTabs = 10; // Safety limit
                let tabCount = 0;

                while (currentRow < expectedRow && tabCount < maxTabs) {
                    tabCount++;
                    console.log(`Row ${rowIndex}: Pressing Tab (attempt ${tabCount})...`);

                    // Ensure focus on the textarea
                    currentTextarea.focus();
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Send Tab key
                    simulateKeyEvent(currentTextarea, 'keydown', 'Tab', 9);
                    simulateKeyEvent(currentTextarea, 'keyup', 'Tab', 9);
                    await new Promise(resolve => setTimeout(resolve, 400));

                    // Check if a new textarea appeared with the correct row
                    const newTextarea = document.querySelector('textarea.cl-text:not([readonly])');
                    if (newTextarea) {
                        const newAriaLabel = newTextarea.getAttribute('aria-label') || '';
                        const newRowMatch = newAriaLabel.match(/(\d+)행/);
                        const newRow = newRowMatch ? parseInt(newRowMatch[1]) : 0;

                        console.log(`Row ${rowIndex}: After Tab, textarea at row ${newRow}`);

                        if (newRow === expectedRow) {
                            console.log(`Row ${rowIndex}: ✓ Reached target row via Tab navigation!`);
                            return newTextarea;
                        }

                        // Update for next iteration
                        currentTextarea = newTextarea;
                    } else {
                        // No textarea found, try clicking the target cell directly
                        break;
                    }
                }
            }

            // Fallback: Try scrollIntoView and direct click
            console.log(`Row ${rowIndex}: Tab navigation didn't work, trying scrollIntoView...`);
            row.scrollIntoView({ behavior: 'instant', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 500));

            // Re-query the row after scrolling (virtual scroll may have changed DOM)
            let freshRow = document.querySelector(`.cl-grid-row[data-rowindex="${rowIndex}"]`);
            if (!freshRow) {
                console.log(`Row ${rowIndex}: Row disappeared after scroll, trying to find again...`);
                // Additional scroll and retry
                if (gridContainer) {
                    gridContainer.scrollTop += 150;
                    await new Promise(resolve => setTimeout(resolve, 400));
                    freshRow = document.querySelector(`.cl-grid-row[data-rowindex="${rowIndex}"]`);
                }
            }
            if (!freshRow) {
                console.log(`Row ${rowIndex}: Row not found after re-scroll!`);
                return null;
            }
            const freshCells = freshRow.querySelectorAll('.cl-grid-cell');
            let freshTargetCell = freshCells[freshCells.length >= 8 ? 7 : 5];

            if (!freshTargetCell) {
                console.log(`Row ${rowIndex}: Target cell not found after scroll!`);
                return null;
            }

            // Record the current textarea's aria-label before clicking (to detect change)
            const prevTextarea = document.querySelector('textarea.cl-text:not([readonly])');
            const prevAriaLabel = prevTextarea ? prevTextarea.getAttribute('aria-label') || '' : '';

            // Step 1: Get FRESH target cell coordinates after scroll
            let rect = freshTargetCell.getBoundingClientRect();
            let centerX = rect.left + rect.width / 2;
            let centerY = rect.top + rect.height / 2;

            console.log(`Row ${rowIndex}: Target cell at (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);

            // Retry scroll if cell is not visible (multiple attempts)
            let scrollRetries = 0;
            const maxScrollRetries = 5;
            while ((centerX < 10 || centerY < 10 || centerY > window.innerHeight) && scrollRetries < maxScrollRetries) {
                scrollRetries++;
                console.log(`Row ${rowIndex}: Cell not visible (attempt ${scrollRetries}), scrolling more...`);

                // Use scrollIntoView on the row first
                if (freshRow) {
                    freshRow.scrollIntoView({ behavior: 'instant', block: 'center' });
                }
                await new Promise(resolve => setTimeout(resolve, 100));

                // Find scroll container again and set scrollTop directly
                const retryScrollContainer = document.querySelector('.cl-scrollbar[style*="overflow"]') ||
                    document.querySelector('div.cl-scrollbar');

                if (retryScrollContainer) {
                    // Scroll to bottom progressively
                    const spacer = retryScrollContainer.querySelector('div[style*="height"]');
                    const totalHeight = spacer ? parseInt(spacer.style.height) || 2000 : 2000;

                    // Scroll more each retry
                    retryScrollContainer.scrollTop = totalHeight * (0.7 + scrollRetries * 0.06);
                    console.log(`Row ${rowIndex}: Set scrollTop to ${retryScrollContainer.scrollTop}px`);
                }
                await new Promise(resolve => setTimeout(resolve, 300));

                // Re-query the row and cell after each scroll
                const retryRow = document.querySelector(`.cl-grid-row[data-rowindex="${rowIndex}"]`);
                if (retryRow) {
                    freshRow = retryRow;
                    const retryCells = freshRow.querySelectorAll('.cl-grid-cell');
                    freshTargetCell = retryCells[retryCells.length >= 8 ? 7 : 5];
                    if (freshTargetCell) {
                        rect = freshTargetCell.getBoundingClientRect();
                        centerX = rect.left + rect.width / 2;
                        centerY = rect.top + rect.height / 2;
                        console.log(`Row ${rowIndex}: After retry ${scrollRetries}, cell at (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
                    }
                }
            }

            // Step 2: Create and dispatch mouse events with coordinates on FRESH cell
            const mouseEvents = ['mousedown', 'mouseup', 'click', 'dblclick'];
            for (const eventType of mouseEvents) {
                const freshRect = freshTargetCell.getBoundingClientRect();
                const event = new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: freshRect.left + freshRect.width / 2,
                    clientY: freshRect.top + freshRect.height / 2,
                    button: 0
                });
                freshTargetCell.dispatchEvent(event);
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            // Step 3: Wait and check for NEW textarea with CORRECT row
            await new Promise(resolve => setTimeout(resolve, 500));

            const foundTextarea = document.querySelector('textarea.cl-text:not([readonly])');
            if (foundTextarea) {
                const ariaLabel = foundTextarea.getAttribute('aria-label') || '';
                const expectedAriaRow = rowIndex + 1;
                const match = ariaLabel.match(/(\d+)행/);

                if (match) {
                    const foundRow = parseInt(match[1], 10);
                    console.log(`Row ${rowIndex}: Found textarea at aria-row ${foundRow} (expected ${expectedAriaRow})`);

                    // STRICT: Only accept if it's the EXACT row we need
                    if (foundRow === expectedAriaRow) {
                        console.log(`Row ${rowIndex}: ✓ Exact match!`);
                        return foundTextarea;
                    }

                    // Check if aria-label changed (means we activated something new)
                    if (ariaLabel !== prevAriaLabel) {
                        console.log(`Row ${rowIndex}: ✓ New textarea activated (aria changed)!`);
                        return currentTextarea;
                    }
                }
            }

            // Step 4: If still no correct textarea, try clicking on the cell's inner control
            const innerControl = freshTargetCell.querySelector('.cl-control, .cl-textarea-wrap');
            if (innerControl) {
                console.log(`Row ${rowIndex}: Trying inner control click...`);
                innerControl.click();
                await new Promise(resolve => setTimeout(resolve, 300));
                innerControl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 300));

                const textareaAfterInner = document.querySelector('textarea.cl-text:not([readonly])');
                if (textareaAfterInner) {
                    const afterAriaLabel = textareaAfterInner.getAttribute('aria-label') || '';
                    const afterMatch = afterAriaLabel.match(/(\d+)행/);
                    const afterRow = afterMatch ? parseInt(afterMatch[1], 10) : -1;
                    const expectedAriaRow = rowIndex + 1;

                    console.log(`Row ${rowIndex}: Inner control found textarea at aria-row ${afterRow}`);

                    // Accept if correct row OR if it's a NEW textarea (different from before)
                    if (afterRow === expectedAriaRow || afterAriaLabel !== prevAriaLabel) {
                        console.log(`Row ${rowIndex}: ✓ Found correct textarea via inner control!`);
                        return textareaAfterInner;
                    }
                }
            }

            console.log(`Row ${rowIndex}: 8-cell special handling failed, falling through to normal methods...`);
        }

        const activationMethods = [
            // Method 1: Direct click on cell
            async () => {
                console.log(`Row ${rowIndex}: Trying direct click...`);
                targetCell.click();
                await new Promise(resolve => setTimeout(resolve, 300));
            },
            // Method 2: Double-click sequence
            async () => {
                console.log(`Row ${rowIndex}: Trying double-click...`);
                simulateClick(targetCell, 'mousedown');
                await new Promise(resolve => setTimeout(resolve, 30));
                simulateClick(targetCell, 'mouseup');
                await new Promise(resolve => setTimeout(resolve, 30));
                simulateClick(targetCell, 'click');
                await new Promise(resolve => setTimeout(resolve, 50));
                simulateClick(targetCell, 'dblclick');
                await new Promise(resolve => setTimeout(resolve, 400));
            },
            // Method 3: Focus + Enter key
            async () => {
                console.log(`Row ${rowIndex}: Trying focus + Enter...`);
                targetCell.focus();
                await new Promise(resolve => setTimeout(resolve, 100));
                simulateKeyEvent(targetCell, 'keydown', 'Enter', 13);
                simulateKeyEvent(targetCell, 'keypress', 'Enter', 13);
                simulateKeyEvent(targetCell, 'keyup', 'Enter', 13);
                await new Promise(resolve => setTimeout(resolve, 400));
            },
            // Method 4: Focus + F2 key
            async () => {
                console.log(`Row ${rowIndex}: Trying focus + F2...`);
                targetCell.focus();
                await new Promise(resolve => setTimeout(resolve, 100));
                simulateKeyEvent(targetCell, 'keydown', 'F2', 113);
                simulateKeyEvent(targetCell, 'keyup', 'F2', 113);
                await new Promise(resolve => setTimeout(resolve, 400));
            },
            // Method 5: Click on the control wrapper inside the cell
            async () => {
                const controlWrapper = targetCell.querySelector('.cl-control');
                if (controlWrapper) {
                    console.log(`Row ${rowIndex}: Trying click on control wrapper...`);
                    simulateClick(controlWrapper, 'click');
                    await new Promise(resolve => setTimeout(resolve, 200));
                    simulateClick(controlWrapper, 'dblclick');
                    await new Promise(resolve => setTimeout(resolve, 400));
                }
            }
        ];

        // Helper function to check if textarea belongs to the target row using aria-label
        // NEIS aria-label format: "N행 마지막 열 세부능력..."
        function isTextareaForRow(textarea, expectedRowIndex) {
            if (!textarea) return false;
            const ariaLabel = textarea.getAttribute('aria-label') || '';
            // Extract row number from aria-label (e.g., "23행 마지막 열...")
            const match = ariaLabel.match(/(\d+)행/);
            if (match) {
                const textareaRowNum = parseInt(match[1], 10);
                // NEIS uses 1-based row numbers in aria-label, but data-rowindex is 0-based
                // So row 0 in data-rowindex = "1행" in aria-label
                const expectedAriaRow = expectedRowIndex + 1;
                console.log(`Row ${expectedRowIndex}: Checking textarea aria-label row=${textareaRowNum}, expected=${expectedAriaRow}`);
                return textareaRowNum === expectedAriaRow;
            }
            return false;
        }

        // Helper function to find any active editable textarea in the document
        function findActiveTextareaInDocument(expectedRowIndex) {
            // Look for any non-readonly textarea that matches our expected row
            const allTextareas = document.querySelectorAll('textarea.cl-text:not([readonly])');
            for (const ta of allTextareas) {
                if (!ta.readOnly && isTextareaForRow(ta, expectedRowIndex)) {
                    return ta;
                }
            }
            // Also check document.activeElement
            if (document.activeElement &&
                document.activeElement.tagName === 'TEXTAREA' &&
                !document.activeElement.readOnly &&
                isTextareaForRow(document.activeElement, expectedRowIndex)) {
                return document.activeElement;
            }
            return null;
        }

        for (const method of activationMethods) {
            await method();

            // Check if textarea appeared in the TARGET CELL (original check)
            let textarea = targetCell.querySelector('textarea.cl-text:not([readonly])') ||
                targetCell.querySelector('textarea:not([readonly])');

            if (textarea && !textarea.readOnly) {
                console.log(`Row ${rowIndex}: ✓ Textarea activated successfully (in cell)`);
                textarea.focus();
                await new Promise(resolve => setTimeout(resolve, 100));
                return textarea;
            }

            // IMPORTANT: NEIS uses a floating textarea that may NOT be inside the row element
            // Check the entire document for a textarea matching our row number via aria-label
            textarea = findActiveTextareaInDocument(rowIndex);
            if (textarea) {
                console.log(`Row ${rowIndex}: ✓ Textarea found via aria-label matching!`);
                textarea.focus();
                await new Promise(resolve => setTimeout(resolve, 100));
                return textarea;
            }

            // Fallback: check document.activeElement and verify it changed
            const currentActive = document.activeElement;
            if (currentActive &&
                currentActive.tagName === 'TEXTAREA' &&
                !currentActive.readOnly &&
                currentActive !== previousActiveElement) {
                // Accept this textarea - we clicked on the target cell and got a new textarea
                // Don't strictly validate aria-label since NEIS row numbering can be inconsistent
                const ariaLabel = currentActive.getAttribute('aria-label') || '';
                console.log(`Row ${rowIndex}: ✓ New textarea activated (aria: "${ariaLabel.substring(0, 40)}...")`);
                return currentActive;
            }
        }

        // Final debug: Log what we found in the entire document
        const allDocTextareas = document.querySelectorAll('textarea.cl-text');
        console.log(`Row ${rowIndex}: Activation failed. Found ${allDocTextareas.length} textareas in document:`,
            Array.from(allDocTextareas).slice(0, 3).map(t => ({
                readonly: t.readOnly,
                ariaLabel: t.getAttribute('aria-label')?.substring(0, 60)
            }))
        );

        return null;
    }

    // Main processing: iterate through students and find each by name
    console.log(`======== 새로운 이름 기반 자동 입력 시작 ========`);
    console.log(`총 ${students.length}명 학생 데이터 입력 예정`);

    // Scroll to top first
    scrollGridTo(0);
    await new Promise(resolve => setTimeout(resolve, 500));

    let lastRowIndex = -1;
    let scrollAttempts = 0;
    const maxScrollAttempts = 50; // Prevent infinite scrolling

    for (let i = 0; i < students.length; i++) {
        const student = students[i];
        console.log(`\n[${i + 1}/${students.length}] 학생 검색 중: ${student.name}`);

        let foundRow = null;
        let searchAttempts = 0;
        const maxSearchAttempts = 10;

        // Search for student, scrolling if needed
        while (!foundRow && searchAttempts < maxSearchAttempts && scrollAttempts < maxScrollAttempts) {
            foundRow = await findStudentRow(student.name, lastRowIndex);

            if (!foundRow) {
                // Scroll down and try again
                const newScrollPos = scrollGridDown(120);
                scrollAttempts++;
                searchAttempts++;

                if (newScrollPos === -1) {
                    console.warn('Cannot scroll further.');
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 400));

                // Check if we've scrolled past all rows
                const currentRows = document.querySelectorAll('.cl-grid-row');
                if (currentRows.length === 0) {
                    console.warn('No more rows in DOM.');
                    break;
                }
            }
        }

        if (!foundRow) {
            console.warn(`학생 "${student.name}"을(를) 찾을 수 없습니다.`);
            notFoundCount++;
            continue;
        }

        let { row, rowIndex } = foundRow;
        lastRowIndex = rowIndex;

        // CRITICAL: Scroll the target row to center of viewport and wait for grid to stabilize
        row.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Re-query the row after scrolling (DOM might have changed due to virtual scrolling)
        const refreshedRow = document.querySelector(`.cl-grid-row[data-rowindex="${rowIndex}"]`);
        if (refreshedRow) {
            row = refreshedRow;
        } else {
            // Try to find the row again by name
            const retryFound = await findStudentRow(student.name, rowIndex - 1);
            if (retryFound) {
                row = retryFound.row;
                rowIndex = retryFound.rowIndex;
            } else {
                console.warn(`Row ${rowIndex}: 스크롤 후 row를 다시 찾을 수 없습니다. 건너뜀.`);
                skippedCount++;
                continue;
            }
        }

        // Activate the textarea in this row
        const textarea = await activateTextareaInRow(row, rowIndex, type);

        if (!textarea) {
            console.warn(`Row ${rowIndex}: 입력 칸 활성화 실패. 건너뜀.`);
            skippedCount++;
            continue;
        }

        // Check if the textarea is actually editable (not readonly)
        if (textarea.readOnly || textarea.hasAttribute('readonly')) {
            console.warn(`Row ${rowIndex}: textarea is readonly. Skipping...`);
            skippedCount++;
            continue;
        }
        if (isCellReadonly(textarea.closest('.cl-grid-cell') || textarea.closest('.cl-control'))) {
            console.warn(`Row ${rowIndex}: 비활성화된 셀입니다. 건너뜀.`);
            skippedCount++;
            continue;
        }

        // Highlight and fill
        textarea.style.backgroundColor = '#e6fffa';
        textarea.focus();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Fill the data
        textarea.value = student.result;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));

        successCount++;
        console.log(`✓ "${student.name}" 입력 완료 (Row ${rowIndex})`);

        // IMPORTANT: Blur the textarea after filling to properly close edit mode
        // This ensures NEIS saves the data and next cell can be activated cleanly
        textarea.blur();
        await new Promise(resolve => setTimeout(resolve, 400));
    }

    // Blur last element to save
    if (document.activeElement.tagName === 'TEXTAREA') {
        document.activeElement.blur();
    }

    // Show result message
    let message = `자동 입력 완료!\n\n✓ 입력: ${successCount}명`;
    if (skippedCount > 0) {
        message += `\n⊘ 건너뜀 (비활성): ${skippedCount}명`;
    }
    if (notFoundCount > 0) {
        message += `\n✗ 찾지 못함: ${notFoundCount}명`;
    }

    console.log(`\n======== 자동 입력 완료 ========`);
    console.log(`입력: ${successCount}, 건너뜀: ${skippedCount}, 찾지 못함: ${notFoundCount}`);

    alert(message);
}

function findNextRowOrInput(currentElement) {
    // Strategy: Use NEIS Grid Row Attributes (data-rowindex)
    const parentRow = currentElement.closest('.cl-grid-row');
    if (parentRow) {
        const currentIndex = parseInt(parentRow.getAttribute('data-rowindex'), 10);
        if (!isNaN(currentIndex)) {
            const nextIndex = currentIndex + 1;
            // Find row with next index
            let nextRow = document.querySelector(`.cl-grid-row[data-rowindex="${nextIndex}"]`);

            // Strategy 1.5: Sibling Navigation (if data-rowindex lookup fails or is non-sequential)
            if (!nextRow) {
                const sibling = parentRow.nextElementSibling;
                if (sibling && sibling.classList.contains('cl-grid-row')) {
                    nextRow = sibling;
                }
            }

            if (nextRow) {
                // Check if textarea already exists in it
                const existingInput = nextRow.querySelector('textarea.cl-text');
                if (existingInput) return existingInput;

                return nextRow; // Return the row to be clicked
            }
        }
    }

    // Fallback: aria-label strategy
    const ariaLabel = currentElement.getAttribute('aria-label');
    if (ariaLabel) {
        const match = ariaLabel.match(/(\d+)행/);
        if (match) {
            const currentRow = parseInt(match[1], 10);
            const nextRow = currentRow + 1;
            const nextRowPrefix = `${nextRow}행`;
            const allTextareas = Array.from(document.querySelectorAll('textarea.cl-text'));
            const nextInput = allTextareas.find(el => {
                const label = el.getAttribute('aria-label');
                return label && label.includes(nextRowPrefix) && !el.disabled && !el.readOnly;
            });
            if (nextInput) return nextInput;
        }
    }

    return null;
}




// UI Helpers
function showFloatingBanner(text) {
    const banner = document.createElement('div');
    banner.id = 'ace-autofill-banner';
    banner.style.position = 'fixed';
    banner.style.top = '20px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.backgroundColor = '#2563eb';
    banner.style.color = 'white';
    banner.style.padding = '15px 25px';
    banner.style.borderRadius = '30px';
    banner.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    banner.style.zIndex = '999999';
    banner.style.fontWeight = 'bold';
    banner.style.fontSize = '16px';
    banner.style.textAlign = 'center';
    banner.style.whiteSpace = 'pre-line';
    banner.innerText = text;

    document.body.appendChild(banner);
}

function removeFloatingBanner() {
    const banner = document.getElementById('ace-autofill-banner');
    if (banner) banner.remove();
}
