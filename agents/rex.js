const { GoogleGenerativeAI } = require('@google/generative-ai');

const brie = require('./brie');
const maya = require('./maya');
const cal = require('./cal');
const olivia = require('./olivia');
const nolan = require('./nolan');
const mac = require('./mac');

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function classifyIntent(message, conversationHistory = '') {
    const historyBlock = conversationHistory ? `\nRECENT CONVERSATION:\n${conversationHistory}\n` : '';
    const prompt = `You are Rex, an AI coordinator for Mitchell, a golf pro. Classify into ONE category:
    - quick_check: Bitcoin price, weather
    - research: Deep analysis
    - calendar_event: Dates/times
    - grocery: Food items
    - personal_task: Personal to-dos
    - professional_task: Work to-dos
    - student_management: New golf student profile, logging lesson notes
    - student_query: Student history/progress
    - send_email: Drafting emails
    - query: Lists, schedule, status
    
    Respond ONLY with JSON: {"category": "...", "action": "ADD|REMOVE|VIEW", "item": "extracted name of student or item", "confidence": 0.0-1.0}
    Message: "${message}"`;

    try {
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);
        return {
            category: data.category.toLowerCase().replace(/[^a-z_]/g, ''),
            action: data.action || 'ADD',
            item: data.item || '',
            confidence: data.confidence || 0.5
        };
    } catch (e) { return { category: 'query', action: 'ADD', item: '', confidence: 0 }; }
}

async function answerQuery(message, groceries, personal, professional, calendarEvents) {
    const localTime = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
    const prompt = `Context: Time: ${localTime}\nGroceries: ${groceries.join(', ')}\nPersonal: ${personal.join(', ')}\nProfessional: ${professional.join(', ')}\nSchedule: ${calendarEvents.map(e => `${e.summary} (${e.start})`).join('; ')}\nQuestion: "${message}"\nRespond concisely in HTML. Use ONLY <b> and <i> tags. No markdown code blocks.`;
    try {
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        return text.replace(/```html|```/g, '')
                   .replace(/<\/?html>|<\/?body>|<\/?div>|<\/?span>/gi, '')
                   .replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<p>/gi, '').replace(/<\/p>/gi, '\n')
                   .trim();
    } catch (e) { return "Error answering query."; }
}

async function routeMessage(ctx, classification) {
    const message = ctx.message.text || ctx.message.voice?.text;
    if (!message) return;
    console.log('🚀 Routing category:', classification.category);

    try {
        if (classification.category === 'query' || classification.category === 'calendar_event') {
            const [groceries, personal, professional, schedule] = await Promise.all([
                maya.getGroceries(),
                maya.getPersonalTasks(),
                maya.getProfessionalTasks(),
                cal.listUpcomingEvents(15)
            ]);
            const answer = await answerQuery(message, groceries, personal, professional, schedule);
            await ctx.reply(answer, { parse_mode: 'HTML' });
        } else if (classification.category === 'student_management') {
            const low = message.toLowerCase();
            if (low.includes('log') || low.includes('lesson') || low.includes('worked on')) {
                console.log('📝 Logging lesson for:', classification.item);
                const res = await mac.addLessonLog(classification.item, message);
                await ctx.reply(res, { parse_mode: 'HTML' });
            } else {
                console.log('👤 Adding student profile for:', classification.item);
                const res = await mac.addStudentProfile({ name: classification.item, details: message });
                await ctx.reply(res, { parse_mode: 'HTML' });
            }
        } else if (classification.category === 'student_query') {
            const res = await mac.getStudentHistory(classification.item);
            await ctx.reply(res, { parse_mode: 'HTML' });
        } else if (classification.category === 'quick_check') {
            const res = await olivia.fetchSnapshot();
            await ctx.reply(`💰 <b>BTC:</b> ${res.btc}\n🌤 <b>Weather:</b> ${res.weather}`, { parse_mode: 'HTML' });
        } else if (classification.category === 'research') {
            await ctx.reply('🕵️‍♂️ Olivia is researching...');
            const res = await olivia.performResearch(message);
            await ctx.reply(res, { parse_mode: 'HTML' });
        } else if (['grocery', 'personal_task', 'professional_task'].includes(classification.category)) {
            if (classification.category === 'grocery') await maya.addMultipleGroceries([classification.item], 'Rex');
            else if (classification.category === 'personal_task') await maya.addPersonalTask(classification.item);
            else await maya.addProfessionalTask(classification.item);
            await ctx.reply(`✅ Added to ${classification.category}: ${classification.item}`);
        } else if (message.toLowerCase().includes('brief')) {
            await ctx.reply('☕️ Brie is preparing your briefing...');
            const brief = await brie.generateBriefing();
            await ctx.reply(brief, { parse_mode: 'HTML' });
        } else {
            await ctx.reply(`Rex: I've categorized this as ${classification.category}. Work in progress!`);
        }
    } catch (e) {
        console.error('Routing Error:', e);
        ctx.reply('⚠️ Error in routing: ' + e.message);
    }
}

module.exports = { routeMessage, classifyIntent, answerQuery };
