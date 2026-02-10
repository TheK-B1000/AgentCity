# Example: Full Research Flow

Complete example of creating a NotebookLM notebook from scratch, running research, and generating artifacts.

## Scenario
Research topic: "How to become an AI Engineer"

## Commands (in order)

```bash
# 1. Verify auth
$env:PYTHONIOENCODING = "utf-8"
nlm login --check

# 2. Create notebook
nlm notebook create "How to Become an AI Engineer"
# Output: ✓ Created notebook: How to Become an AI Engineer
#   ID: e0b58f46-b091-4f89-87c5-90dee4791891

# 3. Add known sources
nlm source add e0b58f46-... --url "https://en.wikipedia.org/wiki/Artificial_intelligence" --wait
nlm source add e0b58f46-... --url "https://en.wikipedia.org/wiki/Machine_learning" --wait
nlm source add e0b58f46-... --url "https://en.wikipedia.org/wiki/Prompt_engineering" --wait

# 4. Run deep web research (~40 sources, ~5 min)
nlm research start "how to become an AI engineer career path skills roadmap" \
  --notebook-id e0b58f46-... --mode deep

# 5. Check progress
nlm research status e0b58f46-...

# 6. Import discovered sources
nlm research import e0b58f46-...

# 7. Query the AI
nlm notebook query e0b58f46-... \
  "What are the key steps, skills, and resources needed to become an AI engineer?"

# 8. Generate artifacts
nlm slides create e0b58f46-...
nlm mindmap create e0b58f46-...
nlm audio create e0b58f46-...

# 9. Open in browser
Start-Process "https://notebooklm.google.com/notebook/e0b58f46-..."
```

## Expected Output
- Notebook with 40+ sources
- AI response with numbered citations
- Slide deck, mind map, and audio overview artifacts
