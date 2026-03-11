const { GoogleGenerativeAI } = require('@google/generative-ai');
const maya = require('./maya');
const cal = require('./cal');
const olivia = require('./olivia');
const nolan = require('./nolan');
const mac = require('./mac');

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateBriefing() {
    const localTime = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    try {
        const results = await Promise.allSettled([
            maya.getGroceries(),
            maya.getPersonalTasks(),
            maya.getProfessionalTasks(),
            cal.listUpcomingEvents(15),
            olivia.fetchSnapshot('78732'),
            nolan.scanOvernightIntel(),
            mac.getBriefingSummary() // Real data instead of mock
        ]);

        // Extract values with fallbacks
        const getValue = (index, fallback) =>
            results[index].status === 'fulfilled' ? results[index].value : fallback;

        const groceries = getValue(0, []);
        const personal = getValue(1, []);
        const professional = getValue(2, []);
        const schedule = getValue(3, []);
        const researcher = getValue(4, { btc: 'Unavailable', weather: 'Unavailable', news: 'Unavailable' });
        const intel = getValue(5, 'Intel scan unavailable this morning.');
        const golf = getValue(6, 'Golf data unavailable.');

        // Track what failed so the briefing can mention it
        const failures = results
            .map((r, i) => r.status === 'rejected' ? ['Groceries', 'Personal', 'Professional', 'Calendar', 'Market', 'Intel', 'Golf'][i] : null)
            .filter(Boolean);

        console.log(`Brie is generating elite brief...`);

        const prompt = `You are a sophisticated personal concierge. 
Provide Mitchell with his Elite Daily Briefing.
${failures.length > 0 ? `\nNOTE: These data sources had issues this morning: ${failures.join(', ')}. Mention this briefly.\n` : ''}
DATA:
- Time & Weather: ${localTime}, ${researcher.weather}
- Bitcoin: ${researcher.btc}
- OVERNIGHT INTEL (Nolan): ${intel}
- GOLF MANAGEMENT (Mac): ${golf}
- AI News: ${researcher.news}
- Groceries: ${groceries.join(', ') || 'None'}
- Tasks (Personal): ${personal.join(', ') || 'All clear'}
- Tasks (Professional): ${professional.join(', ') || 'All clear'}
- Events: ${schedule.map(e => `${e.summary} (${e.start})`).join('; ')}

CRITICAL LAYOUT:
1. MARKET & INTEL (BTC/Weather) at the very top.
2. 🕵️‍♂️ OVERNIGHT INTEL (Nolan): Summarize his findings here.
3. 🏌️‍♂️ GOLF MANAGEMENT (Mac): Highlights for your students.
4. THE AGENDA: Schedule timeline.
5. ACTION CENTER: Tasks and Groceries.
6. AI INTELLIGENCE: News.
7. HTML tags only (<b>, <i>, <u>). No stars.

Format for Telegram HTML. Briefing:`;

        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error('Briefing error:', error);
        return 'Good morning Mitchell! Hit a snag gathering the intel. ☕️';
    }
}

module.exports = { generateBriefing };
