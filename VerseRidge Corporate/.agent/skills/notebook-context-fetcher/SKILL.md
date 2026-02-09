---
name: notebook-context-fetcher
description: Automates the discovery and ingestion of NotebookLM-generated Markdown briefs.
---

# Notebook Context Fetcher

This skill allows the agent to scan specific directories for refined Markdown summaries exported from NotebookLM and ingest them as "Clean Context".

## Usage
Use this skill when you need to find the latest technical specs or research documents that have been processed by NotebookLM.

### Actions
1. **List Briefs**: Scans the designated context folder (default: `/.agent/docs/`) for `.md` files tagged with `#notebooklm`.
2. **Ingest context**: Reads the content of a selected brief and adds it to the active context.

## Configuration
- `CONTEXT_DIR`: Path where NotebookLM exports are saved.
- `TAG_FILTER`: Default is `#notebooklm`.

## Example
"Fetch the latest NotebookLM context for the API refactor."
