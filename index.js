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

app.use(cors());
app.use(express.json());

// 📸 ပုံများကို Frontend မှ လှမ်းကြည့်နိုင်ရန် Static Folder သတ်မှတ်ခြင်း
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
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype) return cb(null, true);
        cb(new Error('Error: Images Only (JPEG/JPG/PNG)!'));
    }
});


// --- MongoDB Connection ---
mongoose.connect('mongodb://127.0.0.1:27017/crypto_exchange')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// --- Auth Middleware ---
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// --- Email OTP System ---
const otpStore = new Map(); 
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  }
});

// --- AUTH ROUTES ---

app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Need Email' });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Account Already have' });

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
        </div>`
    };
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Verification code sent!' });
  } catch (error) { res.status(500).json({ message: `Error: ${error.message}` }); }
});

app.post('/api/register', async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    const storedOtp = otpStore.get(email);
    if (!storedOtp || storedOtp !== otp) return res.status(400).json({ message: 'Wrong Code' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    otpStore.delete(email); 
    res.status(201).json({ message: 'Create Account Successful' });
  } catch (err) { res.status(500).json({ message: 'Server Error' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Wrong Password' });

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
  } catch (err) { res.status(500).json({ message: 'Login Error' }); }
});

app.get('/api/user/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password'); 
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        res.json({
            email: user.email,
            balance: user.balance,
            isVerified: user.isVerified,
            role: user.role,
            profilePic: user.profilePic,
            holdings: user.holdings,
            kycDetails: user.kycDetails 
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error Fetching User Data' });
    }
});


// --- 👮 KYC & PROFILE ROUTES ---

app.post('/api/user/upload-profile', authMiddleware, upload.single('profilePic'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        const user = await User.findById(req.userId);
        user.profilePic = `/uploads/${req.file.filename}`;
        await user.save();
        res.json({ message: 'Profile photo updated', profilePic: user.profilePic });
    } catch (err) { res.status(500).json({ message: 'Upload Failed' }); }
});

app.post('/api/user/submit-kyc', authMiddleware, upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 } 
]), async (req, res) => {
    try {
        const { fullName, idNumber, dob, phoneNumber, gender, address } = req.body; 
        
        if (!req.files || !req.files['idFront'] || !req.files['idBack'] || !req.files['selfie']) {
            return res.status(400).json({ message: 'All documents are required' });
        }

        const user = await User.findById(req.userId);
        
        user.kycDetails.fullName = fullName;
        user.kycDetails.idNumber = idNumber;
        user.kycDetails.dob = dob;                 
        user.kycDetails.phoneNumber = phoneNumber; 
        user.kycDetails.gender = gender;           
        user.kycDetails.address = address;         
        
        user.kycDetails.idCardImage = `/uploads/${req.files['idFront'][0].filename}`; 
        user.kycDetails.idBackImage = `/uploads/${req.files['idBack'][0].filename}`; 
        user.kycDetails.selfieImage = `/uploads/${req.files['selfie'][0].filename}`; 
        user.isVerified = 'Pending'; 

        await user.save();
        res.json({ message: 'Verification details submitted for review!', status: 'Pending' });
    } catch (err) {
        res.status(500).json({ message: 'Submission Error' });
    }
});


// --- 👑 ADMIN CONTROL ROUTES ---

app.get('/api/admin/pending-users', authMiddleware, async (req, res) => {
    try {
        const adminAccount = await User.findById(req.userId);
        if (adminAccount.role !== 'admin') return res.status(403).json({ message: 'Access Denied: Admin only' });

        const pendingUsers = await User.find({ isVerified: 'Pending' }).select('-password');
        res.json(pendingUsers);
    } catch (err) {
        res.status(500).json({ message: 'Server Error while fetching pending users' });
    }
});

app.post('/api/admin/verify-user', authMiddleware, async (req, res) => {
    try {
        const { userId, status, reason } = req.body; 

        if (!['Verified', 'Unverified'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status type' });
        }

        const adminAccount = await User.findById(req.userId);
        if (adminAccount.role !== 'admin') return res.status(403).json({ message: 'Access Denied: Admin only' });
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isVerified = status;
        user.kycDetails.reviewedBy = adminAccount.email; 
        user.kycDetails.reviewDate = new Date(); 
        user.kycDetails.rejectReason = status === 'Unverified' ? (reason || "Document mismatch or blur image") : "";

        await user.save();

        const mailOptions = {
            from: `"X Market Compliance" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `Identity Verification ${status === 'Verified' ? 'Approved' : 'Rejected'}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 25px; background-color: #0B0E11; color: #ffffff; border-radius: 12px; border: 1px solid #2B3139;">
                    <h2 style="color: ${status === 'Verified' ? '#22c55e' : '#ef4444'};">KYC Status Updated</h2>
                    <p>Your account verification has been <b>${status === 'Verified' ? 'SUCCESSFUL' : 'REJECTED'}</b>.</p>
                    ${status === 'Unverified' ? `<p style="background: #1E2329; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;"><b>Reason:</b> ${user.kycDetails.rejectReason}</p>` : '<p>You can now access all trading features and futures terminal.</p>'}
                    <p style="font-size: 12px; color: #666; margin-top: 20px;">Timestamp: ${new Date().toLocaleString()}</p>
                </div>`
        };

        transporter.sendMail(mailOptions).catch(err => console.error("Email send error:", err));

        res.json({ 
            message: `User identity ${status === 'Verified' ? 'Approved' : 'Rejected'}`, 
            status: user.isVerified 
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update user verification status' });
    }
});

app.get('/api/admin/verification-history', authMiddleware, async (req, res) => {
    try {
        const admin = await User.findById(req.userId);
        if (admin.role !== 'admin') return res.status(403).json({ message: 'Admin Only' });

        const history = await User.find({ isVerified: { $in: ['Verified', 'Unverified'] } })
                                  .select('email isVerified kycDetails')
                                  .sort({ 'kycDetails.reviewDate': -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch history' });
    }
});


// --- 💰 TRADING & HISTORY ROUTES ---

// ၁။ BUY COIN WITH HISTORY LOGGING
app.post('/api/buy-coin', authMiddleware, async (req, res) => {
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

    // 🔥 မှတ်တမ်းသိမ်းခြင်း
    const tradeLog = new Transaction({
        userId: user._id,
        email: user.email,
        type: 'Buy',
        coinId: coinId,
        amount: totalCost, // Spent USDT
        coinAmount: coinAmount, // Gained Asset
        pricePerCoin: pricePerCoin,
        status: 'Completed'
    });
    await tradeLog.save();

    res.json({ message: 'Buy Successful', balance: user.balance, holdings: user.holdings });
  } catch (err) { res.status(500).json({ message: 'Buy Failed' }); }
});

// ၂။ SELL COIN WITH HISTORY LOGGING
app.post('/api/sell-coin', authMiddleware, async (req, res) => {
  try {
    const { coinId, amount, pricePerCoin } = req.body;
    const sellAmount = parseFloat(amount);
    const user = await User.findById(req.userId);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    const holdingIndex = user.holdings.findIndex(h => h.coinId === coinId);
    if (holdingIndex === -1 || user.holdings[holdingIndex].amount < sellAmount) {
      return res.status(400).json({ message: 'Insufficient Coin Balance!' });
    }

    const usdtReceived = sellAmount * pricePerCoin;
    user.holdings[holdingIndex].amount -= sellAmount;
    user.balance += usdtReceived;

    if (user.holdings[holdingIndex].amount <= 0) {
      user.holdings.splice(holdingIndex, 1);
    }

    await user.save();

    // 🔥 မှတ်တမ်းသိမ်းခြင်း
    const sellLog = new Transaction({
        userId: user._id,
        email: user.email,
        type: 'Sell',
        coinId: coinId,
        amount: usdtReceived, // Earned USDT
        coinAmount: sellAmount, // Sold Asset
        pricePerCoin: pricePerCoin,
        status: 'Completed'
    });
    await sellLog.save();

    res.json({ message: 'Sell Successful', balance: user.balance, holdings: user.holdings });
  } catch (err) { res.status(500).json({ message: 'Sell Failed' }); }
});

// ၃။ GET USER TRANSACTION HISTORY API
app.get('/api/user/transactions', authMiddleware, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching history' });
    }
});


// --- 💸 DEPOSIT & WITHDRAWAL ROUTES ---

app.post('/api/user/deposit', authMiddleware, upload.single('slip'), async (req, res) => {
    try {
        const { amount, method } = req.body;
        if (!req.file) return res.status(400).json({ message: 'Slip image is required' });
        const user = await User.findById(req.userId);
        const newTransaction = new Transaction({
            userId: user._id, email: user.email, type: 'Deposit',
            amount: parseFloat(amount), method: method,
            slipImage: `/uploads/${req.file.filename}`, status: 'Pending'
        });
        await newTransaction.save();
        res.json({ message: 'Deposit submitted!', status: 'Pending' });
    } catch (err) { res.status(500).json({ message: 'Deposit failed' }); }
});

app.get('/api/admin/pending-deposits', authMiddleware, async (req, res) => {
    try {
        const admin = await User.findById(req.userId);
        if (admin.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
        const pending = await Transaction.find({ status: 'Pending', type: 'Deposit' }).sort({ createdAt: -1 });
        res.json(pending);
    } catch (err) { res.status(500).json({ message: 'Error fetching' }); }
});

app.post('/api/admin/verify-deposit', authMiddleware, async (req, res) => {
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
    } catch (err) { res.status(500).json({ message: 'Failed' }); }
});


app.get('/api/crypto-prices', async (req, res) => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,cardano&vs_currencies=usd&include_24hr_change=true');
    const data = await response.json();
    res.json({
      bitcoin: { usd: data.bitcoin.usd, usd_24h_change: data.bitcoin.usd_24h_change },
      ethereum: { usd: data.ethereum.usd, usd_24h_change: data.ethereum.usd_24h_change },
      binancecoin: { usd: data.binancecoin.usd, usd_24h_change: data.binancecoin.usd_24h_change },
      solana: { usd: data.solana.usd, usd_24h_change: data.solana.usd_24h_change },
      cardano: { usd: data.cardano.usd, usd_24h_change: data.cardano.usd_24h_change }
    });
  } catch (error) { res.json({}); }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));