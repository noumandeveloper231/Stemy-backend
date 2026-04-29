# Stemy Backend (MVP)

Express + Prisma backend for Stemy SaaS with:
- Custom JWT auth (email/password, verify email, forgot/reset password)
- Stripe subscriptions (checkout, portal, webhook sync)
- Quick Master workflow scaffold (upload, queue, status, download)
- BullMQ queue + Redis
- Cloudflare R2 storage support
- Resend transactional email support

## 1) Setup

1. Copy `.env.example` to `.env`
2. Fill required values:
   - `DATABASE_URL` (Neon Postgres)
   - `JWT_SECRET`
   - Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and **`STRIPE_BASIC_PRICE_ID` / `STRIPE_PRO_PRICE_ID` must be recurring Price IDs** (`price_…`) from the Dashboard product’s **Pricing** row—not Product IDs (`prod_…`))
   - Optional integrations: `REDIS_URL`, R2, Resend

## 2) Install and run

```bash
npm install
npx prisma generate --no-engine
npm run dev
```

## 3) Database

After setting a valid Neon URL:

```bash
npm run db:migrate
```

## 4) Main API routes

- Auth: `/api/auth/*`
- Users: `/api/users/*`
- Subscriptions: `/api/subscriptions/*`
- Stripe webhook: `/api/webhooks/stripe`
- Masters: `/api/masters/*`

## 5) Test

```bash
npm test
```
# Stemy Authentication Backend

Complete authentication backend with email/password login, Google OAuth, email verification, and password reset.

## Features

- Email/password signup and login
- Google OAuth (Continue with Google)
- Email verification on signup
- Forgot password with email reset link
- JWT session management
- Protected routes
- User profile management

## Quick Start

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Setup environment variables

Edit `.env` file with your credentials:

```env
# Required for basic functionality
JWT_SECRET="your-random-secret-key"

# Required for email features (verification & password reset)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxx"

# Required for Google OAuth
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

### 3. Initialize database

```bash
npx prisma migrate dev --name init
```

### 4. Start the server

```bash
npm run dev
```

Server will run on `http://localhost:3000`

## API Endpoints

### Authentication

| Method | Endpoint                          | Description                  |
| ------ | --------------------------------- | ---------------------------- |
| POST   | `/api/auth/signup`                | Register new user            |
| POST   | `/api/auth/login`                 | Login with email/password    |
| POST   | `/api/auth/google`                | Google OAuth login           |
| POST   | `/api/auth/forgot-password`       | Request password reset       |
| POST   | `/api/auth/reset-password/:token` | Reset password with token    |
| GET    | `/api/auth/verify-email/:token`   | Verify email address         |
| POST   | `/api/auth/resend-verification`   | Resend verification email    |
| GET    | `/api/auth/me`                    | Get current user (protected) |

### User

| Method | Endpoint             | Description                  |
| ------ | -------------------- | ---------------------------- |
| GET    | `/api/user/profile`  | Get user profile (protected) |
| PUT    | `/api/user/profile`  | Update profile (protected)   |
| PUT    | `/api/user/password` | Change password (protected)  |

## Request/Response Examples

### Signup

```bash
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

Response:

```json
{
  "message": "User created successfully...",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false
  },
  "requiresVerification": true
}
```

### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Google OAuth

```bash
POST /api/auth/google
Content-Type: application/json

{
  "email": "user@gmail.com",
  "googleId": "123456789",
  "displayName": "John Doe",
  "firstName": "John",
  "lastName": "Doe",
  "avatarUrl": "https://..."
}
```

## Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
4. Configure consent screen (External)
5. Add authorized JavaScript origins for each dev URL you use (e.g. `http://localhost:5500` for Live Server, `http://localhost:8080` if you use another static port)
6. Copy Client ID and Client Secret to `.env`

## Setup Email (Resend)

We use [Resend](https://resend.com) for reliable email delivery.

1. Sign up at [resend.com](https://resend.com)
2. Go to API Keys → Create API Key
3. Copy the key to your `.env` file as `RESEND_API_KEY`
4. **For production**: Verify your domain at resend.com and update `FROM_EMAIL` to use your domain (e.g., `noreply@yourdomain.com`)

**Note**: With the default `onboarding@resend.dev` sender, emails can only be sent to your own email address. For production use, verify your domain to send to any email address.

## Production Notes

1. Change `JWT_SECRET` to a cryptographically secure random string
2. Use a production database (PostgreSQL recommended)
3. Set up proper CORS for your domain
4. Use environment variables for all secrets
5. Enable HTTPS for all communications
