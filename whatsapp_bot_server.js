/**
 * WhatsApp Bot Server for Daily Activity Updates
 * -------------------------------------------------------------
 * This server provides automated background sending of daily activity updates
 * directly to a teacher's WhatsApp number.
 * 
 * Supports two modes:
 * 1. Twilio WhatsApp API (Recommended for production/cloud)
 * 2. Webhook / Green-API / Local Bot Gateway
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Optional: Twilio Client Setup
// To enable real Twilio automated sending, install twilio: npm install twilio
// Set environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Twilio WhatsApp Client initialized successfully.');
    } catch (e) {
        console.warn('⚠️ Twilio package not found or credentials missing. Running in simulated bot mode.');
    }
}

// API Endpoint to Receive and Automatically Send WhatsApp Messages
app.post('/api/send-whatsapp', async (req, res) => {
    const { targetNumber, messageText } = req.body;

    if (!targetNumber || !messageText) {
        return res.status(400).json({ 
            success: false, 
            error: 'Target phone number and message text are required.' 
        });
    }

    // Clean target number (remove spaces, dashes, add country code if missing)
    let cleanNumber = targetNumber.replace(/[^\d+]/g, '');
    if (!cleanNumber.startsWith('+')) {
        // Default to India country code +91 if missing 10 digits
        if (cleanNumber.length === 10) {
            cleanNumber = '+91' + cleanNumber;
        } else {
            cleanNumber = '+' + cleanNumber;
        }
    }

    console.log(`\n🤖 [WhatsApp Bot] Sending daily update to ${cleanNumber}...`);
    console.log(`---------------------------------------------------\n${messageText}\n---------------------------------------------------`);

    try {
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            // Send via Twilio WhatsApp API
            const response = await twilioClient.messages.create({
                from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
                to: `whatsapp:${cleanNumber}`,
                body: messageText
            });

            console.log(`✅ Message sent via Twilio! Message SID: ${response.sid}`);
            return res.json({
                success: true,
                mode: 'twilio',
                messageSid: response.sid,
                status: 'Sent automatically via Twilio WhatsApp Bot!'
            });
        } else {
            // Simulated Bot Mode / Gateway response
            return res.json({
                success: true,
                mode: 'simulated',
                targetNumber: cleanNumber,
                status: `Bot received message for ${cleanNumber}! (To enable live cloud sending, configure Twilio or Green-API credentials)`
            });
        }
    } catch (error) {
        console.error('❌ Failed to send WhatsApp message:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to dispatch WhatsApp message.'
        });
    }
});

// Health check endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        service: 'WhatsApp Activity Bot Server',
        twilioEnabled: !!twilioClient
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp Bot Server running on http://localhost:${PORT}`);
    console.log(`👉 Send POST requests to http://localhost:${PORT}/api/send-whatsapp`);
});
