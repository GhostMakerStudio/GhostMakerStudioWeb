# 🔐 Environment Variables Explained

## How `.env` Files Work in Local vs Production

### 📋 **Quick Answer:**
**YES, the `.env` file is ONLY for local development!** Your live Amplify website never sees it.

---

## 🏠 **Local Development (Your Computer)**

### What Happens:
```
1. You run: npm start
2. Node.js reads: .env file
3. Variables loaded: process.env.STRIPE_SECRET_KEY
4. Backend uses them: stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
5. Frontend uses hardcoded keys or config
```

### `.env` File Structure:
```env
# Backend variables (Node.js only)
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
PORT=3000
NODE_ENV=development
S3_BUCKET=ghostmaker-studio-media
AWS_REGION=us-east-1

# ❌ NOT NEEDED (Amplify blocks these anyway)
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
```

### What Gets Committed to Git:
```
✅ server.js (code that USES process.env.STRIPE_SECRET_KEY)
✅ package.json
✅ All your HTML/CSS/JS files
❌ .env file (blocked by .gitignore)
❌ node_modules/
```

---

## ☁️ **Production (AWS Amplify)**

### What Happens:
```
1. You push code to Git (main or dev branch)
2. Amplify pulls code (NO .env file!)
3. Amplify looks for: Environment Variables in Console
4. Amplify injects: process.env.STRIPE_SECRET_KEY from Console
5. Your code runs: stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
```

### How to Set Amplify Environment Variables:
1. Go to AWS Amplify Console
2. Select your app: **GhostMakerStudioWeb**
3. Click **Environment variables** (left sidebar)
4. Add variables:

```
Key: STRIPE_SECRET_KEY
Value: sk_test_YOUR_ACTUAL_SECRET_KEY

Key: NODE_ENV
Value: production

Key: PORT
Value: 3000

Key: S3_BUCKET
Value: ghostmaker-studio-media

Key: AWS_REGION
Value: us-east-1
```

### ❌ **DO NOT ADD:**
- `AWS_ACCESS_KEY_ID` - Amplify blocks this
- `AWS_SECRET_ACCESS_KEY` - Amplify blocks this
- These are handled automatically by Amplify's service role

---

## 🎯 **How Your Code Accesses Variables**

### **Backend Code (`server.js`):**
```javascript
// Local: Reads from .env file
// Production: Reads from Amplify Environment Variables
require('dotenv').config(); // Only works locally

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 3000;
```

### **Frontend Code (`order.js`, `account.js`):**
```javascript
// ❌ WRONG - process.env doesn't work in browser
const stripe = Stripe(process.env.STRIPE_PUBLISHABLE_KEY);

// ✅ CORRECT - Use config file
const publishableKey = window.StripeConfig.getPublishableKey();
const stripe = Stripe(publishableKey);
```

---

## 🔄 **The Complete Flow**

### **Local Development:**
```
Developer writes code
    ↓
Code uses: process.env.STRIPE_SECRET_KEY
    ↓
dotenv package reads: .env file
    ↓
Variables available: in Node.js backend
    ↓
Server runs: with test keys
```

### **Production Deployment:**
```
Developer pushes to Git
    ↓
Amplify pulls code (NO .env file)
    ↓
Amplify reads: Environment Variables from Console
    ↓
Amplify injects: into process.env
    ↓
Code runs: with production keys
```

---

## 🔐 **Security Best Practices**

### **What's Safe to Commit:**
```
✅ Code that USES environment variables
✅ Config files with fallbacks
✅ Public keys (pk_test_... or pk_live_...)
✅ Bucket names, regions
```

### **What NEVER Gets Committed:**
```
❌ .env file
❌ Secret keys (sk_test_... or sk_live_...)
❌ AWS access keys
❌ Database passwords
❌ API secrets
```

---

## 🧪 **Testing Your Understanding**

### **Question 1: If I delete my `.env` file, will my live website break?**
**Answer:** ❌ **NO!** Your live website uses Amplify Environment Variables, not the `.env` file.

### **Question 2: If I change a value in `.env`, will my live website change?**
**Answer:** ❌ **NO!** You need to update the value in Amplify Environment Variables.

### **Question 3: Why do I need `.env` then?**
**Answer:** ✅ **For local testing only!** So you can run `npm start` on your computer.

### **Question 4: Do I need AWS_ACCESS_KEY_ID in Amplify?**
**Answer:** ❌ **NO!** Amplify uses its own service role and account permissions automatically.

---

## 📚 **Your Current Setup**

### **Files That Handle Configuration:**

1. **`server.js`** - Backend that uses `process.env.STRIPE_SECRET_KEY`
2. **`src/config/stripe.js`** - Frontend config for publishable keys
3. **`.env`** - Local development only (NOT committed to Git)
4. **`.gitignore`** - Blocks `.env` from being committed
5. **Amplify Console** - Production environment variables

### **How Stripe Keys Work:**

```
Publishable Key (pk_test_...):
├── Public (safe to expose)
├── Used in: Frontend JavaScript
├── Location: Hardcoded or config file
└── Same key for local and production

Secret Key (sk_test_...):
├── Private (NEVER expose)
├── Used in: Backend Node.js only
├── Location: .env (local) or Amplify Variables (production)
└── Different keys for test and live
```

---

## 🚀 **Next Steps**

1. ✅ Keep your `.env` file local (already blocked by `.gitignore`)
2. ✅ Add environment variables to Amplify Console
3. ✅ Use `src/config/stripe.js` for frontend configuration
4. ✅ Backend automatically reads from `process.env`
5. ✅ Test locally with `npm start`
6. ✅ Push to Git and let Amplify handle production

---

## 💡 **Key Takeaway**

**The `.env` file is like a notepad on your desk - useful for you, but it never leaves your office!**

Your live website is in a completely different building (AWS Amplify) and has its own set of keys (Environment Variables) that you configure separately.









