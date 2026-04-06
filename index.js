const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS - ဘယ် Website ကလာလာ လက်ခံမယ်
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());
app.use(cors());

// Mailer
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 587,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.post('/api/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'X Market OTP',
            text: `Your OTP is ${otp}`
        });
        res.json({ message: 'Verification code sent!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on ${PORT}`));