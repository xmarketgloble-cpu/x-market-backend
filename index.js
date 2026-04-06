const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');

dotenv.config();

const User = require('./models/User'); 
const Transaction = require('./models/Transaction'); 

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'crypto_x_secret_2026';

// --- 🛡️ Middlewares ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 🗄️ MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ DB Error:', err));

// --- 📧 Email Setup (Mailtrap) ---
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 587,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS 
    }
});

const otpStore = new Map(); 

// --- 🎯 AUTH ROUTES ---

// ၁။ OTP ပို့ခြင်း
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { code: otp, expiresAt: Date.now() + 300000 });

    await transporter.sendMail({
      from: '"X Market Security" <security@xmarket.com>',
      to: email,
      subject: 'Verification Code',
      html: `<h3>Your code is: <b style="color: #EAB308;">${otp}</b></h3>`
    });
    res.json({ message: 'OTP Sent Successfully!' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ၂။ Register လုပ်ခြင်း
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    const stored = otpStore.get(email);
    
    if (!stored || stored.code !== otp || stored.expiresAt < Date.now()) {
        return res.status(400).json({ message: 'Invalid or Expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    
    otpStore.delete(email);
    res.status(201).json({ message: 'Account Created Successfully!' });
  } catch (error) { res.status(500).json({ error: error.message }); }
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
    res.json({ token, user });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));