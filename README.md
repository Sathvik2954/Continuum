# CONTINUUM

**Offline-first healthcare continuity platform - patient ↔ doctor, anywhere.**

**Live:** https://continuum-alpha-two.vercel.app

**API:** https://continuum-a8um.onrender.com

---

## What it is

CONTINUUM is a healthcare continuity platform built for patients who see multiple doctors and lose the thread between appointments - and for doctors who spend the first ten minutes of every consultation asking questions that were already answered by someone else.

Patients maintain a single, portable health record: conditions, medications, consultations, lab reports, vitals. They share access with specific doctors. Doctors see the full picture before responding. Everything works offline and syncs when connectivity returns.

---

## Features

### For patients

- **Health timeline** - every consultation, condition, medication, document, and vital in one chronological feed
- **Async consultations** - record symptoms by voice, submit to a connected doctor, receive a response with structured medications and follow-up scheduling
- **Document upload** - lab reports, scans, and prescriptions attached to your record, compressed client-side before upload
- **Vitals tracking** - blood pressure, glucose, weight, heart rate with trend charts
- **Live calls** - scheduled WebRTC video calls with doctors, call audio saved to your timeline automatically
- **Offline-first** - everything above works without internet; data syncs automatically when back online

### For doctors

- **Patient timeline view** - full health history before responding to any consultation
- **Structured medications** - prescribe with dosage, frequency, duration, and instructions; active medications surfaced in the patient's profile
- **Condition management** - add chronic conditions with severity and status; only doctors can add conditions (not inferred from symptom checkboxes)
- **Follow-up scheduling** - schedule follow-ups from any consultation response; overdue follow-ups surfaced on the dashboard
- **Doctor-initiated check-ins** - reach out to chronic patients without waiting for them to submit a consultation
- **Analytics** - patient count, avg response time, follow-up completion rate, top conditions, call stats; CSV export

### For admins

- **Doctor verification** - one-click approve/revoke verified status
- **User management** - view all users, filter by role, soft-delete accounts
- **Storage monitoring** - file count and total MB across uploads

---

## Architecture

```
continuum/
├── client/          React + Vite + TypeScript + Tailwind CSS
│   ├── PWA          vite-plugin-pwa (offline shell, service worker)
│   ├── Offline DB   Dexie.js (IndexedDB) - sync queue + timeline cache
│   └── Real-time    Socket.io client + RTCPeerConnection (WebRTC)
│
└── server/          Node.js + Express + TypeScript
    ├── Database     MongoDB Atlas (Mongoose ODM)
    ├── Auth         JWT (jsonwebtoken + bcryptjs)
    ├── Files        Multer - audio, images, call recordings
    ├── Real-time    Socket.io - WebRTC signaling server
    └── i18n         Client-side (i18next) - English, Hindi, Telugu
```

### Offline sync flow

```
Patient (offline)
├── Creates consultation ──► IndexedDB sync_queue (pending)
├── Records audio ──────────► IndexedDB blobs store
└── Logs vitals ────────────► IndexedDB sync_queue (pending)

[connectivity returns]

Sync engine
├── Upload blobs ──────────► Express → /uploads/audio/
├── POST records ──────────► Express → MongoDB
├── Mark synced ───────────► IndexedDB update
└── Pull fresh data ───────► Update IndexedDB cache
```

Conflict resolution: client sends `updatedAt`, server rejects stale writes with HTTP 409. User sees a non-blocking notification - no silent data loss.

### WebRTC call flow

```
Patient                Signaling (Socket.io)          Doctor
├── join_room ────────────────────────────────────────►│
│◄────────────────── peer_joined ─────────────────────┤
├── sdp_offer (forwarded) ───────────────────────────►│
│◄────────────── sdp_answer (forwarded) ──────────────┤
│◄══════════════ P2P audio + video ═══════════════════►│
│
[call ends]
├── Patient's device stops MediaRecorder
├── Uploads audio blob to server
└── Server creates LIVE_CALL consultation → appears on timeline
```

---

## Tech stack

| Layer            | Technology                                               |
| ---------------- | -------------------------------------------------------- |
| Frontend         | React 18, Vite, TypeScript, Tailwind CSS                 |
| Offline storage  | Dexie.js (IndexedDB wrapper)                             |
| PWA              | vite-plugin-pwa                                          |
| Real-time        | Socket.io client, RTCPeerConnection                      |
| i18n             | i18next, react-i18next, i18next-browser-languagedetector |
| Backend          | Node.js, Express, TypeScript                             |
| Database         | MongoDB Atlas (Mongoose)                                 |
| Auth             | JWT (jsonwebtoken), bcryptjs                             |
| File upload      | Multer                                                   |
| Signaling        | Socket.io (same Express server, same port)               |
| TURN             | Xirsys (NAT traversal for WebRTC)                        |
| Frontend hosting | Vercel                                                   |
| Backend hosting  | Render                                                   |

---

## Local setup

### Prerequisites

- Node.js 20+
- npm
- MongoDB Atlas account (free M0 cluster)
- Git

### 1. Clone and install

```bash
git clone https://github.com/your-username/continuum.git
cd continuum

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/continuum
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
PORT=3001
CLIENT_ORIGIN=http://localhost:5173

# Optional - TURN server for WebRTC NAT traversal
# Without these, calls work on the same network but may fail on mobile data
XIRSYS_IDENT=
XIRSYS_SECRET=
XIRSYS_CHANNEL=
```

### 3. Configure the client

Create `client/.env`:

```env
VITE_API_ORIGIN=http://localhost:3001
```

### 4. Run

```bash
# Terminal 1 - server
cd server && npm run dev

# Terminal 2 - client
cd client && npm run dev
```

Client runs at `http://localhost:5173`, server at `http://localhost:3001`.

---

## Creating an admin account

Admin accounts cannot be self-registered by design (prevents privilege escalation). To create one:

1. Register normally as a patient
2. Open MongoDB Atlas → Collections → `users`
3. Find your document, change `role: "PATIENT"` to `role: "ADMIN"`
4. Log out and log back in

---

## Deployment

### Render (backend)

| Setting        | Value                          |
| -------------- | ------------------------------ |
| Root directory | `server`                       |
| Build command  | `npm install && npm run build` |
| Start command  | `npm start`                    |
| Environment    | Node                           |

Add all `.env` variables in Render's Environment tab. `CLIENT_ORIGIN` must match your Vercel URL exactly, no trailing slash.

> **Note:** Render's free tier sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. WebRTC calls will fail if the signaling server is cold - upgrade to a paid instance before live use.

### Vercel (frontend)

| Setting          | Value           |
| ---------------- | --------------- |
| Root directory   | `client`        |
| Framework preset | Vite            |
| Build command    | `npm run build` |
| Output directory | `dist`          |

Add `VITE_API_ORIGIN=https://continuum-a8um.onrender.com` in Vercel's Environment Variables.

> **Note:** Uploaded files (audio, documents, call recordings) are stored on Render's ephemeral filesystem and are lost on every redeploy. For production use, replace the local Multer storage with Cloudflare R2 or AWS S3.

---

## Offline testing

1. Open Chrome DevTools → Network → **Offline**
2. Register as a patient, complete health profile, submit a consultation with audio
3. Check Application → IndexedDB → `continuum_db` → `sync_queue` - pending items should appear
4. Set network back to **Online**
5. The sync engine fires automatically on the `online` event
6. Verify records in MongoDB Atlas → Collections

---

## Project structure

```
continuum/
├── client/
│   └── src/
│       ├── components/
│       │   ├── consultation/    AudioRecorder, AudioPlayer, SymptomChecklist
│       │   ├── documents/       DocumentUploadButton
│       │   ├── followups/       FollowUpsList
│       │   ├── medication/      SpeakMedicationButton (TTS)
│       │   ├── sync/            SyncStatusWidget, SyncErrorPanel
│       │   ├── timeline/        TimelineEntryRow, HealthSummaryCard, AddConditionForm
│       │   ├── ui/              GlassCard, Avatar, StatusPill, Navbar, LanguageSwitcher
│       │   └── vitals/          VitalsLogForm, VitalsChart
│       ├── lib/
│       │   ├── apiClient.ts     Axios + JWT injection
│       │   ├── authContext.tsx  Auth state
│       │   ├── callRecorder.ts  MediaRecorder for live calls
│       │   ├── compressImage.ts Canvas-based image compression
│       │   ├── i18n.ts          i18next setup
│       │   ├── offlineDB.ts     Dexie schema (v3)
│       │   ├── resolveFileUrl.ts Server-relative → full URL
│       │   ├── socket.ts        Socket.io singleton
│       │   ├── syncEngine.ts    Offline queue + retry logic
│       │   ├── useAudioRecorder.ts MediaRecorder hook
│       │   ├── useTextToSpeech.ts  Web Speech API hook
│       │   └── webrtc.ts        RTCPeerConnection wrapper
│       ├── locales/
│       │   ├── en/common.json
│       │   ├── hi/common.json
│       │   └── te/common.json
│       └── pages/
│           ├── admin/           AdminDashboard
│           ├── auth/            LoginPage, RegisterPage
│           ├── call/            ScheduleCallPage, CallRoomPage
│           ├── doctor/          DoctorDashboard, ConsultationDetailPage, AnalyticsPage, MyPatientsSearchPage
│           └── patient/         PatientDashboard, TimelinePage, OnboardingPage, NewConsultationPage,
│                                ConsultationListPage, DoctorSearchPage, MyDoctorsPage, ProfilePage
│
└── server/
    └── src/
        ├── lib/
        │   ├── db.ts            MongoDB connection
        │   └── expiryCron.ts    Auto-expires stale connection requests
        ├── middleware/
        │   ├── auth.ts          JWT verification + role guard
        │   ├── auditTrail.ts    Patient change logging
        │   ├── patientAccess.ts assertPatientAccess() - core access control
        │   ├── upload.ts        Multer - async audio
        │   ├── uploadImage.ts   Multer - documents
        │   └── uploadCallRecording.ts  Multer - call recordings
        ├── models/
        │   ├── Call.ts
        │   ├── Condition.ts
        │   ├── Consultation.ts
        │   ├── Document.ts
        │   ├── DoctorProfile.ts
        │   ├── FollowUp.ts
        │   ├── Medication.ts
        │   ├── PatientChange.ts
        │   ├── PatientDoctorLink.ts
        │   ├── PatientProfile.ts
        │   ├── User.ts
        │   └── Vital.ts
        ├── routes/
        │   ├── admin.ts
        │   ├── analytics.ts
        │   ├── auth.ts
        │   ├── calls.ts
        │   ├── conditions.ts
        │   ├── connections.ts
        │   ├── consultations.ts
        │   ├── documents.ts
        │   ├── doctors.ts
        │   ├── followups.ts
        │   ├── patients.ts
        │   ├── timeline.ts
        │   └── vitals.ts
        ├── socket/
        │   └── signaling.ts     Socket.io WebRTC signaling handlers
        └── index.ts             Express + Socket.io server bootstrap
```

---

## Future scope

- **Persistent file storage** - migrate audio, documents, and call recordings from local filesystem to Cloudflare R2 or AWS S3 for durability across deployments
- **Full i18n coverage** - extend Hindi and Telugu translations across all pages and components (currently covers Navbar and Patient Dashboard)
- **SMS / WhatsApp notifications** - notify patients of doctor responses and upcoming follow-ups via Twilio when the app is not open
- **Family health management** - allow a single account to manage health records for dependents (children, elderly parents)
- **Diagnostic center integration** - allow labs and imaging centers to upload reports directly to a patient's record without going through the patient manually
- **Medication reminders** - push notifications or SMS reminders when a medication dose is due, based on prescribed frequency
- **Doctor availability calendar** - let doctors set available slots for live calls so patients can self-schedule without back-and-forth
- **Population health analytics** - village-level or region-level disease trend dashboards for public health administrators, built on anonymised aggregated data
- **AI-assisted symptom triage** - surface relevant past consultations and conditions when a patient submits symptoms, helping doctors respond faster
- **Multi-language voice input** - extend audio symptom recording with speech-to-text transcription in Hindi and Telugu so doctors can read symptoms without listening to full recordings

---

## License

MIT
