import os
import asyncio
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

from schema import Song
from agent import app as agent_app
from midi_utils import song_to_midi, midi_to_song
from utils import generate_filename

# Load environment variables (OPENAI_API_KEY)
load_dotenv()

app = FastAPI(title="AI Music Agent API")

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AGENT_TIMEOUT_SECONDS = 90

class ChatRequest(BaseModel):
    message: str
    model: str = "gpt-4o"  # Default model

class ChatResponse(BaseModel):
    response: str
    song_state: Song

@app.get("/api/state", response_model=Song)
async def get_state():
    """Returns the current symbolic music state."""
    from agent import current_song
    return current_song

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Sends a user instruction to the AI Music Producer agent."""
    from agent import current_song, chat_history

    # Append the next user message to memory
    chat_history.append(HumanMessage(content=request.message))

    inputs = {"messages": chat_history, "song": current_song, "model": request.model}

    loop = asyncio.get_event_loop()

    try:
        # Run the blocking synchronous LangGraph call in a thread pool so the
        # event loop stays free, then enforce a hard async timeout around it.
        result = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: agent_app.invoke(inputs)),
            timeout=AGENT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        chat_history.pop()
        raise HTTPException(
            status_code=504,
            detail=f"Request to '{request.model}' timed out after {AGENT_TIMEOUT_SECONDS}s. The model may be unavailable or overloaded.",
        )
    except Exception as e:
        chat_history.pop()
        error_str = str(e)
        if "insufficient_quota" in error_str or "429" in error_str:
            detail = "OpenAI quota exceeded. Please add credits at platform.openai.com/account/billing."
        elif "model_not_found" in error_str or "404" in error_str:
            detail = f"Model '{request.model}' is not available on your API plan."
        else:
            detail = f"AI API error: {error_str[:300]}"
        raise HTTPException(status_code=502, detail=detail)

    # Update chat history with the full agent conversation
    from agent import chat_history as global_history
    global_history.clear()
    global_history.extend(result["messages"])

    final_message = result["messages"][-1].content

    return ChatResponse(
        response=final_message,
        song_state=current_song
    )

@app.post("/api/state", response_model=Song)
async def map_state(song: Song):
    """Updates the internal song state with a user-provided JSON file."""
    import agent
    agent.current_song = song
    agent.chat_history.clear()
    return agent.current_song

@app.get("/api/export/midi")
async def export_midi():
    """Export the current song as a MIDI file."""
    from agent import current_song
    
    if not current_song or not current_song.tracks:
        raise HTTPException(status_code=400, detail="No song to export")
    
    try:
        midi_data = song_to_midi(current_song)
        
        # Generate filename using the shared utility function
        filename = generate_filename(current_song.name, "mid")
        
        return Response(
            content=midi_data,
            media_type="audio/midi",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export MIDI: {str(e)}")

@app.post("/api/import/midi", response_model=Song)
async def import_midi(file: UploadFile = File(...)):
    """Import a MIDI file and convert to song format."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No MIDI file provided")
    
    if not (file.filename.endswith('.mid') or file.filename.endswith('.midi')):
        raise HTTPException(status_code=400, detail="File must be a MIDI file (.mid or .midi)")
    
    try:
        midi_data = await file.read()
        song = midi_to_song(midi_data)
        
        # Update the current song state
        import agent
        agent.current_song = song
        agent.chat_history.clear()
        
        return song
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import MIDI: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
