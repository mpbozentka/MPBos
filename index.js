require('dotenv').config();
const { Telegraf } = require('telegraf');
const rex = require('./agents/rex');
const olivia = require('./agents/olivia');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(token);

// Persist drafts to file to survive restarts
const DRAFTS_FILE = path.join(__dirname, 'drafts.json');
function saveDraft(userId, draft) {
    let drafts = {};
    if (fs.existsSync(DRAFTS_FILE)) drafts = JSON.parse(fs.readFileSync(DRAFTS_FILE));
    drafts[userId] = draft;
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(drafts));
}
function getDraft(userId) {
    if (!fs.existsSync(DRAFTS_FILE)) return null;
    const drafts = JSON.parse(fs.readFileSync(DRAFTS_FILE));
    return drafts[userId] || null;
}
function deleteDraft(userId) {
    if (!fs.existsSync(DRAFTS_FILE)) return;
    const drafts = JSON.parse(fs.readFileSync(DRAFTS_FILE));
    delete drafts[userId];
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(drafts));
}

console.log("🚀 AI Elite Team is online (Telegraf)...");

bot.on(['text', 'voice'], async (ctx) => {
    const message = ctx.message.text || ctx.message.voice?.text;
    if (!message) return;
    console.log('📩 Message from ' + (ctx.from.username || ctx.from.id));

    try {
        const classification = await rex.classifyIntent(message);
        console.log('🔍 Classification:', classification.category);

        if (classification.category === 'send_email') {
            await ctx.reply('✍️ Drafting email with Olivia...');
            const draft = await olivia.draftEmail(message, ctx);
            if (!draft) return ctx.reply('❌ Failed to draft email.');

            saveDraft(ctx.from.id, draft);
            const preview = `📩 DRAFT PREVIEW\n\nTO: ${draft.to}\nSUBJECT: ${draft.subject}\n\nMESSAGE:\n${draft.body}`;
            
            await ctx.reply(preview, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Send It', callback_data: 'send_draft' },
                        { text: '❌ Cancel', callback_data: 'cancel_draft' }
                    ]]
                }
            });
            return;
        }
        await rex.routeMessage(ctx);
    } catch (e) {
        console.error('Bot Error:', e.message);
        ctx.reply('⚠️ Error: ' + e.message).catch(() => {});
    }
});

bot.action('send_draft', async (ctx) => {
    try {
        const draft = getDraft(ctx.from.id);
        if (!draft) return ctx.answerCbQuery('⚠️ No draft found.', { show_alert: true }).catch(() => {});

        await ctx.answerCbQuery('Sending email...').catch(() => {});
        await ctx.editMessageText('📤 Sending...').catch(() => {});

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.PGA_EMAIL,
                pass: process.env.PGA_APP_PASSWORD
            }
        });

        await transporter.sendMail({
            from: process.env.PGA_EMAIL,
            to: draft.to,
            subject: draft.subject,
            text: draft.body
        });

        await ctx.editMessageText('✅ Email Sent to ' + draft.to).catch(() => {});
        deleteDraft(ctx.from.id);
    } catch (error) {
        console.error('Email Error:', error.message);
        ctx.reply('❌ Error sending: ' + error.message).catch(() => {});
    }
});

bot.action('cancel_draft', async (ctx) => {
    deleteDraft(ctx.from.id);
    await ctx.answerCbQuery('Cancelled').catch(() => {});
    await ctx.editMessageText('❌ Email cancelled.').catch(() => {});
});

bot.catch((err, ctx) => {
    console.error(`Telegraf error for ${ctx.updateType}`, err);
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
