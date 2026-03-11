const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const ical = require('node-ical');
const axios = require('axios');

// Initialize auth
const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth: serviceAccountAuth });
const calendarIds = (process.env.GOOGLE_CALENDAR_IDS || process.env.GOOGLE_CALENDAR_ID || 'primary').split(',').map(id => id.trim());

// Robust iCal URL cleaner: removes quotes, whitespace, and handles multi-line env vars
const rawIcalUrls = process.env.ICAL_URLS || '';
const icalUrls = rawIcalUrls
    .split(',')
    .map(url => url.replace(/["']/g, '').trim())
    .filter(url => url.length > 10 && (url.startsWith('http') || url.startsWith('webcal')));

function formatToCST(dateInput) {
    if (!dateInput) return 'Unknown';
    return new Date(dateInput).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

async function addEvent(summary, startTime, endTime, description = '') {
    try {
        const event = {
            summary: summary,
            description: description,
            start: { dateTime: startTime, timeZone: 'America/Chicago' },
            end: { dateTime: endTime, timeZone: 'America/Chicago' },
        };
        const response = await calendar.events.insert({
            calendarId: calendarIds[0],
            resource: event,
        });
        console.log('Event created: %s', response.data.htmlLink);
        return true;
    } catch (error) {
        console.error('Error adding calendar event:', error);
        return false;
    }
}

async function updateEvent(calendarId, eventId, updates) {
    try {
        const resource = {
            summary: updates.summary,
            start: { dateTime: updates.start, timeZone: 'America/Chicago' },
            end: { dateTime: updates.end, timeZone: 'America/Chicago' }
        };

        const response = await calendar.events.patch({
            calendarId: calendarId,
            eventId: eventId,
            resource: resource,
        });
        console.log('Event updated: %s', response.data.htmlLink);
        return true;
    } catch (error) {
        console.error('Error updating calendar event:', error);
        return false;
    }
}

async function fetchIcalEvents() {
    const events = [];
    const now = new Date();
    for (let url of icalUrls) {
        try {
            url = url.replace('webcal://', 'https://');
            if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            const response = await axios.get(url, { timeout: 10000 });
            const data = ical.parseICS(response.data);

            for (let k in data) {
                if (data.hasOwnProperty(k)) {
                    const ev = data[k];
                    if (ev.type === 'VEVENT') {
                        const start = new Date(ev.start);
                        const end = ev.end ? new Date(ev.end) : null;

                        if ((end && end >= now) || (start >= now)) {
                            events.push({
                                summary: ev.summary,
                                startRaw: start.toISOString(),
                                start: formatToCST(start.toISOString()),
                                calendarName: 'iCalendar Feed',
                                id: null,
                                calendarId: 'ical'
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`❌ iCal Error [${url}]:`, error.message);
        }
    }
    return events;
}

async function listUpcomingEvents(maxResults = 20) {
    try {
        const allEvents = [];
        for (const calendarId of calendarIds) {
            try {
                const response = await calendar.events.list({
                    calendarId: calendarId,
                    timeMin: new Date().toISOString(),
                    timeZone: 'America/Chicago',
                    maxResults: maxResults,
                    singleEvents: true,
                    orderBy: 'startTime',
                });
                if (response.data.items) {
                    allEvents.push(...response.data.items.map(event => ({
                        id: event.id,
                        summary: event.summary || '(No title)',
                        startRaw: event.start.dateTime || event.start.date,
                        start: formatToCST(event.start.dateTime || event.start.date),
                        end: event.end?.dateTime || event.end?.date || null,
                        calendarName: calendarId,
                        calendarId: calendarId
                    })));
                }
            } catch (e) {
                console.error(`Warning: Could not fetch Google Calendar ${calendarId}:`, e.message);
            }
        }
        const icalEvents = await fetchIcalEvents();
        allEvents.push(...icalEvents);

        return allEvents
            .sort((a, b) => new Date(a.startRaw || a.start) - new Date(b.startRaw || b.start))
            .slice(0, maxResults);
    } catch (error) {
        console.error('Error listing calendar events:', error);
        return [];
    }
}

async function deleteEvent(calendarId, eventId) {
    try {
        await calendar.events.delete({ calendarId, eventId });
        console.log(`Event ${eventId} deleted from ${calendarId}`);
        return true;
    } catch (error) {
        console.error('Error deleting event:', error.message);
        return false;
    }
}

async function checkConflicts(startTime, endTime) {
    const events = await listUpcomingEvents(50);
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    return events.filter(e => {
        const eStart = new Date(e.startRaw || e.start);
        const eEnd = e.end ? new Date(e.end) : new Date(eStart.getTime() + 3600000);
        return (newStart < eEnd && newEnd > eStart);
    });
}

function getBookingPages() {
    return (process.env.GOOGLE_BOOKING_PAGES || '').split(',').map(p => p.trim()).filter(p => p !== '');
}

module.exports = { addEvent, updateEvent, listUpcomingEvents, deleteEvent, checkConflicts, getBookingPages };
