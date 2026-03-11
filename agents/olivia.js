const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const cache = {};
const CACHE_DURATION = 5 * 60 * 1000;

function getCached(key) {
    const entry = cache[key];
    if (entry && (Date.now() - entry.time) < CACHE_DURATION) return entry.value;
    return null;
}

function setCache(key, value) {
    cache[key] = { value, time: Date.now() };
}

async function getBitcoinPrice() {
    const cached = getCached('btc');
    if (cached) return cached;
    console.log("Olivia: Starting Gemini call...");
    if (ctx) ctx.reply("🤔 Thinking of the perfect draft...");
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { timeout: 5000 });
        if (response.data && response.data.bitcoin) {
            const price = '$' + response.data.bitcoin.usd.toLocaleString();
            setCache('btc', price);
            return price;
        }
        return 'Price unavailable';
    } catch (e) { return 'Price unavailable'; }
}

async function getWeather(zip = '78732') {
    const cached = getCached('weather_' + zip);
    if (cached) return cached;
    console.log("Olivia: Starting Gemini call...");
    if (ctx) ctx.reply("🤔 Thinking of the perfect draft...");
    try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=30.37&longitude=-97.90&current_weather=true&temperature_unit=fahrenheit';
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data && response.data.current_weather) {
            const temp = Math.round(response.data.current_weather.temperature);
            return temp + '°F';
        }
        return 'Weather unavailable';
    } catch (e) { return 'Weather unavailable'; }
}

async function getAINews() {
    console.log("Olivia: Starting Gemini call...");
    if (ctx) ctx.reply("🤔 Thinking of the perfect draft...");
    try {
        const rssUrl = 'https://hnrss.org/frontpage?q=AI';
        const response = await axios.get(rssUrl, { timeout: 10000 });
        const xml = response.data;
        const prompt = 'Extract 3 AI highlights from: ' + xml.substring(0, 3000);
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) { return 'News unavailable'; }
}

async function performResearch(topic) {
    console.log("Olivia: Starting Gemini call...");
    if (ctx) ctx.reply("🤔 Thinking of the perfect draft...");
    try {
        const prompt = 'Research this for Mitchell: ' + topic;
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash', tools: [{ googleSearch: {} }] });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) { return 'Research error: ' + e.message; }
}

async function fetchSnapshot(zip = '78732') {
    const [btc, weather, news] = await Promise.all([getBitcoinPrice(), getWeather(zip), getAINews()]);
    return { btc, weather, news };
}

async function draftEmail(message, ctx = null) {
    const prompt = "You are Olivia, the Email Specialist for Mitchell, a PGA Professional. User Instruction: " + message + " Mitchell PGA Email: " + (process.env.PGA_EMAIL || '') + " TASK: 1. Extract recipient email. 2. Write subject. 3. Draft body. RETURN ONLY JSON: { \"to\": \"...\", \"subject\": \"...\", \"body\": \"...\" }";
    console.log("Olivia: Starting Gemini call...");
    if (ctx) ctx.reply("🤔 Thinking of the perfect draft...");
    try {
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/\`\`\`json|\`\`\`/g, '').trim();
        console.log("Olivia: Raw Gemini text:", text);
        console.log("Olivia: Parsed JSON successfully!");
        return JSON.parse(text);
    } catch (e) {
        console.error('Olivia Error:', e.message);
        return null;
    }
}

module.exports = { getBitcoinPrice, getWeather, getAINews, performResearch, fetchSnapshot, draftEmail };
