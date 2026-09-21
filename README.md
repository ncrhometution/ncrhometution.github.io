<div align="center">

# NCR Home Tuition

**A two-sided tuition marketplace connecting students and home tutors across Delhi NCR and India.**

Students post their tuition needs for free. Tutors browse and unlock student leads. Parents and teachers meet over a free demo class.

[![Live Site](https://img.shields.io/badge/Live_Site-www.ncrhometuitions.com-0f766e?style=for-the-badge)](https://www.ncrhometuitions.com/)
[![API](https://img.shields.io/badge/API-ncrhomr.vercel.app-f59e0b?style=for-the-badge)](https://ncrhomr.vercel.app/)
[![Docs](https://img.shields.io/badge/API_Docs-API__WORKFLOW.md-3b82f6?style=for-the-badge)](API_WORKFLOW.md)

</div>

---

## Overview

NCR Home Tuition is a static, no-build front-end backed by a FastAPI service. It has three sides:

| Audience | What they can do |
| --- | --- |
| **Students / Parents** | Register a tuition requirement for free, browse tutors, filter by city, subject, experience and pay range, and request a free demo class. |
| **Tutors** | Join for free, browse tuition requirements, and unlock a student's contact details using the lead wallet. |
| **Admins** | Review and qualify leads, import leads in bulk (Excel/CSV), monitor payments, and track site traffic and logins. |

Contact details are the monetised part: browsing is open, but revealing a lead costs credits purchased per lead.

---

## Features

### Students & parents
- Free registration of a tuition requirement (class, subject, city, budget, mode)
- Search and filter tutors by city, subject, experience, pay range, with sorting
- Detailed tutor profiles with address, joined date and experience
- Cart-based checkout with transparent per-lead pricing and package savings
- Free demo class request flow

### Tutors
- Free signup and profile creation
- Browse live student requirements, filtered the same way
- Lead wallet: unlock contact details for a single lead or a discounted package
- Razorpay checkout with server-side order creation and signature verification
- "My purchased profiles" list so previously unlocked leads stay accessible

### Admin panel
- **Leads** — search, filter, edit, add single leads, bulk import from Excel/CSV, change status, delete, and manage the preferred gender field
- **Payments** — revenue totals with paid / created / failed breakdowns and per-transaction detail
- **Stats** — visits today, unique visitors, logins today, a daily visits trend, visits by page, and a "who logged in today" list

### Platform
- Firebase Authentication (Google popup and email/password with verification)
- Firestore profile mirror with Supabase as the system of record for listings and payments
- Session-based admin authentication via an `X-Admin-Token` header
- Return-to-page login: users land back on the exact page and filter state they came from
- Fire-and-forget visit and login analytics (never blocks page rendering)
- Fully responsive layout with a custom, dependency-free design system

---

## Tech Stack

**Front-end** — static HTML5, vanilla JavaScript (ES5-compatible), Bootstrap 5.3, Font Awesome 6.5, SweetAlert2, Inter via Google Fonts, custom `css/main.css` design system.

**Back-end** — FastAPI on Vercel, Supabase (PostgreSQL) for persistence, Razorpay for payments, Firebase Auth + Firestore for identity.

No bundler, no build step, no framework runtime. Pages call the API directly through `js/api.js`.

---

## Project Structure

```
.
├── index.html                 Landing page
├── how-it-works.html          Explainer for students and tutors
├── search.html                Tutor / student results with filters
├── data.html                  Full profile view + contact unlock
├── findbyidtutor.html         Find a tutor
├── findbyidtution.html        Find tuition jobs
├── student-register.html      Student requirement form
├── tutor-register.html        Tutor registration
├── cart.html                  Lead wallet checkout
├── verify-payment.html        Razorpay callback and verification
├── login.html / signup.html   Authentication
├── profile.html               User profile management
├── admin-login-page.html      Admin sign-in
├── admin-leads.html           Admin: lead management
├── admin-payments.html        Admin: payment dashboard
├── admin-stats.html           Admin: traffic and login analytics
│
├── js/
│   ├── auth.js                Firebase auth, session, pricing, visit tracking
│   └── api.js                 API client, endpoints, error handling
├── css/main.css               Design tokens and components
│
├── database/
│   ├── create_tables.sql      Schema for all tables
│   ├── students_template.csv  Bulk-import template
│   ├── tutors_template.csv    Bulk-import template
│   └── clear_data.sql         Utility scripts
│
├── backend/main.py            FastAPI application
├── API_WORKFLOW.md            Full endpoint reference
└── CNAME                      Custom domain mapping
```

---

## Pricing Model

Credits are bought per lead. Bundles apply automatically at checkout (`calculateSmartPrice` in `js/auth.js`).

| Quantity | Price | Effective rate |
| --- | --- | --- |
| 1 – 4 leads | ₹99 each | ₹99 / lead |
| 5 leads | ₹399 | ₹80 / lead |
| 10 leads | ₹699 | ₹70 / lead |
| 10 + 5 | ₹399 + ₹699 | Package rate |

---

## API

Base URL: `https://ncrhomr.vercel.app/`

The service exposes registration, search, payment, lead-management and analytics routes. Highlights:

| Area | Endpoints |
| --- | --- |
| Registration | `POST /student`, `POST /tutor` |
| Directory | `GET /students`, `GET /tutors`, `GET /search`, `GET /cities` |
| Profile | `GET/PUT /student/{id}`, `GET/PUT /tutor/{id}` |
| Payments | `POST /payments/create-order`, `POST /payments/verify`, `POST /payments/webhook`, `GET /payments/my` |
| Admin | `POST /admin/login`, `GET /admin/leads`, `POST /admin/leads/bulk`, `GET /admin/stats` |
| Analytics | `POST /visit`, `POST /login-event` |

See [API_WORKFLOW.md](API_WORKFLOW.md) for request and response shapes for every route.

---

## Database Schema

Defined in [`database/create_tables.sql`](database/create_tables.sql). Run it in the Supabase SQL Editor.

| Table | Purpose |
| --- | --- |
| `students` | Student requirements and contact details |
| `tutors` | Tutor profiles, subjects, experience and fees |
| `admins` | Admin accounts |
| `admin_sessions` | Active admin tokens |
| `payments` | Razorpay orders and verification results |
| `page_visits` | Page-level traffic for the Stats dashboard |
| `login_events` | Login and signup history |

Analytics timestamps are recorded in IST (`Asia/Kolkata`) so that "today" in the admin panel matches the local business day.

---

## Running Locally

The front-end is fully static:

```powershell
python -m http.server 8765
```

Then open <http://127.0.0.1:8765/>.

Point the front-end at a different API by editing `API_BASE` at the top of `js/api.js`.

To run the backend, set these environment variables and start `backend/main.py`:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<service-role-key>
RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
```

Never commit real keys. The `.env` file is not read on Vercel — set variables in the Vercel dashboard instead.

---

## Deployment

| Piece | Host | Trigger |
| --- | --- | --- |
| Front-end | GitHub Pages (`www.ncrhometuitions.com`) | Push to `main`, via `.github/workflows/static.yml` |
| Backend | Vercel (`ncrhomr.vercel.app`) | Update the API file and redeploy |
| Database | Supabase | Run `database/create_tables.sql` |

Cache busting is done with query strings on the shared scripts (`js/auth.js?v=6`, `js/api.js?v=3`). Bump these whenever those files change, or browsers will serve a stale copy.

---

## Design System

Brand tokens live at the top of `css/main.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--primary` | `#0f766e` | Brand teal, buttons, links |
| `--accent` | `#f59e0b` | Calls to action, highlights |
| `--success` | `#0d9e6c` | Confirmations |
| `--bg` | `#f6f9f8` | Page background |
| `--font-main` | `Inter` | Global typeface |

---

## License

See [LICENSE](LICENSE).

<div align="center">

**Built for students and tutors across Delhi NCR.**

</div>
