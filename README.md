# AI-Based Vehicle Insurance Fraud Detection Using Image Authenticity Verification

A full-stack insurance technology platform that detects whether uploaded vehicle accident images are **AUTHENTIC** (genuine camera-captured damage photos) or **SUSPICIOUS** (AI-generated, manipulated, or edited images) using a PyTorch CNN architecture, deterministic computer-vision forensic checks, Node.js/Express REST APIs, MongoDB, and a React + Tailwind CSS dashboard.

---

## 1. Project Overview

Vehicle insurance fraud increasingly involves manipulated repair photos or AI-generated damage images. **VeriClaim AI** provides an end-to-end verification workflow:

1. **Customers** register, log in, submit accident claim details, and upload accident photos (JPG, JPEG, PNG).
2. **Python AI Service (FastAPI + PyTorch + OpenCV)** verifies image authenticity:
   - Runs **CNN-based image classification** (`VehicleForensicCNN`) when trained weights are connected via `CNN_MODEL_PATH`.
   - Runs in **explicit Demo Mode** (clearly labeled as unverified demo mode) when no trained weights are attached, while still computing real deterministic forensic metrics (Error Level Analysis heatmap, residual noise, patch texture variance, Canny/Sobel edge artifacts, 8×8 block boundary ratio, and EXIF metadata inspection).
   - Optionally integrates **YOLO** (`/detect-damage`) for vehicle damage localization.
3. **Node.js + Express + MongoDB** stores users, claims, AI analysis results, and investigator decisions.
4. **Insurance Investigators / Admins** review flagged claims, inspect visual evidence and forensic details, and record final decisions (**Approve Claim**, **Reject Claim**, **Request Manual Verification**) with remarks. An AI prediction never automatically establishes fraud—final decisions remain with authorized investigators.

---

## 2. Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, Lucide React, Recharts, React Router, Axios
- **Backend:** Node.js, Express.js, Mongoose, JWT (`jsonwebtoken`), `bcryptjs`, Multer, Helmet, CORS
- **AI / ML Service:** Python 3, FastAPI, Uvicorn, PyTorch, Torchvision, OpenCV, Pillow, NumPy, Ultralytics (optional YOLO)
- **Database:** MongoDB (with optional `mongodb-memory-server` fallback for local dev/testing when `USE_MEMORY_DB_FALLBACK=true`)

---

## 3. Folder Structure

```text
vehicle-insurance-fraud-detection/
├── .env.example
├── README.md
├── ai-service/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── forensics.py       # OpenCV/PIL/NumPy ELA, noise, texture, edge, block & EXIF forensics
│   │   ├── main.py            # FastAPI endpoints: /health, /predict, /detect-damage
│   │   └── model.py           # VehicleForensicCNN (PyTorch) & configurable model loader
│   ├── requirements.txt
│   └── train_model.py         # PyTorch CNN training script
├── backend/
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/db.js
│       ├── middleware/
│       │   ├── auth.js        # JWT verification & role-based authorization
│       │   └── upload.js      # Multer disk storage + MIME & magic-byte validation
│       ├── models/
│       │   ├── User.js
│       │   ├── InsuranceClaim.js
│       │   ├── AnalysisResult.js
│       │   └── InvestigationRecord.js
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── claimRoutes.js
│       │   └── analyticsRoutes.js
│       ├── services/
│       │   └── aiServiceClient.js
│       └── utils/
│           └── seedDemoData.js
└── frontend/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── api/client.ts
        ├── context/AuthContext.tsx
        ├── types/index.ts
        ├── components/
        │   ├── AppLayout.tsx
        │   └── StatusBadges.tsx
        └── pages/
            ├── LandingPage.tsx
            ├── LoginPage.tsx
            ├── RegisterPage.tsx
            ├── CustomerDashboardPage.tsx
            ├── SubmitClaimPage.tsx
            ├── ClaimDetailPage.tsx
            ├── InvestigatorDashboardPage.tsx
            ├── ClaimsHistoryPage.tsx
            ├── AnalyticsPage.tsx
            └── SettingsPage.tsx
```

---

## 4. Prerequisites

- **Node.js** v20+ and **npm** v10+
- **Python** 3.10+ and **pip**
- **MongoDB** Community Server (local or MongoDB Atlas URI). For quick evaluation without a local `mongod` service, `USE_MEMORY_DB_FALLBACK=true` enables automatic in-memory MongoDB fallback.

---

## 5. Installation & Configuration

### Step 1: Environment Variables
Copy `.env.example` to `.env` inside `backend/` (and optionally `ai-service/`):

```bash
cp .env.example backend/.env
cp .env.example ai-service/.env
```

Key environment variables:
- `PORT`: Express API port (default `5000`)
- `MONGODB_URI`: MongoDB connection string (default `mongodb://127.0.0.1:27017/vehicle_insurance_fraud`)
- `USE_MEMORY_DB_FALLBACK`: `true` to fall back to in-memory MongoDB if local `mongod` is unreachable; set `false` in production
- `JWT_SECRET`: Secret key for signing JWT tokens
- `UPLOAD_DIR`: Local disk directory for uploaded claim images (default `uploads`)
- `AI_SERVICE_URL`: FastAPI base URL (default `http://127.0.0.1:8000`)
- `CNN_MODEL_PATH`: File path to trained PyTorch `.pth` checkpoint (leave empty for Demo Mode)
- `YOLO_MODEL_PATH`: Optional file path to trained YOLO `.pt` weights for damage localization

### Step 2: Python AI Service Setup
```bash
cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Step 3: Backend Setup
```bash
cd backend
npm install
npm run dev
```

On first startup against an empty database, `seedDemoData.js` seeds two demo accounts and 4 sample demo claims:
- **Customer Demo:** `customer@insureguard.ai` / `Customer@123`
- **Investigator Demo:** `investigator@insureguard.ai` / `Investigator@123`

### Step 4: Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 6. Connecting a Trained CNN (and Optional YOLO) Model

Out of the box, if `CNN_MODEL_PATH` is unset, `ai-service` operates in **explicit Demo Mode**:
- `model_status` is `"demo_mode"` and `is_demo_prediction` is `true`.
- Every UI result displays a prominent Demo Mode notice stating that no trained CNN weights are loaded.

To connect a real trained CNN model:
1. Prepare an image dataset structured as:
   ```text
   dataset/
     train/
       authentic/
       suspicious/
     val/
       authentic/
       suspicious/
   ```
2. Train `VehicleForensicCNN`:
   ```bash
   cd ai-service
   python train_model.py --data-dir ./dataset --epochs 15 --output ./models/forensic_cnn.pth
   ```
3. Set `CNN_MODEL_PATH=./models/forensic_cnn.pth` and `AI_DEMO_MODE=false` in `ai-service/.env`, then restart `uvicorn`.
4. Verify `GET http://127.0.0.1:8000/health` returns `"model_status": "model_loaded"`.

To enable YOLO damage localization, set `YOLO_MODEL_PATH=/path/to/damage_yolov8.pt` and restart `uvicorn`.

---

## 7. API Documentation

### Python AI Service (`http://127.0.0.1:8000`)
- `GET /health` — Returns service status, compute device (`cpu`/`cuda`), CNN load status, and YOLO load status.
- `POST /predict` (`multipart/form-data` with `file`) — Returns `prediction`, `confidence`, `authentic_probability`, `suspicious_probability`, `model_status`, `is_demo_prediction`, `disclaimer`, and `analysis_details` (image quality, texture consistency, noise/ELA, edge artifacts, structural block ratio, EXIF metadata, and base64 ELA heatmap).
- `POST /detect-damage` (`multipart/form-data` with `file`) — Optional YOLO damage bounding-box localization; returns `model_unavailable` if no YOLO weights are configured.

### Express Backend (`http://127.0.0.1:5000/api`)
- `GET /api/health` — Backend & AI service connectivity status
- `POST /api/auth/register` — Register Customer or Investigator
- `POST /api/auth/login` — Authenticate and receive JWT
- `GET /api/auth/profile` / `PUT /api/auth/profile` — Fetch or update user profile
- `PUT /api/auth/change-password` — Update user password
- `POST /api/claims/upload-image` — Upload and validate JPG/JPEG/PNG image (Multer + magic bytes)
- `POST /api/claims` — Create insurance claim document
- `POST /api/claims/:id/analyze` — Run FastAPI analysis and store `AnalysisResult`
- `GET /api/claims/my` — Retrieve logged-in customer's claims
- `GET /api/claims` — Investigator-only queue with search, date filters, status filters, and confidence sorting
- `GET /api/claims/:id` — Retrieve claim details, latest analysis, and investigation history
- `PATCH /api/claims/:id/investigate` — Investigator-only decision (`Approve Claim`, `Reject Claim`, `Request Manual Verification`) with remarks
- `GET /api/analytics/dashboard` — Aggregated database metrics and Recharts datasets

---

## 8. Troubleshooting

- **AI Service Unreachable (503 on Analyze):** Ensure `uvicorn app.main:app --host 127.0.0.1 --port 8000` is running and `AI_SERVICE_URL` in `backend/.env` matches.
- **Image Upload Rejected:** Ensure the file is a valid `.jpg`, `.jpeg`, or `.png` under 10 MB with matching JPEG/PNG file headers.
- **MongoDB Connection Error:** Start local `mongod` on port `27017`, update `MONGODB_URI` for Atlas, or enable `USE_MEMORY_DB_FALLBACK=true` for local development.
- **Missing `python-multipart` in FastAPI:** Run `pip install python-multipart` inside your Python environment.
