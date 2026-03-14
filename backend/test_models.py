import sys
import os

# Add the backend directory to the path so we can import agent
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agent import get_llm_for_model

def test_model_mapping():
    test_cases = [
        ("gpt-5.4", "gpt-5.4"),
        ("gpt-4.1", "gpt-4.1"),
        ("gpt-4o", "gpt-4o"),
        ("claude-opus-4-6", "claude-opus-4-6"),
        ("claude-sonnet-4-6", "claude-sonnet-4-6"),
        ("claude-haiku-4-5", "claude-haiku-4-5"),
        ("unknown", "gpt-4o"), # Default case
    ]

    print("Running model mapping tests...")
    all_passed = True
    for model_id, expected_name in test_cases:
        llm = get_llm_for_model(model_id)
        actual_name = llm.model_name if hasattr(llm, 'model_name') else getattr(llm, 'model', 'N/A')
        
        if actual_name == expected_name:
            print(f"✅ {model_id} -> {actual_name}")
        else:
            print(f"❌ {model_id} -> {actual_name} (Expected: {expected_name})")
            all_passed = False
    
    if all_passed:
        print("\nAll tests passed!")
        sys.exit(0)
    else:
        print("\nSome tests failed.")
        sys.exit(1)

if __name__ == "__main__":
    test_model_mapping()
