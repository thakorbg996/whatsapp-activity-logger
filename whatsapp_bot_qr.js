/**
 * Automated WhatsApp Web QR Bot (Render.com & Cloud Optimized)
 * -------------------------------------------------------------
 * 1. Generates a crisp, high-resolution QR Code webpage at /qr
 * 2. Persists login session in ./.wwebjs_auth so you scan ONCE only.
 * 3. Listens on /api/send-whatsapp for instant cloud sending.
 */

const path = require('path');
const fs = require('fs');

// Set PUPPETEER_CACHE_DIR to ./.cache so Puppeteer resolves local Chrome at runtime
process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || path.join(__dirname, '.cache');

const express = require('express');
const cors = require('cors');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let isReady = false;
let isAuthenticated = false;
let loadingMessage = "Initializing WhatsApp Web...";
let currentQrDataUrl = null;

// Resolve Chrome Executable Path safely for Render.com Cloud Environment
let chromeExecutablePath = undefined;
try {
    const detectedPath = puppeteer.executablePath();
    if (detectedPath && fs.existsSync(detectedPath)) {
        chromeExecutablePath = detectedPath;
        console.log('✅ Found verified Chrome Executable Path:', chromeExecutablePath);
    } else {
        const localCacheChrome = path.join(__dirname, '.cache', 'chrome', 'linux-146.0.7680.31', 'chrome-linux64', 'chrome');
        if (fs.existsSync(localCacheChrome)) {
            chromeExecutablePath = localCacheChrome;
            console.log('✅ Found Chrome in local ./.cache:', chromeExecutablePath);
        }
    }
} catch (e) {
    console.log('Using default Puppeteer Chrome launcher...');
}

// Initialize WhatsApp Web Client with memory-optimized Puppeteer Flags
const puppeteerOptions = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--js-flags="--max-old-space-size=4096"'
    ]
};

if (chromeExecutablePath) {
    puppeteerOptions.executablePath = chromeExecutablePath;
}

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "teacher-wa-bot"
    }),
    puppeteer: puppeteerOptions
});

// Event: QR Code generation
client.on('qr', async (qr) => {
    isReady = false;
    isAuthenticated = false;
    loadingMessage = "Waiting for QR scan...";
    console.log('\n=======================================================');
    console.log('📱 NEW QR CODE GENERATED!');
    console.log('   Open /qr in your browser to scan QR code...');
    console.log('=======================================================\n');

    qrcodeTerminal.generate(qr, { small: true });

    try {
        currentQrDataUrl = await QRCode.toDataURL(qr, {
            width: 400,
            margin: 2,
            color: {
                dark: '#075E54',
                light: '#FFFFFF'
            }
        });
    } catch (err) {
        console.error('Failed to generate DataURL QR:', err);
    }
});

// Event: Authenticated (QR code scanned successfully!)
client.on('authenticated', () => {
    isAuthenticated = true;
    currentQrDataUrl = null;
    loadingMessage = "Authenticated! Syncing WhatsApp Web data...";
    console.log('\n🔑 AUTHENTICATED SUCCESSFULLY! Loading chats...\n');
});

// Event: Loading screen progress
client.on('loading_screen', (percent, message) => {
    loadingMessage = `Loading WhatsApp Web: ${percent}% - ${message}`;
    console.log(`⏳ ${loadingMessage}`);
});

// Event: Ready & Connected
client.on('ready', () => {
    isReady = true;
    isAuthenticated = true;
    currentQrDataUrl = null;
    loadingMessage = "Connected and Ready!";
    console.log('\n=======================================================');
    console.log('🎉 WHATSAPP BOT IS CONNECTED AND READY!');
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log('=======================================================\n');
});

client.on('auth_failure', (msg) => {
    isReady = false;
    isAuthenticated = false;
    loadingMessage = `Authentication failed: ${msg}`;
    console.error('❌ Auth failure:', msg);
});

client.on('disconnected', async (reason) => {
    isReady = false;
    isAuthenticated = false;
    currentQrDataUrl = null;
    loadingMessage = `Disconnected: ${reason}`;
    console.warn('⚠️ Disconnected:', reason);
    try {
        await client.destroy();
    } catch (e) {}
    setTimeout(() => {
        client.initialize();
    }, 4000);
});

// Root Route Handler - Redirects automatically to /qr
app.get('/', (req, res) => {
    res.redirect('/qr');
});

// Web Page Route to display high-resolution scannable QR Code & real-time connection status
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot - Connected</title>
                <meta http-equiv="refresh" content="5">
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-slate-900 text-white flex items-center justify-center min-h-screen font-sans p-4">
                <div class="bg-slate-800 p-8 rounded-3xl shadow-2xl text-center max-w-md border border-emerald-500/30">
                    <div class="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl">✓</div>
                    <h1 class="text-2xl font-bold text-emerald-400 mb-2">WhatsApp Bot Connected!</h1>
                    <p class="text-slate-300 text-sm mb-4">Your cloud bot is 100% active and ready to auto-send updates.</p>
                    <p class="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl font-mono">You can close this tab and return to index.html!</p>
                </div>
            </body>
            </html>
        `);
    }

    if (isAuthenticated) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot - Syncing</title>
                <meta http-equiv="refresh" content="3">
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-slate-900 text-white flex items-center justify-center min-h-screen font-sans p-4">
                <div class="bg-slate-800 p-8 rounded-3xl shadow-2xl text-center max-w-md border border-amber-500/30">
                    <div class="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h1 class="text-xl font-bold text-amber-400 mb-2">QR Code Scanned Successfully!</h1>
                    <p class="text-slate-300 text-sm mb-3">${loadingMessage}</p>
                    <p class="text-xs text-slate-400">Syncing WhatsApp Web session... Please wait 5–10 seconds.</p>
                </div>
            </body>
            </html>
        `);
    }

    if (!currentQrDataUrl) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot - Initializing</title>
                <meta http-equiv="refresh" content="3">
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-slate-900 text-white flex items-center justify-center min-h-screen font-sans p-4">
                <div class="bg-slate-800 p-8 rounded-3xl shadow-2xl text-center max-w-md">
                    <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <h1 class="text-xl font-bold text-slate-200 mb-2">Initializing Cloud Bot...</h1>
                    <p class="text-slate-400 text-xs">${loadingMessage}</p>
                </div>
            </body>
            </html>
        `);
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Scan WhatsApp QR Code</title>
            <meta http-equiv="refresh" content="10">
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-950 text-white flex items-center justify-center min-h-screen font-sans p-4">
            <div class="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl text-center max-w-md w-full">
                <div class="inline-block bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                    Render Cloud WhatsApp Bot Scan
                </div>
                <h1 class="text-xl font-bold mb-1 text-slate-100">Scan QR Code</h1>
                <p class="text-xs text-slate-400 mb-5">Open WhatsApp → Menu/Settings → Linked Devices → Link a Device</p>
                
                <div class="bg-white p-4 rounded-2xl inline-block shadow-xl border-4 border-emerald-500 mb-4">
                    <img src="${currentQrDataUrl}" alt="WhatsApp QR Code" class="w-72 h-72 mx-auto">
                </div>

                <p class="text-[11px] text-amber-400 animate-pulse">Page refreshes automatically once scanned</p>
            </div>
        </body>
        </html>
    `);
});

// API Endpoint to send WhatsApp update
app.post('/api/send-whatsapp', async (req, res) => {
    const { targetNumber, messageText } = req.body;

    if (!targetNumber || !messageText) {
        return res.status(400).json({ success: false, error: 'Target phone number and message text required.' });
    }

    if (!isReady) {
        return res.status(503).json({ success: false, error: 'Bot is initializing or waiting for QR scan at /qr' });
    }

    try {
        let cleanNumber = targetNumber.replace(/[^\d]/g, '');
        if (cleanNumber.length === 10) cleanNumber = '91' + cleanNumber;

        const chatId = `${cleanNumber}@c.us`;
        const response = await client.sendMessage(chatId, messageText);

        return res.json({
            success: true,
            status: `Message delivered automatically to ${cleanNumber}!`,
            messageId: response.id._serialized
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Failed to send message.' });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ status: isReady ? 'online' : (isAuthenticated ? 'syncing' : 'qr_waiting'), service: 'WhatsApp QR Bot' });
});

app.listen(PORT, () => {
    console.log(`\n⏳ WhatsApp Bot starting on port ${PORT}... Open /qr to scan QR code.\n`);
    client.initialize();
});
