import { parseBackup } from './storage.js';

const CDN = 'https://cdn.jsdelivr.net/gh/akari-taomini/picture@main/img/';
const bundled = new Set(['book', 'catalogue', 'page1', 'page5', 'page6', 'page7', 'page11']);
const art = name => bundled.has(name) ? new URL(`./assets/${name}.png`, import.meta.url).href : `${CDN}${name}.png`;
const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
};
const button = (text, action) => {
    const node = el('button', '', text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
};

export async function createNotebook(store, options = {}) {
    let notes = await store.read();
    if (!Array.isArray(notes)) throw new Error('笔记数据格式异常，请勿覆盖原数据。');
    let current = null;
    let dirty = false;
    let busy = false;
    let opener;
    const dialog = el('dialog', 'tn-dialog');
    dialog.setAttribute('aria-label', '好吃的正文收藏笔记');
    const header = el('header', 'tn-header');
    header.append(el('strong', '', '好吃的正文'), el('span', '', '把喜欢的片段，好好收起来。'));
    const close = button('关闭 ×', () => { if (canLeave()) dialog.close(); });
    header.append(close);
    const layout = el('div', 'tn-layout');
    const sidebar = el('aside', 'tn-sidebar');
    sidebar.style.backgroundImage = `url("${art('catalogue')}")`;
    const search = el('input');
    search.placeholder = '搜索标题、正文或来源';
    search.setAttribute('aria-label', '搜索笔记');
    search.type = 'search';
    const list = el('nav', 'tn-list');
    list.setAttribute('aria-label', '笔记目录');
    sidebar.append(el('h2', '', '收藏目录'), search, list);
    const stage = el('main', 'tn-stage');
    const cover = el('div', 'tn-cover');
    const coverImg = el('img');
    coverImg.src = art('book');
    coverImg.alt = '收藏笔记本封面';
    coverImg.addEventListener('error', () => { coverImg.hidden = true; });
    cover.append(coverImg, el('h2', '', '值得再读一遍'), el('p', '', '从酒馆收藏一段正文，或在这里写下新的笔记。'), button('写一篇笔记', () => newNote()));
    const editor = el('section', 'tn-editor');
    editor.hidden = true;
    const sheet = el('div', 'tn-sheet');
    const title = el('input', 'tn-title');
    title.maxLength = 160;
    title.placeholder = '给这段正文起个名字';
    title.setAttribute('aria-label', '笔记标题');
    const source = el('p', 'tn-source');
    const paper = el('select');
    paper.setAttribute('aria-label', '内页贴图');
    for (let i = 1; i <= 11; i++) {
        const option = el('option', '', `内页 ${i}${bundled.has(`page${i}`) ? '' : '（联网）'}`);
        option.value = i;
        paper.append(option);
    }
    const body = el('textarea', 'tn-body');
    body.placeholder = '把好吃的正文留在这里……';
    body.setAttribute('aria-label', '笔记正文');
    const reading = el('div', 'tn-body tn-reading mes_text');
    reading.tabIndex = 0;
    reading.setAttribute('aria-label', '正文阅读');
    let readingMode = true;
    const modeButton = button('编辑原文', () => setMode(!readingMode));
    const actions = el('div', 'tn-actions');
    const saveButton = button('保存笔记', save);
    const previous = button('← 上一篇', () => move(-1));
    const next = button('下一篇 →', () => move(1));
    actions.append(previous, next, paper, modeButton, saveButton, button('删除', remove));
    sheet.append(title, source, body, reading);
    editor.append(sheet, actions);
    stage.append(cover, editor);
    layout.append(sidebar, stage);
    const footer = el('footer', 'tn-footer');
    const status = el('span', 'tn-status', '笔记保存在当前浏览器；换设备前请导出备份。');
    status.setAttribute('role', 'status');
    const file = el('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.hidden = true;
    footer.append(button('＋ 新笔记', () => newNote()), button('导出备份', exportNotes), button('导入备份', () => file.click()), status, file);
    dialog.append(header, layout, footer);
    document.body.append(dialog);

    function canLeave() {
        if (busy) return false;
        return !dirty || confirm('当前修改还没有保存，确定放弃这些修改吗？');
    }
    function show() {
        if (current && readingMode) renderReading();
        if (!dialog.open) { opener = document.activeElement; dialog.showModal(); }
    }
    function renderReading() {
        reading.replaceChildren();
        try {
            const html = options.render?.(body.value, current);
            if (typeof html === 'string') {
                // Only the injected host formatter may return HTML. Stored/imported
                // note bodies are never assigned directly to innerHTML.
                reading.innerHTML = html;
                reading.classList.remove('tn-plain');
            } else {
                reading.textContent = body.value;
                reading.classList.add('tn-plain');
            }
        } catch (error) {
            reading.textContent = body.value;
            reading.classList.add('tn-plain');
            status.textContent = '酒馆排版暂时不可用，已显示原文。';
            console.error('[tasty-notebook] 正文渲染失败', error);
        }
    }
    function setMode(read) {
        readingMode = read;
        body.hidden = read;
        reading.hidden = !read;
        modeButton.textContent = read ? '编辑原文' : '阅读排版';
        modeButton.setAttribute('aria-pressed', String(!read));
        if (read) renderReading();
        else {
            // Remove regex-produced style elements while editing.
            reading.replaceChildren();
            body.focus();
        }
    }
    function renderList() {
        list.replaceChildren();
        const query = search.value.trim().toLocaleLowerCase();
        const filtered = notes.filter(n => `${n.title}\n${n.body}\n${n.source}`.toLocaleLowerCase().includes(query));
        if (!filtered.length) list.append(el('p', 'tn-empty', query ? '没有找到这段收藏。' : '目录还是空的，等一段喜欢的文字。'));
        for (const note of filtered) {
            const item = button('', () => { if (canLeave()) edit(note); });
            item.className = 'tn-entry';
            item.setAttribute('aria-current', String(current?.id === note.id));
            item.append(el('strong', '', note.title || '未命名笔记'), el('small', '', note.source || '随手记'));
            list.append(item);
        }
    }
    let paperRequest = 0;
    function setPaper() {
        const request = ++paperRequest;
        sheet.dataset.paper = paper.value;
        const url = art(`page${paper.value}`);
        sheet.style.backgroundImage = `url("${url}"), url("${art('page1')}")`;
        const check = new Image();
        check.onerror = () => { if (request === paperRequest) status.textContent = '这张内页暂时加载不到，先用内页 1 显示。'; };
        check.src = url;
    }
    function edit(note) {
        current = { ...note };
        dirty = false;
        cover.hidden = true;
        editor.hidden = false;
        title.value = note.title;
        body.value = note.body;
        paper.value = note.paper;
        source.textContent = note.source || '随手记';
        setMode(true);
        setPaper();
        renderList();
    }
    function newNote(text = '', origin = '', formatting = undefined) {
        if (!canLeave()) return;
        show();
        edit({ id: crypto.randomUUID(), title: text.trim().split('\n')[0].slice(0, 30), body: text, source: origin, formatting, paper: [1, 11, 7][notes.length % 3], created: new Date().toISOString() });
        if (!text) setMode(false);
        dirty = true;
        status.textContent = '新笔记尚未保存，可以先修剪正文。';
        title.focus();
    }
    async function commit(updated) {
        if (busy) return false;
        busy = true;
        const controls = [...dialog.querySelectorAll('button,input,textarea,select')];
        controls.forEach(node => { node.disabled = true; });
        try {
            await store.write(updated);
            notes = updated;
            return true;
        } catch (error) {
            console.error('[tasty-notebook]', error);
            status.textContent = '保存失败，修改仍留在编辑器中。请检查浏览器存储空间并重试。';
            return false;
        } finally {
            busy = false;
            controls.forEach(node => { node.disabled = false; });
        }
    }
    async function save() {
        if (!current || busy) return;
        if (!body.value.trim()) { status.textContent = '先写一点正文再保存吧。'; return; }
        const note = { ...current, title: title.value.trim() || '未命名笔记', body: body.value, paper: Number(paper.value) };
        const updated = notes.some(n => n.id === note.id) ? notes.map(n => n.id === note.id ? note : n) : [note, ...notes];
        if (await commit(updated)) { current = note; dirty = false; renderList(); setMode(true); status.textContent = '已保存到当前浏览器。'; }
    }
    async function remove() {
        if (!current || busy || !confirm('确定删除这篇笔记？原聊天消息不会受影响。')) return;
        if (await commit(notes.filter(n => n.id !== current.id))) {
            current = null; dirty = false; reading.replaceChildren(); editor.hidden = true; cover.hidden = false; renderList(); status.textContent = '笔记已删除。';
        }
    }
    function move(step) {
        if (!canLeave()) return;
        const index = notes.findIndex(n => n.id === current?.id);
        const note = notes[index + step];
        if (note) edit(note);
    }
    function exportNotes() {
        const blob = new Blob([JSON.stringify({ format: 'tasty-notebook', version: 1, notes }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = el('a');
        link.href = url;
        link.download = `正文笔记-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        status.textContent = dirty ? '已导出已保存的笔记；当前未保存的修改不在备份内。' : '已导出备份。';
    }
    file.addEventListener('change', async () => {
        const upload = file.files[0];
        file.value = '';
        if (!upload || busy) return;
        try {
            if (upload.size > 25 * 1024 * 1024) throw new Error('备份文件不能超过 25 MB。');
            const incoming = parseBackup(await upload.text());
            const keys = new Set(notes.map(n => JSON.stringify([n.title, n.body, n.source])));
            const unique = incoming.filter(n => { const key = JSON.stringify([n.title, n.body, n.source]); if (keys.has(key)) return false; keys.add(key); return true; });
            if (await commit([...unique, ...notes])) { renderList(); status.textContent = `导入了 ${unique.length} 篇笔记，重复内容已跳过。`; }
        } catch (error) { status.textContent = `导入失败：${error.message}`; }
    });
    search.addEventListener('input', renderList);
    for (const node of [title, body, paper]) node.addEventListener('input', () => { dirty = true; status.textContent = '有修改尚未保存。'; });
    paper.addEventListener('change', setPaper);
    dialog.addEventListener('cancel', event => { if (!canLeave()) event.preventDefault(); });
    dialog.addEventListener('close', () => {
        reading.replaceChildren();
        if (dirty) { current = null; dirty = false; cover.hidden = false; editor.hidden = true; renderList(); }
        opener?.focus();
    });
    dialog.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
    });
    window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
    renderList();
    return { open: show, capture: newNote };
}
