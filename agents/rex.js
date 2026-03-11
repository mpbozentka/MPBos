const { GoogleGenerativeAI } = require('@google/generative-ai');

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function classifyIntent(message, conversationHistory = '') {
    console.log("Rex: Classifying intent for: " + message);
    const historyBlock = conversationHistory
        ? `\nRECENT CONVERSATION (use this to understand follow-ups like "also", "that", "too", "same", "another one"):\n${conversationHistory}\n`
        : '';

    const prompt = `You are Rex, an AI intake coordinator for Mitchell.
${historyBlock}
CONTEXT CLUES (use these to improve accuracy):
- Mitchell is a golf instructor. Names like "Liam Hyde", mentions of "Op36", "swing", "drill", "lesson notes", "student" → these are GOLF/STUDENT topics.
- "BTC", "bitcoin", "price", "weather" with no other context → quick_check (NOT research)
- Only classify as "research" if the user explicitly wants a deep dive, analysis, or web lookup.
- If the user says "also", "too", "and", "another", "same" — look at the RECENT CONVERSATION to determine the category and context from the previous message.

Classify into ONE category:
- quick_check: Bitcoin price, weather, simple factual lookups
- research: Deep analysis, web research, complex questions
- calendar_event: Scheduling, booking, moving, cancelling events with dates/times
- grocery: Food/household items to buy
- personal_task: Personal life to-dos
- professional_task: Work/career to-dos
- student_management: Adding a new golf student, logging a lesson, updating student notes
- student_query: Questions about a specific student's history, progress, or lessons
- send_email: Drafting or sending emails to students or contacts
- query: Questions about current lists, schedule, or general status

Respond ONLY with JSON:
{"category": "...", "action": "ADD|REMOVE|VIEW", "item": "extracted name of the person or item (if student management/query, MUST be the student's name)", "confidence": 0.0-1.0}

Message: "${message}"`;

    try {
        console.log("Rex: Calling Gemini for classification...");
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);
        let category = data.category.toLowerCase().replace(/[^a-z_]/g, '');

        // Hard overrides — these should never misclassify
        const low = message.toLowerCase();

        // Any message asking to VIEW a list → always a query, never an add
        const isViewRequest = /\b(show|list|display|what('?s| is| are)|give me|tell me|read|see|check|pull up|view)\b/.test(low);
        const isListTopic = /\b(task|tasks|list|todo|to-do|schedule|grocery|groceries)\b/.test(low);
        if (isViewRequest && isListTopic) {
            category = 'query';
        }

        // BTC/weather price checks
        if (data.confidence < 0.7) {
            if ((low.includes('btc') || low.includes('bitcoin')) &&
                (low.includes('price') || low.includes('check'))) {
                category = 'quick_check';
            }
        }

        return {
            category,
            action: data.action || 'ADD',
            item: data.item || '',
            confidence: data.confidence || 0.5
        };
    } catch (error) {
        console.error('Rex classification error:', error.message);
        return { category: 'query', action: 'ADD', item: '', confidence: 0 };
    }
}

async function identifyEventAction(message, events) {
    const prompt = `Upcoming Events:
${events.map((e, i) => `${i}: ${e.summary} (${e.start})`).join('\n')}

User Message: "${message}"

Determine if MOVE, CREATE, or DELETE. Respond ONLY with:
ACTION: MOVE
INDEX: [number]
OR
ACTION: DELETE
INDEX: [number]
OR
ACTION: CREATE`;

    try {
        console.log("Rex: Calling Gemini for classification...");
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const actionMatch = text.match(/ACTION: (MOVE|CREATE|DELETE)/);
        const indexMatch = text.match(/INDEX: (\d+)/);
        return {
            action: actionMatch ? actionMatch[1] : 'CREATE',
            index: indexMatch ? parseInt(indexMatch[1]) : -1
        };
    } catch (error) {
        return { action: 'CREATE', index: -1 };
    }
}

async function parseEventDetails(message, originalEvent = null) {
    const now = new Date();
    const localTime = now.toLocaleString("en-US", { timeZone: "America/Chicago" });
    const isoDate = now.toISOString().split('T')[0]; // gives LLM a reference date

    const prompt = originalEvent
        ? `MOVE this event: "${originalEvent.summary}" currently at ${originalEvent.start}.
User wants: "${message}"
Return ONLY valid JSON: {"summary": "...", "start": "YYYY-MM-DDTHH:MM:SS", "end": "YYYY-MM-DDTHH:MM:SS"}
All times in Central Time (America/Chicago). Today is ${isoDate}.`
        : `Extract event details from: "${message}"
Return ONLY valid JSON: {"summary": "...", "start": "YYYY-MM-DDTHH:MM:SS", "end": "YYYY-MM-DDTHH:MM:SS"}
All times in Central Time (America/Chicago). Current time: ${localTime}. Today is ${isoDate}.
If no end time is given, default to 1 hour after start.`;

    try {
        console.log("Rex: Calling Gemini for classification...");
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);

        // Validate the dates are real
        const start = new Date(parsed.start);
        const end = new Date(parsed.end);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.error('Rex: Invalid dates from LLM:', parsed);
            return null;
        }
        if (end <= start) {
            parsed.end = new Date(start.getTime() + 60 * 60 * 1000).toISOString();
        }

        return parsed;
    } catch (error) {
        console.error('Rex parseEventDetails error:', error.message);
        return null;
    }
}

async function answerQuery(message, groceries, personal, professional, calendarEvents, extraContext = "") {
    const localTime = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });

    // Detect if the user wants a full list — if so, tell the LLM to list everything, not summarize
    const isListRequest = /\b(show|list|tell me|what('?s| is| are)|give me|read)\b/i.test(message) &&
        /\b(task|todo|to-do|grocery|groceries|list)\b/i.test(message);

    const prompt = `Context:
Time: ${localTime}
Groceries (${groceries.length}): ${groceries.join('\n- ') || 'None'}
Personal Tasks (${personal.length}):
- ${personal.join('\n- ') || 'None'}
Professional Tasks (${professional.length}):
- ${professional.join('\n- ') || 'None'}
Schedule: ${calendarEvents.map(e => `${e.summary} (${e.start})`).join('; ') || 'No upcoming events'}
Market/Research: ${extraContext}

Question: "${message}"

${isListRequest
    ? 'The user wants to SEE the full list. List EVERY item — do not summarize or count. Use a numbered or bulleted list in Telegram HTML.'
    : 'Respond concisely in Telegram HTML.'}
You are Rex. Use HTML tags only (<b>, <i>). No markdown stars.`;

    try {
        console.log("Rex: Calling Gemini for classification...");
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        return "Error answering query.";
    }
}

module.exports = { classifyIntent, answerQuery, parseEventDetails, identifyEventAction };
