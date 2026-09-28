// IndexedDB keeps long excerpts out of SillyTavern's frequently saved settings.
export function createStore(scope) {
    const ready = new Promise((resolve, reject) => {
        const request = indexedDB.open('tasty-notebook-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('books');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return {
        async read() {
            const db = await ready;
            return new Promise((resolve, reject) => {
                const request = db.transaction('books').objectStore('books').get(scope);
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        },
        async write(notes) {
            const db = await ready;
            return new Promise((resolve, reject) => {
                const tx = db.transaction('books', 'readwrite');
                tx.objectStore('books').put(notes, scope);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error('保存中止'));
            });
        },
    };
}

export function parseBackup(text) {
    const data = JSON.parse(text);
    if (data.format !== 'tasty-notebook' || data.version !== 1 || !Array.isArray(data.notes)) {
        throw new Error('请选择本插件导出的 JSON 备份。');
    }
    if (data.notes.length > 10000) throw new Error('一次最多导入 10000 篇笔记。');
    return data.notes.map(note => {
        if (!note || typeof note.body !== 'string' || typeof note.title !== 'string' || note.body.length > 2000000) {
            throw new Error('备份中有无效的笔记，未导入任何内容。');
        }
        return {
            id: crypto.randomUUID(), title: note.title.slice(0, 160), body: note.body,
            source: typeof note.source === 'string' ? note.source.slice(0, 500) : '',
            created: typeof note.created === 'string' ? note.created.slice(0, 40) : new Date().toISOString(),
            paper: Number.isInteger(note.paper) && note.paper >= 1 && note.paper <= 11 ? note.paper : 1,
        };
    });
}
