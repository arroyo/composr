import asyncio
from agent import app
from langchain_core.messages import HumanMessage

async def print_tracks(genre: str, prompt: str):
    print(f"\n--- Testing Genre: {genre} ---")
    state = {"messages": [HumanMessage(content=prompt)], "song": None}
    
    # We have to reset the global song state for the test script hack
    import agent
    from schema import Song
    agent.current_song = Song()

    final_state = await app.ainvoke(state)
    song = final_state.get("song")
    
    if not song or not song.tracks:
        print("No tracks generated!")
        return
        
    for idx, track in enumerate(song.tracks):
        print(f"Track {idx + 1}: Engine={track.engine}, Instrument={track.instrument} | Name={track.id}")

async def main():
    await print_tracks("Techno", "Create a basic techno loop with a kick, hihat, and a bassline")
    await print_tracks("Classical", "Create a classical arrangement with a piano playing chords and a solo violin melody")
    await print_tracks("Hip Hop", "Create a hip hop beat with an 808 bass, snare, hihats, and a piano melody")

if __name__ == "__main__":
    asyncio.run(main())
