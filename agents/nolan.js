const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const maya = require('./maya');

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

async function getGmailClient() {
    if (!fs.existsSync(TOKEN_PATH)) return null;
    const content = fs.readFileSync(TOKEN_PATH);
    const credentials = JSON.parse(content);
    const auth = google.auth.fromJSON(credentials);
    return google.gmail({ version: 'v1', auth });
}

// Instead of parsing HTML output, ask for structured JSON separately
async function extractActions(intelSummary) {
    const prompt = `From this email intel summary, extract any clear action items.
Return ONLY a JSON array of strings. If no actions, return [].

Example: ["Follow up with John about proposal", "Review Q1 budget draft"]

Intel:
${intelSummary}`;

    try {
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        return [];
    }
}

async function scanOvernightIntel() {
    console.log("🕵️‍♂️ Nolan is starting his night shift...");
    const gmail = await getGmailClient();
    if (!gmail) return "Gmail not authorized.";

    try {
        // Dynamic date: always look back 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g, '/');

        const res = await gmail.users.messages.list({
            userId: 'me',
            q: `is:unread after:${dateStr}`,
            maxResults: 10 // bumped from 5 to catch more
        });

        const messages = res.data.messages || [];
        let intelSummary = "";

        for (const msg of messages) {
            const email = await gmail.users.messages.get({ userId: 'me', id: msg.id });
            const snippet = email.data.snippet;
            const subject = email.data.payload.headers.find(h => h.name === 'Subject')?.value || "No Subject";

            intelSummary += `\n- 📧 SUBJECT: ${subject}\n  SNIPPET: ${snippet}\n`;
        }

        if (!messages.length) return "No new intel found overnight.";

        const prompt = `You are Nolan, the Overnight Intel Analyst. 
I have scanned Mitchell's emails. Extract exactly 3 key "Action Items" or "Intel Flags" from this summary.

INTEL SUMMARY:
${intelSummary}

RULES:
1. Be concise.
2. If an action is clear, say "ACTION: [Task]".
3. If it's just info, say "FLAG: [Info]".
4. Format as a bulleted list for a briefing.
5. Use HTML (<b>, <i>). No stars.`;

        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const finalIntel = result.response.text().trim();

        // After generating the display intel...
        const actions = await extractActions(intelSummary);

        // Check existing tasks to avoid duplicates
        const existingTasks = await maya.getProfessionalTasks();
        for (const action of actions) {
            const isDuplicate = existingTasks.some(t =>
                t.toLowerCase().includes(action.toLowerCase().substring(0, 20))
            );
            if (!isDuplicate) {
                await maya.addProfessionalTask(action, "Nolan (Email Intel)");
            }
        }

        return finalIntel;
    } catch (error) {
        console.error("Nolan scan error:", error.message);
        return "I hit a snag scanning the intel.";
    }
}

module.exports = { scanOvernightIntel };
