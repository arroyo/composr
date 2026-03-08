from schema import Song, Track, InstrumentState
s = Song()
s.tracks.append(Track(id="test", instrument=InstrumentState(engine="tone", bank="factory", preset="kick")))
print(s.model_dump_json(indent=2))
