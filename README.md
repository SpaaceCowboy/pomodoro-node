<div align="center">

# ⏱️ Pomodoro Timer

### A full-stack productivity app with optional sync, sharing, and session tracking

A modern Pomodoro timer application with optional authentication, server-side timer state management, session tracking, public profiles, friends, rooms, and PWA notifications — built with a **Node.js/Express** backend and a **Next.js** frontend.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000?style=for-the-badge&logo=vercel&logoColor=white)

[Live App](https://pomodoro-timer-teal-pi.vercel.app) · [Backend Repo](https://github.com/SpaaceCowboy/pomodoro-node) · [Frontend Repo](https://github.com/SpaaceCowboy/PomodoroTimer)

</div>

---

## 📋 Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [API Reference](#-api-reference)
- [Authentication Flow](#-authentication-flow)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🔍 About the Project

This Pomodoro Timer follows the classic **Pomodoro Technique** — 25-minute focus sessions followed by short breaks, with a longer break after every 4 sessions. What makes this different from a simple browser timer is that it can run local-first without an account, then sync authenticated users through a full-stack backend:

- Timer state lives on the **server** for signed-in users, so sessions survive refreshes and device switches
- Anonymous users can still use the frontend locally before deciding to sign in
- **User authentication** with email/password, access tokens, and refresh-token rotation
- **Secure token management** with JWT access/refresh token rotation
- **Session statistics** tracking to monitor your productivity
- Opt-in **public profiles** at `/u/:handle` for sharing weekly focus stats
- Friends, live focus presence, and co-focus rooms for signed-in users

> **Repository Structure:** This project is split across two repositories:
>
> - [`pomodoro-node`](https://github.com/SpaaceCowboy/pomodoro-node) — Backend (Express API + PostgreSQL)
> - [`PomodoroTimer`](https://github.com/SpaaceCowboy/PomodoroTimer) — Frontend (Next.js)

---

## ✨ Features

- **⏱️ Server-Side Timer** — Timer state is managed on the backend with elapsed-time calculation, ensuring accuracy even when the client disconnects
- **🔄 Auto Session Cycling** — Automatically transitions between focus → short break → focus → ... → long break after 4 consecutive sessions
- **🔐 Email Authentication** — Email/password registration with bcrypt hashing
- **🔑 Secure Token Rotation** — JWT access tokens (15min) + refresh tokens (7 days) with SHA-256 hashing, HTTP-only cookies, and automatic rotation
- **📊 Session Statistics** — Track completed sessions, labels, streaks, daily goals, weekly totals, and next long break countdown
- **🌍 Public Profiles** — Signed-in users can opt in to a public `/u/:handle` profile showing weekly focus time, streak, and top labels
- **👥 Friends & Rooms** — Friend requests, live focus presence, and shareable co-focus rooms
- **🔔 PWA Push Notifications** — Authenticated browser subscriptions receive segment-end notifications
- **🌐 Cross-Device Sync** — Since state lives on the server, start a timer on your laptop and check it on your phone
- **🚀 Serverless Ready** — Vercel-compatible with environment detection for serverless deployment

---

## 🏗️ Architecture

```
┌──────────────────┐         ┌──────────────────────────────────┐
│                  │         │         Backend (Express)         │
│   Next.js Client │ ◄─────► │                                  │
│   (Vercel)       │  REST   │  ┌────────┐  ┌───────────────┐  │
│                  │  API    │  │ Timer   │  │ Auth Routes   │  │
└──────────────────┘         │  │ Engine  │  │ (JWT)         │  │
                             │  └────────┘  └───────┬───────┘  │
                             │                      │          │
                             │         ┌────────────┴────┐     │
                             │         │   PostgreSQL    │     │
                             │         │ Users, Sessions │     │
                             │         └─────────────────┘     │
                             └──────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend (`pomodoro-node`)

| Category             | Technology                                                 |
| -------------------- | ---------------------------------------------------------- |
| **Runtime**          | Node.js                                                    |
| **Framework**        | Express.js                                                 |
| **Database**         | PostgreSQL (via node-postgres)                             |
| **Auth**             | JWT (jsonwebtoken)                                         |
| **Password Hashing** | bcryptjs                                                   |
| **Token Security**   | SHA-256 hashing, HTTP-only cookies, refresh token rotation |
| **Deployment**       | Vercel (serverless) / Render                               |

### Frontend (`PomodoroTimer`)

| Category       | Technology                 |
| -------------- | -------------------------- |
| **Framework**  | Next.js App Router + React |
| **Deployment** | Vercel                     |

---

## 📡 API Reference

### Timer Endpoints

All timer routes are prefixed with `/api`.

| Method  | Endpoint                  | Description                                                                           |
| ------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `GET`   | `/api/health`             | Health check — returns server status and timestamp                                    |
| `GET`   | `/api/timer/state`        | Get current timer state (calculates elapsed time server-side)                         |
| `POST`  | `/api/timer/start`        | Start the timer                                                                       |
| `POST`  | `/api/timer/pause`        | Pause the timer                                                                       |
| `POST`  | `/api/timer/reset`        | Reset timer to current mode's default duration                                        |
| `POST`  | `/api/timer/switch`       | Toggle between focus and break modes                                                  |
| `GET`   | `/api/timer/stats`        | Get session statistics                                                                |
| `GET`   | `/api/timer/sessions`     | List timer sessions, with optional `from`, `to`, `limit`, `mode`, and `label` filters |
| `GET`   | `/api/timer/stats/labels` | Aggregate completed focus time by label                                               |
| `POST`  | `/api/timer/merge-local`  | Merge anonymous local timer data into an authenticated account                        |
| `PATCH` | `/api/timer/label`        | Update the current focus segment label                                                |

#### Timer State Response

```json
{
  "isRunning": true,
  "isFocus": true,
  "timeLeft": 1320,
  "totalSessions": 3,
  "consecutiveSessions": 3,
  "currentLabel": "Launch prep",
  "lastUpdated": 1706234567890
}
```

#### Stats Response

```json
{
  "totalSessions": 7,
  "consecutiveSessions": 3,
  "nextLongBreak": 1,
  "isLongBreakNext": true,
  "todayFocus": 2,
  "weekFocus": 9,
  "todayFocusMin": 50,
  "dailyFocusGoalMin": 60,
  "streak": 4,
  "streakEnabled": true
}
```

### Auth Endpoints

All auth routes are prefixed with `/api/auth`.

| Method | Endpoint             | Description                                   |
| ------ | -------------------- | --------------------------------------------- |
| `POST` | `/api/auth/register` | Register with email, username, password       |
| `POST` | `/api/auth/login`    | Login — returns JWT access token              |
| `POST` | `/api/auth/refresh`  | Rotate refresh token and get new access token |
| `POST` | `/api/auth/logout`   | Revoke refresh token and clear cookie         |

### Profile Endpoints

| Method  | Endpoint          | Description                                         |
| ------- | ----------------- | --------------------------------------------------- |
| `GET`   | `/api/profile/me` | Get current authenticated user (requires JWT)       |
| `PATCH` | `/api/profile/me` | Update nickname, avatar, and public profile setting |

### Public Profile Endpoints

| Method | Endpoint                    | Description                              |
| ------ | --------------------------- | ---------------------------------------- |
| `GET`  | `/api/public/users/:handle` | Get an opt-in public profile by username |

Public profiles are private by default. When enabled, the public response contains display name, username, avatar, joined date, weekly focus totals, all-time focus totals, current streak, and top labels. It does not expose email addresses.

### Social Endpoints

All social routes are prefixed with `/api/social` and require JWT auth.

| Method   | Endpoint                         | Description                                            |
| -------- | -------------------------------- | ------------------------------------------------------ |
| `GET`    | `/api/social/users/search?q=`    | Search users by username, nickname, name, or email     |
| `GET`    | `/api/social/friends`            | Get friends, pending requests, and live focus presence |
| `POST`   | `/api/social/friends/request`    | Send a friend request                                  |
| `POST`   | `/api/social/friends/:id/accept` | Accept a friend request                                |
| `DELETE` | `/api/social/friends/:id`        | Remove or cancel a friendship                          |
| `POST`   | `/api/social/rooms`              | Create a co-focus room                                 |
| `POST`   | `/api/social/rooms/:code/join`   | Join a room by code                                    |
| `GET`    | `/api/social/rooms/:code`        | Get room details and member presence                   |
| `POST`   | `/api/social/rooms/:code/leave`  | Leave a room                                           |

### Push Endpoints

All push routes are prefixed with `/api/push` and require JWT auth.

| Method   | Endpoint              | Description                           |
| -------- | --------------------- | ------------------------------------- |
| `GET`    | `/api/push/vapid-key` | Get the browser push VAPID public key |
| `POST`   | `/api/push/subscribe` | Save a browser push subscription      |
| `DELETE` | `/api/push/subscribe` | Remove a browser push subscription    |

---

## 🔐 Authentication Flow

The app uses email/password authentication with short-lived access tokens and rotating refresh tokens.

```
Register → Password hashed (bcrypt) → Stored in PostgreSQL
Login → Verify credentials → Issue Access Token (15min) + Refresh Token (7 days)
Refresh → Validate refresh cookie → Revoke old token → Issue new pair (rotation)
Logout → Revoke refresh token → Clear HTTP-only cookie
```

**Security measures:**

- Passwords hashed with **bcrypt** (10 rounds)
- Access tokens expire in **15 minutes**
- Refresh tokens stored as **SHA-256 hashes** in PostgreSQL
- Refresh tokens delivered via **HTTP-only, Secure, SameSite=Strict** cookies
- **Token rotation** — each refresh invalidates the old token and issues a new one
- Revoked tokens tracked with `revokedAt` timestamp and `replacedBy` chain

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.9+
- **PostgreSQL** 14+

### Backend Setup

```bash
# Clone the backend
git clone https://github.com/SpaaceCowboy/pomodoro-node.git
cd pomodoro-node

# Install dependencies
npm install

# Create .env file (see Environment Variables section below)
cp .env.example .env

# Create/update the PostgreSQL schema
npm run db:migrate

# Start development server
npm run dev
```

The backend will be running at `http://localhost:4002` unless `PORT` is set.

### Frontend Setup

```bash
# Clone the frontend
git clone https://github.com/SpaaceCowboy/PomodoroTimer.git
cd PomodoroTimer

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be running at `http://localhost:3002`.

---

## 🔧 Environment Variables

Create a `.env` file in the backend root:

```env
# Server
PORT=4002
NODE_ENV=development
CORS_ORIGINS=http://localhost:3002

# PostgreSQL
DATABASE_URL=postgresql://pomodoro:<password>@127.0.0.1:5432/pomodoro

# JWT Secrets
JWT_SECRET=your-access-token-secret
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# PWA Push
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:you@example.com
```

---

## 🌐 Deployment

The project is deployed as two services:

| Service      | Platform | URL                                                                            |
| ------------ | -------- | ------------------------------------------------------------------------------ |
| **Frontend** | Vercel   | [pomodoro-timer-teal-pi.vercel.app](https://pomodoro-timer-teal-pi.vercel.app) |
| **Backend**  | Render   | [pomodorotimer-d9n5.onrender.com](https://pomodorotimer-d9n5.onrender.com)     |

The backend includes a `vercel.json` configuration and automatically detects the Vercel serverless environment to skip `app.listen()` in production.

Release preparation, deployment order, rollback, database recovery, alert thresholds, and incident response are documented in the [production operations runbook](docs/operations.md).

---

## ⏱️ Timer Logic

The Pomodoro cycle follows these durations:

| Mode            | Duration                                        |
| --------------- | ----------------------------------------------- |
| **Focus**       | 25 minutes                                      |
| **Short Break** | 5 minutes                                       |
| **Long Break**  | 15 minutes (after 4 consecutive focus sessions) |

Signed-in timer state is stored in PostgreSQL. When the client requests the current state, the server calculates elapsed wall-clock time from the stored segment start and remaining duration, finalizes any completed segments, writes session records, and returns the accurate remaining time. This means the timer keeps running even if the client disconnects.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

**Built with ❤️ by [Shayan Shoeibzade](https://github.com/SpaaceCowboy)**

</div>
