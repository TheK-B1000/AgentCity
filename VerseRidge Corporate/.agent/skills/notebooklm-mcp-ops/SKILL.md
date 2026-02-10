---
name: notebooklm-mcp-ops
description: Operates the NotebookLM MCP server for programmatic notebook management. Use when the user mentions NotebookLM, research notebooks, creating notebooks, adding sources, querying AI, generating audio overviews, slides, mind maps, or any NotebookLM automation task.
---

# NotebookLM MCP Ops

Programmatic control of Google NotebookLM via the `notebooklm-mcp-cli` package. Provides **29 MCP tools** for AI agents and a `nlm` CLI for terminal use.

## When to Use This Skill

- User mentions **NotebookLM**, research notebooks, or knowledge bases
- User wants to **create**, **query**, **research**, or **share** notebooks
- User wants to **add sources** (URLs, YouTube, PDFs, Drive, text)
- User wants **artifacts** (audio, video, slides, mind maps, quizzes, flashcards, reports, infographics, data tables)
- User wants to **download** or **export** generated content

## Prerequisites

```bash
pip install notebooklm-mcp-cli    # Install
nlm login                         # Auth (opens Brave/Chrome)
nlm login --check                 # Verify
```

> **Brave users:** See [resources/brave-patch.md](resources/brave-patch.md)

## Workflow Checklist

- [ ] Validate auth → `refresh_auth` or `nlm login --check`
- [ ] Create notebook → `notebook_create`
- [ ] Research sources → `research_start` → `research_status` → `research_import`
- [ ] Add specific sources → `source_add` (url, text, file, drive)
- [ ] Query AI → `notebook_query` (follow-ups via `conversation_id`)
- [ ] Generate artifacts → `studio_create` (audio, slides, quiz, etc.)
- [ ] Download/export → `download_artifact` or `export_artifact`

---

## MCP Tools Reference (29 tools)

### Auth (3 tools)

| Tool | Purpose | Key Args |
|------|---------|----------|
| `refresh_auth` | Reload tokens from disk or headless re-auth | — |
| `save_auth_tokens` | Fallback: save cookies manually | `cookies` |
| `server_info` | Version check, update availability | — |

### Notebooks (6 tools)

| Tool | Purpose | Key Args |
|------|---------|----------|
| `notebook_create` | Create notebook | `title` |
| `notebook_list` | List all notebooks | `max_results` (default 100) |
| `notebook_get` | Get details + sources | `notebook_id` |
| `notebook_describe` | AI summary + suggested topics | `notebook_id` |
| `notebook_rename` | Rename | `notebook_id`, `new_title` |
| `notebook_delete` | Delete (⚠️ irreversible) | `notebook_id`, `confirm=True` |

### Sources (6 tools)

| Tool | Purpose | Key Args |
|------|---------|----------|
| `source_add` | Add URL/text/file/Drive | `notebook_id`, `source_type`, `url`/`text`/`file_path`/`document_id`, `wait=True` |
| `source_describe` | AI summary + keywords | `source_id` |
| `source_get_content` | Raw text (fast, no AI) | `source_id` |
| `source_list_drive` | List sources + Drive freshness | `notebook_id` |
| `source_sync_drive` | Sync stale Drive sources | `source_ids`, `confirm=True` |
| `source_delete` | Delete (⚠️ irreversible) | `source_id`, `confirm=True` |

### Research (3 tools)

| Tool | Workflow Step | Key Args |
|------|-------------|----------|
| `research_start` | 1. Start search | `query`, `source` (web\|drive), `mode` (fast\|deep), `notebook_id` |
| `research_status` | 2. Poll progress | `notebook_id`, `task_id`, `max_wait` |
| `research_import` | 3. Import results | `notebook_id`, `task_id`, `source_indices` |

> **Deep mode:** ~5 min, ~40 sources (web only). **Fast mode:** ~30s, ~10 sources.

### AI Query (2 tools)

| Tool | Purpose | Key Args |
|------|---------|----------|
| `notebook_query` | Ask AI about existing sources | `notebook_id`, `query`, `source_ids`, `conversation_id` |
| `chat_configure` | Set chat goal/length | `notebook_id`, `goal` (default\|learning_guide\|custom), `response_length` |

### Studio Artifacts (3 tools)

| Tool | Purpose | Key Args |
|------|---------|----------|
| `studio_create` | Create any artifact | `notebook_id`, `artifact_type`, `confirm=True` + type-specific opts |
| `studio_status` | Check status / rename | `notebook_id`, `action` (status\|rename) |
| `studio_delete` | Delete artifact (⚠️) | `notebook_id`, `artifact_id`, `confirm=True` |

**`studio_create` artifact types and options:**

| Type | Options |
|------|---------|
| `audio` | `audio_format`: deep_dive\|brief\|critique\|debate, `audio_length`: short\|default\|long |
| `video` | `video_format`: explainer\|brief, `visual_style`: auto_select\|classic\|whiteboard\|kawaii\|anime\|watercolor\|retro_print\|heritage\|paper_craft |
| `slide_deck` | `slide_format`: detailed_deck\|presenter_slides, `slide_length`: short\|default |
| `report` | `report_format`: Briefing Doc\|Study Guide\|Blog Post\|Create Your Own, `custom_prompt` |
| `infographic` | `orientation`: landscape\|portrait\|square, `detail_level`: concise\|standard\|detailed |
| `quiz` | `question_count` (int), `difficulty`: easy\|medium\|hard |
| `flashcards` | `difficulty`: easy\|medium\|hard |
| `mind_map` | `title` |
| `data_table` | `description` (required) |

**Common options:** `language` (BCP-47), `focus_prompt`, `source_ids`

### Download & Export (2 tools)

| Tool | Purpose | Key Args |
|------|---------|----------|
| `download_artifact` | Save to file | `notebook_id`, `artifact_type`, `output_path`, `output_format` (quiz/flashcards: json\|markdown\|html) |
| `export_artifact` | → Google Docs/Sheets | `notebook_id`, `artifact_id`, `export_type` (docs\|sheets) |

**Download types:** audio (MP3/MP4), video (MP4), report (Markdown), mind_map (JSON), slide_deck (PDF), infographic (PNG), data_table (CSV), quiz, flashcards

### Notes (1 tool)

| Tool | Actions | Key Args |
|------|---------|----------|
| `note` | create, list, update, delete | `notebook_id`, `action`, `content`, `title`, `note_id`, `confirm` |

### Sharing (3 tools)

| Tool | Purpose | Key Args |
|------|---------|----------|
| `notebook_share_status` | Get sharing settings | `notebook_id` |
| `notebook_share_public` | Toggle public link | `notebook_id`, `is_public` |
| `notebook_share_invite` | Invite collaborator | `notebook_id`, `email`, `role` (viewer\|editor) |

---

## CLI Quick Reference

Set `$env:PYTHONIOENCODING = "utf-8"` on Windows.

```bash
nlm notebook create "Title"                    # Create
nlm notebook list                              # List all
nlm notebook query <id> "question"             # Query AI
nlm source add <id> --url "https://..." --wait # Add URL
nlm research start "topic" -n <id> -m deep     # Deep research
nlm research status <id>                       # Check progress
nlm research import <id>                       # Import sources
nlm audio create <id>                          # Audio overview
nlm slides create <id>                         # Slide deck
nlm mindmap create <id>                        # Mind map
nlm download <type> <id>                       # Download artifact
nlm login --check                              # Verify auth
nlm doctor                                     # Diagnose issues
```

## Error Handling

- **Unicode errors (Windows):** `$env:PYTHONIOENCODING = "utf-8"`
- **Auth expired:** `refresh_auth` or `nlm login`
- **Chrome not found:** Apply Brave patch (see resources/)
- **Unknown syntax:** Run `nlm <command> --help`
- **Destructive ops:** Always require `confirm=True`

## Resources

- [Brave browser patch](resources/brave-patch.md)
- [Example: full research flow](examples/research-flow.md)
