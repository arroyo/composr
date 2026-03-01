# Composr Backend

This directory contains the FastAPI server and the LangGraph AI agent that powers Composr.

## Tech Stack
- **Python**: Core programming language.
- **FastAPI**: Provides the REST API server (`/api/chat`, `/api/state`).
- **LangGraph & Langchain**: Drives the agentic framework, mapping tools to the GPT-4o model.
- **Pydantic**: Enforces strict JSON schemas for musical structures (`Song`, `Track`, `Note`), ensuring the AI outputs valid musical data to the frontend.

## Setup & Running

1. **Virtual Environment**:
   It is recommended to run this within a virtual environment.
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

2. **Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Variables**:
   Create a `.env` file in this `backend/` directory with your OpenAI API Key:
   ```env
   OPENAI_API_KEY=sk-...
   ```

4. **Start Server**:
   ```bash
   uvicorn main:app --reload
   ```
   *The server defaults to `http://127.0.0.1:8000`.*

## Modifying the Agent
The agent behavior is defined in `agent.py`. Tools available to the AI currently include:
- `create_track`: Creates a new instrument track.
- `add_notes`: Appends mapped notes to a specific track using precise Tone.js timing representations.
- `change_tempo`: Modifies the global tempo.
- `clear_song`: Resets the arrangement.
