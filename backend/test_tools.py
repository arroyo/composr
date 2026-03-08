from agent import tools, create_track
import json

print("TOOL SCHEMAS:")
for t in tools:
    if t.name == "create_track":
        print(json.dumps(t.args_schema.schema(), indent=2))
