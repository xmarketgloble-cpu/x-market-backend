const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// Models Import
const User = require('./models/User'); 
const Transaction = require('./models/Transaction'); 

// index.js
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => { // ✨ '0.0.0.0' ဆိုတာ ပါမှ Networking ပွင့်တာပါ
    console.log(`🚀 Server running on port ${PORT}`);
});
// --- 🛡️ Professional Middlewares Setup ---

// ✅ CORS Configuration: Netlify URL အသစ်ကို အသေအချာ ခွင့်ပြုထားသည်
app.use(cors({
    origin: [
        "https://xmarket-pro-2026.netlify.app", // ✨ Updated Netlify Domain
        "http://localhost:5173",                // Local Development (Vite)
        "http://localhost:3000"                 // Local Development (CRA)
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 🗄️ MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => {
      console.error('❌ DB Connection Error:', err.message);
      process.exit(1); 
  });

// --- 📧 Email Setup (Mailtrap) ---
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 587,
    secure: false, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS 
    }
});

// OTP Storage (Memory Map)
const otpStore = new Map(); 

// --- 🎯 AUTH ROUTES ---

// ၁။ OTP ပို့ခြင်း
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // OTP ကို ၅ မိနစ် (300,000 ms) သိမ်းဆည်းထားမည်
    otpStore.set(email, { 
        code: otp, 
        expiresAt: Date.now() + 300000 
    });

    console.log(`📩 Sending OTP ${otp} to ${email}`);

    await transporter.sendMail({
      from: '"X Market Security" <security@xmarket.com>',
      to: email,
      subject: 'Your Verification Code - X Market',
      html: `
        <div style="font-family: sans-serif; padding: 20px; background-color: #f4f4f4;">
            <div style="max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 10px; border-top: 5px solid #EAB308; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #333; text-align: center;">Identity Verification</h2>
                <p style="color: #666; font-size: 16px; text-align: center;">Use the code below to complete your registration process.</p>
                <div style="background: #FFF9E6; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                    <h1 style="color: #EAB308; letter-spacing: 10px; margin: 0; font-size: 36px; font-weight: bold;">${otp}</h1>
                </div>
                <p style="font-size: 13px; color: #888; text-align: center;">This verification code is valid for 5 minutes only.</p>
            </div>
        </div>
      `
    });

    res.json({ message: 'OTP Sent Successfully!' });
  } catch (error) { 
    console.error("Email Error:", error);
    res.status(500).json({ message: 'Failed to send OTP', error: error.message }); 
  }
});

// ၂။ Register လုပ်ခြင်း
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    
    if (!email || !password || !otp) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const stored = otpStore.get(email);
    
    if (!stored || stored.code !== otp || stored.expiresAt < Date.now()) {
        return res.status(400).json({ message: 'Invalid or Expired OTP' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    
    otpStore.delete(email); 
    res.status(201).json({ message: 'Account Created Successfully!' });
  } catch (error) { 
    res.status(500).json({ message: 'Registration Failed', error: error.message }); 
  }
});

// ၃။ Login ဝင်ခြင်း
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ message: 'Invalid Credentials' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    
    const userObj = user.toObject();
    delete userObj.password;

    res.json({ token, user: userObj });
  } catch (error) { 
    res.status(500).json({ message: 'Login Failed', error: error.message }); 
  }
});

// Health Check API
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is healthy and CORS configured for xmarket-pro-2026',
        timestamp: new Date().toISOString()
    });
});

// Server Start
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Trusted Origin: https://xmarket-pro-2026.netlify.app`);
});