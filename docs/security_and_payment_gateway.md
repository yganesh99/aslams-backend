# Backend Security & Payment Gateway Integration Strategy

## 1. Current Security Posture

The backend currently has a solid foundational security posture for e-commerce and POS operations.

### Key Security Implementations:

- **Helmet (`helmet()`)**: Configured in `app.js` to set secure HTTP response headers, mitigating common attacks like Cross-Site Scripting (XSS) and clickjacking.
- **CORS (`cors()`)**: Properly configured to restrict cross-origin requests, ensuring only allowed origins can interact with the API.
- **Rate Limiting**: `express-rate-limit` is applied to `/api/auth` routes (100 requests per 15 minutes) to protect against brute-force login and signup attacks.
- **Input Validation**: `celebrate` and `Joi` are used extensively across routes (e.g., in `ecommerce.routes.js`) for strict validation of incoming request payloads, preventing malformed data and injection attacks.
- **Authentication & Authorization**: The `auth.js` middleware verifies **Better Auth** sessions (shared MongoDB with the ERP app) and enforces Role-Based Access Control (RBAC) for user roles (admin, store manager, customer, etc.).

---

## 2. Readiness for Payment Gateway Integration

The system is secure enough for payment gateway integration, but requires **one critical architectural adjustment** before deployment:

### Required Adjustment: Raw Body Parsing for Webhooks

Payment gateways (like Stripe, Razorpay, or PayPal) utilize asynchronous webhook events to securely notify the backend of successful or failed payments.
To prevent spoofed payment confirmations, **the backend must verify the cryptographic signature of these incoming webhooks.**

**The Problem:**
Currently, `app.use(express.json())` is applied globally in `app.js`. This parses all incoming JSON requests into JavaScript objects and discards the raw request body. Cryptographic signature verification requires the exact, unaltered raw string payload.

**The Solution:**
You must configure `express.raw({ type: 'application/json' })` specifically for the webhook route _before_ the global `express.json()` middleware is applied in `app.js`.

---

## 3. Integration Architecture Flow (E-commerce Only)

To securely integrate a payment gateway (e.g., Stripe) into the existing e-commerce routing (`ecommerce.routes.js`), the following standard architecture should be implemented:

### Step 1: Secure Order Calculation (Backend - `/api/ecommerce/checkout`)

When a user submits their cart, the backend **must calculate the exact, final total amount securely** using prices from the database (`product.model.js`).
_Security Rule: Never trust cart totals calculated or provided by the frontend. The backend represents the single source of truth for pricing._

### Step 2: Create a Payment Intent (Backend - `/api/ecommerce/checkout`)

The backend communicates securely with the payment gateway API (e.g., `stripe.paymentIntents.create`) to declare the expected payment amount.

- The gateway returns a secure `clientSecret` and a `paymentIntentId`.
- The backend creates the `Order` document in the database with a status of `pending_payment` and saves the `paymentIntentId`.
- The backend returns the `clientSecret` to the frontend.

### Step 3: Collect Payment Info securely (Frontend)

The frontend uses the `clientSecret` to safely render the payment gateway's secure UI components (e.g., Stripe Elements).

- The user inputs their credit card or banking details.
- This sensitive data is transmitted **directly from the browser to the payment gateway**. It never touches the backend server or the database, greatly reducing PCI-DSS compliance scope.

### Step 4: Verify Payment via Webhook (Backend - e.g., `/api/ecommerce/webhook`)

A new, public webhook endpoint is created to receive asynchronous updates from the payment gateway.

- When an asynchronous payment completes (or fails), the gateway securely POSTs to this webhook URL.
- The backend extracts the raw request body and verifies the cryptographic signature using the gateway's webhook secret.
- Upon successful verification, the backend extracts the `paymentIntentId`, queries the database for the matching order, and securely updates its status from `pending_payment` to `paid` or `processing`.
