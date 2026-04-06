const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // --- 🔐 Basic Auth Info ---
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  
  // --- 💰 Financial Wallet ---
  balance: { 
    type: Number, 
    default: 0,
    min: [0, 'Balance cannot be negative'] 
  },
  
  // 📸 Profile Photo
  profilePic: { type: String, default: "" }, 
  
  // Verification Status: 'Unverified', 'Pending', 'Verified'
  isVerified: { 
    type: String, 
    enum: {
        values: ['Unverified', 'Pending', 'Verified'],
        message: '{VALUE} is not a valid status'
    },
    default: 'Unverified' 
  },
  
  // 🔥 Professional KYC Details (Updated with Extra Personal Info)
  kycDetails: {
    fullName: { type: String, default: "" },
    idNumber: { type: String, default: "" },
    
    // --- 🆕 ထပ်တိုးထားသော ကိုယ်ရေးအချက်အလက်များ (New KYC Fields) ---
    dob: { type: String, default: "" },           // မွေးသက္ကရာဇ်
    phoneNumber: { type: String, default: "" },   // ဖုန်းနံပါတ်
    gender: { 
        type: String, 
        enum: ['', 'Male', 'Female', 'Other'], 
        default: "" 
    },        // ကျား/မ
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
    coinId: { type: String, required: true },
    amount: { type: Number, default: 0, min: 0 }
  }],
  
  watchlist: [{ type: String }],
  
  // User Role (For Admin Control Panel Access)
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },

  // --- 🕒 Timestamp Metadata ---
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
    // Automates updatedAt field and cleanup
    timestamps: true 
});

// --- 🛡️ Security: Password Hide ---
// JSON အဖြစ်ထုတ်တဲ့အခါ password ကို အမြဲ ဖျောက်ထားပေးမယ်
userSchema.set('toJSON', {
    transform: function(doc, ret, options) {
        delete ret.password;
        return ret;
    }
});

module.exports = mongoose.model('User', userSchema);