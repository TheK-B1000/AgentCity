---
name: doc-harmonizer
description: Identify "Drift" between live code and NotebookLM documentation.
---

# Doc Harmonizer

This skill performs a semantic audit between the live codebase and the grounded documentation in NotebookLM.

## Usage
Use this skill during code reviews or before major releases to ensure the implementation hasn't drifted from the approved specs.

### Actions
1. **Audit implementation**: Compares a specific file or module against a NotebookLM brief.
2. **Report Drift**: Lists discrepancies in logic, naming, or requirements.

## Example
"Check the `auth.py` implementation against the NotebookLM security spec."
