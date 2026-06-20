# CONTINUUM — Phase 1

Offline-first patient ↔ doctor healthcare continuity platform.

## Stack
- **Client:** React + Vite + TypeScript + Tailwind CSS + Dexie.js (IndexedDB)
- **Server:** Node.js + Express + TypeScript + Mongoose
- **Database:** MongoDB Atlas
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **Design:** Daybreak glassmorphism (cream → sky gradient)

---

## Setup

### 1. MongoDB Atlas
1. Create a free account at https://cloud.mongodb.com
2. Create a free M0 cluster
3. Under Database Access → Add user with read/write permissions
4. Under Network Access → Allow access from anywhere (0.0.0.0/0) for dev
5. Click Connect → Drivers → copy the connection string

### 2. Server

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env`:
```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/continuum
JWT_SECRET=generate_a_long_random_string_here
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

Generate a JWT secret (run in terminal):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Start the server:
```bash
npm run dev
```

Server runs on http://localhost:3001

### 3. Client

```bash
cd client
npm install
```

Start the client:
```bash
npm run dev
```

Client runs on http://localhost:5173

---

## Phase 1 — What's built

- [x] JWT auth — register (patient + doctor) and login
- [x] MongoDB models — User, PatientProfile, DoctorProfile, PatientChange
- [x] Offline patient health profile — saved to IndexedDB (Dexie.js)
- [x] Sync engine — flushes pending items to Express when online
  - Exponential backoff (2s → 4s → 8s → 16s → 32s)
  - Max 5 retries then marks FAILED
  - 409 Conflict detection (stale write rejection)
- [x] Audit trail middleware — logs every profile change
- [x] Sync status widget — live pending/failed/synced indicator
- [x] Daybreak design system — cream to sky glassmorphism throughout
- [x] Patient onboarding form (works fully offline)
- [x] Role-based routing (PATIENT / DOCTOR)
- [x] Protected routes
- [x] PWA manifest + service worker (vite-plugin-pwa)

## Phase 2 — Coming next
- Patient ↔ doctor connection system
- Doctor search (by name, specialization, city)
- Async consultation creation with audio
- Doctor consultation response

---

## Testing offline mode

1. Open Chrome DevTools → Network tab → set to Offline
2. Register as a patient
3. Complete health profile and save
4. Open Application tab → IndexedDB → continuum_db → sync_queue
5. You should see the pending profile record
6. Set network back to Online
7. The sync engine fires automatically
8. Check MongoDB Atlas → continuum → patientprofiles collection
