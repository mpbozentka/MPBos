require('dotenv').config();
const rex = require('./agents/rex');

const testCases = [
    // Quick Check
    "What is the price of Bitcoin?",
    "What's the weather in Austin right now?",
    "Price of Ethereum?",
    
    // Research
    "Research the latest trends in golf swing analytics.",
    "Look up the best drills for fixing a slice.",
    "Tell me about the history of the PGA.",
    
    // Calendar Event
    "Schedule a lesson with Liam Hyde for tomorrow at 2 PM.",
    "Move my 3 PM meeting to 4 PM.",
    "Cancel my 10 AM lesson on Friday.",
    "Book a flight to Orlando for next month.",
    
    // Grocery
    "Add milk and eggs to my grocery list.",
    "I need to buy some golf balls.",
    "Put bread on the shopping list.",
    
    // Personal Task
    "Remind me to call my mom at 6 PM.",
    "I need to fix the fence this weekend.",
    "Pick up the dry cleaning tomorrow.",
    
    // Professional Task
    "Finish the quarterly report by Friday.",
    "Remind me to send the invoice to the club.",
    "Prepare the presentation for the board meeting.",
    
    // Student Management
    "Add Sarah Jenkins as a new student. She's a beginner.",
    "Log a lesson for Paul: worked on his putting today.",
    "Update notes for Liam: his swing path is improving.",
    
    // Student Query
    "What's the history of lessons for Mitchell Bozentka?",
    "Show me the last lesson notes for Sarah Jenkins.",
    "How has Liam's progress been lately?",
    
    // Send Email
    "Draft an email to Paul Bozentka welcoming him to the program.",
    "Send an email to Mitchell letting him know I'll be late.",
    "Draft a follow-up email for Sarah's last lesson.",
    
    // Query
    "Show me my grocery list.",
    "What are my tasks for today?",
    "What's on my schedule for next Monday?"
];

async function runAudit() {
    console.log("🚀 Starting Full Category Audit (30 Tests)...\n");
    let passed = 0;
    
    for (let i = 0; i < testCases.length; i++) {
        const msg = testCases[i];
        try {
            const result = await rex.classifyIntent(msg);
            console.log(`[${i+1}/30] Message: "${msg}"`);
            console.log(`      Categorized as: ${result.category} (Conf: ${result.confidence})\n`);
            passed++;
        } catch (e) {
            console.error(`[${i+1}/30] FAILED: "${msg}" - Error: ${e.message}\n`);
        }
    }
    
    console.log(`\n✅ Audit Complete. ${passed}/30 tests processed.`);
}

runAudit();
