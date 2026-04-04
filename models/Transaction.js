const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // ၁။ မည်သည့် User က လုပ်ဆောင်သည်ကို ချိတ်ဆက်ခြင်း
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },

  // ၂။ Transaction အမျိုးအစား (Deposit/Withdraw အပြင် Buy/Sell ပါ ထည့်သွင်းထားသည်)
  type: { 
    type: String, 
    enum: ['Deposit', 'Withdraw', 'Buy', 'Sell'], 
    required: true 
  },

  // ၃။ Coin နှင့် ပတ်သက်သော အချက်အလက်များ (Buy/Sell လုပ်မှသာ လိုအပ်မည်)
  coinId: { 
    type: String, 
    default: 'usdt' // ဥပမာ - bitcoin, ethereum
  },
  coinAmount: { 
    type: Number, 
    default: 0 // ဝယ်လိုက်ရသော (သို့) ရောင်းလိုက်သော Coin ပမာဏ
  },
  pricePerCoin: { 
    type: Number, 
    default: 0 // ဝယ်စဉ်/ရောင်းစဉ်က Market Price
  },

  // ၄။ ငွေကြေးပမာဏ (USDT value)
  amount: { 
    type: Number, 
    required: true 
  },

  // ၅။ Deposit/Withdraw အတွက်သာ လိုအပ်သော အချက်အလက်များ
  method: { 
    type: String, 
    required: function() { return this.type === 'Deposit' || this.type === 'Withdraw'; } 
  }, // KPay, Wave, Bank, etc.
  slipImage: { 
    type: String 
  }, // ငွေလွှဲပြေစာပုံ လမ်းကြောင်း

  // ၆။ လုပ်ဆောင်မှု အခြေအနေ
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Completed', 'Failed'], 
    default: 'Pending' 
  },

  // ၇။ အချိန်နှင့် စစ်ဆေးသူ အချက်အလက်များ
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  reviewedBy: { 
    type: String 
  }, // Approve/Reject လုပ်သော Admin Email
  reviewDate: { 
    type: Date 
  },
  rejectReason: { 
    type: String 
  } // ငြင်းပယ်ခံရပါက အကြောင်းပြချက်
});

// Indexing ထည့်သွင်းခြင်း (နောက်ပိုင်း Transaction တွေများလာရင် ရှာရမြန်အောင် လုပ်ပေးခြင်း)
transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);