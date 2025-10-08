# AWS SES (Simple Email Service) Setup Guide

## 📧 What is AWS SES?

Amazon SES is AWS's email service that lets you send:
- **Transactional emails** (order confirmations, receipts)
- **Notification emails** (status updates, alerts)
- **Marketing emails** (newsletters, promos)

### **Key Benefits:**
- ⚡ **Fast** - Emails delivered in 1-3 seconds
- 💰 **Cheap** - $0.10 per 1,000 emails
- 🎨 **Customizable** - Full HTML/CSS control
- 📊 **Trackable** - Open rates, bounces, complaints
- 🔒 **Reliable** - 99.9% uptime SLA

---

## 🚀 Setup Steps

### **Step 1: Verify Your Domain**

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Click **Verified identities** → **Create identity**
3. Choose **Domain** and enter `ghostmakerstudio.com`
4. Select **Easy DKIM** (recommended)
5. Copy the **CNAME records** shown
6. Add these CNAME records to your Namecheap DNS:
   - Go to Namecheap → Your domain → Advanced DNS
   - Add each CNAME record exactly as shown by AWS
   - Wait 10-30 minutes for DNS propagation

### **Step 2: Verify Email Addresses (Optional)**

For testing, verify individual email addresses:
1. Click **Create identity** → Choose **Email address**
2. Enter your email (e.g., `youremail@gmail.com`)
3. Check your inbox and click the verification link
4. Now you can send test emails to this address

### **Step 3: Request Production Access**

**Important:** New SES accounts start in **Sandbox Mode**:
- ✅ Can send to verified emails only
- ✅ Limit: 200 emails/day
- ❌ Cannot send to customers

**To get production access:**
1. Go to SES Console → **Account dashboard**
2. Click **Request production access**
3. Fill out the form:
   - **Use case:** Transactional emails (order confirmations)
   - **Website:** ghostmakerstudio.com
   - **How you handle bounces:** Monitor bounce rates
   - **How customers opt-in:** Customers place orders
4. Submit and wait 24-48 hours for approval

**After approval:**
- ✅ Send to any email address
- ✅ 50,000 emails/day (free tier)
- ✅ $0.10 per 1,000 emails after that

### **Step 4: Configure Sending**

1. Go to **Configuration sets** → **Create configuration set**
2. Name it `ghostmaker-transactional`
3. Enable **Event publishing** to track:
   - Opens
   - Clicks
   - Bounces
   - Complaints

### **Step 5: Update Your Code**

Add SES credentials to `.env`:
```env
# AWS SES Configuration
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=orders@ghostmakerstudio.com
AWS_SES_FROM_NAME=GhostMaker Studio
```

---

## 📬 Email Types for Your Business

### **1. Order Confirmation Email**
**When:** Immediately after payment
**To:** Customer
**Content:**
- Order number and details
- Tracking link (unique token)
- What happens next (timeline)
- CTA: "Track Your Order"

### **2. Creator Notification Email**
**When:** Immediately after payment
**To:** Your mobile email (push notification)
**Content:**
- New order alert
- Order details
- Quick link to admin dashboard
- Mobile-optimized format

### **3. Draft Ready Email**
**When:** Creator uploads first draft
**To:** Customer
**Content:**
- "Your draft is ready for review!"
- Tracking link to view draft
- Instructions for requesting revisions
- CTA: "View Draft"

### **4. Order Complete Email**
**When:** Order marked as complete
**To:** Customer
**Content:**
- "Your order is complete!"
- Download links for final files
- Thank you message
- CTA: "Download Files"

### **5. Revision Requested Email**
**When:** Customer requests revision
**To:** Your mobile email
**Content:**
- Revision notification
- Customer's revision notes
- Link to order details
- CTA: "View Revision Request"

---

## ⚡ Email Speed & Deliverability

### **How Fast are Emails?**
- **AWS SES:** 1-3 seconds delivery
- **Gmail/Yahoo:** 5-30 seconds to inbox
- **Total time:** Usually under 30 seconds

### **Why Some Emails are Slow:**
1. **Spam filters** - First-time sender
2. **Not verified** - Domain not verified
3. **Poor reputation** - High bounce rate
4. **Large attachments** - Slow processing

### **How to Ensure Fast Delivery:**
✅ **Verify your domain** (Step 1)
✅ **Use production access** (Step 3)
✅ **Warm up your domain** (start with small volumes)
✅ **Monitor bounce rates** (keep under 5%)
✅ **Use plain text + HTML** (better deliverability)
✅ **Avoid spam words** (FREE, URGENT, CLICK HERE)

### **Test Email Speed:**
```javascript
const startTime = Date.now();
await emailService.sendOrderConfirmation(orderData);
const endTime = Date.now();
console.log(`Email sent in ${endTime - startTime}ms`);
```

---

## 🎨 Email Design Best Practices

### **1. Keep It Simple**
- Use **table-based layouts** (email-safe)
- Avoid complex CSS (Gmail strips most styles)
- Use **inline styles** only
- Test in multiple email clients

### **2. Mobile-First Design**
- 60% of emails are opened on mobile
- Use **large buttons** (44px minimum)
- **Single column** layout
- **Large text** (16px minimum)

### **3. Brand Consistency**
- Use your brand colors (#8b5cf6 purple)
- Include your logo
- Match your website style
- Keep the ghost theme

### **4. Call-to-Action**
- **One primary CTA** per email
- Make it **obvious and large**
- Use **action words** ("Track Order", "View Draft")
- Link to tracking page with token

---

## 🔧 Backend Implementation

When you connect to real AWS, your backend will:

```javascript
// Lambda function or API endpoint
const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: 'us-east-1' });

async function sendOrderConfirmation(orderData) {
  const params = {
    Source: 'orders@ghostmakerstudio.com',
    Destination: {
      ToAddresses: [orderData.email]
    },
    Message: {
      Subject: {
        Data: `Order Confirmation #${orderData.orderId}`,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: getEmailTemplate(orderData),
          Charset: 'UTF-8'
        }
      }
    }
  };
  
  const result = await ses.sendEmail(params).promise();
  console.log('Email sent:', result.MessageId);
}
```

---

## 📊 Monitoring Email Performance

### **Key Metrics to Track:**
- **Delivery rate** - % of emails delivered (goal: >99%)
- **Open rate** - % of emails opened (goal: >40%)
- **Click rate** - % of links clicked (goal: >20%)
- **Bounce rate** - % of emails bounced (goal: <5%)
- **Complaint rate** - % marked as spam (goal: <0.1%)

### **How to Monitor:**
1. SES Console → **Reputation metrics**
2. CloudWatch → **SES metrics**
3. Your database → Track user interactions

### **If Delivery Rate Drops:**
- Check domain verification
- Review bounce reasons
- Improve email content
- Remove invalid emails

---

## 💰 Cost Breakdown

### **SES Pricing:**
- First **62,000 emails/month**: FREE (when hosted on EC2)
- After that: **$0.10 per 1,000 emails**

### **Your Business (Example):**
- **10 orders/day** = 300 orders/month
- **4 emails per order** = 1,200 emails/month
- **Cost:** FREE (well under 62,000)

Even at **1,000 orders/month**:
- 4,000 emails/month
- Cost: Still FREE!

---

## ✅ Quick Setup Checklist

- [ ] Create AWS SES account
- [ ] Verify domain (ghostmakerstudio.com)
- [ ] Add DNS records to Namecheap
- [ ] Wait for domain verification (10-30 min)
- [ ] Verify test email address
- [ ] Send test email to yourself
- [ ] Request production access
- [ ] Create configuration set
- [ ] Add SES credentials to `.env`
- [ ] Test email delivery speed
- [ ] Monitor bounce/complaint rates

---

## 🚨 Common Issues & Solutions

### **Issue: Emails going to spam**
**Solution:**
- Verify domain (DKIM, SPF)
- Request production access
- Warm up domain (start slow)
- Avoid spam trigger words

### **Issue: Slow email delivery**
**Solution:**
- Check domain verification
- Use production access (not sandbox)
- Optimize email size
- Check recipient's spam settings

### **Issue: Emails not sending**
**Solution:**
- Check SES sandbox mode
- Verify recipient email
- Check AWS credentials
- Review CloudWatch logs

---

## 📱 Mobile Push Notifications

**For instant creator alerts:**
1. SES sends email to your mobile email
2. Your phone gets push notification
3. Open email → Click link → Admin dashboard
4. View order → Start working

**Alternative:** Use AWS SNS (Simple Notification Service) for true push notifications to a mobile app (Phase 3 of your vision).

---

## 🎯 Next Steps

1. **Now:** Test with mock emails (already implemented)
2. **Soon:** Set up SES sandbox and verify your email
3. **Before launch:** Request production access
4. **After launch:** Monitor delivery metrics

**Remember:** Emails are critical for your "no manual communication" goal. Fast, reliable emails = happy customers! 🚀

