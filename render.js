// Delegate regex, Markdown and HTML sanitization to SillyTavern exactly once.
// Never pass message 0: some versions mutate its chat text during formatting.
export function renderNote(text, note, context) {
    if (typeof context.messageFormatting !== 'function') return null;
    const meta = note.formatting || {};
    // Selections are already-visible text, not raw message source. Re-running
    // substitutions on them could apply a non-idempotent regex a second time.
    if (meta.isSelection) return null;
    let messageId = -1;
    const scope = context.groupId ? `group:${context.groupId}` : `character:${context.characters?.[context.characterId]?.avatar || ''}`;
    const original = context.chat?.[meta.messageId];
    if (meta.messageId > 0 && meta.chatId === context.chatId && meta.scope === scope &&
        meta.sentAt && String(original?.send_date) === meta.sentAt &&
        original?.name === meta.name && Boolean(original?.is_user) === Boolean(meta.isUser)) {
        messageId = meta.messageId;
    }
    return context.messageFormatting(text, meta.name || context.name2 || '',
        Boolean(meta.isSystem), Boolean(meta.isUser), messageId);
}

export function captureFormatting(context, item, index) {
    return {
        name: item.name || '', isUser: Boolean(item.is_user), isSystem: Boolean(item.is_system),
        messageId: index, chatId: context.chatId || '', sentAt: String(item.send_date || ''),
        scope: context.groupId ? `group:${context.groupId}` : `character:${context.characters?.[context.characterId]?.avatar || ''}`,
    };
}
