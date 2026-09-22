/**
 * Automated WhatsApp Web QR Bot (Render.com & Cloud Optimized)
 * -------------------------------------------------------------
 * 1. Generates a crisp, high-resolution QR Code webpage at /qr
 * 2. Persists login session in ./.wwebjs_auth so you scan ONCE only.
 * 3. Listens on /api/send-whatsapp for instant cloud sending.
 */

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
let currentQrDataUrl = null;

// Resolve Chrome Executable Path for Render.com Cloud Environment
let chromeExecutablePath = undefined;
try {
    chromeExecutablePath = puppeteer.executablePath();
    console.log('Detected Chrome Executable Path:', chromeExecutablePath);
} catch (e) {
    console.log('Using default Puppeteer Chrome launcher...');
}

// Initialize WhatsApp Web Client with Cloud-Friendly Puppeteer Flags
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "teacher-wa-bot"
    }),
    puppeteer: {
        headless: true,
        executablePath: chromeExecutablePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Event: QR Code generation
client.on('qr', async (qr) => {
    isReady = false;
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

// Event: Ready & Connected
client.on('ready', () => {
    isReady = true;
    currentQrDataUrl = null;
    console.log('\n=======================================================');
    console.log('🎉 WHATSAPP BOT IS CONNECTED AND READY!');
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log('=======================================================\n');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth failure:', msg);
});

client.on('disconnected', async (reason) => {
    isReady = false;
    currentQrDataUrl = null;
    console.warn('⚠️ Disconnected:', reason);
    try {
        await client.destroy();
    } catch (e) {}
    setTimeout(() => {
        client.initialize();
    }, 3000);
});

// Web Page Route to display high-resolution scannable QR Code
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
                    <p class="text-slate-300 text-sm mb-4">Your cloud bot is active 24/7 and ready to auto-send updates.</p>
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
                    <h1 class="text-xl font-bold text-amber-400 mb-2">Initializing Cloud Bot...</h1>
                    <p class="text-slate-300 text-sm">Please wait a few seconds while fresh QR code loads...</p>
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
            <meta http-equiv="refresh" content="15">
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

                <p class="text-[11px] text-amber-400 animate-pulse">Refreshes automatically for fresh QR code</p>
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
    res.json({ status: isReady ? 'online' : 'qr_waiting', service: 'WhatsApp QR Bot' });
});

app.listen(PORT, () => {
    console.log(`\n⏳ WhatsApp Bot starting on port ${PORT}... Open /qr to scan QR code.\n`);
    client.initialize();
});
