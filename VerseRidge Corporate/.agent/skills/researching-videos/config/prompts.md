# Synthesis Prompts

These prompts are designed to be used with the "Constitution" and the processed video transcripts.

## Prompt 1: Actionable Task Extraction

**Input**: 
- Constitution (Context)
- Video Transcript (Source)

**Goal**: Extract concrete, actionable steps that a developer can follow.

**Prompt**:
```markdown
You are a Senior Engineer. Review the following transcript against our Constitution.
Extract a list of actionable tasks or instructions.
Each task must be specific, technical, and verifiable.
Ignore general advice or "fluff".
Format the output using the "Actionable Tasks Template".
If the content violates the Constitution (e.g. inaccurate or marketing-heavy), output "REJECTED: [Reason]".
```

## Prompt 2: Slide Deck Generation

**Input**:
- Constitution (Context)
- Video Transcript (Source)

**Goal**: Create a slide deck outline for teaching this concept.

**Prompt**:
```markdown
Create a slide deck outline based on the transcript.
Structure it for a technical presentation.
Each slide should have a Title, Bullet Points, and Speaker Notes.
Ensure the tone matches the Constitution's values (Accuracy, Depth).
Format the output using the "Slideshow Template".
```
