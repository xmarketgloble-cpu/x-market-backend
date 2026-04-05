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

// 🔥 Professional Packages 
const helmet = require('helmet'); // HTTP Headers လုံခြုံရေး
const morgan = require('morgan'); // API logging
const rateLimit = require('express-rate-limit'); // DDOS Protection

dotenv.config();

const User = require('./models/User'); 
const Transaction = require('./models/Transaction'); 

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'crypto_x_secret_2026';

// --- 🛡️ Professional Middlewares & CORS Setup ---

const corsOptions = {
    origin: [
        "https://monumental-frangipane-d8ba7a.netlify.app", 
        "http://localhost:5173"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 🚀 CRITICAL FIX: Path-to-RegExp error မတက်အောင် wildcard ကို စနစ်တကျ ပြောင်းလဲထားပါတယ်
// Node.js v22+ မှာ app.options('*') ထက် app.use(cors()) က ပိုစိတ်ချရပါတယ်
app.options('*', cors(corsOptions)); 

app.use(express.json({ limit: '10mb' })); 
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan('dev'));

// 🚦 Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: { message: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/login', apiLimiter); 
app.use('/api/register', apiLimiter);

// Static Folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 📂 Multer Setup ---
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Error: Images Only (JPEG/JPG/PNG/WEBP)!'));
    }
});

// --- 🗄️ MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crypto_exchange';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => {
      console.error('❌ MongoDB Connection Error:', err.message);
      process.exit(1); 
  });

// --- 🔐 Auth Middleware ---
const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid or has expired' });
  }
};

// --- 📧 Email OTP System Setup ---

// 🚀 OTP သိမ်းဆည်းရန် Store ကို define လုပ်လိုက်ပါပြီ
const otpStore = new Map(); 

const transporter = nodemailer.createTransport({
  service: 'hotmail', // Outlook/Hotmail အတွက်
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS 
  }
});

// Server တက်လာပြီးမှ Email စနစ်ကို စစ်ဆေးခိုင်းခြင်း
setTimeout(() => {
    transporter.verify((error, success) => {
        if (error) {
            console.log("❌ Email Verification Error:", error.message);
        } else {
            console.log("📧 Email System is ready (Outlook IPv4 Verified)");
        }
    });
}, 5000);

// --- AUTH ROUTES ---

app.post('/api/send-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Need Email' });
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Account Already exists' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, otp); 

    const mailOptions = {
      from: `"X Market Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'X Market - Verification Code',
      html: `<div style="font-family: Arial, sans-serif; padding: 30px; background-color: #0B0E11; color: #ffffff; border-radius: 12px; max-width: 500px; margin: auto; border: 1px solid #2B3139;">
          <h2 style="color: #EAB308; text-align: center;">X Market Registration</h2>
          <p>Your verification code is:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #1E2329; padding: 15px 25px; border-radius: 8px; color: #ffffff;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #666; text-align: center;">This code will expire shortly. Do not share it with anyone.</p>
        </div>`
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP Successfully sent to: ${email}`);
    res.json({ message: 'Verification code sent!' });
  } catch (error) { 
    console.error("🔥 OTP Send Error:", error);
    next(error); 
  }
});

app.post('/api/register', async (req, res, next) => {
  try {
    const { email, password, otp } = req.body;
    const storedOtp = otpStore.get(email);
    if (!storedOtp || storedOtp !== otp) return res.status(400).json({ message: 'Wrong Code' });

    const hashedPassword = await bcrypt.hash(password, 12); 
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    otpStore.delete(email); 
    res.status(201).json({ message: 'Create Account Successful' });
  } catch (err) { next(err); }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' }); 

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ 
      token, 
      user: { 
        email: user.email, 
        balance: user.balance, 
        isVerified: user.isVerified, 
        role: user.role, 
        profilePic: user.profilePic,
        holdings: user.holdings,
        kycDetails: user.kycDetails 
      } 
    });
  } catch (err) { next(err); }
});

app.get('/api/user/me', authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('-password'); 
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) { next(err); }
});

// --- 👮 KYC & PROFILE ROUTES ---

app.post('/api/user/upload-profile', authMiddleware, upload.single('profilePic'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        const user = await User.findById(req.userId);
        user.profilePic = `/uploads/${req.file.filename}`;
        await user.save();
        res.json({ message: 'Profile photo updated', profilePic: user.profilePic });
    } catch (err) { next(err); }
});

app.post('/api/user/submit-kyc', authMiddleware, upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 } 
]), async (req, res, next) => {
    try {
        const { fullName, idNumber, dob, phoneNumber, gender, address } = req.body; 
        if (!req.files || !req.files['idFront'] || !req.files['idBack'] || !req.files['selfie']) {
            return res.status(400).json({ message: 'All documents are required' });
        }
        const user = await User.findById(req.userId);
        user.kycDetails = {
            fullName, idNumber, dob, phoneNumber, gender, address,
            idCardImage: `/uploads/${req.files['idFront'][0].filename}`,
            idBackImage: `/uploads/${req.files['idBack'][0].filename}`,
            selfieImage: `/uploads/${req.files['selfie'][0].filename}`
        };
        user.isVerified = 'Pending'; 
        await user.save();
        res.json({ message: 'Verification details submitted for review!', status: 'Pending' });
    } catch (err) { next(err); }
});

// --- 👑 ADMIN CONTROL ROUTES ---

app.get('/api/admin/pending-users', authMiddleware, async (req, res, next) => {
    try {
        const adminAccount = await User.findById(req.userId);
        if (adminAccount.role !== 'admin') return res.status(403).json({ message: 'Access Denied: Admin only' });
        const pendingUsers = await User.find({ isVerified: 'Pending' }).select('-password');
        res.json(pendingUsers);
    } catch (err) { next(err); }
});

app.post('/api/admin/verify-user', authMiddleware, async (req, res, next) => {
    try {
        const { userId, status, reason } = req.body; 
        if (!['Verified', 'Unverified'].includes(status)) return res.status(400).json({ message: 'Invalid status type' });

        const adminAccount = await User.findById(req.userId);
        if (adminAccount.role !== 'admin') return res.status(403).json({ message: 'Access Denied: Admin only' });
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isVerified = status;
        user.kycDetails.reviewedBy = adminAccount.email; 
        user.kycDetails.reviewDate = new Date(); 
        user.kycDetails.rejectReason = status === 'Unverified' ? (reason || "Document mismatch") : "";

        await user.save();

        const mailOptions = {
            from: `"X Market Compliance" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `Identity Verification ${status}`,
            html: `<div style="font-family: Arial, sans-serif; padding: 25px; background-color: #0B0E11; color: #ffffff; border-radius: 12px; border: 1px solid #2B3139;">
                    <h2 style="color: ${status === 'Verified' ? '#22c55e' : '#ef4444'};">KYC Status Updated</h2>
                    <p>Your account verification has been <b>${status.toUpperCase()}</b>.</p>
                    ${status === 'Unverified' ? `<p style="background: #1E2329; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;"><b>Reason:</b> ${user.kycDetails.rejectReason}</p>` : '<p>You can now access all trading features.</p>'}
                </div>`
        };
        transporter.sendMail(mailOptions).catch(err => console.error("Email error:", err));

        res.json({ message: `User identity ${status}`, status: user.isVerified });
    } catch (err) { next(err); }
});

// --- 💰 TRADING ROUTES ---

app.post('/api/buy-coin', authMiddleware, async (req, res, next) => {
  try {
    const { coinId, amount, pricePerCoin } = req.body;
    const totalCost = parseFloat(amount);
    const user = await User.findById(req.userId);
    
    if (user.balance < totalCost) return res.status(400).json({ message: 'Insufficient Balance' });
    
    const coinAmount = totalCost / pricePerCoin;
    user.balance -= totalCost;
    
    const holdingIndex = user.holdings.findIndex(h => h.coinId === coinId);
    if (holdingIndex > -1) user.holdings[holdingIndex].amount += coinAmount;
    else user.holdings.push({ coinId, amount: coinAmount });
    
    await user.save();

    const tradeLog = new Transaction({
        userId: user._id, email: user.email, type: 'Buy',
        coinId, amount: totalCost, coinAmount, pricePerCoin, status: 'Completed'
    });
    await tradeLog.save();

    res.json({ message: 'Buy Successful', balance: user.balance, holdings: user.holdings });
  } catch (err) { next(err); }
});

app.post('/api/sell-coin', authMiddleware, async (req, res, next) => {
  try {
    const { coinId, amount, pricePerCoin } = req.body;
    const sellAmount = parseFloat(amount);
    const user = await User.findById(req.userId);
    
    const holdingIndex = user.holdings.findIndex(h => h.coinId === coinId);
    if (holdingIndex === -1 || user.holdings[holdingIndex].amount < sellAmount) {
      return res.status(400).json({ message: 'Insufficient Coin Balance!' });
    }

    const usdtReceived = sellAmount * pricePerCoin;
    user.holdings[holdingIndex].amount -= sellAmount;
    user.balance += usdtReceived;
    if (user.holdings[holdingIndex].amount <= 0) user.holdings.splice(holdingIndex, 1);
    
    await user.save();

    const sellLog = new Transaction({
        userId: user._id, email: user.email, type: 'Sell',
        coinId, amount: usdtReceived, coinAmount: sellAmount, pricePerCoin, status: 'Completed'
    });
    await sellLog.save();

    res.json({ message: 'Sell Successful', balance: user.balance, holdings: user.holdings });
  } catch (err) { next(err); }
});

app.get('/api/user/transactions', authMiddleware, async (req, res, next) => {
    try {
        const transactions = await Transaction.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(transactions);
    } catch (err) { next(err); }
});

// --- 💸 DEPOSIT ROUTES ---

app.post('/api/user/deposit', authMiddleware, upload.single('slip'), async (req, res, next) => {
    try {
        const { amount, method } = req.body;
        if (!req.file) return res.status(400).json({ message: 'Slip image is required' });
        const user = await User.findById(req.userId);
        const newTransaction = new Transaction({
            userId: user._id, email: user.email, type: 'Deposit',
            amount: parseFloat(amount), method,
            slipImage: `/uploads/${req.file.filename}`, status: 'Pending'
        });
        await newTransaction.save();
        res.json({ message: 'Deposit submitted!', status: 'Pending' });
    } catch (err) { next(err); }
});

app.get('/api/admin/pending-deposits', authMiddleware, async (req, res, next) => {
    try {
        const admin = await User.findById(req.userId);
        if (admin.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
        const pending = await Transaction.find({ status: 'Pending', type: 'Deposit' }).sort({ createdAt: -1 });
        res.json(pending);
    } catch (err) { next(err); }
});

app.post('/api/admin/verify-deposit', authMiddleware, async (req, res, next) => {
    try {
        const { transactionId, status } = req.body;
        const admin = await User.findById(req.userId);
        if (admin.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
        const trx = await Transaction.findById(transactionId);
        if (status === 'Approved') {
            const user = await User.findById(trx.userId);
            user.balance += trx.amount;
            await user.save();
        }
        trx.status = status;
        trx.reviewedBy = admin.email;
        trx.reviewDate = new Date();
        await trx.save();
        res.json({ message: `Deposit ${status}` });
    } catch (err) { next(err); }
});

app.get('/api/crypto-prices', async (req, res, next) => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,cardano&vs_currencies=usd&include_24hr_change=true');
    const data = await response.json();
    res.json(data);
  } catch (error) { res.json({}); }
});

// --- 🚨 Global Error Handler ---
app.use((err, req, res, next) => {
    console.error('🔥 System Error:', err.stack);
    res.status(500).json({ 
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// --- 🚀 Server Start ---
app.listen(PORT, () => {
    console.log(`🚀 Professional Server running on port ${PORT}`);
});