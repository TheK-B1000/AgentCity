---
name: grounded-architect
description: Generate technical designs strictly constrained by NotebookLM sources.
---

# Grounded Architect

This skill enforces a "Grounded Reasoning" loop, where every architectural decision must be traced back to a citation in a NotebookLM-generated brief.

## Usage
Use this skill when designing new systems or making high-level refactors to ensure consistency with the original project vision stored in NotebookLM.

### Actions
1. **Verify Design**: Checks a proposed design against `context_brief.md`.
2. **Generate Grounded Proposal**: Drafts a design spec that includes citations to source documents.

## Guidelines
- Follow the "Clean Context" provided by the `notebook-context-fetcher`.
- Do not introduce dependencies or patterns that contradict the source material.

## Example
"Verify this implementation plan against the NotebookLM technical brief."
