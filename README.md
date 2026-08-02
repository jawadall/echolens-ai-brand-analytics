<div align="center">

# 🔍 EchoLens — AI-Powered Brand Monitoring & NLP Analytics

[![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

**An AI-powered platform for real-time brand monitoring, sentiment analysis, and NLP-driven analytics across multiple data sources — leveraging Google Gemini AI for intelligent text processing.**

</div>

---

## 📋 Overview

EchoLens is a comprehensive brand monitoring and analytics platform that enables businesses to track their online reputation, analyze customer sentiment, and gain actionable insights from multi-platform data sources. The system uses **Google Gemini AI** for advanced NLP processing, including sentiment analysis, topic extraction, and text summarization.

Built as a **Final Year Project** at COMSATS University Islamabad, Wah Campus.

---

## ✨ Key Features

### 🤖 AI-Powered NLP Engine
- **Sentiment Analysis** — Real-time positive/negative/neutral classification using Gemini AI
- **Topic Extraction** — Automatic identification of key discussion themes
- **Text Summarization** — AI-generated summaries of brand mentions
- **Entity Recognition** — Identify brands, products, and key entities
- Dual processing: Gemini AI (primary) + HuggingFace models (fallback)

### 📊 Analytics Dashboard
- Interactive data visualizations with charts and graphs
- Sentiment trends over time
- Brand mention volume tracking
- Competitive analysis views
- Export reports in multiple formats

### 🔗 Multi-Platform Data Connectors
- Social media platform integrations
- Review site monitoring
- News and blog tracking
- Custom data source connectors
- Extensible connector architecture

### 👥 User Management
- Multi-tenant subscription system
- Role-based access control
- Brand workspace management
- Admin dashboard for platform management

### ⚡ Async Processing
- **Celery** task queue for background NLP processing
- Real-time processing status updates
- Scalable worker architecture

---

## 🏗️ Architecture

```
echolens/
├── backend/                    # Django REST API
│   ├── apps/
│   │   ├── accounts/           # User authentication & profiles
│   │   ├── admin_dashboard/    # Platform administration
│   │   ├── analytics/          # Analytics & visualization
│   │   ├── brands/             # Brand workspace management
│   │   ├── data_connectors/    # Multi-platform data ingestion
│   │   ├── exports/            # Report export functionality
│   │   ├── nlp_engine/         # AI/NLP processing core
│   │   │   ├── gemini_client.py    # Google Gemini AI integration
│   │   │   ├── processor.py        # Primary NLP processor
│   │   │   ├── processor_hf.py     # HuggingFace fallback
│   │   │   └── tasks.py            # Celery async tasks
│   │   └── subscriptions/      # Subscription management
│   ├── echo_lens/              # Django project settings
│   ├── templates/              # Email & HTML templates
│   ├── manage.py               # Django management
│   └── requirements.txt        # Python dependencies
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── api/                # API client layer
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── pages/              # Page components
│   │   ├── store/              # State management
│   │   └── types/              # TypeScript definitions
│   ├── package.json
│   └── vite.config.ts
└── .gitignore
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Django 5.x, Django REST Framework |
| **Frontend** | React 18, TypeScript, Vite |
| **AI/NLP** | Google Gemini AI, HuggingFace Transformers |
| **Styling** | Tailwind CSS |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Task Queue** | Celery + Redis |
| **API** | REST API with token authentication |

---

## 🚀 Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment variables
# GEMINI_API_KEY=your_google_ai_key
# SECRET_KEY=your_django_secret

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Celery Workers (for async NLP processing)
```bash
celery -A echo_lens worker -l info
```

---

## 👤 Author

**Syed Jawad Ali**
- GitHub: [@jawadall](https://github.com/jawadall)
- LinkedIn: [syed-jawad-all](https://www.linkedin.com/in/syed-jawad-all/)

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
