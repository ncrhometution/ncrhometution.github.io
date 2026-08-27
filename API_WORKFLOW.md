# NCR Home Tuition — Complete API Workflow Guide

Base URL: **`https://ncrhomr.vercel.app/`**

This guide covers every API, the data you pass, the response you get, and how to call it from a frontend (Android / Web).

---

## ⚠️ IMPORTANT — Live Deployment Status

**The live API at `https://ncrhomr.vercel.app/` was returning `500 Internal Server Error` on every endpoint.**

**Cause:** `api/index.py` requires the environment variables `SUPABASE_URL` and `SUPABASE_KEY` at startup. On Vercel the `.env` file is not read, so these must be set in the **Vercel dashboard**.

**Fix (already applied):** The environment variables are now set in the Vercel dashboard, and `index.py` reads them with `os.getenv()`. The app now loads and works.

**Required Vercel environment variables:**

```
SUPABASE_URL=https://byjokusvtckvryzaajjt.supabase.co
SUPABASE_KEY=<your-supabase-key>
RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
```

> The local `.env` file in `api/` is **not** read by Vercel. Vercel only reads env vars set in its dashboard. The `api/db.py` file is no longer imported by `index.py` and can be ignored/removed.

---

## API Overview

| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 1 | GET | `/` | No | Home / route list |
| 2 | POST | `/admin/create` | No | Create an admin |
| 3 | POST | `/admin/login` | No | Login → session token |
| 4 | POST | `/student` | No | Register a student |
| 5 | POST | `/tutor` | No | Register a tutor |
| 6 | GET | `/tutors` | Optional admin | List tutors |
| 7 | GET | `/students` | Optional admin | List students |
| 8 | GET | `/search` | Optional admin | Search + filter |
| 9 | GET | `/cities` | No | Unique cities |
| 10 | GET | `/tutor/{id}` | Optional admin | Tutor by id |
| 11 | GET | `/student/{id}` | Optional admin | Student by id |
| 12 | PUT | `/student/{id}` | No | Update student |
| 13 | PUT | `/tutor/{id}` | No | Update tutor |
| 14 | GET | `/experience-options` | No | Experience filter options |
| 15 | GET | `/sort-options` | No | Sort options |
| 16 | POST | `/payments/create-order` | No | Create Razorpay order |
| 17 | POST | `/payments/verify` | No | Verify payment |
| 18 | POST | `/payments/webhook` | No | Razorpay webhook |
| 19 | GET | `/payments` | **Admin required** | List payments |
| 20 | GET | `/payments/{payment_id}` | No | Payment by internal id |
| 21 | GET | `/payments/order/{razorpay_order_id}` | No | Payment by order id |
| 22 | GET | `/payments/razorpay/{razorpay_payment_id}` | No | Payment by payment id |

---

## Authentication (Admin)

Two endpoints need admin auth: `GET /payments` (required) and the list/search endpoints (optional — returns extra private fields if admin).

**How it works:**
1. Call `POST /admin/login` with username + password.
2. You get a `session_token`.
3. Send it in the **`X-Admin-Token`** header on protected requests.

```http
X-Admin-Token: <session_token>
```

---

## 1. GET / — Home

Lists all routes.

**Response:**
```json
{
  "status": "success",
  "message": "FastAPI + Supabase running",
  "version": "2.0.0",
  "routes": [ "...all routes..." ]
}
```

---

## 2. POST /admin/create — Create Admin

**Request (query params):**
```
POST /admin/create?username=admin&password=secret123
```

**Response:**
```json
{
  "status": "success",
  "message": "Admin created",
  "data": { "id": "uuid", "username": "admin", "password_hash": "..." }
}
```

---

## 3. POST /admin/login — Login

**Request body:**
```json
{
  "username": "admin",
  "password": "secret123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Login successful",
  "session_token": "hex-token",
  "expires_at": "2026-08-27T18:00:00+00:00"
}
```

> Save `session_token` and send it as `X-Admin-Token` on admin requests. It expires after 8 hours.

---

## 4. POST /student — Register Student

**Request body:**
```json
{
  "name": "Rahul Sharma",
  "mobile_no": "9876543210",
  "email": "rahul@gmail.com",
  "course": "B.Tech",
  "subject": "Mathematics",
  "Preferred_Gender": "Male",
  "qualification": "12th",
  "experience_years": 0,
  "payment": 500,
  "payment_type": "per_hour",
  "preferred_mode": "online",
  "language": "English",
  "country": "India",
  "city": "Delhi",
  "timezone": "Asia/Kolkata"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Student created",
  "data": { "...full student record with id, status, joined_date..." }
}
```

---

## 5. POST /tutor — Register Tutor

**Request body:**
```json
{
  "name": "Priya Verma",
  "mobile_no": "9123456780",
  "email": "priya@gmail.com",
  "course": "B.Sc",
  "subject": "Physics",
  "qualification": "M.Sc",
  "experience_years": 5,
  "payment": 800,
  "payment_type": "per_hour",
  "preferred_mode": "online",
  "language": "English",
  "country": "India",
  "city": "Noida",
  "timezone": "Asia/Kolkata"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tutor created",
  "data": { "...full tutor record with id, status, joined_date..." }
}
```

---

## 6 & 7. GET /tutors and GET /students — List

**Query params:** `page` (default 1), `per_page` (default 18, max 100)

```
GET /tutors?page=1&per_page=18
GET /students?page=1&per_page=18
```

**Response:**
```json
{
  "status": "success",
  "page": 1,
  "per_page": 18,
  "total": 45,
  "total_pages": 3,
  "has_next": true,
  "has_previous": false,
  "admin": false,
  "data": [ "...records..." ]
}
```

> Without `X-Admin-Token`, only **public fields** are returned (id, name, course, subject, qualification, experience_years, payment, payment_type, preferred_mode, language, city, country, status, joined_date). With admin token, **private fields** (email, mobile_no, timezone, ip_address, user_agent, source) are also included.

---

## 8. GET /search — Search & Filter

The main search API. Works for both students and tutors.

**Query params:**

| Param | Type | Example |
|-------|------|---------|
| `type` | string | `tutor` or `student` (default `tutor`) |
| `keyword` | string | `Mathematics` |
| `city` | string | `Delhi` |
| `subject` | string | `Physics` |
| `course` | string | `B.Tech` |
| `experience` | string | `0-2`, `2-5`, `5-10`, `10+` |
| `experience_min` | number | `3` |
| `experience_max` | number | `8` |
| `payment_min` | number | `300` |
| `payment_max` | number | `700` |
| `preferred_mode` | string | `online` |
| `language` | string | `English` |
| `country` | string | `India` |
| `status` | string | `active` (default) |
| `sort` | string | `newest`, `oldest`, `name_asc`, `name_desc`, `payment_low`, `payment_high`, `experience_low`, `experience_high` |
| `page` | number | `1` |
| `per_page` | number | `18` |

**Examples:**
```
GET /search?type=tutor
GET /search?type=tutor&city=Delhi&subject=Mathematics
GET /search?type=tutor&experience=2-5
GET /search?type=tutor&payment_min=300&payment_max=700&sort=payment_low
GET /search?type=student&keyword=rahul
```

**Response:**
```json
{
  "status": "success",
  "type": "tutor",
  "filters": { "...echo of applied filters..." },
  "pagination": {
    "page": 1, "per_page": 18, "total": 12,
    "total_pages": 1, "has_next": false, "has_previous": false
  },
  "admin": false,
  "data": [ "...records..." ]
}
```

---

## 9. GET /cities — Unique Cities

Returns all distinct cities from active students and tutors.

**Response:**
```json
{
  "status": "success",
  "count": 15,
  "cities": ["Delhi", "Noida", "Gurgaon", "..."]
}
```

---

## 10 & 11. GET /tutor/{id} and GET /student/{id} — By ID

```
GET /tutor/7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d
GET /student/3f2b1c9e-8a4d-4f6b-9c2e-1a2b3c4d5e6f
```

**Response (200):**
```json
{
  "id": "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "type": "tutor",
  "name": "Priya Verma",
  "...": "..."
}
```

**Errors:** `404` — `Tutor not found` / `Student not found`

---

## 12 & 13. PUT /student/{id} and PUT /tutor/{id} — Update

**Request body (only include fields you want to change):**
```json
{
  "name": "Priya Verma Updated",
  "payment": 900,
  "status": "active"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tutor updated",
  "data": { "...updated record..." }
}
```

**Errors:** `400` — `No fields to update`, `404` — not found

---

## 14 & 15. GET /experience-options and GET /sort-options

Return the allowed filter/sort values for building dropdowns in the frontend.

**Response (experience-options):**
```json
{
  "status": "success",
  "experience": [
    { "value": "0-2", "label": "0 - 2 years" },
    { "value": "2-5", "label": "2 - 5 years" },
    { "value": "5-10", "label": "5 - 10 years" },
    { "value": "10+", "label": "10+ years" }
  ]
}
```

**Response (sort-options):**
```json
{
  "status": "success",
  "sort": [
    { "value": "newest", "label": "Newest" },
    { "value": "oldest", "label": "Oldest" },
    { "value": "experience_high", "label": "Experience: High to Low" },
    { "value": "experience_low", "label": "Experience: Low to High" },
    { "value": "payment_low", "label": "Payment: Low to High" },
    { "value": "payment_high", "label": "Payment: High to Low" },
    { "value": "name_asc", "label": "Name: A to Z" },
    { "value": "name_desc", "label": "Name: Z to A" }
  ]
}
```

---

## 16. POST /payments/create-order — Create Razorpay Order

**Request body:**
```json
{
  "email": "abc@gmail.com",
  "mobile_no": "6388574919",
  "amount": 999,
  "currency": "INR",
  "user_type": "student",
  "user_ids": "abf9699e-8813-439f-93e2-e3c9ac2bde90,fdee704f-37eb-42d8-a334-4eed8a0f9101"
}
```

**Response:**
```json
{
  "status": "success",
  "payment_id": "LOCAL-UUID",
  "razorpay_order_id": "order_xxxxxxxxx",
  "amount": 99900,
  "currency": "INR",
  "key_id": "rzp_test_xxxxx",
  "status": "created"
}
```

> `amount` in the response is in **paise** (999 rupees → 99900). `key_id` is used to open the Razorpay checkout.

---

## 17. POST /payments/verify — Verify Payment

**Request body:**
```json
{
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_order_id": "order_xxxxx",
  "razorpay_signature": "xxxxx"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Payment verified",
  "already_verified": false,
  "payment": {
    "id": "local-payment-uuid",
    "email": "abc@gmail.com",
    "mobile_no": "6388574919",
    "amount": 999,
    "currency": "INR",
    "status": "paid",
    "user_type": "student",
    "user_ids": ["abf9699e-...", "fdee704f-..."],
    "razorpay_order_id": "order_xxxxx",
    "razorpay_payment_id": "pay_xxxxx",
    "razorpay_signature": "xxxxx",
    "created_at": "2026-08-27T16:47:00+00:00",
    "paid_at": "2026-08-27T16:48:12+00:00"
  }
}
```

> **Idempotent:** verifying the same `razorpay_payment_id` again returns `already_verified: true` with the existing record — no duplicate is created.

---

## 18. POST /payments/webhook — Razorpay Webhook

Called by Razorpay automatically. Signature verified with `RAZORPAY_WEBHOOK_SECRET`. Handles `payment.captured`, `payment.authorized`, `payment.failed`, `payment.refunded`.

**Response:**
```json
{
  "status": "success",
  "event": "payment.captured",
  "updated": true
}
```

---

## 19. GET /payments — List Payments (Admin Only)

**Requires `X-Admin-Token` header.**

**Query params:** `page`, `per_page`, `status`, `user_type`, `user_id`

```
GET /payments?page=1&per_page=18&status=paid&user_type=student&user_id=abf9699e-8813-439f-93e2-e3c9ac2bde90
X-Admin-Token: <session_token>
```

**Response:**
```json
{
  "status": "success",
  "pagination": { "page": 1, "per_page": 18, "total": 1, "total_pages": 1, "has_next": false, "has_previous": false },
  "data": [ "...payment records..." ]
}
```

**Errors:** `401` — `Admin authentication required`

---

## 20, 21, 22. GET Payment by ID

```
GET /payments/{payment_id}                          → by internal UUID
GET /payments/order/{razorpay_order_id}             → by Razorpay order id
GET /payments/razorpay/{razorpay_payment_id}        → by Razorpay payment id
```

**Response:**
```json
{
  "status": "success",
  "payment": { "...full payment record..." }
}
```

**Errors:** `404` — `Payment not found`

---

## Frontend Usage

### Web (JavaScript) — Search tutors

```js
const res = await fetch('https://ncrhomr.vercel.app/search?type=tutor&city=Delhi&subject=Mathematics&page=1');
const data = await res.json();
console.log(data.data); // list of tutors
```

### Web (JavaScript) — Register a tutor

```js
const res = await fetch('https://ncrhomr.vercel.app/tutor', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Priya Verma',
    mobile_no: '9123456780',
    email: 'priya@gmail.com',
    course: 'B.Sc',
    subject: 'Physics',
    qualification: 'M.Sc',
    experience_years: 5,
    payment: 800,
    city: 'Noida'
  })
});
const data = await res.json();
```

### Web (JavaScript) — Admin login

```js
const res = await fetch('https://ncrhomr.vercel.app/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'secret123' })
});
const data = await res.json();
const token = data.session_token;

// Use token on admin requests
const payments = await fetch('https://ncrhomr.vercel.app/payments', {
  headers: { 'X-Admin-Token': token }
});
```

### Web (JavaScript) — Payment flow

```js
// 1. Create order
const orderRes = await fetch('https://ncrhomr.vercel.app/payments/create-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'abc@gmail.com',
    mobile_no: '6388574919',
    amount: 999,
    user_type: 'student',
    user_ids: 'abf9699e-8813-439f-93e2-e3c9ac2bde90,fdee704f-37eb-42d8-a334-4eed8a0f9101'
  })
});
const order = await orderRes.json();

// 2. Open Razorpay checkout
const options = {
  key: order.key_id,
  amount: order.amount, // paise
  currency: order.currency,
  name: 'NCR Home Tuition',
  order_id: order.razorpay_order_id,
  handler: async function (response) {
    // 3. Verify
    const verifyRes = await fetch('https://ncrhomr.vercel.app/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      })
    });
    const verified = await verifyRes.json();
    console.log('Payment verified:', verified);
  }
};
const rzp = new Razorpay(options);
rzp.open();
```

### Android (Kotlin) — Payment flow

```kotlin
// 1. Create order
val body = JSONObject().apply {
    put("email", "abc@gmail.com")
    put("mobile_no", "6388574919")
    put("amount", 999)
    put("user_type", "student")
    put("user_ids", "abf9699e-8813-439f-93e2-e3c9ac2bde90,fdee704f-37eb-42d8-a334-4eed8a0f9101")
}
// POST /payments/create-order → response: payment_id, razorpay_order_id, amount (paise), key_id

val checkout = Checkout()
checkout.setKeyID(response.key_id)
val options = JSONObject().apply {
    put("name", "NCR Home Tuition")
    put("currency", "INR")
    put("amount", response.amount) // paise
    put("order_id", response.razorpay_order_id)
}
checkout.open(activity, options)

// 2. On success, verify
override fun onPaymentSuccess(paymentId: String?, orderId: String?) {
    val verifyBody = JSONObject().apply {
        put("razorpay_order_id", orderId)
        put("razorpay_payment_id", paymentId)
        put("razorpay_signature", signature)
    }
    // POST /payments/verify
}
```

---

## Typical User Workflows

### Student finds a tutor
1. `GET /search?type=tutor&subject=Mathematics&city=Delhi` → list of tutors
2. `GET /tutor/{id}` → tutor details
3. `POST /payments/create-order` → create order
4. Open Razorpay checkout → pay
5. `POST /payments/verify` → confirm payment
6. `GET /payments/razorpay/{razorpay_payment_id}` → fetch payment record

### Admin manages data
1. `POST /admin/login` → get `session_token`
2. `GET /students` / `GET /tutors` with `X-Admin-Token` → full data (incl. emails, mobiles)
3. `PUT /student/{id}` / `PUT /tutor/{id}` → update status or details
4. `GET /payments` with `X-Admin-Token` → view all payments

---

## Error Handling Summary

| Scenario | HTTP | Detail |
|----------|------|--------|
| Missing env vars (deployment) | 500 | App fails to load |
| Invalid login | 401 | `Invalid username or password` |
| Admin list without token | 401 | `Admin authentication required` |
| Invalid experience filter | 400 | `Invalid experience filter` |
| Invalid sort | 400 | `Invalid sort option` |
| Amount <= 0 | 400 | `amount must be greater than 0` |
| Invalid payment signature | 400 | `Invalid payment signature` |
| Invalid webhook signature | 400 | `Invalid webhook signature` |
| Payment not found | 404 | `Payment not found` |
| Duplicate verification | 200 | `Payment already verified` |
