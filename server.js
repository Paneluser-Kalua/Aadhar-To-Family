const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Key Database
const activeKeys = {};

// Upstream fetch helper
async function fetchUpstream(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        }
    });

    const textData = await response.text();
    if (textData.trim().startsWith('<!DOCTYPE') || textData.trim().startsWith('<html')) {
        throw new Error("Upstream returned HTML response");
    }

    try {
        return JSON.parse(textData);
    } catch (e) {
        return textData;
    }
}

const sendSuccess = (res, data) => {
    return res.json({
        "powered by": "KaluaApiAdmin",
        "channel": "KaluaApiStore",
        "status": "success",
        "data": data
    });
};

const sendError = (res, details = "Service failure") => {
    return res.status(500).json({
        "powered by": "KaluaApiAdmin",
        "channel": "KaluaApiStore",
        "status": "error",
        "message": "pls purchase premium on KaluaApi Store",
        "details": details
    });
};

// Generate API Key Endpoint
app.post('/api/generate-key', (req, res) => {
    const { username, days } = req.body;
    const numDays = parseInt(days) || 3;
    const userTag = (username || 'USER').slice(0, 6).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    
    const apiKey = `KALUA-FAM-${numDays}D-${userTag}-${rand}`;
    const expiryTime = Date.now() + (numDays * 24 * 60 * 60 * 1000);
    
    activeKeys[apiKey] = {
        user: username || 'USER',
        expiresAt: expiryTime,
        days: numDays
    };

    return res.json({ status: "success", key: apiKey });
});

// Admin: List Keys
app.post('/api/admin/list-keys', (req, res) => {
    const { adminPass } = req.body;
    if (adminPass !== "KaluaApiStore") {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    const keyList = Object.keys(activeKeys).map(k => ({
        key: k,
        user: activeKeys[k].user,
        days: activeKeys[k].days,
        expiresAt: activeKeys[k].expiresAt
    }));

    return res.json({ status: "success", keys: keyList });
});

// Admin: Revoke Key
app.post('/api/admin/delete-key', (req, res) => {
    const { adminPass, key } = req.body;
    if (adminPass !== "KaluaApiStore") {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    if (activeKeys[key]) {
        delete activeKeys[key];
    }
    return res.json({ status: "success", message: "Key revoked successfully" });
});

// Aadhaar Family API Endpoint with Key Verification
app.get('/api/family-info/:key', async (req, res) => {
    const key = req.params.key;
    const num = req.query.num || req.query.aadhaar || req.query.q;

    if (!activeKeys[key] || Date.now() > activeKeys[key].expiresAt) {
        return res.status(403).json({
            "powered by": "KaluaApiAdmin",
            "channel": "KaluaApiStore",
            "status": "error",
            "message": "pls purchase premium on KaluaApi Store"
        });
    }

    if (!num) {
        return res.status(400).json({
            "powered by": "KaluaApiAdmin",
            "channel": "KaluaApiStore",
            "status": "error",
            "message": "Aadhaar / Number is required (?num=)"
        });
    }

    try {
        const upstreamUrl = `https://api.allprinthub.in/api?=adhaar_to_family&key=3day&num=${encodeURIComponent(num)}`;
        const data = await fetchUpstream(upstreamUrl);
        return sendSuccess(res, data);
    } catch (err) {
        return sendError(res, err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Aadhaar Family API Hub running on port ${PORT}`);
});
