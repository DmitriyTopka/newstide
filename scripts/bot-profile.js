// Bot Profile: sets what a person sees BEFORE pressing Start (description, short description, command menu,
// avatar). Run once after a text change: node --env-file=.env scripts/bot-profile.js [--avatar]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error('TELEGRAM_BOT_TOKEN is not set.'); process.exit(1); }
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const call = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, body instanceof FormData ? { method: 'POST', body } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  console.log(`${method}${body?.language_code ? ` (${body.language_code})` : ''}: ${data.ok ? 'ok' : data.description}`);
  return data.ok;
};

const PROFILE = {
  '': {
    description: 'NewsTide is a newspaper-style news background for crypto traders. Pick up to 10 coins and every morning the bot sends a short summary: where the news point your coin, up, down or no clear direction. If a verdict flips, it writes right away. Not a price forecast and not trading advice. Press Start.',
    short: 'The news background for your coins: a short morning summary and an alert when the verdict flips.',
    commands: [['menu', 'Menu'], ['now', 'Summary now'], ['news', 'News'], ['markets', 'Markets'], ['stocks', 'US stocks'], ['list', 'My coins'], ['about', 'About the bot'], ['help', 'Help']]
  },
  ru: {
    description: 'NewsTide: газета о новостном фоне для крипто-трейдера. Выберите до 10 монет, и каждое утро бот пришлёт короткую сводку: куда новости тянут монету, вверх, вниз или ясного направления нет. Если вердикт развернулся, напишет сразу. Это не прогноз цены и не совет по торговле. Нажмите «Запустить».',
    short: 'Новостной фон по вашим монетам: короткая утренняя сводка и сигнал, если вердикт развернулся.',
    commands: [['menu', 'Меню'], ['now', 'Сводка сейчас'], ['news', 'Новости'], ['markets', 'Рынки'], ['stocks', 'Акции США'], ['list', 'Мои монеты'], ['about', 'О боте'], ['help', 'Помощь']]
  }
};

for (const [language_code, p] of Object.entries(PROFILE)) {
  await call('setMyDescription', { description: p.description, language_code });
  await call('setMyShortDescription', { short_description: p.short, language_code });
  await call('setMyCommands', { commands: p.commands.map(([command, description]) => ({ command, description })), language_code });
}
await call('setChatMenuButton', { menu_button: { type: 'commands' } });

if (process.argv.includes('--avatar')) {
  const form = new FormData();
  form.set('photo', JSON.stringify({ type: 'static', photo: 'attach://avatar' }));
  form.set('avatar', new Blob([await readFile(path.join(root, 'docs/avatar.png'))], { type: 'image/png' }), 'avatar.png');
  await call('setMyProfilePhoto', form);
}
