# 🗄️ GhostMaker Studio Database Schema

## **📋 Orders Table (`ghostmaker-orders`)**
```json
{
  "orderId": "order_1234567890",
  "userId": "guest_1234567890",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "service": "flyer",
  "projectDetails": "Design a flyer for my event...",
  "amount": 500,
  "currency": "usd",
  "status": "paid",
  "stripePaymentId": "pi_1234567890",  // ← Stripe handles the card
  "stripeCustomerId": "cus_1234567890", // ← Links to Stripe customer
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## **👤 Customers Table (`ghostmaker-customers`)**
```json
{
  "customerId": "cus_1234567890",
  "name": "John Doe",
  "email": "john@example.com",
  "stripeCustomerId": "cus_1234567890", // ← Links to Stripe
  "totalOrders": 3,
  "totalSpent": 1500,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## **🔐 What You NEVER Store:**
- ❌ Card numbers (4242 4242 4242 4242)
- ❌ CVV codes (123)
- ❌ Expiry dates (12/25)
- ❌ Billing addresses (Stripe handles this)

## **✅ What Stripe Stores:**
- 🔒 Encrypted card numbers
- 🔒 Billing addresses
- 🔒 Payment methods
- 🔒 Subscription data
- 🔒 Refund history

## **🔗 How They Connect:**
- **Your Database:** `stripeCustomerId` → Links to Stripe
- **Stripe:** `customer_id` → Links back to your database
- **API Calls:** Your backend talks to Stripe API
- **Webhooks:** Stripe notifies your backend of events

