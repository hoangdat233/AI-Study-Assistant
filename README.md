# AI Study Assistant

AI Study Assistant is a portfolio-ready full-stack project scaffold for building an AI-powered learning platform. Students can upload PDF materials, manage study documents, and (in upcoming iterations) ask document-grounded questions through a Retrieval-Augmented Generation (RAG) pipeline.

## Problem Being Solved

Students often split study workflows across many disconnected tools. This project centralizes document storage, study interactions, and AI-driven learning support in one maintainable platform.

## Current Features (Initial Scope)

- Monorepo architecture for frontend, backend, and ML experiments
- Next.js + TypeScript + Tailwind frontend scaffold
- FastAPI backend scaffold with modular API routing
- Health check endpoint: `GET /api/health`
- REST route groups for:
  - `/api/auth`
  - `/api/documents`
  - `/api/chat`
  - `/api/quizzes`
  - `/api/flashcards`
  - `/api/progress`
- SQLAlchemy models prepared for:
  - User
  - Document
  - DocumentChunk (pgvector-ready embedding column)
  - Chat
  - Message
  - Quiz
  - Question
  - Flashcard
  - StudyProgress
- Docker + Docker Compose local environment
- GitHub Actions CI workflow
- Backend pytest health test

## Tech Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS

### Backend
- Python
- FastAPI
- Pydantic / pydantic-settings
- SQLAlchemy

### Database
- PostgreSQL
- pgvector (via `pgvector/pgvector` image and SQLAlchemy integration)

### AI / RAG (Planned)
- PDF text extraction
- Text chunking
- Embedding generation
- Vector similarity search
- Context assembly
- LLM response generation with sources

### Development
- Docker
- Docker Compose
- GitHub Actions
- pytest

## Architecture

### Backend API Modules
- `backend/app/api`: route definitions by domain
- `backend/app/models`: SQLAlchemy models and relationships
- `backend/app/schemas`: request/response schema layer
- `backend/app/services`: business logic services
- `backend/app/rag`: dedicated RAG pipeline module
- `backend/app/db`: database/session setup

### Planned RAG Pipeline

PDF Upload  
→ Extract Text  
→ Clean Text  
→ Split into Chunks  
→ Generate Embeddings  
→ Store Embeddings in PostgreSQL/pgvector  
→ User Question  
→ Generate Question Embedding  
→ Vector Similarity Search  
→ Retrieve Relevant Chunks  
→ Build Context  
→ Send Context + Question to LLM  
→ Generate Answer  
→ Return Answer with Sources

## Project Structure

```text
ai-study-assistant/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── services/
│   └── types/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── db/
│   │   └── rag/
│   └── tests/
├── ml/
│   └── notebooks/
├── .github/
│   └── workflows/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Local Installation

1. Clone repository and enter project:
   ```bash
   git clone <repo-url>
   cd AI-Study-Assistant
   ```
2. Create environment file:
   ```bash
   cp .env.example .env
   ```
3. Start services with Docker:
   ```bash
   docker compose up --build
   ```

Frontend: `http://localhost:3000`  
Backend API: `http://localhost:8000`  
API docs: `http://localhost:8000/docs`

## Environment Variables

See `.env.example` for defaults.

Key variables:
- `NEXT_PUBLIC_API_BASE_URL`
- `APP_NAME`
- `APP_ENV`
- `APP_DEBUG`
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

## Running Without Docker (Optional)

### Backend
```bash
cd backend
python -m pip install -e .[dev]
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testing

Backend tests:
```bash
cd backend
pytest -q
```

Frontend lint:
```bash
cd frontend
npm run lint
```

## API Documentation

FastAPI auto-generates docs at:
- Swagger UI: `/docs`
- ReDoc: `/redoc`

## Development Roadmap

- Implement persistent user registration/login with PostgreSQL
- Add JWT auth dependency guards
- Add real PDF upload, extraction, and chunking
- Add embedding generation and vector retrieval pipeline
- Implement document-grounded chat with source attribution
- Implement quiz and flashcard generation
- Add study progress analytics and dashboard widgets
- Add DB migrations and expanded test coverage

## Future Improvements

- Role-based access control
- Streaming LLM responses
- Background job processing for long-running AI tasks
- Enhanced observability (structured logs/metrics)
- End-to-end testing and load testing
