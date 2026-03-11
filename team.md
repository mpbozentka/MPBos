# 🚀 The AI Elite Team

This document outlines the specialized AI agents that power Mitchell's personal and professional life.

## 🧠 Rex: The Orchestrator
**Role**: Intake Coordinator & Intent Classifier
- **Responsibilities**: 
    - Analyzes every incoming message to determine the user's intent.
    - Decides which specialized agent should handle the request (e.g., Grocery vs. Research).
    - Manages complex calendar logic (identifying moves vs. new creations).
    - Acts as the central "Brain" for general queries by synthesizing data from the entire team.
- **Key Files**: `rex.js`
- **Relationships**: The entry point for the team. Delegates tasks to **Maya**, **Cal**, and **Olivia**.

---

## 🛒 Maya: The List Manager
**Role**: Task & Inventory Specialist
- **Responsibilities**: 
    - Maintains the "Truth" via Google Sheets for three critical lists:
        1. **Grocery List**: Tracking household needs.
        2. **Personal To-Do**: Managing life's tasks.
        3. **Professional To-Do**: Tracking work commitments.
    - Handles real-time addition and removal of items.
- **Key Files**: `maya.js`
- **Relationships**: Provides list data to **Rex** and **Brie**. Receives tasks from **Rex** and **Nolan**.

---

## 🗓 Cal: The Schedule Keeper
**Role**: Calendar Operations Manager
- **Responsibilities**: 
    - Manages multiple Google Calendars and external iCal feeds (e.g., iCloud).
    - Handles event creation, rescheduling, and status checks.
    - Provides access to Mitchell's booking pages for easy sharing.
- **Key Files**: `cal.js`
- **Relationships**: Provides scheduling intelligence to **Rex** and **Brie**. Receives scheduling directives from **Rex**.

---

## 🕵️‍♀️ Olivia: The Advanced Researcher
**Role**: Information Intelligence Specialist
- **Responsibilities**: 
    - Fetches live market data (Bitcoin price) and local weather conditions.
    - Monitors the web for the latest AI news and breakthroughs.
    - Performs deep-dive research reports on any complex topic.
- **Key Files**: `olivia.js`
- **Relationships**: Feeds real-time snapshots to **Brie**. Performs research deep-dives for **Rex**.

---

## 🕵️‍♂️ Nolan: The Overnight Intel Analyst
**Role**: Email & Intel Specialist
- **Responsibilities**: 
    - Runs the "Night Shift" by scanning Gmail for unread messages and important intel.
    - Extracts actionable items ("Intel Flags") from email snippets.
    - **Proactive**: Automatically adds work-related tasks discovered in email to **Maya's** professional list.
- **Key Files**: `nolan.js`
- **Relationships**: Reports overnight findings to **Brie**. Feeds task assignments to **Maya**.

---

## 🏎️ Mac: Golf Operations Specialist
**Role**: Student Performance & Instruction Manager
- **Responsibilities**: 
    - Manages detailed student profiles and technical progression notes.
    - Captures and summarizes detailed lesson logs (drills, feels, and swing changes).
    - Tracks equipment specifications and milestone achievements.
    - Provides instant intel on student history and current focus areas.
- **Key Files**: `mac.js`
- **Relationships**: Provides program status updates to **Brie**. Interacts deeply with **Maya** for data storage.

---

## ☕️ Brie: The Personal Concierge
**Role**: Briefing & Synthesis Specialist
- **Responsibilities**: 
    - Generates the **Elite Daily Briefing** every morning at 7:00 AM.
    - Pulls data from every single team member to create a unified view of Mitchell's day.
    - Formats the intelligence into a premium, easy-to-read Telegram layout.
- **Key Files**: `brie.js`
- **Relationships**: The ultimate synthesizer. Dependent on the entire team's data to function.

---

## 🔄 Interaction Flow
1. **Intake**: A message arrives at the **Rex** orchestrator.
2. **Delegation**: **Rex** classifies the intent and sends the "work order" to **Maya**, **Cal**, or **Olivia**.
3. **Action**: The specialist agent performs the task (e.g., **Maya** adds a task, **Cal** books a meeting).
4. **Briefing**: At 7:00 AM, **Brie** wakes up the whole team to gather the morning briefing.
5. **Insights**: **Nolan** and **Mac** provide specialized intel that is woven into the briefing.
