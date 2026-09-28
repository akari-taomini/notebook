import { createStore } from './storage.js';
import { createNotebook } from './notebook.js';
import { renderNote, captureFormatting } from './render.js';

let started = false;
async function init() {
    if (started) return;
    started = true;
    try {
        const context = SillyTavern.getContext();
        const key = 'tasty_notebook_v1';
        if (!context.extensionSettings[key]?.storageId) {
            context.extensionSettings[key] = { storageId: crypto.randomUUID() };
            context.saveSettingsDebounced();
        }
        const book = await createNotebook(createStore(context.extensionSettings[key].storageId), {
            render: (text, note) => renderNote(text, note, SillyTavern.getContext()),
        });
        const launcher = document.createElement('button');
        launcher.id = 'tn-launcher';
        launcher.type = 'button';
        launcher.textContent = '📖 拾光手札';
        launcher.title = '打开收藏笔记';
        launcher.addEventListener('click', book.open);
        document.body.append(launcher);
        function decorate() {
            document.querySelectorAll('#chat .mes').forEach(message => {
                const target = message.querySelector('.extraMesButtons') || message.querySelector('.mes_buttons');
                if (!target || target.querySelector('.tn-capture')) return;
                const capture = document.createElement('button');
                capture.className = 'tn-capture menu_button';
                capture.type = 'button';
                capture.textContent = '📑 收藏';
                capture.title = '收藏整条正文；选中文字后点击则只收藏选段';
                capture.addEventListener('pointerdown', event => { if (event.button === 0) event.preventDefault(); });
                capture.addEventListener('click', () => {
                    const live = SillyTavern.getContext();
                    const index = Number(message.getAttribute('mesid'));
                    const item = live.chat[index];
                    if (!item) return;
                    const selection = window.getSelection();
                    const area = message.querySelector('.mes_text');
                    const inMessage = selection?.rangeCount && area?.contains(selection.anchorNode) && area.contains(selection.focusNode);
                    const selected = inMessage ? selection.toString().trim() : '';
                    const text = selected || item.mes;
                    if (typeof text !== 'string' || !text.trim()) return;
                    const chatName = live.chatId || live.characters?.[live.characterId]?.chat || '当前聊天';
                    book.capture(text, `${item.name || '未命名角色'} · ${chatName} · 第 ${index + 1} 条${selected ? ' · 选段' : ''}`, { ...captureFormatting(live, item, index), isSelection: Boolean(selected) });
                });
                target.append(capture);
            });
        }
        decorate();
        for (const name of ['CHAT_CHANGED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED']) {
            if (context.event_types[name]) context.eventSource.on(context.event_types[name], decorate);
        }
        const chat = document.getElementById('chat');
        if (chat) {
            let scheduled = false;
            new MutationObserver(records => {
                if (scheduled || !records.some(r => [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('.mes,.mes_buttons,.extraMesButtons') || n.querySelector?.('.mes'))))) return;
                scheduled = true;
                requestAnimationFrame(() => { scheduled = false; decorate(); });
            }).observe(chat, { childList: true, subtree: true });
        }
    } catch (error) {
        console.error('[tasty-notebook] 初始化失败', error);
        globalThis.toastr?.error('拾光手札初始化失败，请检查浏览器存储权限。');
    }
}

const context = SillyTavern.getContext();
if (context.event_types.APP_READY) context.eventSource.on(context.event_types.APP_READY, init);
else if (context.event_types.APP_INITIALIZED) context.eventSource.on(context.event_types.APP_INITIALIZED, init);
else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
