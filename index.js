const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Fix - Netlify နဲ့ ချိတ်ဆက်ဖို့ အရေးကြီးဆုံးအပိုင်း
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ DB Error:', err));

// Mailtrap Setup
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 587,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running perfectly!' });
});

app.post('/api/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        await transporter.sendMail({
            from: '"X Market" <security@xmarket.com>',
            to: email,
            subject: "Your Verification Code",
            text: `Your OTP code is ${otp}`
        });

        res.json({ message: 'OTP sent successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server started on port ${PORT}`);
});