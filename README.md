<div align="center">

# ⏱️ Pomodoro Timer

### A Full-Stack Productivity App with Authentication & Session Tracking

A modern Pomodoro timer application with user authentication, server-side timer state management, and session tracking — built with a **Node.js/Express** backend and a **React** frontend.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
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

This Pomodoro Timer follows the classic **Pomodoro Technique** — 25-minute focus sessions followed by short breaks, with a longer break after every 4 sessions. What makes this different from a simple browser timer is that it's a **full-stack application**:

- Timer state lives on the **server**, so your session survives page refreshes and device switches
- **User authentication** with both email/password and Google sign-in (Firebase)
- **Secure token management** with JWT access/refresh token rotation
- **Session statistics** tracking to monitor your productivity

> **Repository Structure:** This project is split across two repositories:
> - [`pomodoro-node`](https://github.com/SpaaceCowboy/pomodoro-node) — Backend (Express API + MongoDB + Firebase Admin)
> - [`PomodoroTimer`](https://github.com/SpaaceCowboy/PomodoroTimer) — Frontend (React)

---

## ✨ Features

- **⏱️ Server-Side Timer** — Timer state is managed on the backend with elapsed-time calculation, ensuring accuracy even when the client disconnects
- **🔄 Auto Session Cycling** — Automatically transitions between focus → short break → focus → ... → long break after 4 consecutive sessions
- **🔐 Dual Authentication** — Email/password registration with bcrypt hashing **and** Google Sign-In via Firebase Auth
- **🔑 Secure Token Rotation** — JWT access tokens (15min) + refresh tokens (7 days) with SHA-256 hashing, HTTP-only cookies, and automatic rotation
- **📊 Session Statistics** — Track total completed sessions, consecutive sessions, and next long break countdown
- **🌐 Cross-Device Sync** — Since state lives on the server, start a timer on your laptop and check it on your phone
- **🚀 Serverless Ready** — Vercel-compatible with environment detection for serverless deployment

---

## 🏗️ Architecture

```
┌──────────────────┐         ┌──────────────────────────────────┐
│                  │         │         Backend (Express)         │
│   React Client   │ ◄─────► │                                  │
│   (Vercel)       │  REST   │  ┌────────┐  ┌───────────────┐  │
│                  │  API    │  │ Timer   │  │ Auth Routes   │  │
└──────────────────┘         │  │ Engine  │  │ (JWT + Firebase│  │
                             │  └────────┘  └───────┬───────┘  │
                             │                      │          │
                             │         ┌────────────┴────┐     │
                             │         │    MongoDB      │     │
                             │         │  (Users, Tokens)│     │
                             │         └─────────────────┘     │
                             └──────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend (`pomodoro-node`)

| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Database** | MongoDB (via Mongoose 9) |
| **Auth** | JWT (jsonwebtoken) + Firebase Admin SDK |
| **Password Hashing** | bcryptjs |
| **Token Security** | SHA-256 hashing, HTTP-only cookies, refresh token rotation |
| **Deployment** | Vercel (serverless) / Render |

### Frontend (`PomodoroTimer`)

| Category | Technology |
|----------|-----------|
| **Framework** | React |
| **Auth Provider** | Firebase Auth (Google Sign-In) |
| **Deployment** | Vercel |

---

## 📡 API Reference

### Timer Endpoints

All timer routes are prefixed with `/api`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check — returns server status and current timer state |
| `GET` | `/api/timer/state` | Get current timer state (calculates elapsed time server-side) |
| `POST` | `/api/timer/start` | Start the timer |
| `POST` | `/api/timer/pause` | Pause the timer |
| `POST` | `/api/timer/reset` | Reset timer to current mode's default duration |
| `POST` | `/api/timer/switch` | Toggle between focus and break modes |
| `GET` | `/api/timer/stats` | Get session statistics |

#### Timer State Response

```json
{
  "isRunning": true,
  "isFocus": true,
  "timeLeft": 1320,
  "totalSessions": 3,
  "consecutiveSessions": 3,
  "lastUpdated": 1706234567890
}
```

#### Stats Response

```json
{
  "totalSessions": 7,
  "consecutiveSessions": 3,
  "nextLongBreak": 1,
  "isLongBreakNext": true
}
```

### Auth Endpoints

All auth routes are prefixed with `/api/auth`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register with email, username, password |
| `POST` | `/api/auth/login` | Login — returns JWT access token |
| `POST` | `/api/auth/refresh` | Rotate refresh token and get new access token |
| `POST` | `/api/auth/logout` | Revoke refresh token and clear cookie |
| `POST` | `/api/auth/verify-token` | Verify Firebase ID token (for Google Sign-In) |
| `GET` | `/api/auth/user/:uid` | Get user data by Firebase UID |

### Profile Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profile/me` | Get current authenticated user (requires JWT) |

---

## 🔐 Authentication Flow

The app supports **two authentication methods**:

### 1. Email/Password (Custom JWT)

```
Register → Password hashed (bcrypt) → Stored in MongoDB
Login → Verify credentials → Issue Access Token (15min) + Refresh Token (7 days)
Refresh → Validate refresh cookie → Revoke old token → Issue new pair (rotation)
Logout → Revoke refresh token → Clear HTTP-only cookie
```

**Security measures:**
- Passwords hashed with **bcrypt** (10 rounds)
- Access tokens expire in **15 minutes**
- Refresh tokens stored as **SHA-256 hashes** in MongoDB
- Refresh tokens delivered via **HTTP-only, Secure, SameSite=Strict** cookies
- **Token rotation** — each refresh invalidates the old token and issues a new one
- Revoked tokens tracked with `revokedAt` timestamp and `replacedBy` chain

### 2. Google Sign-In (Firebase)

```
Client → Firebase Auth popup → Get ID Token → Send to /api/auth/verify-token
Backend → Firebase Admin SDK verifies token → Return user info
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **MongoDB** (local or Atlas)
- **Firebase** project (for Google auth)

### Backend Setup

```bash
# Clone the backend
git clone https://github.com/SpaaceCowboy/pomodoro-node.git
cd pomodoro-node

# Install dependencies
npm install

# Create .env file (see Environment Variables section below)
cp .env.example .env

# Start development server
npm run dev
```

The backend will be running at `http://localhost:4000`.

### Frontend Setup

```bash
# Clone the frontend
git clone https://github.com/SpaaceCowboy/PomodoroTimer.git
cd PomodoroTimer

# Install dependencies
npm install

# Start development server
npm start
```

The frontend will be running at `http://localhost:3000`.

---

## 🔧 Environment Variables

Create a `.env` file in the backend root:

```env
# Server
PORT=4000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/pomodoro

# JWT Secrets
JWT_SECRET=your-access-token-secret
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=000000000000000000000
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
```

---

## 🌐 Deployment

The project is deployed as two services:

| Service | Platform | URL |
|---------|----------|-----|
| **Frontend** | Vercel | [pomodoro-timer-teal-pi.vercel.app](https://pomodoro-timer-teal-pi.vercel.app) |
| **Backend** | Render | [pomodorotimer-d9n5.onrender.com](https://pomodorotimer-d9n5.onrender.com) |

The backend includes a `vercel.json` configuration and automatically detects the Vercel serverless environment to skip `app.listen()` in production.

---

## ⏱️ Timer Logic

The Pomodoro cycle follows these durations:

| Mode | Duration |
|------|----------|
| **Focus** | 25 minutes |
| **Short Break** | 5 minutes |
| **Long Break** | 15 minutes (after 4 consecutive focus sessions) |

The timer state is stored in-memory on the server. When the client requests the current state, the server calculates elapsed time since `lastUpdated` and returns the accurate remaining time — this means the timer keeps running even if the client disconnects.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

**Built with ❤️ by [Shayan Shoeibzade](https://github.com/SpaaceCowboy)**

</div>
