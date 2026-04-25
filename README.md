# ExamFlow - Advanced Exam Management System

ExamFlow is a professional full-stack platform for creating, managing, and taking academic assessments. Built with a focus on premium UI/UX, scalability, and clean architecture.

## 🚀 Key Features

### 👤 For Instructors
- **Dynamic Question Builder**: Create Exams with MCQ, True/False, Fill in the Blanks, and Essay questions.
- **Assessment Management**: Set durations, total grades, and start/end times.
- **Dashboard**: Track student enrollment and assessment metrics.

### 🎓 For Students
- **Exam Session Interface**: Responsive taker with a visible timer, progress bar, and sidebar navigation.
- **Auto-Save**: Progress is automatically saved every 30 seconds to prevent data loss.
- **Instant Grading**: Automated evaluation for MCQ, T/F, and Fill-in-the-blanks.

### 🎨 Design & UX
- **Modern UI**: Inspired by Google Forms, utilizing Glassmorphism and smooth transitions.
- **Responsive**: Fully optimized for mobile and desktop.
- **Dark/Light Mode**: Seamless theme switching.

---

## 🛠️ Tech Stack

- **Frontend**: React, TailwindCSS (v4), Framer Motion, Axios, Lucide React.
- **Backend**: Node.js, Express, JWT, Bcrypt.
- **ORM/Database**: Prisma ORM with PostgreSQL.

---

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL Database (Local or Cloud like Neon/Railway)

### 2. Backend Setup
1. `cd backend`
2. `npm install`
3. Create a `.env` file based on `.env.example`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/exam_db"
   JWT_SECRET="your_secret_key"
   PORT=5000
   ```
4. Run migrations: `npx prisma db push`
5. Start server: `npm start` (or `npm run dev` with nodemon)

### 3. Frontend Setup
1. `cd frontend`
2. `npm install`
3. Start development server: `npm run dev`
4. Access at `http://localhost:3000`

---

## 📂 Project Structure (Clean Modular Architecture)

```text
├── backend
│   ├── prisma/            # Database schema
│   └── src/
│       ├── config/        # Database init
│       ├── middleware/    # Auth & Role checks
│       ├── modules/       # Domain modules (Auth, Exams, Submissions)
│       └── app.js         # Express setup
└── frontend
    └── src/
        ├── components/    # UI elements
        ├── store/         # Auth Context
        ├── lib/           # Utils & API client
        └── pages/         # Dashboard & Exam views
```

## 🛠️ Future Improvements
- Manual grading interface for Essays.
- Real-time proctoring (Tab switch tracking).
- Rich text editor for questions.
