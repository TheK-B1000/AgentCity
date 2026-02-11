---
name: researching-videos
description: Curates, ingests, and processes video content from trusted YouTube sources. Use when the user wants to build training data from videos, find technical tutorials, or creates a "constitution" for content quality.
---

# Video Researching

## When to use this skill
- User wants to find high-quality technical videos from specific channels.
- User wants to extract transcripts and structure them into "Actionable Tasks" or "Slideshows".
- User needs to validate content against a specific "Constitution" or set of values.

## Workflow
- [ ] **Configuration**:
    - [ ] Update `config/sources.json` with trusted channel IDs.
    - [ ] Update `config/constitution.md` with quality standards.
    - [ ] Verify `YOUTUBE_API_KEY` is set in `.env`.
- [ ] **Ingestion**: Run `npm run ingest` to fetch videos and transcripts.
- [ ] **Processing**: Run `npm run process` to structure and filter content.
- [ ] **Synthesis**: Upload processed files to NotebookLM (or use LLM) with `config/prompts.md`.
- [ ] **Review**: Run `npm run review` to approve/reject final artifacts.

## Instructions

### 1. Ingestion
The `ingest.ts` script fetches the latest videos from channels defined in `sources.json`.
```bash
npx tsx scripts/ingest.ts
```
*Output*: Raw JSON files in `output/raw/`.

### 2. Processing
The `process.ts` script cleans raw transcripts and checks them against `constitution.md`.
```bash
npx tsx scripts/process.ts
```
*Output*: Markdown files in `output/processed/`.

### 3. Review
The `review.ts` script provides a CLI to manually approve or reject processed files.
```bash
npx tsx scripts/review.ts
```
*Output*: Moved files to `output/final/` or `output/rejected/`.

## Resources
- `config/sources.json`: Trusted source list.
- `config/constitution.md`: Quality standards.
- `config/prompts.md`: Synthesis prompts.
