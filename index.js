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

// ✅ App initialization
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'crypto_x_secret_2026';

// --- 🛡️ Allowed Origins List ---
const allowedOrigins = [
    "https://xmarket-pro-2026.netlify.app",
    "https://xmarket-pro-2026.netlify.app/",
    "http://localhost:5173",
    "http://localhost:3000"
];

// --- 🛡️ Professional CORS Configuration ---
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`❌ CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    optionsSuccessStatus: 200
}));

// ✅ Handle preflight requests explicitly
app.options('*', cors());

// --- 🛡️ Other Middlewares ---
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 📝 Request Logger (Optional but professional) ---
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
});

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

// --- 🗃️ OTP Store (In-memory cache) ---
const otpStore = new Map(); 

// --- 🧹 Clean expired OTPs every 5 minutes ---
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (data.expiresAt < now) {
            otpStore.delete(email);
            console.log(`🗑️ Expired OTP cleaned for: ${email}`);
        }
    }
}, 300000); // 5 minutes

// ============================================
// 🎯 AUTH ROUTES
// ============================================

// --- 📤 Send OTP ---
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
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
    console.error("❌ Email Error:", error);
    res.status(500).json({ message: 'Failed to send OTP', error: error.message }); 
  }
});

// --- 📝 Register User ---
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    if (!email || !password || !otp) return res.status(400).json({ message: 'All fields are required' });

    const stored = otpStore.get(email);
    if (!stored || stored.code !== otp || stored.expiresAt < Date.now()) {
        return res.status(400).json({ message: 'Invalid or Expired OTP' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    
    otpStore.delete(email); 
    res.status(201).json({ message: 'Account Created Successfully!' });
  } catch (error) { 
    console.error("❌ Register Error:", error);
    res.status(500).json({ message: 'Registration Failed', error: error.message }); 
  }
});

// --- 🔐 Login User ---
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
    console.error("❌ Login Error:", error);
    res.status(500).json({ message: 'Login Failed', error: error.message }); 
  }
});

// --- ❤️ Health Check Endpoint ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// --- 🧪 CORS Test Endpoint ---
app.options('/api/test-cors', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
});

app.get('/api/test-cors', (req, res) => {
    res.json({ message: 'CORS is working!', origin: req.headers.origin });
});

// ============================================
// 🚀 START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Trusted Origins: ${allowedOrigins.join(', ')}`);
});