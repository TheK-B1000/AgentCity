---
name: pyramid-librarian
description: Enforces Corey's "Pyramid Research" structure on messy notes.
---

# Pyramid Librarian ("The Archivist")

This skill acts as the Guardian of the VerseRidge Knowledge Pyramid, restructuring raw brain dumps into the formal 4-layer taxonomy.

## Usage
Use this when you have unstructured notes (meeting minutes, rough ideas) that need to be filed into the formal Knowledge Base.

## The Pyramid Structure
1.  **Level 1: Concept** (The high-level idea, e.g., "Code Quality")
2.  **Level 2: Theory** (The academic backing, e.g., "Cyclomatic Complexity")
3.  **Level 3: Application** (The "Code Rater" logic, implementation details, The "Gap Bridger" usage)
4.  **Level 4: Execution** (Actual code snippets, tests, data)

## Process
1.  **Read**: Analyze the raw note.
2.  **Sort**: Place every sentence/point into one of the 4 levels.
3.  **Identify Gaps**: If a level is missing (e.g., we have Code but no Theory), flag it as `[GAP]`.
4.  **Format**: Output a clean Markdown document.
