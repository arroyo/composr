# Composr

Composr is an AI-powered music composition agent that allows you to easily generate, edit, and play back musical arrangements.

## Architecture

This project consists of two main components:
- **`backend/`**: A Python-based agentic server powered by FastAPI and LangGraph. The AI agent, built with GPT-4o, utilizes various musical tools (create_track, add_notes, etc.) to construct compositions securely within strict Pydantic JSON schemas.
- **`frontend/`**: A modern Next.js UI styled with Tailwind CSS and glassmorphism. It provides a real-time Chat interface and an interactive Piano Roll. Audio playback is seamlessly handled by an `AudioEngine` adapter wrapped around Tone.js.

## Getting Started

To run the full stack locally, follow these steps:

### 1. Start the Backend
Navigate to the backend directory and run the API server:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Ensure you have your .env file with OPENAI_API_KEY
uvicorn main:app --reload
```
The server will start on `http://127.0.0.1:8000`.

### 2. Start the Frontend
In a new terminal, navigate to the frontend directory:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to interact with your AI composer!
