const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  
  // 📸 Profile Photo
  profilePic: { type: String, default: "" }, 
  
  // Verification Status: 'Unverified', 'Pending', 'Verified'
  isVerified: { 
    type: String, 
    enum: ['Unverified', 'Pending', 'Verified'], 
    default: 'Unverified' 
  },
  
  // 🔥 Professional KYC Details (Updated with Extra Personal Info)
  kycDetails: {
    fullName: { type: String, default: "" },
    idNumber: { type: String, default: "" },
    
    // --- 🆕 ထပ်တိုးထားသော ကိုယ်ရေးအချက်အလက်များ (New KYC Fields) ---
    dob: { type: String, default: "" },           // မွေးသက္ကရာဇ်
    phoneNumber: { type: String, default: "" },   // ဖုန်းနံပါတ်
    gender: { type: String, default: "" },        // ကျား/မ
    address: { type: String, default: "" },       // နေရပ်လိပ်စာ
    // --------------------------------------------------------

    idCardImage: { type: String, default: "" }, // Front Side
    idBackImage: { type: String, default: "" }, // Back Side Image
    selfieImage: { type: String, default: "" }, // Face Selfie Image
    
    // --- 🛡️ Admin Review Logs ---
    reviewedBy: { type: String, default: "" },   // စစ်ဆေးပေးခဲ့သည့် Admin ၏ Email
    reviewDate: { type: Date },                 // စစ်ဆေးခဲ့သည့် အချိန်
    rejectReason: { type: String, default: "" }  // ငြင်းပယ်ခံရလျှင် အကြောင်းပြချက်
  },
  
  // Asset Holdings & Portfolio
  holdings: [{
    coinId: String,
    amount: { type: Number, default: 0 }
  }],
  
  watchlist: [{ type: String }],
  
  // User Role (For Admin Control Panel Access)
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);