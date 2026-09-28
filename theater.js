// HTML code fences are displayed as code by the normal Markdown formatter.
// Preview only explicit HTML documents/fragments, isolated from the host page.
export function theaterDocument(html) {
    const policy = "default-src 'none'; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; font-src https: http: data:; base-uri 'none'; form-action 'none'";
    return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{background:transparent}body{margin:0;color:#493b32;font:16px/1.9 Georgia,serif}*{scrollbar-width:none}::-webkit-scrollbar{display:none}</style>${html}`;
}

export function mountTheaters(root) {
    for (const code of root.querySelectorAll('pre > code')) {
        const language = /(?:^|\s)(?:custom-)?(?:language-|lang-)html(?:\s|$)/i.test(code.className);
        const html = code.textContent.trim();
        if (!language && !/^(?:<!doctype\s+html|<html[\s>])/i.test(html)) continue;
        // Avoid turning HTML examples containing no markup into empty frames.
        if (!/<[a-z][\s\S]*>/i.test(html)) continue;
        const frame = document.createElement('iframe');
        frame.className = 'tn-theater-frame';
        frame.title = '小剧场';
        frame.setAttribute('sandbox', '');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        frame.srcdoc = theaterDocument(html);
        code.parentElement.replaceWith(frame);
    }
}
