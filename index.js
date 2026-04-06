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

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'crypto_x_secret_2026';

// --- 🛡️ Professional Middlewares Setup ---

// ✅ CORS ကို အသေအချာ သတ်မှတ်ခြင်း (Netlify URL ကို ခွင့်ပြုရန်)
app.use(cors({
    origin: [
        "https://monumental-frangipane-d8ba7a.netlify.app", // မင်းရဲ့ Netlify Frontend URL
        "http://localhost:5173", // Local React (Vite) အတွက်
        "http://localhost:3000"  // Local React (CRA) အတွက်
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
      process.exit(1); // DB မချိတ်မိရင် ဆာဗာကို ပိတ်လိုက်ရန်
  });

// --- 📧 Email Setup (Mailtrap) ---
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 587,
    secure: false, // port 587 အတွက် false ထားရပါမည်
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS 
    }
});

// OTP ယာယီသိမ်းဆည်းရန် Map
const otpStore = new Map(); 

// --- 🎯 AUTH ROUTES ---

// ၁။ OTP ပို့ခြင်း
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // OTP ကို ၅ မိနစ်စာ သိမ်းဆည်းခြင်း
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
            <div style="max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 10px;">
                <h2 style="color: #333;">Verification Code</h2>
                <p>Use the following code to complete your registration:</p>
                <h1 style="color: #EAB308; letter-spacing: 5px; text-align: center;">${otp}</h1>
                <p style="font-size: 12px; color: #888;">This code will expire in 5 minutes.</p>
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
    
    // Validation
    if (!email || !password || !otp) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const stored = otpStore.get(email);
    
    if (!stored || stored.code !== otp || stored.expiresAt < Date.now()) {
        return res.status(400).json({ message: 'Invalid or Expired OTP' });
    }

    // အီးမေးလ် ရှိပြီးသားလား စစ်ဆေးခြင်း
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    
    otpStore.delete(email); // OTP ကို ပြန်ဖျက်ခြင်း
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
    
    // Password ကို response ထဲမှာ ပြန်မပို့ရန်
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
        message: 'Server is healthy and CORS is configured',
        timestamp: new Date().toISOString()
    });
});

// Server Start
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Configured for Netlify Origin: https://monumental-frangipane-d8ba7a.netlify.app`);
});