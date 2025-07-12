
// --- Theme Management ---
document.addEventListener('DOMContentLoaded', () => {
    const themeSwitcher = document.getElementById('theme-switcher');
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', () => {
            const doc = document.documentElement;
            const currentTheme = doc.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            doc.setAttribute('data-theme', currentTheme);
            localStorage.setItem('theme', currentTheme);
        });
    }
});

// --- Storage & UI Helpers ---
const getStore = (key) => JSON.parse(localStorage.getItem(key) || '{}');
const getStoreArray = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const setStore = (key, data) => localStorage.setItem(key, JSON.stringify(data));

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// --- Core Logic ---
function checkAnswer(questionId) {
    const qBlock = document.getElementById(`q-${questionId}`);
    const feedbackEl = document.getElementById(`feedback-q-${questionId}`);
    const correctAnswer = qBlock.dataset.answer;
    const inputs = qBlock.querySelectorAll('input:checked');
    let userAnswer = Array.from(inputs).map(input => input.value).sort().join('');

    if (userAnswer === correctAnswer) {
        feedbackEl.innerHTML = '✅ 正确！';
        feedbackEl.className = 'feedback correct';
    } else {
        feedbackEl.innerHTML = `❌ 错误。正确答案是: <strong>${correctAnswer}</strong>`;
        feedbackEl.className = 'feedback incorrect';
        logError(questionId);
    }
}

function logError(questionId) {
    let errors = getStoreArray('maogaiErrors');
    if (!errors.includes(questionId)) {
        errors.push(questionId);
        setStore('maogaiErrors', errors);
    }
}

function toggleFavorite(questionId) {
    let favorites = getStoreArray('maogaiFavorites');
    const button = document.querySelector(`#q-${questionId} .favorite-btn`);
    const index = favorites.indexOf(questionId);

    if (index > -1) {
        favorites.splice(index, 1);
        button?.classList.remove('favorited');
        showToast('已取消收藏');
    } else {
        favorites.push(questionId);
        button?.classList.add('favorited');
        showToast('已收藏');
    }
    setStore('maogaiFavorites', favorites);
}

function saveNote(questionId) {
    const textarea = document.getElementById(`note-q-${questionId}`);
    let notes = getStore('maogaiNotes');
    if (textarea.value.trim()) {
        notes[questionId] = textarea.value;
    } else {
        delete notes[questionId];
    }
    setStore('maogaiNotes', notes);
    showToast('笔记已保存');
}

function removeStoredItem(type, id) {
    const key = type === 'errors' ? 'maogaiErrors' : 'maogaiFavorites';
    let items = getStoreArray(key);
    const newItems = items.filter(itemId => itemId != id);
    setStore(key, newItems);
    
    const elementToRemove = document.getElementById(`q-${id}`);
    elementToRemove.style.transition = 'opacity 0.3s, transform 0.3s';
    elementToRemove.style.opacity = '0';
    elementToRemove.style.transform = 'scale(0.95)';
    setTimeout(() => elementToRemove.remove(), 300);
    showToast('已移除');
}

// --- Page Loaders & History ---
function setupHistoryTracker(moduleNum) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const history = {
                    module: moduleNum,
                    questionId: entry.target.id
                };
                localStorage.setItem('maogaiHistory', JSON.stringify(history));
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.question-block').forEach(q => observer.observe(q));
}

function setupHistoryLink() {
    const history = JSON.parse(localStorage.getItem('maogaiHistory') || 'null');
    if (history) {
        const container = document.getElementById('history-link-container');
        const link = document.getElementById('history-link');
        link.href = `module_${history.module}.html#${history.questionId}`;
        container.style.display = 'block';
    }
}

function loadAllNotes() {
    const notes = getStore('maogaiNotes');
    for (const [id, text] of Object.entries(notes)) {
        const textarea = document.getElementById(`note-q-${id}`);
        if (textarea) textarea.value = text;
    }
}

function updateAllFavoriteIcons() {
    const favorites = getStoreArray('maogaiFavorites');
    favorites.forEach(id => {
        const button = document.querySelector(`#q-${id} .favorite-btn`);
        if (button) button.classList.add('favorited');
    });
}

function loadContent(type) {
    document.addEventListener('DOMContentLoaded', () => {
        const key = type === 'errors' ? 'maogaiErrors' : 'maogaiFavorites';
        const ids = getStoreArray(key);
        const container = document.getElementById('content-container');
        
        if (ids.length === 0) {
            container.innerHTML = `<p style="text-align:center; color: var(--text-secondary);">${type === 'errors' ? '太棒了！您的错题本是空的。' : '您的收藏夹是空的。'}</p>`;
            return;
        }
        
        // 为错题本生成带移除按钮的题目
        container.innerHTML = ids.map(id => {
            const q = ALL_QUESTIONS.find(q => q.id == id);
            return q ? generateQuestionHTML(q, null, type) : '';
        }).join('');
        
        updateAllFavoriteIcons();
        loadAllNotes();
    });
}

function loadKnowledgePoints() {
    document.addEventListener('DOMContentLoaded', () => {
        const errorIds = getStoreArray('maogaiErrors');
        const favoriteIds = getStoreArray('maogaiFavorites');
        const notedIds = Object.keys(getStore('maogaiNotes'));
        const combinedIds = [...new Set([...errorIds, ...favoriteIds, ...notedIds.map(String)])].sort((a, b) => parseInt(a) - parseInt(b));
        
        const container = document.getElementById('knowledge-content');
        const actionButtons = document.querySelector('.action-buttons');
        
        if (combinedIds.length === 0) {
            container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">这里会自动汇总您的错题、收藏和笔记。现在还是空的哦！</p>';
            if (actionButtons) actionButtons.style.display = 'none';
            return;
        }
        
        container.innerHTML = combinedIds.map(id => {
            const q = ALL_QUESTIONS.find(q => q.id == id);
            return q ? generateKnowledgePointHTML(q) : '';
        }).join('');

        setupActionButtons(combinedIds);
    });
}

// --- HTML Generators ---
function generateQuestionHTML(q, localId, pageType) {
    const globalId = q.id;
    const displayId = localId || globalId;
    const q_type = q.answer instanceof Array || (typeof q.answer === 'string' && q.answer.length > 1 && !['正确','错误'].includes(q.answer)) ? '多选' : '单选';
    const normalized_answer = q.answer instanceof Array ? q.answer.sort().join('') : String(q.answer);
    let opts = q.options;
    if (Array.isArray(opts)) opts = Object.fromEntries(opts.map((v, i) => [String.fromCharCode(65 + i), v]));
    const options_html = Object.entries(opts).map(([k, v]) => `<label><input type="${q_type === '多选' ? 'checkbox' : 'radio'}" name="q-${globalId}" value="${k}"><span>${k}</span> ${v}</label>`).join('');
    
    let actionButtons = `<button class="icon-btn favorite-btn" onclick="toggleFavorite('${globalId}')" title="收藏"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>`;
    if (pageType === 'errors' || pageType === 'favorites') {
        actionButtons += `<button class="icon-btn remove-btn" onclick="removeStoredItem('${pageType}', '${globalId}')" title="移除"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`;
    }

    return `
    <div class="question-block" id="q-${globalId}" data-answer="${normalized_answer}">
        <div class="question-header">
            <div class="question-title"><span class="question-id">${displayId}</span><p>【${q_type}】${q.question}</p></div>
            <div class="question-actions">${actionButtons}</div>
        </div>
        <div class="options">${options_html}</div>
        <div class="feedback" id="feedback-q-${globalId}"></div>
        <div class="actions-footer">
            <div class="note-section">
                <details><summary><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>我的笔记</span></summary>
                    <div class="note-content"><textarea id="note-q-${globalId}" placeholder="在此输入您的笔记..."></textarea><button class="save-note-btn" onclick="saveNote('${globalId}')">保存</button></div>
                </details>
            </div>
            <button class="check-btn" onclick="checkAnswer('${globalId}')">确认</button>
        </div>
    </div>`;
}

function generateKnowledgePointHTML(q) {
    const correct_keys = Array.isArray(q.answer) ? q.answer.sort() : [String(q.answer)];
    let opts = q.options;
    if (Array.isArray(opts)) opts = Object.fromEntries(opts.map((v, i) => [String.fromCharCode(65 + i), v]));
    const options_html = Object.entries(opts).map(([key, value]) => {
        const style_class = correct_keys.includes(key) ? 'correct' : 'incorrect';
        const label = correct_keys.includes(key) ? '正确答案' : '干扰项';
        return `<li class="${style_class}">${key}. ${value} <em>(${label})</em></li>`;
    }).join('');
    
    const note = getStore('maogaiNotes')[q.id] || '';
    const note_html = note ? `<div class="knowledge-note"><strong>笔记:</strong><p>${note.replace(/\\n/g, '<br>')}</p></div>` : '';

    return `
    <div class="knowledge-point">
        <h4>${q.id}. ${q.question}</h4>
        <ul>${options_html}</ul>
        ${note_html}
    </div>`;
}

// --- Export & Print ---
function setupActionButtons(idsToExport) {
    document.getElementById('print-btn').addEventListener('click', () => {
        const contentToPrint = document.getElementById('knowledge-content').innerHTML;
        const printWindow = window.open('', '', 'height=800,width=900');
        printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><title>知识点打印</title><meta charset="UTF-8"><link rel="stylesheet" href="style.css"><style>body{padding:20px;background:#fff !important; color: #000 !important;} .container{max-width: 100%; box-shadow:none;border:none} .action-buttons{display:none} @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body data-theme="light"><h1>核心知识库</h1>${contentToPrint}</body></html>`);
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500);
    });
}
