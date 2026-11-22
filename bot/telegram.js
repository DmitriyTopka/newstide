// Telegram API: the few Bot API calls we need, over plain fetch (no library).
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
  return {
    me: () => call('getMe', {}),
    updates: (offset) => call('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] }, 35000),
    // markup is an optional inline keyboard: { inline_keyboard: [[{ text, callback_data }]] }
    send: (chat_id, text, markup) => call('sendMessage', { chat_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(markup ? { reply_markup: markup } : {}) }),
    edit: (chat_id, message_id, text, markup) => call('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(markup ? { reply_markup: markup } : {}) }),
    answer: (callback_query_id, text) => call('answerCallbackQuery', { callback_query_id, ...(text ? { text } : {}) }),
    setCommands: commands => call('setMyCommands', { commands })
  };
}
