// Telegram API: the few Bot API calls we need, over plain fetch (no library).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function telegram(token) {
  const call = async (method, body, timeoutMs = 15000) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const data = await res.json();
    if (!data.ok) throw Object.assign(new Error(`${method}: ${data.description}`), { code: data.error_code });
    return data.result;
  };
  // photo: a file path (uploaded once) or the file_id Telegram gave back (reused for free)
  const sendPhoto = async (chat_id, photo, caption) => {
    if (!photo.includes('/')) return call('sendPhoto', { chat_id, photo, caption, parse_mode: 'HTML' });
    const form = new FormData();
    form.set('chat_id', String(chat_id));
    if (caption) { form.set('caption', caption); form.set('parse_mode', 'HTML'); }
    form.set('photo', new Blob([await readFile(photo)], { type: 'image/jpeg' }), path.basename(photo));
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    if (!data.ok) throw Object.assign(new Error(`sendPhoto: ${data.description}`), { code: data.error_code });
    return data.result;
  };
  return {
    sendPhoto,
    me: () => call('getMe', {}),
    updates: (offset) => call('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] }, 35000),
    // markup is an optional inline keyboard: { inline_keyboard: [[{ text, callback_data }]] }
    send: (chat_id, text, markup) => call('sendMessage', { chat_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(markup ? { reply_markup: markup } : {}) }),
    edit: (chat_id, message_id, text, markup) => call('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(markup ? { reply_markup: markup } : {}) }),
    answer: (callback_query_id, text) => call('answerCallbackQuery', { callback_query_id, ...(text ? { text } : {}) }),
    setCommands: commands => call('setMyCommands', { commands })
  };
}
