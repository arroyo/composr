import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

from schema import Song
from agent import app as agent_app

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

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    song_state: Song

@app.get("/api/state", response_model=Song)
async def get_state():
    """Returns the current symbolic music state."""
    # current_song is a global in-memory object in agent.py
    # We dynamically import it here to avoid circular dependencies if later split
    from agent import current_song
    return current_song

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Sends a user instruction to the AI Music Producer agent."""
    from agent import current_song
    
    # Invoke the LangGraph framework
    inputs = {"messages": [HumanMessage(content=request.message)], "song": current_song}
    
    # We need to run the graph and get the final output.
    # The output structure is a dict containing 'messages' and 'song'
    result = agent_app.invoke(inputs)
    
    # The last message is the agent's final text response
    final_message = result["messages"][-1].content
    
    return ChatResponse(
        response=final_message,
        song_state=result["song"]
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
