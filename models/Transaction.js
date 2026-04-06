const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // ၁။ မည်သည့် User က လုပ်ဆောင်သည်ကို ချိတ်ဆက်ခြင်း (Relational Link)
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID is required'],
    index: true // Searching speed ကို ပိုမြန်စေရန်
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },

  // ၂။ Transaction အမျိုးအစား (Deposit/Withdraw အပြင် Buy/Sell ပါ ထည့်သွင်းထားသည်)
  type: { 
    type: String, 
    enum: {
        values: ['Deposit', 'Withdraw', 'Buy', 'Sell'],
        message: '{VALUE} is not a valid transaction type'
    },
    required: [true, 'Transaction type is required'] 
  },

  // ၃။ Coin နှင့် ပတ်သက်သော အချက်အလက်များ (Buy/Sell လုပ်မှသာ လိုအပ်မည်)
  coinId: { 
    type: String, 
    default: 'usdt', // ဥပမာ - bitcoin, ethereum
    lowercase: true,
    trim: true
  },
  coinAmount: { 
    type: Number, 
    default: 0, // ဝယ်လိုက်ရသော (သို့) ရောင်းလိုက်သော Coin ပမာဏ
    min: [0, 'Coin amount cannot be negative']
  },
  pricePerCoin: { 
    type: Number, 
    default: 0, // ဝယ်စဉ်/ရောင်းစဉ်က Market Price
    min: [0, 'Price per coin cannot be negative']
  },

  // ၄။ ငွေကြေးပမာဏ (Total USDT value)
  amount: { 
    type: Number, 
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },

  // ၅။ Deposit/Withdraw အတွက်သာ လိုအပ်သော အချက်အလက်များ
  method: { 
    type: String, 
    required: function() { 
        // Deposit သို့မဟုတ် Withdraw ဖြစ်မှသာ Method က မဖြစ်မနေ လိုအပ်မည်
        return this.type === 'Deposit' || this.type === 'Withdraw'; 
    },
    trim: true
  }, // KPay, Wave, Bank, etc.
  
  slipImage: { 
    type: String,
    default: "" 
  }, // ငွေလွှဲပြေစာပုံ လမ်းကြောင်း

  // ၆။ လုပ်ဆောင်မှု အခြေအနေ
  status: { 
    type: String, 
    enum: {
        values: ['Pending', 'Approved', 'Rejected', 'Completed', 'Failed'],
        message: '{VALUE} is not a valid status'
    },
    default: 'Pending',
    index: true
  },

  // ၇။ အချိန်နှင့် စစ်ဆေးသူ အချက်အလက်များ
  reviewedBy: { 
    type: String,
    lowercase: true,
    trim: true
  }, // Approve/Reject လုပ်သော Admin Email
  
  reviewDate: { 
    type: Date 
  },
  
  rejectReason: { 
    type: String,
    trim: true
  }, // ငြင်းပယ်ခံရပါက အကြောင်းပြချက်

  // 🛡️ Extra Metadata (Audit Trail အတွက် ထပ်တိုးထားခြင်း)
  txHash: { 
    type: String, 
    unique: true, 
    sparse: true // တကယ်လို့ Blockchain transaction ID ရှိရင် သိမ်းထားဖို့
  }

}, {
    // Automates createdAt and updatedAt
    timestamps: true 
});

// Indexing ထည့်သွင်းခြင်း (နောက်ပိုင်း Transaction တွေများလာရင် ရှာရမြန်အောင် လုပ်ပေးခြင်း)
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1 }); // Admin dashboard အတွက် Pending တွေကို ရှာရမြန်စေရန်

module.exports = mongoose.model('Transaction', transactionSchema);