# The Battle Mind: Architecture for the Ultimate Agent
*Blueprint for NotebookLM Project*

## Core Philosophy
The Battle Mind combines **Symbolic AI** (Rules, Damage Calcs) with **Probabilistic Reasoning** (Prediction) and **LLM Reasoning** (Strategy).

## System Architecture

### 1. The Cortex (Central Controller)
*   **Role**: Orchestrates the decision loop.
*   **Input**: Battle State (JSON from Showdown Protocol).
*   **Output**: Selected Action (Move/Switch).

### 2. The Knowledge Graph (Static Memory)
*   **Pokedex**: Base stats, types, abilities.
*   **Smogon Dex**: Common sets, usage stats (Pikalytics).
    *   *Usage*: "If opponent has Landorus-T, they have a 80% chance of Scarf, 20% Helmet."
*   **Type Chart**: Hard-coded effectiveness logic.

### 3. The Simulator (The Imagination)
*   **Engine**: A lightweight clone of the Pokemon battle engine (e.g., `poke-env`).
*   **Function**: `Simulate(State, MyAction, EnemyAction) -> NewState`.
*   **Purpose**: Used by the Search Engine to look ahead.

### 4. The Inference Engine (The Predictor)
*   **Set Inference**:
    *   *Observation*: "Opponent took 12% from Stealth Rock." -> *Inference*: "They are not Boots/Magic Guard."
    *   *Observation*: "Opponent moved first." -> *Inference*: "They are Scarfed or Speed invested."
*   **Move Prediction**:
    *   Uses Usage Stats + Game State to assign probabilities to enemy moves.
    *   $P(Move_i) = f(Damage, Risk, History)$

### 5. The Evaluator (The Judge)
*   **Heuristic Function**: Assigns a scalar value (0-100) to a state.
    *   $Score = (HP_{my} / HP_{total}) \times W_1 - (HP_{opp} / HP_{total}) \times W_2 + Momentum \times W_3 + WinCon_{alive} \times W_4$
*   **Win Condition Logic**: Dynamic weighting. If `Kingambit` is the cleaner, preserve its HP at all costs ($W_{Kingambit} \uparrow$).

## Proposed Workflow on NotebookLM
1.  **Ingest Sources**: Upload this blueprint, the Smogon guide, and the AI algorithm review.
2.  **Generate Prompts**:
    *   "Design the `Evaluator` function for a Stall vs Hyper Offense matchup."
    *   "Create a Python class structure for the `Inference Engine`."
    *   "How should the agent handle '50/50' Sucker Punch situations using Minimax?"

## Reference Implementation Stack
*   **Language**: Python 3.10+
*   **Framework**: `poke-env` (Interface with Showdown).
*   **Search**: Alpha-Beta Pruned Minimax (Depth 2-4).
*   **Knowledge**: LLM-generated heuristics stored in a vector database.
