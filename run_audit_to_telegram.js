require('dotenv').config();
const { Telegraf } = require('telegraf');
const rex = require('./agents/rex');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(token);
const PREFERENCES_FILE = './preferences.json';
const prefs = JSON.parse(fs.readFileSync(PREFERENCES_FILE));
const chatId = prefs.chatId;

const testCases = [
    "What is the price of Bitcoin?",
    "What's the weather in Austin right now?",
    "Research the latest trends in golf swing analytics.",
    "Schedule a lesson with Liam Hyde for tomorrow at 2 PM.",
    "Add milk and eggs to my grocery list.",
    "I need to fix the fence this weekend.",
    "Finish the quarterly report by Friday.",
    "Add Sarah Jenkins as a new student. She's a beginner.",
    "Log a lesson for Paul: worked on his putting today.",
    "What's the history of lessons for Mitchell Bozentka?",
    "Draft an email to Paul Bozentka welcoming him to the program.",
    "Show me my grocery list.",
    "What are my tasks for today?"
];

async function runTelegramAudit() {
    console.log("🚀 Starting Telegram Audit (sending to " + chatId + ")...");
    
    for (let i = 0; i < testCases.length; i++) {
        const msg = testCases[i];
        console.log(`[${i+1}/${testCases.length}] Processing: "${msg}"`);
        
        try {
            // 1. Send the user message preview
            await bot.telegram.sendMessage(chatId, "🧪 <b>TEST CASE:</b> " + msg, { parse_mode: 'HTML' });
            
            // 2. Classify
            const classification = await rex.classifyIntent(msg);
            
            // 3. Mock the context object for Rex
            const mockCtx = {
                message: { text: msg },
                from: { id: chatId, username: 'AuditBot' },
                reply: async (text, options) => {
                    return await bot.telegram.sendMessage(chatId, text, options);
                }
            };
            
            // 4. Route it
            await rex.routeMessage(mockCtx, classification);
            
            // Small delay to prevent hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 1500));
            
        } catch (e) {
            console.error(`Error on test case ${i+1}:`, e.message);
            await bot.telegram.sendMessage(chatId, "❌ <b>FAILED:</b> " + e.message, { parse_mode: 'HTML' });
        }
    }
    
    await bot.telegram.sendMessage(chatId, "🏁 <b>AUDIT COMPLETE.</b> All test cases processed.");
    console.log("✅ Telegram Audit Complete.");
}

runTelegramAudit();
