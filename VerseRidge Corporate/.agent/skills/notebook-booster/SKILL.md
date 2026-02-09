---
name: notebook-booster
description: Guide the user through creating a new NotebookLM project from scratch.
---

# Notebook Booster

This skill provides the **"Zero-Human"** workflow for programmatically initializing a new grounded knowledge base in NotebookLM.

## Usage
Use this skill when starting a new project or topic. Antigravity will handle the session creation and context grounding autonomously.

### Actions
1. **Automated Setup**: Navigates to NotebookLM, creates a notebook, and uploads specified workspace sources.
2. **Autonomous Extraction**: Triggers the "Agentic Technical Brief" generation and exports it to `/.agent/docs/`.

## Workflow
- **Input**: Topic name and optionally local source files/URLs.
- **Execution**: Antigravity uses its internal tools to bridge with NotebookLM.
- **Output**: A fully grounded `context_brief.md` in your workspace.

## Example
"Autonomously bootstrap a new NotebookLM project for the 'Auth v2' refactor."
