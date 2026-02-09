---
name: ops-autopilot
description: Automates Beny's "Weighing Hours" system for equity tracking.
---

# Ops Autopilot ("The Accountant")

This skill acts as the VerseRidge Equity Auditor, converting raw "Did-Do" lists into "Weighted Hours" based on the VW-EAS Protocol.

## Usage
Use this to process daily notes or bulleted lists of work into a structured CSV format for the equity log.

## The Rubric (VW-EAS)
*   **Deep Work (x1.3)**: Coding (New Feature), Architecture Design, Legal Drafting, Complex Research.
*   **Standard Work (x1.0)**: Meetings, bug fixes, emails, standups.
*   **Maintenance (x0.7)**: Cleaning files, incidental research, chatting, admin.

## Process
1.  **Classify**: Read each line item and assign a category (Deep/Standard/Maintenance).
2.  **Calculate**: Duration * Multiplier = Weighted Hours.
3.  **Format**: Output a CSV table.

## Example Input
"Worked 2 hours on the backend API, then had a 1 hour meeting with Beny, then spent 30 mins cleaning the drive."

## Example Output
| Date | Task | Duration | Category | Multiplier | Weighted Total |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Today | Backend API | 2.0 | Deep | 1.3 | 2.6 |
| Today | Meeting w/ Beny | 1.0 | Standard | 1.0 | 1.0 |
| Today | Drive Cleanup | 0.5 | Maintenance | 0.7 | 0.35 |
