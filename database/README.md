# NCR Home Tuition - Database Setup Guide

## Files

| File | Purpose |
|------|---------|
| `create_tables.sql` | Creates tables + auto-increment triggers |
| `clear_data.sql` | Deletes ALL old data |
| `students_template.csv` | Sample student data (IDs auto-generated) |
| `tutors_template.csv` | Sample tutor data (IDs auto-generated) |

---

## How Auto-Increment Works

| Type | Prefix | Example | Trigger |
|------|--------|---------|---------|
| Student | `NCR` | NCR001, NCR002, NCR003 | Auto on INSERT |
| Tutor | `TECH` | TECH001, TECH002, TECH003 | Auto on INSERT |

**You don't need to specify IDs** — the database trigger auto-generates them.

---

## Step-by-Step Instructions

### Step 1: Clear Old Data

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `clear_data.sql`
3. Copy SQL → paste → click **Run**

### Step 2: Create Tables with Triggers

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `create_tables.sql`
3. Copy SQL → paste → click **Run**
4. You should see "Success" — tables + triggers created

### Step 3: Import CSV (No ID Column Needed!)

1. Go to **Supabase Dashboard** → **Table Editor**
2. Click on **students** table
3. Click **Insert** → **Import from CSV**
4. Select `students_template.csv`
5. Map columns (ID column not in CSV — trigger auto-fills)
6. Click **Import**
7. Verify: IDs should be NCR001, NCR002, NCR003

Repeat for **tutors** table with `tutors_template.csv` (IDs: TECH001, TECH002, TECH003).

---

## Import Your Own Data

### Option A: Import via Supabase Dashboard

1. Prepare your CSV with these columns (NO id column needed):

**Students CSV columns:**
```
type,name,mobile_no,email,course,subject,qualification,Preferred_Gender,preferred_mode,address,city,status,created_at,joined_date,ip_address,user_agent,source
```

**Tutors CSV columns:**
```
type,name,mobile_no,email,course,subject,qualification,experience_years,preferred_mode,address,city,status,created_at,joined_date,ip_address,user_agent,source
```

2. Go to Table Editor → students/tutors → Insert → Import from CSV
3. Map columns → Import
4. IDs auto-generate: NCR001, NCR002... or TECH001, TECH002...

### Option B: Insert via SQL

```sql
-- Student (ID auto-generated)
INSERT INTO students (type, name, mobile_no, email, course, subject, qualification, "Preferred_Gender", preferred_mode, address, city, status, created_at, joined_date, source)
VALUES ('student', 'Dhruv', '9818271412', 'abc@email.com', 'Class 10', 'Mathematics', 'DC Model School', 'Male', 'offline', 'Sector 80, Badauli', 'Faridabad', 'active', '2026-01-22 18:41:52+00', '22/01/26', 'website');

-- Tutor (ID auto-generated)
INSERT INTO tutors (type, name, mobile_no, email, course, subject, qualification, experience_years, preferred_mode, address, city, status, created_at, joined_date, source)
VALUES ('tutor', 'NIKHIL RAJPUT', '9458492500', 'nikhilrajput05892@gmail.com', 'mathematics & science', 'Trigonometry, algebra, mensuration', 'B.Tech. in mechanical engineering', 2, 'offline', 'Sec 78', 'Faridabad', 'active', '2026-03-09 18:34:59+00', '23-05-2026', 'website');
```

---

## Verify

Run this SQL to check:

```sql
SELECT id, name, city FROM students ORDER BY id;
SELECT id, name, city FROM tutors ORDER BY id;
```

Expected output:
```
students:
NCR001 | Dhruv      | Faridabad
NCR002 | Priya      | Faridabad
NCR003 | Amit       | Noida

tutors:
TECH001 | NIKHIL RAJPUT | Faridabad
TECH002 | Rahul Verma   | Gurgaon
TECH003 | Sunita Patel  | Delhi
```

---

## Important Notes

1. **CSV must NOT have id column** — trigger auto-generates it
2. **experience_years** must be a number (`2` not `2 year`)
3. **Text with commas** must be in quotes (`"Sector 80, Badauli"`)
4. **Email** must be valid format
5. After importing, backend auto-increments from highest existing number
6. Old UUID records won't match the pattern — they're ignored by the trigger
