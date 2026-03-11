const { GoogleGenerativeAI } = require('@google/generative-ai');
const maya = require('./maya');

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Mac: Golf Student Management Specialist
 * Responsible for student profiles, detailed lesson logs, and student progress tracking.
 */

async function addStudentProfile(details) {
    try {
        console.log("Mac is creating a new student profile...");
        // This will use Maya's sheet methods to add a row to '🏌️‍♂️ Golf Students'
        const success = await maya.addGolfStudent(details);
        return success ? `✅ Profile created for <b>${details.name}</b>.` : "❌ Failed to create profile.";
    } catch (e) {
        console.error("Mac profile error:", e.message);
        return "Error creating profile.";
    }
}

async function addLessonLog(studentName, content) {
    try {
        console.log(`Mac is documenting a lesson for ${studentName}...`);
        const localTime = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });

        // This will add a row to '📝 Lesson Logs'
        const success = await maya.addLessonLog({
            studentName: studentName,
            date: localTime,
            summary: content
        });
        return success ? `📝 Lesson logged for <b>${studentName}</b> on ${localTime}.` : "❌ Failed to log lesson.";
    } catch (e) {
        console.error("Mac lesson log error:", e.message);
        return "Error logging lesson.";
    }
}

async function getStudentHistory(studentName) {
    try {
        console.log(`Mac is retrieving intel on ${studentName}...`);
        const [profile, logs] = await Promise.all([
            maya.getStudentProfile(studentName),
            maya.getLessonLogs(studentName)
        ]);

        if (!profile && logs.length === 0) return `No records found for ${studentName}.`;

        let report = `👤 <b>STUDENT PROFILE: ${studentName}</b>\n`;
        if (profile) report += `<i>${profile.details}</i>\n`;

        report += `\n📝 <b>RECENT LESSONS:</b>\n`;
        logs.slice(0, 3).forEach(log => {
            report += `• <i>${log.date}</i>: ${log.summary.substring(0, 100)}...\n`;
        });

        return report;
    } catch (e) {
        console.error("Mac history error:", e.message);
        return "Error fetching history.";
    }
}


async function summarizeLesson(studentName, content) {
    try {
        // Pull student context first
        const [profile, recentLogs] = await Promise.all([
            maya.getStudentProfile(studentName),
            maya.getLessonLogs(studentName)
        ]);

        const lastLesson = recentLogs.length > 0
            ? recentLogs.sort((a, b) => new Date(b.date) - new Date(a.date))[0].summary
            : 'No previous lessons on file.';

        const prompt = `You are Mac, a golf instruction specialist. Summarize this lesson into structured, technical components.

STUDENT CONTEXT:
- Name: ${studentName}
- Profile: ${profile?.details || 'New student, no profile yet'}
- Last Lesson Focus: ${lastLesson.substring(0, 300)}

TODAY'S LESSON DATA:
"${content}"

Format:
1. <b>Key Feels/Thoughts</b> — What the student was working on mentally
2. <b>Drills & Exercises</b> — What was practiced
3. <b>Progress vs Last Session</b> — What improved or regressed
4. <b>Next Steps</b> — What to focus on next time

Use HTML tags. Be concise and technical.`;

        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) {
        return content; // Fallback to raw
    }
}


async function getLatestLessonSummary(studentName) {
    try {
        console.log(`Mac is retrieving the latest lesson for ${studentName}...`);
        const logs = await maya.getLessonLogs(studentName);
        if (logs.length === 0) return `I have no lesson logs on file for ${studentName} yet.`;

        // Sort by date descending to guarantee we get the actual latest
        const sorted = logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        const latest = sorted[0];

        return `🏎️ <b>Mac's Intel:</b> Latest lesson for <b>${studentName}</b> (${latest.date}):\n\n${latest.summary}`;
    } catch (e) {
        return "Error fetching latest lesson.";
    }
}

async function getBriefingSummary() {
    try {
        const doc = await maya.getDoc();
        const sheet = doc.sheetsByTitle['📝 Lesson Logs'];
        const rows = await sheet.getRows();

        // Get lessons from the last 48 hours
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const recent = rows.filter(r => {
            const d = new Date(r.get('date'));
            return !isNaN(d) && d >= cutoff;
        });

        if (recent.length === 0) return 'No lessons logged in the last 48 hours.';

        const summaries = recent.map(r =>
            `${r.get('student_name')}: ${r.get('summary').substring(0, 80)}`
        ).join('\n');

        return `${recent.length} lesson(s) logged recently:\n${summaries}`;
    } catch (e) {
        return 'Golf data unavailable.';
    }
}

module.exports = { addStudentProfile, addLessonLog, getStudentHistory, summarizeLesson, getLatestLessonSummary, getBriefingSummary };
