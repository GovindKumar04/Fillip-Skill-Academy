# Fillip Skill Academy — Backend API Documentation

REST API for the Fillip Skill Academy platform. Handles authentication, course
management (modules, materials, reviews), enrollments, learning progress, and the
contact/enquiry support portal.

- **Runtime:** Node.js + Express 5 (ES Modules)
- **Databases:** PostgreSQL (users / auth) + MongoDB via Mongoose (courses, enrollments, progress, enquiries)
- **Media storage:** Cloudinary (course thumbnails, lesson materials)
- **Email:** Nodemailer (enquiry confirmations & replies)

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Base URL](#base-url)
3. [Authentication & Roles](#authentication--roles)
4. [Standard Response Format](#standard-response-format)
5. [Error Handling](#error-handling)
6. [Endpoints](#endpoints)
   - [Auth](#1-auth----auth)
   - [Courses](#2-courses----courses)
   - [Modules](#3-modules-nested-under-courses)
   - [Materials](#4-materials-nested-under-modules)
   - [Reviews & Testimonials](#5-reviews--testimonials-nested-under-courses)
   - [Contact](#6-contact----contact)
   - [Enquiries](#7-enquiries----enquiries-admin)
   - [Enrollments](#8-enrollments----enrollments)
   - [Progress](#9-progress----progress)
7. [Data Models](#data-models)
8. [Environment Variables](#environment-variables)

---

## Getting Started

```bash
cd backend
npm install
npm start          # runs src/server.js (main entry)
```

The server boots only after both databases connect:

```
Connecting to databases...
✅ PostgreSQL connected
✅ MongoDB connected
🚀 Server running on port 3000
```

---

## Base URL

The Express app mounts routers at the **root** path:

```
http://localhost:3000
```

> **Frontend note:** the React client calls the API through `/api/*` and the Vite
> dev server proxies `/api` → `http://localhost:3000` (stripping the `/api` prefix).
> So `POST /api/auth/login` from the browser hits `POST /auth/login` on the backend.
> All paths in this document are the **backend** paths (no `/api` prefix).

---

## Authentication & Roles

Auth uses **JWT** delivered as **httpOnly cookies** (`accessToken`, `refreshToken`).
A `Bearer` token in the `Authorization` header is also accepted.

```
Authorization: Bearer <accessToken>
```

`verifyJWT` resolves the token (cookie first, then header) and attaches the decoded
payload to `req.user` (`{ id, role, ... }`). `requireRole(...roles)` gates a route to
specific roles.

### Roles

| Role         | Notes                                                            |
|--------------|------------------------------------------------------------------|
| `student`    | Default for self-registration. Learns, reviews, tracks progress. |
| `instructor` | Self-registration allowed. Course/student oversight (scoped).    |
| `admin`      | Full control. **Cannot self-register** — seeded/managed directly.|

### Token lifecycle

- **Login** sets `accessToken` + `refreshToken` cookies and returns the user + access token.
- **`POST /auth/refresh`** issues a new access token from the `refreshToken` cookie.
- **Logout** clears both cookies.

---

## Standard Response Format

Every successful response uses a consistent envelope (`ApiResponse`):

```json
{
  "statusCode": 200,
  "data": { "...": "endpoint-specific payload" },
  "message": "Success",
  "success": true
}
```

- `success` is `true` when `statusCode < 400`.
- `data` holds the payload (object, array, or `null`).

---

## Error Handling

A global error handler returns (`ApiError`):

```json
{
  "success": false,
  "statusCode": 400,
  "message": "title, description, and category are required",
  "errors": [],
  "stack": "...(only when NODE_ENV !== 'production')"
}
```

| Status | Meaning                                            |
|--------|----------------------------------------------------|
| 400    | Bad request / validation failure                   |
| 401    | Missing/invalid token, refresh failure             |
| 403    | Authenticated but not allowed (wrong role / scope) |
| 404    | Resource not found                                 |
| 409    | Conflict (e.g. duplicate enrollment)               |
| 500    | Server error                                       |

---

## Endpoints

**Auth legend:** 🔓 public · 🔑 any logged-in user · 👤 student · 🎓 instructor · 🛡️ admin
*(🔓➕ = optional auth — works for guests, behavior adapts if logged in)*

---

### 1. Auth — `/auth`

| Method | Path             | Auth | Description                          |
|--------|------------------|------|--------------------------------------|
| POST   | `/auth/register` | 🔓   | Register a student or instructor     |
| POST   | `/auth/login`    | 🔓   | Log in, sets auth cookies            |
| POST   | `/auth/logout`   | 🔓   | Clear auth cookies                   |
| POST   | `/auth/refresh`  | 🔓   | Issue a new access token from cookie |
| GET    | `/auth/me`       | 🔑   | Get the current authenticated user   |

#### POST `/auth/register`

Validated with Zod. `role` must be `student` or `instructor` (admin is rejected).

**Body**
```json
{
  "full_name": "Jane Doe",          // min 3, max 100 chars
  "email": "jane@example.com",       // valid email
  "password": "secret123",           // min 6 chars
  "role": "student",                 // "student" | "instructor"
  "phone": "9876543210",             // Indian mobile: ^[6-9]\d{9}$
  "location": "Patna, Bihar"         // 2–255 chars
}
```

**201**
```json
{ "statusCode": 201, "data": { "id": 12, "full_name": "Jane Doe", "email": "jane@example.com", "role": "student" }, "message": "User registered successfully", "success": true }
```

#### POST `/auth/login`

**Body**
```json
{ "email": "jane@example.com", "password": "secret123" }
```

**200** — also sets `accessToken` & `refreshToken` cookies.
```json
{ "statusCode": 200, "data": { "user": { "id": 12, "role": "student", "...": "..." }, "accessToken": "<jwt>" }, "message": "Login successful", "success": true }
```

#### POST `/auth/logout`
Clears cookies. **200** `{ "data": {}, "message": "Logout successful" }`

#### POST `/auth/refresh`
Reads `refreshToken` cookie, validates against the stored token, issues a new `accessToken` cookie. **200** `{ "data": { "accessToken": "<jwt>" } }`

#### GET `/auth/me` 🔑
**200** — current user from PostgreSQL.
```json
{ "statusCode": 200, "data": { "id": 12, "full_name": "Jane Doe", "email": "jane@example.com", "role": "student", "phone": "9876543210", "avatar": null, "is_verified": false, "is_active": true, "created_at": "2026-06-01T..." }, "message": "Current user fetched successfully", "success": true }
```

---

### 2. Courses — `/courses`

> ⚠️ The entire course router is behind `verifyJWT` — **all course endpoints require a logged-in user.** Non-admins only ever see published courses.

| Method | Path                 | Auth  | Description                               |
|--------|----------------------|-------|-------------------------------------------|
| POST   | `/courses`           | 🛡️    | Create a course (optional thumbnail)      |
| GET    | `/courses`           | 🔑    | List courses (published only for non-admin)|
| GET    | `/courses/:courseId` | 🔑    | Get one course with modules & materials   |
| PATCH  | `/courses/:courseId` | 🛡️    | Update a course (optional new thumbnail)  |
| DELETE | `/courses/:courseId` | 🛡️    | Delete course + its modules/materials     |

#### POST `/courses` 🛡️
`multipart/form-data` (so the optional thumbnail file can be attached).

**Fields**
| Field        | Type   | Required | Notes                                   |
|--------------|--------|----------|-----------------------------------------|
| `title`      | string | ✅       |                                         |
| `description`| string | ✅       |                                         |
| `category`   | string | ✅       |                                         |
| `level`      | string | ❌       | `beginner`\|`intermediate`\|`advanced`  |
| `price`      | number | ❌       | defaults `0`                            |
| `thumbnail`  | file   | ❌       | image, field name `thumbnail`           |

**201** → created course document.

#### GET `/courses` 🔑
**Query:** `page` (default 1), `limit` (default 10), `search` (matches title/category/description, case-insensitive). Non-admins are forced to `isPublished: true`. Module list is excluded from this view.

**200**
```json
{ "statusCode": 200, "data": { "courses": [ { "_id": "...", "title": "Full-Stack Dev", "category": "Development", "level": "intermediate", "price": 0, "isPublished": true } ], "total": 1, "page": 1, "limit": 10 }, "message": "Success", "success": true }
```

#### GET `/courses/:courseId` 🔑
Returns the course with `modules` populated, each with their `materials`. Non-admins get **403** if the course is not published.

#### PATCH `/courses/:courseId` 🛡️
`multipart/form-data`. Updatable fields: `title`, `description`, `category`, `level`, `price`, `isPublished`. Send a new `thumbnail` file to replace the image (old one is removed from Cloudinary).

#### DELETE `/courses/:courseId` 🛡️
Cascades — deletes all modules, their materials, and the Cloudinary assets. **200** `{ "data": null, "message": "Course deleted successfully" }`

---

### 3. Modules (nested under courses)

| Method | Path                                    | Auth | Description            |
|--------|-----------------------------------------|------|------------------------|
| POST   | `/courses/:courseId/modules`            | 🛡️   | Add a module           |
| GET    | `/courses/:courseId/modules`            | 🔑   | List modules + materials|
| PATCH  | `/courses/:courseId/modules/:moduleId`  | 🛡️   | Update a module        |
| DELETE | `/courses/:courseId/modules/:moduleId`  | 🛡️   | Delete module + materials|

#### POST `/courses/:courseId/modules` 🛡️
**Body**
```json
{ "title": "Introduction", "description": "Course overview", "order": 0 }
```
`title` required; `order` defaults to the current module count. **201** → module.

#### GET `/courses/:courseId/modules` 🔑
**200** → array of modules (sorted by `order`) with `materials` populated.

#### PATCH `/courses/:courseId/modules/:moduleId` 🛡️
**Body** — any module fields (`title`, `description`, `order`). **200** → updated module.

#### DELETE `/courses/:courseId/modules/:moduleId` 🛡️
Removes the module, its materials, and the Cloudinary files. **200** `{ "data": null }`

---

### 4. Materials (nested under modules)

| Method | Path                                                                | Auth | Description                |
|--------|---------------------------------------------------------------------|------|----------------------------|
| POST   | `/courses/:courseId/modules/:moduleId/materials`                    | 🛡️   | Upload up to 10 files      |
| DELETE | `/courses/:courseId/modules/:moduleId/materials/:materialId`        | 🛡️   | Delete a material          |

#### POST `.../materials` 🛡️
`multipart/form-data`. Field name **`files`** (max 10). Supported types: **video**, **pdf**, **image** (inferred from MIME type).

**Optional titles:** send a `titles` field as a JSON array string (`'["Intro","Notes"]'`) or a comma-separated list. Each title maps to the file at the same index; falls back to the original filename.

**201**
```json
{ "statusCode": 201, "data": [ { "_id": "...", "title": "Intro", "type": "video", "url": "https://res.cloudinary.com/...", "duration": 312, "size": 10485760 } ], "message": "1 material(s) uploaded successfully", "success": true }
```

#### DELETE `.../materials/:materialId` 🛡️
Removes the Cloudinary asset and the DB record. **200** `{ "data": null }`

---

### 5. Reviews & Testimonials (nested under courses)

| Method | Path                                       | Auth | Description                              |
|--------|--------------------------------------------|------|------------------------------------------|
| GET    | `/courses/:courseId/reviews`               | 🔑   | Paginated reviews + average rating       |
| GET    | `/courses/:courseId/reviews/testimonials`  | 🔑   | Featured reviews only                    |
| POST   | `/courses/:courseId/reviews`               | 👤   | Add/update own review (must be enrolled) |
| DELETE | `/courses/:courseId/reviews`               | 🔑   | Delete own review (admin: any via query) |
| PATCH  | `/courses/:courseId/reviews/featured`      | 🛡️   | Toggle a review's testimonial flag       |

#### GET `/courses/:courseId/reviews` 🔑
**Query:** `page` (1), `limit` (10). **200**
```json
{ "statusCode": 200, "data": { "reviews": [ { "userId": "uuid", "rating": 5, "comment": "Great!", "isFeatured": false, "createdAt": "...", "user": { "id": "uuid", "full_name": "Jane", "avatar": null } } ], "total": 1, "averageRating": 5, "page": 1, "limit": 10 }, "success": true }
```

#### POST `/courses/:courseId/reviews` 👤
Caller must have an active enrollment. One review per user per course (re-posting updates it).
**Body** `{ "rating": 5, "comment": "Loved it" }` — `rating` 1–5 required.
**200** `{ "data": { "averageRating": 4.8, "totalReviews": 12 }, "message": "Review added" }`

#### DELETE `/courses/:courseId/reviews` 🔑
Deletes the caller's own review. **Admin** may delete anyone's by passing `?userId=<id>`. **200** `{ "data": null, "message": "Review deleted" }`

#### PATCH `/courses/:courseId/reviews/featured` 🛡️
**Body** `{ "userId": "uuid", "isFeatured": true }` — `userId` required; omit `isFeatured` to toggle. **200** → updated review.

---

### 6. Contact — `/contact`

Public-facing support entry point. Uses **optional auth** — works for guests, and tailors output for logged-in users.

| Method | Path               | Auth   | Description                                   |
|--------|--------------------|--------|-----------------------------------------------|
| GET    | `/contact/info`    | 🔓➕   | Phone/email/WhatsApp contact details          |
| POST   | `/contact/enquiry` | 🔓➕   | Submit an enquiry (creates a support ticket)  |

> Admins are blocked from both (they use the enquiry portal instead → **403**).

#### GET `/contact/info` 🔓➕
WhatsApp routing adapts to the caller (guest / instructor / enrolled student / guest student).
**200**
```json
{ "statusCode": 200, "data": { "phone": { "number": "+91...", "label": "Call Admin Directly", "link": "tel:+91..." }, "email": { "address": "admin@...", "label": "Email Us", "link": "mailto:admin@..." }, "whatsapp": { "number": "+91...", "type": "Guest Support", "prefilledMessage": "Hi! I am interested...", "link": "https://wa.me/..." } }, "success": true }
```

#### POST `/contact/enquiry` 🔓➕
Saves a ticket to MongoDB and emails a confirmation.
**Body**
```json
{
  "subject": "Course question",     // required
  "message": "How long is access?", // required
  "name": "Guest User",             // required for guests (auto-filled if logged in)
  "email": "guest@example.com",     // required for guests (auto-filled if logged in)
  "phone": "9876543210",            // optional
  "category": "general"             // optional: course_issue|payment|general|technical
}
```
**200**
```json
{ "statusCode": 200, "data": { "ticketId": "TKT-0001" }, "message": "Enquiry submitted! Your ticket ID is TKT-0001. We will get back to you within 24 hours.", "success": true }
```

---

### 7. Enquiries — `/enquiries` (admin)

> Entire router is `verifyJWT` + `requireRole("admin")`. **All endpoints are admin-only.**

| Method | Path                      | Auth | Description                              |
|--------|---------------------------|------|------------------------------------------|
| GET    | `/enquiries`              | 🛡️   | List enquiries (filters + pagination)    |
| GET    | `/enquiries/stats`        | 🛡️   | Dashboard counts & avg response time     |
| GET    | `/enquiries/:id`          | 🛡️   | One enquiry + reply history + links      |
| POST   | `/enquiries/:id/reply`    | 🛡️   | Reply (emails the user, marks contacted) |
| PATCH  | `/enquiries/:id/status`   | 🛡️   | Update status / priority / admin note    |

#### GET `/enquiries` 🛡️
**Query:** `page`, `limit`, `status`, `role`, `priority`, `category`, `search` (name/email/subject/ticketId). Replies are omitted from the list view.

#### GET `/enquiries/stats` 🛡️
**200** → `{ total, byStatus, byRole, byCategory, avgResponseTime }`.

#### GET `/enquiries/:id` 🛡️
**200** → `{ enquiry, contactLinks: { callLink, whatsappLink, mailLink } }`.

#### POST `/enquiries/:id/reply` 🛡️
**Body** `{ "message": "Thanks for reaching out..." }`. Appends an admin reply, sets status `contacted`, emails the user. Fails (**400**) if the enquiry is already `resolved`.

#### PATCH `/enquiries/:id/status` 🛡️
**Body** `{ "status": "resolved", "priority": "high", "adminNote": "Called back" }` — all optional. Setting `resolved` stamps `respondedAt`.

---

### 8. Enrollments — `/enrollments`

> Entire router behind `verifyJWT`.

| Method | Path                                      | Auth        | Description                          |
|--------|-------------------------------------------|-------------|--------------------------------------|
| GET    | `/enrollments/my-courses`                 | 🔑          | Caller's enrolled courses + progress |
| POST   | `/enrollments`                            | 🛡️          | Enroll a student into a course       |
| DELETE | `/enrollments/:enrollmentId`              | 🛡️          | Unenroll (soft delete)               |
| GET    | `/enrollments/course/:courseId/students`  | 🛡️ / 🎓     | Students in a course (+ progress)    |
| GET    | `/enrollments/student/:userId`            | 🛡️          | All courses a student is enrolled in |

#### GET `/enrollments/my-courses` 🔑
**200** → array of `{ enrollmentId, enrolledAt, course, progress: { completionPercent, lastAccessedAt } }`.

#### POST `/enrollments` 🛡️
**Body** `{ "userId": 12, "courseId": "<ObjectId>" }`. The target user must exist in PostgreSQL and be a `student`. Re-enrolls (re-activates) a previously unenrolled student. Creates an empty progress doc on first enrollment.
- **201** → enrollment created · **200** → re-enrolled · **409** → already enrolled.

#### DELETE `/enrollments/:enrollmentId` 🛡️
Soft delete (`isActive=false`, stamps `unenrolledAt`) — keeps progress history. **200**.

#### GET `/enrollments/course/:courseId/students` 🛡️ / 🎓
**Query:** `page` (1), `limit` (20). Instructors may only view their own courses (else **403**). **200** → `{ students: [ { enrollmentId, enrolledAt, user, progress } ], total, page, limit }`.

#### GET `/enrollments/student/:userId` 🛡️
**200** → array of `{ enrollmentId, enrolledAt, course, progress }` for that student.

---

### 9. Progress — `/progress`

> Entire router behind `verifyJWT`.

| Method | Path                            | Auth        | Description                                 |
|--------|---------------------------------|-------------|---------------------------------------------|
| POST   | `/progress/mark-watched`        | 👤          | Mark a material watched/completed           |
| GET    | `/progress/my-progress/:courseId`| 🔑         | Caller's detailed progress in a course      |
| GET    | `/progress/course/:courseId`    | 🛡️ / 🎓     | All students' progress in a course          |
| GET    | `/progress/student/:userId`     | 🛡️          | A student's progress across all courses     |
| GET    | `/progress/overview`            | 🛡️          | Platform-wide progress overview             |

#### POST `/progress/mark-watched` 👤
Caller must be enrolled & active in the course.
**Body**
```json
{ "courseId": "<ObjectId>", "materialId": "<ObjectId>", "watchPercent": 100 }
```
Recomputes `completionPercent` (unique materials watched ÷ total materials). Sets `completedAt` when it reaches 100%.
**200** → `{ completionPercent, completedAt, totalMaterials, completedMaterials }`.

#### GET `/progress/my-progress/:courseId` 🔑
Per-module breakdown with each material's `isCompleted` flag.
**200** → `{ courseId, courseTitle, completionPercent, lastAccessedAt, completedAt, enrolledAt, moduleBreakdown: [...] }`.

#### GET `/progress/course/:courseId` 🛡️ / 🎓
**Query:** `page` (1), `limit` (20). Instructors restricted to their own courses. **200** → `{ courseTitle, totalMaterials, summary: { totalEnrolled, avgCompletionPercent, fullyCompleted, inProgress }, students: [...], page, limit, total }`.

#### GET `/progress/student/:userId` 🛡️
**200** → array of `{ courseId, courseTitle, courseThumbnail, category, completionPercent, lastAccessedAt, completedAt, enrolledAt }`.

#### GET `/progress/overview` 🛡️
Aggregated per-course stats. **200** → array of `{ courseId, courseTitle, totalStudents, avgCompletion, completed, neverStarted, completionRate }`.

---

## Data Models

### PostgreSQL — `users`
Authoritative store for identity. Referenced from Mongo documents by `userId`.

| Column        | Notes                                            |
|---------------|--------------------------------------------------|
| `id`          | Primary key (referenced as `userId` in Mongo)    |
| `full_name`   |                                                  |
| `email`       | Unique                                           |
| `password`    | bcrypt hash                                       |
| `role`        | `student` \| `instructor` \| `admin`             |
| `phone`       |                                                  |
| `location`    |                                                  |
| `avatar`      | Nullable                                         |
| `is_verified` | Boolean                                          |
| `is_active`   | Boolean                                          |
| `refresh_token`| Current refresh token (validated on refresh)    |
| `created_at`  |                                                  |

### MongoDB (Mongoose)

#### Course
```
title*        String
description*  String
category*     String
level         "beginner" | "intermediate" | "advanced"  (default "beginner")
price         Number (default 0)
thumbnail / thumbnailPublicId   String  (Cloudinary)
isPublished   Boolean (default false)
createdBy     String   (PG user id)
modules       [ObjectId → Module]
prerequisites / benefits / targetAudience   [String]
language      String (default "English")
totalDuration / totalStudentsEnrolled       Number
averageRating / totalReviews                Number
reviews       [{ userId, rating 1–5, comment, isFeatured, createdAt }]
timestamps
```

#### Module
```
title*        String
description   String
course*       ObjectId → Course
order         Number (default 0)
materials     [ObjectId → Material]
timestamps
```

#### Material
```
title*    String
type*     "pdf" | "image" | "video"
url*      String  (Cloudinary URL)
publicId* String  (Cloudinary id, used for deletion)
module*   ObjectId → Module
order     Number
duration  Number (seconds, videos)
size      Number (bytes)
timestamps
```

#### Enrollment
```
userId*       Number  (PG user id)
courseId*     ObjectId → Course
enrolledBy*   Number  (admin PG id)
isActive      Boolean (default true)
unenrolledAt  Date
timestamps
unique index: { userId, courseId }
```

#### Progress
```
userId*            Number  (PG user id)
courseId*          ObjectId → Course
completedMaterials [{ materialId, watchedAt, watchPercent 0–100 }]
completionPercent  Number 0–100 (default 0)
lastAccessedAt     Date
completedAt        Date (set at 100%)
timestamps
unique index: { userId, courseId }
```

#### Enquiry
```
ticketId   String  (auto: "TKT-0001", "TKT-0002", ...)
name*      String
email*     String
phone      String
subject*   String
message*   String
role       "guest" | "student" | "instructor"  (default "guest")
status     "pending" | "contacted" | "resolved"  (default "pending")
priority   "low" | "medium" | "high" | "urgent"  (default "medium")
category   "course_issue" | "payment" | "general" | "technical"  (default "general")
adminNote  String
replies    [{ message, sentBy: "user"|"admin", sentAt }]
respondedAt Date
timestamps
```

> `*` = required.

---

## Environment Variables

Create a `.env` in `backend/`:

```ini
# Server
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173        # used for CORS in production

# JWT
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret

# PostgreSQL (users) — see src/config/db.js
DATABASE_URL=postgres://user:pass@host:5432/dbname
# (or PGHOST / PGUSER / PGPASSWORD / PGDATABASE / PGPORT)

# MongoDB (courses, enrollments, progress, enquiries)
MONGODB_URI=mongodb://localhost:27017/fillip

# Cloudinary (media)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Email (Nodemailer)
SMTP_USER=you@gmail.com
SMTP_PASS=app_password
ADMIN_EMAIL=admin@fillip.com
ADMIN_PHONE=+91XXXXXXXXXX

# WhatsApp routing (contact info)
WHATSAPP_GUEST=+91XXXXXXXXXX
WHATSAPP_INSTRUCTOR=+91XXXXXXXXXX
WHATSAPP_ENROLLED=+91XXXXXXXXXX
```

> Exact PostgreSQL and Cloudinary/Mongo variable names depend on `src/config/db.js`,
> `src/config/mongodb.js`, and `src/config/cloudinary.js` — check those files and
> match your `.env` accordingly.

---

*Generated from the route, controller, and model source under `backend/src/`. Keep
this file in sync when endpoints change.*
