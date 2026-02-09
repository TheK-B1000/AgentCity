# AntiGravity City Constitution (AgentOps v1)

**City Name:** AntiGravity
**Purpose:** Provide a safe, repeatable foundation for deploying and operating multiple agents (“Buildings”) for VerseRidge internal workflows, starting with NotebookLM.
**Scope:** Internal use only (v1). Single machine. File-backed registry and traces.

---

## 1) Core Metaphor and Definitions

### 1.1 The City

**AntiGravity** is the City: the platform that governs how work is executed, recorded, evaluated, promoted, and rolled back.

### 1.2 Buildings

A **Building** is a deployable agent capability package. Examples:

* `notebooklm` (document-grounded research and synthesis)
* future buildings: “web-research”, “code-review”, “ops-autopilot”, etc.

A building is not “an idea.” A building is a **versioned unit** with a permit, contracts, and an entrypoint.

### 1.3 Roads

A **Road** is a workflow: a repeatable path that moves a job from input → steps → verified output.

### 1.4 Intersections

An **Intersection** is the Tool Gateway: the only approved route for tool use, building calls, and external actions.

### 1.5 City Records

* **Git** is the City’s historical record of changes (code, SOPs, contracts).
* **Obsidian** is the City’s human-readable record (notes, meeting logs, research briefs, decisions).

---

## 2) Non-Negotiable Principles

### 2.1 One Front Door

All City operations must be performed via the official entrypoints (CLI or internal API):

* validate
* run
* eval
* register
* promote
* rollback

No “random scripts” may bypass the City.

### 2.2 Reproducibility by Default

Every run must be reproducible and must record:

* git SHA
* building versions used
* workflow version
* configuration hash
* timestamp
* trace_id

### 2.3 Principle of Least Agency

Buildings get the minimum access they need to do their job.

* Default posture: deny.
* Allow by explicit allowlist only.
* No unrestricted tool access.

### 2.4 Gates Before Promotion

No building may be promoted to staging/prod unless it passes its eval gates.

### 2.5 Rollback Must Always Work

Promotion must be pointer-based (stage references), making rollback fast and reliable.

---

## 3) What Counts as “Deployed” (Internal v1)

### 3.1 Deployment Definition

A building is “deployed” when:

* it is **registered** in Registry Hall with metadata
* its version is **promoted** to an environment stage pointer (dev/staging/prod)

v1 does not require containers or Kubernetes. Deployment is governance + version pointers.

### 3.2 Environments

* **dev:** fast iteration, still logged
* **staging:** eval required, stricter policies
* **prod:** manual approval + strict budgets + strict allowlists

---

## 4) Building Codes (Required Packaging Standard)

A building MUST include:

1. **Permit**
   `buildings/<name>/building.yaml`

2. **Contracts**
   `buildings/<name>/contracts/input.schema.json`
   `buildings/<name>/contracts/output.schema.json`

3. **SOP (Standard Operating Procedure)**
   `buildings/<name>/sop/vX.Y/sop.yaml`

4. **Adapter/Entrypoint**
   A callable entrypoint exposed through the Tool Gateway:
   `tool.<building>.run` (example: `tool.notebooklm.run`)

If any required piece is missing, the City must refuse to register or run the building.

---

## 5) Road Codes (Workflow Standard)

### 5.1 Golden Path First

Every new building must have at least one “Golden Road” workflow demonstrating:

* valid inputs
* controlled tool use
* verification
* trace emission
* reproducible output shape

### 5.2 Step Types (v1)

Allowed workflow step types:

* `step_start`
* `tool_call`
* `verify`
* `report`
* `step_end`
* `error`

No other types are allowed without updating City standards.

---

## 6) Run Event Standard (City Ledger)

### 6.1 Required Fields (Minimum Viable)

Every event MUST include:

* `event_version`
* `trace_id`
* `timestamp_utc`
* `event_type` (step_start, step_end, tool_call, error)
* `agent.name`, `agent.version`
* `run.run_id`, `run.workflow`, `run.environment`
* `step.step_index`, `step.step_type`, `step.status`
* `step.inputs_summary`, `step.outputs_summary`
* `step.errors` (empty list if none)

### 6.2 Optional but Strongly Recommended

* `span_id`, `parent_span_id`
* `duration_ms`
* `tool.*` (tool name, cache hit, budgets)
* `security.*` (policy decisions, redactions)
* `links.*` (artifact pointers)
* `metrics.*` (token/cost observability)

### 6.3 Storage Format

Runs are recorded as JSON Lines (JSONL):
`data/traces/YYYY-MM-DD/<trace_id>.jsonl`

The trace is the City’s “flight recorder.”

---

## 7) Tool Gateway Rules (No Side Streets)

### 7.1 Single Approved Route

All tool calls and building calls MUST pass through the Tool Gateway.

### 7.2 Enforcement Responsibilities

Tool Gateway must enforce:

* allowlist policies
* input/output contract validation
* budgets (max tool calls, timeouts)
* trace emission (tool_call start/end)
* redaction rules (if configured)

If enforcement cannot be applied, the call must be denied.

---

## 8) Registry Hall Rules (Versioning and Promotion)

### 8.1 Registration Requirements

To register a building version, the City must record:

* building name + version
* permit path + permit hash
* SOP version
* git SHA
* created timestamp
* evaluation status (if available)

### 8.2 Promotion Rules

Promotion moves a stage pointer:

* dev → staging → prod

Staging/prod promotion requires eval pass (unless explicitly overridden for emergencies).

### 8.3 Rollback Rules

Rollback must:

* revert the stage pointer to a previous known-good version
* record an audit event in the trace ledger or registry history

---

## 9) Evaluation and Inspections (Evals)

### 9.1 Minimum Evaluation Requirements

Every building must have at least one eval suite:

* contract validity
* required outputs (citations if needed)
* budget compliance
* deterministic formatting rules

### 9.2 Separation of Test Data

Eval inputs must not be mixed into SOP “training” examples or permanent memory stores without explicit review.

---

## 10) Obsidian and Documentation Standards (City Records)

### 10.1 Obsidian Is the Human Record

Obsidian stores:

* decisions
* meeting notes
* research briefs
* “why” behind changes

### 10.2 Git Is the Operational Record

Git stores:

* building permits
* SOPs
* contracts
* workflows
* runtime code

### 10.3 Drift Policy

If Obsidian says one thing and Git code says another, **Git is truth for execution**.
Obsidian must be updated to match within the next sprint.

---

## 11) v1 Constraints and Allowed Shortcuts

### 11.1 Internal-Only Shortcuts Allowed

* Human-in-the-loop adapters are allowed (NotebookLM v1)
* File-backed registry/traces are allowed
* Single-machine runtime is allowed

### 11.2 Shortcuts Not Allowed

* bypassing Tool Gateway
* running unregistered buildings
* promoting without any eval suite (except emergency override with log entry)
* undocumented tool access

---

## 12) Amendment Process

Constitution changes must:

1. be proposed in Obsidian (brief rationale + impact)
2. be implemented as a PR in Git
3. include updates to schemas/policies if needed
4. be versioned (e.g., v1.0 → v1.1)

---

## Appendix A: Default v1 “Golden Road”

**Workflow:** `sop_routed_knowledge_task`
**Building:** `notebooklm`
**Purpose:** prove the end-to-end system:

* permit validation
* tool gateway enforcement
* JSONL trace
* output verification
* registry promotion + rollback readiness

