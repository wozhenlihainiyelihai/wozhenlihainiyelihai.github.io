
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
    logAnsweredQuestion(questionId, qBlock.dataset.module);
}

function logError(questionId) {
    let errors = getStoreArray('maogaiErrors');
    if (!errors.includes(String(questionId))) {
        errors.push(String(questionId));
        setStore('maogaiErrors', errors);
    }
}

function toggleFavorite(questionId) {
    let favorites = getStoreArray('maogaiFavorites');
    const button = document.querySelector(`#q-${questionId} .favorite-btn`);
    const index = favorites.indexOf(String(questionId));

    if (index > -1) {
        favorites.splice(index, 1);
        button?.classList.remove('favorited');
        showToast('已取消收藏');
    } else {
        favorites.push(String(questionId));
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

// --- AI Explanation (OpenAI) ---
async function getAIExplanation(questionId) {
    const question = ALL_QUESTIONS.find(q => q.id == questionId);
    if (!question) return;

    const aiSection = document.getElementById(`ai-section-q-${questionId}`);
    aiSection.innerHTML = `<p>AI正在思考中...<span class="cursor"></span></p>`;
    aiSection.style.display = 'block';

    const optionsString = JSON.stringify(question.options);
    const systemPrompt = "你是一位精通2024年版《毛泽东思想和中国特色社会主义理论体系概论》教材的专家。请用中文回答。";
    const userPrompt = `你现在是一位经验丰富的高校思想政治理论课老师，熟悉2024年最新版《毛泽东思想和中国特色社会主义理论体系概论》教材的全部知识点。

请根据以下多项选择题的内容，逐个选项进行分析，说明每一个选项为什么正确或错误，并在最后总结本题的考查知识点和解题思路，帮助学生更好地掌握相关理论内容。

请使用如下结构进行回答：
【题目】
（请补全题干，例如：“中国特色社会主义最本质的特征是（ ）。”）

A. 以人民为中心
B. 共同富裕
C. 中国共产党的领导
D. 社会公平正义

【选项分析】

A选项：（先判断正误，然后解释原因，如：本选项错误。虽然“以人民为中心”是基本立场，但不是最本质的特征。）

B选项：（……）

C选项：（本选项正确。根据教材第×章第×节的内容，中国特色社会主义最本质的特征是中国共产党的领导。）

D选项：（……）

【考查要点总结】

本题考查的是中国特色社会主义的本质特征这一知识点，具体内容见教材第×章×节，核心理解为：党的领导是中国特色社会主义最本质的特征，是中国特色社会主义制度的最大优势。在做题时要注意区分“最本质特征”“最大优势”“根本立场”等相似概念，明确其在教材中的严谨表述。题目：'${question.question}', 选项：${optionsString}, 正确答案是：'${question.answer}'`;
    
    // --- START: API Configuration ---
    // 1. 在这里粘贴您的API密钥
    const apiKey = "sk-MM577Ej46pdPyXj3vKillbbVazNqyidUAHTncGIye5nJft3X"; 

    // 2. 在这里确认您的代理地址
    const baseUrl = "https://api.chatanywhere.tech"; 
    // --- END: API Configuration ---

    if (!apiKey) {
        aiSection.innerHTML = `<p>错误：尚未配置API密钥。请根据指南在 script.js 文件中设置您的密钥。</p>`;
        return;
    }

    try {
        const payload = {
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        };
        
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API请求失败: ${errorData.error.message}`);
        }

        const result = await response.json();
        
        let text = "抱歉，解析出错了。";
        if (result.choices && result.choices[0] && result.choices[0].message) {
            text = result.choices[0].message.content;
        }
        
        // Typewriter effect
        aiSection.innerHTML = '<p></p>';
        const p = aiSection.querySelector('p');
        let i = 0;
        function typeWriter() {
            if (i < text.length) {
                p.innerHTML += text.charAt(i).replace(/\\n/g, '<br>');
                i++;
                setTimeout(typeWriter, 20);
            }
        }
        typeWriter();

    } catch (error) {
        console.error('OpenAI API Error:', error);
        aiSection.innerHTML = `<p>抱歉，AI解析服务暂时不可用。请检查您的网络连接、API密钥或代理地址是否正确。</p>`;
    }
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
                sessionStorage.setItem('maogaiCurrentPosition', JSON.stringify(history));
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.question-block').forEach(q => observer.observe(q));
}

function logSessionHistory() {
    const lastPosition = JSON.parse(sessionStorage.getItem('maogaiCurrentPosition') || 'null');
    if (!lastPosition) return;

    let historyList = getStoreArray('maogaiHistoryList');
    const question = ALL_QUESTIONS.find(q => q.id == lastPosition.questionId.replace('q-',''));
    if (!question) return;

    const newEntry = {
        module: lastPosition.module,
        questionId: lastPosition.questionId,
        questionText: question.question,
        timestamp: new Date().toISOString()
    };

    // Avoid adding duplicate consecutive entries
    if (historyList.length > 0 && historyList[0].questionId === newEntry.questionId) {
        return;
    }

    historyList.unshift(newEntry);
    if (historyList.length > 20) { // Keep last 20 sessions
        historyList.pop();
    }
    setStore('maogaiHistoryList', historyList);
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        logSessionHistory();
    }
});

function loadHistoryPage() {
    document.addEventListener('DOMContentLoaded', () => {
        const historyList = getStoreArray('maogaiHistoryList');
        const container = document.getElementById('content-container');
        const clearBtn = document.getElementById('clear-history-btn');

        if (historyList.length === 0) {
            container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">还没有历史记录哦。</p>';
            clearBtn.style.display = 'none';
            return;
        }

        container.innerHTML = historyList.map(item => {
            const question = ALL_QUESTIONS.find(q => q.id == item.questionId.replace('q-',''));
            if (!question) return '';
            const localId = question.id; // Or calculate if needed
            return `
                <a href="module_${item.module}.html#${item.questionId}" class="history-item">
                    <div class="history-info">
                        <p>模块 ${item.module} - 题目 ${localId}</p>
                        <span>${item.questionText.substring(0, 40)}...</span>
                    </div>
                    <span class="history-time">${formatTimeAgo(item.timestamp)}</span>
                </a>
            `;
        }).join('');

        clearBtn.addEventListener('click', () => {
            if (confirm('确定要清空所有历史记录吗？')) {
                localStorage.removeItem('maogaiHistoryList');
                loadHistoryPage(); // Reload the content
            }
        });
    });
}

function formatTimeAgo(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return '刚刚';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}小时前`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}天前`;
    
    return date.toLocaleDateString();
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
        const container = document.getElementById('content-container');
        let ids;
        let pageTypeForRemoval = null;

        if (type === 'errors' || type === 'favorites') {
            ids = getStoreArray(type === 'errors' ? 'maogaiErrors' : 'maogaiFavorites');
            pageTypeForRemoval = type;
        } else if (type === 'knowledge') {
            const errorIds = getStoreArray('maogaiErrors');
            const favoriteIds = getStoreArray('maogaiFavorites');
            const notedIds = Object.keys(getStore('maogaiNotes'));
            ids = [...new Set([...errorIds, ...favoriteIds, ...notedIds])].sort((a, b) => parseInt(a) - parseInt(b));
        }

        if (!ids || ids.length === 0) {
            const messages = {
                errors: '太棒了！您的错题本是空的。',
                favorites: '您的收藏夹是空的。',
                knowledge: '这里会自动汇总您的错题、收藏和笔记。现在还是空的哦！'
            };
            container.innerHTML = `<p style="text-align:center; color: var(--text-secondary);">${messages[type]}</p>`;
            if (type === 'knowledge') {
                 const actionButtons = document.querySelector('.action-buttons');
                 if(actionButtons) actionButtons.style.display = 'none';
            }
            return;
        }
        
        container.innerHTML = ids.map(id => {
            const q = ALL_QUESTIONS.find(q => q.id == id);
            if (!q) return '';
            if (type === 'knowledge') {
                return generateKnowledgePointHTML(q);
            } else {
                return generateQuestionHTML(q, null, pageTypeForRemoval);
            }
        }).join('');
        
        updateAllFavoriteIcons();
        loadAllNotes();

        if (type === 'knowledge') {
            setupActionButtons(ids);
        }
    });
}

// --- HTML Generators ---
function generateQuestionHTML(q, localId, pageType) {
    const globalId = q.id;
    const displayId = localId || q.id;
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
        <div class="ai-section" id="ai-section-q-${globalId}"></div>
        <div class="actions-footer">
            <div class="note-section">
                <details><summary><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>我的笔记</span></summary>
                    <div class="note-content"><textarea id="note-q-${globalId}" placeholder="在此输入您的笔记..."></textarea><button class="save-note-btn" onclick="saveNote('${globalId}')">保存</button></div>
                </details>
            </div>
            <div class="footer-buttons">
                 <button class="ai-btn" onclick="getAIExplanation('${globalId}')" title="AI解析"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.41 1.41L16.17 10H4v4h12.17l-5.58 5.59L12 21l8-8-8-8z"/><path d="M22 12h-2"/></svg><span>AI解析</span></button>
                 <button class="check-btn" onclick="checkAnswer('${globalId}')">确认</button>
            </div>
        </div>
    </div>`;
}

function generateKnowledgePointHTML(q) {
    const globalId = q.id;
    const q_type = q.answer instanceof Array || (typeof q.answer === 'string' && q.answer.length > 1 && !['正确','错误'].includes(q.answer)) ? '多选' : '单选';
    const correct_keys = Array.isArray(q.answer) ? q.answer.sort() : [String(q.answer)];
    let opts = q.options;
    if (Array.isArray(opts)) opts = Object.fromEntries(opts.map((v, i) => [String.fromCharCode(65 + i), v]));
    
    const options_html = Object.entries(opts).map(([key, value]) => {
        const isCorrect = correct_keys.includes(key);
        const style_class = isCorrect ? 'correct' : 'incorrect';
        const label = isCorrect ? '正确答案' : '干扰项';
        return `<li class="${style_class}">${key}. ${value} <em>(${label})</em></li>`;
    }).join('');
    
    const note = getStore('maogaiNotes')[q.id] || '';
    const note_html = `<div class="knowledge-note">
        <div class="knowledge-note-header">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
             <span>我的笔记</span>
        </div>
        <textarea id="note-q-${globalId}">${note}</textarea>
        <button class="save-note-btn" onclick="saveNote('${globalId}')">保存笔记</button>
    </div>`;

    return `
    <div class="question-block knowledge-point" id="q-${globalId}">
        <div class="question-header">
            <div class="question-title"><span class="question-id">${globalId}</span><p>【${q_type}】${q.question}</p></div>
            <div class="question-actions">
                 <button class="icon-btn favorite-btn" onclick="toggleFavorite('${globalId}')" title="收藏"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>
                 <button class="icon-btn remove-btn" onclick="removeStoredItem('knowledge', '${globalId}')" title="从错题本和收藏夹移除"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
        </div>
        <ul class="options">${options_html}</ul>
        ${note_html}
    </div>`;
}

// --- Export & Print ---
function setupActionButtons(idsToExport) {
    document.getElementById('print-btn').addEventListener('click', () => {
        const contentToPrint = document.getElementById('content-container').innerHTML;
        const printWindow = window.open('', '', 'height=800,width=900');
        printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><title>知识点打印</title><meta charset="UTF-8"><link rel="stylesheet" href="style.css"><style>body{padding:20px;background:#fff !important; color: #000 !important;} .container{max-width: 100%; box-shadow:none;border:none} .action-buttons, .question-actions, .knowledge-note .save-note-btn {display:none} .knowledge-note textarea { border: 1px dashed #ccc; } @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body data-theme="light"><h1>核心知识库</h1>${contentToPrint}</body></html>`);
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500);
    });
}
