import TelegramBot from 'node-telegram-bot-api';
import { processMessage, type ConversationHistory } from '../services/claude.service';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ALLOWED_CHAT_ID = parseInt(process.env.TELEGRAM_CHAT_ID!, 10);

// ─── Per-chat conversation history ───────────────────────────
// Keeps the last MAX_PAIRS exchanges (user + assistant) in memory.
const histories = new Map<number, ConversationHistory>();
const MAX_PAIRS = 15; // 30 messages max per chat

// Track in-flight requests to avoid duplicate processing
const processing = new Set<number>();

function getHistory(chatId: number): ConversationHistory {
  if (!histories.has(chatId)) histories.set(chatId, []);
  return histories.get(chatId)!;
}

function pushToHistory(chatId: number, role: 'user' | 'assistant', content: string) {
  const history = getHistory(chatId);
  history.push({ role, content });
  // Trim oldest pairs when over limit
  while (history.length > MAX_PAIRS * 2) {
    history.splice(0, 2);
  }
}

// ─── Typing indicator (keeps showing until cancelled) ─────────
function startTyping(bot: TelegramBot, chatId: number): NodeJS.Timeout {
  bot.sendChatAction(chatId, 'typing').catch(() => {});
  return setInterval(() => {
    bot.sendChatAction(chatId, 'typing').catch(() => {});
  }, 4_000);
}

// ─── Safe message sender (escapes nothing — plain text) ───────
async function reply(bot: TelegramBot, chatId: number, text: string) {
  try {
    await bot.sendMessage(chatId, text);
  } catch (err: any) {
    console.error('[Chat] Failed to send message:', err.message);
  }
}

// ─── Main export ──────────────────────────────────────────────
export function startChat() {
  const bot = new TelegramBot(TOKEN, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text   = msg.text?.trim();

    // Only respond to the configured chat ID
    if (chatId !== ALLOWED_CHAT_ID || !text) return;

    // Skip duplicate/concurrent messages from same chat
    if (processing.has(chatId)) {
      await reply(bot, chatId, '⏳ Still processing your last message — hang on!');
      return;
    }

    // ── Special commands ──────────────────────────────────
    if (text === '/start' || text === '/help') {
      await reply(bot, chatId, [
        '👋 Hey! I\'m Jarvis, your productivity assistant.',
        '',
        'You can talk to me naturally. For example:',
        '📚 "Add assignment: Lab Report for Biology due Friday"',
        '📚 "Add exam: Midterm for Calc 2 on April 20"',
        '📚 "What assignments are due this week?"',
        '📚 "Mark the Biology lab as done"',
        '',
        '🎬 "Add content idea: morning routine video for YouTube"',
        '🎬 "What\'s my posting schedule this week?"',
        '🎬 "Mark my TikTok post as posted"',
        '',
        '💼 "Add client: Nike working on social media strategy"',
        '💼 "What\'s my agency pipeline looking like?"',
        '💼 "Update Nike status to active"',
        '',
        '📅 "What\'s on my calendar today?"',
        '📅 "Block 2 hours for studying on Thursday"',
        '',
        '⚡ "What should I focus on today?"',
        '⚡ "Give me a full summary"',
        '',
        'Type /reset to clear our conversation history.',
      ].join('\n'));
      return;
    }

    if (text === '/reset') {
      histories.delete(chatId);
      await reply(bot, chatId, '🔄 Conversation history cleared. Fresh start!');
      return;
    }

    // ── Process with Claude ───────────────────────────────
    processing.add(chatId);
    const typingTimer = startTyping(bot, chatId);

    try {
      const history = getHistory(chatId);
      const response = await processMessage(text, history);

      // Persist this exchange to history
      pushToHistory(chatId, 'user', text);
      pushToHistory(chatId, 'assistant', response);

      await reply(bot, chatId, response);
    } catch (err: any) {
      console.error('[Chat] processMessage error:', err.message);
      await reply(bot, chatId, '❌ Something went wrong on my end. Try again in a moment.');
    } finally {
      clearInterval(typingTimer);
      processing.delete(chatId);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[Chat] Polling error:', (err as any).message ?? err);
  });

  console.log('[Chat] 🤖 Jarvis chat active — send a message on Telegram!');
}
