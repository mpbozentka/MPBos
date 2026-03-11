const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Uses Gemini to find the best matching item/task from a list based on a natural language request
async function findBestMatch(userRequest, candidates) {
    if (candidates.length === 0) return -1;

    // Try simple string matching first to save an API call
    const target = userRequest.toLowerCase().trim();
    const exactIdx = candidates.findIndex(c => c.toLowerCase().trim() === target);
    if (exactIdx !== -1) return exactIdx;

    const fuzzyIdx = candidates.findIndex(c =>
        c.toLowerCase().trim().includes(target) || target.includes(c.toLowerCase().trim())
    );
    if (fuzzyIdx !== -1) return fuzzyIdx;

    // Fall back to LLM matching for vague or differently-worded requests
    try {
        const prompt = `A user wants to remove an item. Their request: "${userRequest}"

Available items (by index):
${candidates.map((c, i) => `${i}: "${c}"`).join('\n')}

Which index best matches what the user wants to remove? Reply with ONLY the number, or -1 if nothing is a reasonable match.`;

        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const index = parseInt(result.response.text().trim());
        return (isNaN(index) || index < -1 || index >= candidates.length) ? -1 : index;
    } catch (e) {
        console.error('Maya findBestMatch LLM error:', e.message);
        return -1;
    }
}

// Initialize auth
const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Cache the doc instance — reuse it across calls
let cachedDoc = null;
let docLoadedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getDoc() {
    const now = Date.now();
    if (cachedDoc && (now - docLoadedAt) < CACHE_TTL) {
        return cachedDoc;
    }
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    cachedDoc = doc;
    docLoadedAt = now;
    return doc;
}

// Force refresh when you know data changed (after writes)
function invalidateCache() {
    cachedDoc = null;
    docLoadedAt = 0;
}

async function addMultipleGroceries(items, addedBy) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['🛒 Grocery List'];
        const rows = items.map(item => ({
            item: item.trim(),
            added_by: addedBy,
            date_added: new Date().toISOString().split('T')[0],
            status: 'pending'
        }));
        await sheet.addRows(rows); // addRows (plural) is one API call
        invalidateCache();
        return items.length;
    } catch (e) {
        console.error('Maya batch add error:', e.message);
        return 0;
    }
}

async function addGrocery(item, addedBy) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['🛒 Grocery List'];
        await sheet.addRow({
            item: item,
            added_by: addedBy,
            date_added: new Date().toISOString().split('T')[0],
            status: 'pending'
        });
        invalidateCache();
        return true;
    } catch (e) { return false; }
}

async function removeGrocery(item) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['🛒 Grocery List'];
        const rows = await sheet.getRows();

        const candidates = rows.map(r => r.get('item') || '');
        const index = await findBestMatch(item, candidates);

        if (index !== -1) {
            const removedItem = rows[index].get('item');
            await rows[index].delete();
            invalidateCache();
            return removedItem;
        }
        return null;
    } catch (e) {
        console.error('Maya removeGrocery error:', e.message);
        return null;
    }
}

async function addPersonalTask(task, source, priority = 'Medium') {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['🙋 Personal To-Do'];
        await sheet.addRow({
            task: task,
            source: source,
            priority: priority,
            status: 'pending'
        });
        invalidateCache();
        return true;
    } catch (e) { return false; }
}

async function removePersonalTask(task) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['🙋 Personal To-Do'];
        const rows = await sheet.getRows();

        const candidates = rows.map(r => r.get('task') || '');
        const index = await findBestMatch(task, candidates);

        if (index !== -1) {
            const removedTask = rows[index].get('task');
            await rows[index].delete();
            invalidateCache();
            return removedTask;
        }
        return null;
    } catch (e) {
        console.error('Maya removePersonalTask error:', e.message);
        return null;
    }
}

async function addProfessionalTask(task, source, priority = 'Medium') {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['💼 Professional To-Do'];
        await sheet.addRow({
            task: task,
            source: source,
            priority: priority,
            status: 'pending'
        });
        invalidateCache();
        return true;
    } catch (e) { return false; }
}

async function removeProfessionalTask(task) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['💼 Professional To-Do'];
        const rows = await sheet.getRows();

        const candidates = rows.map(r => r.get('task') || '');
        const index = await findBestMatch(task, candidates);

        if (index !== -1) {
            const removedTask = rows[index].get('task');
            await rows[index].delete();
            invalidateCache();
            return removedTask;
        }
        return null;
    } catch (e) {
        console.error('Maya removeProfessionalTask error:', e.message);
        return null;
    }
}

async function getGroceries() {
    try {
        const doc = await getDoc();
        return (await doc.sheetsByTitle['🛒 Grocery List'].getRows()).map(r => r.get('item'));
    } catch (e) { return []; }
}

async function getPersonalTasks() {
    try {
        const doc = await getDoc();
        return (await doc.sheetsByTitle['🙋 Personal To-Do'].getRows()).map(r => r.get('task'));
    } catch (e) { return []; }
}

async function getProfessionalTasks() {
    try {
        const doc = await getDoc();
        return (await doc.sheetsByTitle['💼 Professional To-Do'].getRows()).map(r => r.get('task'));
    } catch (e) { return []; }
}

async function addGolfStudent(details) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['🏌️♂️ Golf Students'];
        await sheet.addRow({
            name: details.name,
            details: details.details,
            date_created: new Date().toISOString().split('T')[0]
        });
        invalidateCache();
        return true;
    } catch (e) { return false; }
}

async function getStudentProfile(name) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['🏌️♂️ Golf Students'];
        const rows = await sheet.getRows();
        
        const target = name.toLowerCase().trim();
        let row = rows.find(r => (r.get('name') || '').toLowerCase().trim() === target);
        if (!row) {
            row = rows.find(r => {
                const sName = (r.get('name') || '').toLowerCase().trim();
                return sName.includes(target) || target.includes(sName);
            });
        }
        
        return row ? { name: row.get('name'), details: row.get('details') } : null;
    } catch (e) { return null; }
}

async function addLessonLog(log) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['📝 Lesson Logs'];
        await sheet.addRow({
            student_name: log.studentName,
            date: log.date,
            summary: log.summary
        });
        invalidateCache();
        return true;
    } catch (e) { return false; }
}

async function getLessonLogs(studentName) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['📝 Lesson Logs'];
        const rows = await sheet.getRows();
        const target = studentName.toLowerCase().trim();
        
        return rows
            .filter(r => {
                const sheetName = (r.get('student_name') || '').toLowerCase().trim();
                return sheetName === target || sheetName.includes(target) || target.includes(sheetName);
            })
            .map(r => ({
                date: r.get('date'),
                summary: r.get('summary')
            }));
    } catch (e) { return []; }
}

module.exports = {
    getDoc,
    addMultipleGroceries,
    addGrocery, removeGrocery,
    addPersonalTask, removePersonalTask,
    addProfessionalTask, removeProfessionalTask,
    getGroceries, getPersonalTasks, getProfessionalTasks,
    addGolfStudent, getStudentProfile, addLessonLog, getLessonLogs
};
