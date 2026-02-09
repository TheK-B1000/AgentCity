# Agentic Technical Brief: The Ultimate Pokemon Showdown Agent
*Code Name: "Battle Mind"*

## 1. Executive Summary
The **Battle Mind** is a hybrid AI architecture designed to compete at the highest levels of Pokemon Showdown (OU Gen 9). Unlike traditional bots that rely solely on Minimax damage optimization, Battle Mind integrates **Psychological Modeling** (Bluffing/Conditioning) and **Bayesian Inference** (Set Prediction) to mimic professional human intuition.

## 2. Core Architecture

The system is composed of five distinct modules operating in a continuous OODA Loop (Observe, Orient, Decide, Act).

### Module A: The Cortex (Orchestrator)
*   **Role**: Central nervous system. Manages the loop and time budget (20s/turn).
*   **Input**: `BattleState` (JSON from Showdown Protocol).
*   **Output**: `Action` (Move/Switch string).
*   **Sub-Component**: `TimeManager` - Allocates 70% of computation to critical turns, 10% to "obvious" turns.

### Module B: The Inference Engine (Sherlock)
*   **Role**: Deduces hidden information.
*   **Logic**:
    *   **Set Prediction**: Uses `Pikalytics` usage stats as priors. Updates posteriors based on:
        *   Damage Taken $\rightarrow$ Deduced Defensive EVs/Nature.
        *   Speed Order $\rightarrow$ Deduced Scarf/Speed EVs.
        *   Damage Dealt $\rightarrow$ Deduced Item (Life Orb/Band) or Ability.
    *   **The "Impossible Set" Filter**: Eliminates possibilities. "Opponent took Stealth Rock damage $\rightarrow$ Cannot be Heavy-Duty Boots."

### Module C: The Strategist (The LLM Layer)
*   **Role**: High-level directional guidance (The "Vibe" check).
*   **Input**: Battle log summary + Team compositions.
*   **Query**: "Given the opponent has a defensive Gholdengo and I have a Great Tusk, what is my win condition?"
*   **Output**: `StrategicBias` vector (e.g., `Aggression: 0.8`, `Preserve_Health: Great Tusk`).

### Module D: The Tactician (Nash Solver)
*   **Role**: Solves the immediate turn.
*   **Algorithm**: **Hybrid MCTS-Expectiminimax**.
    *   **Depth**: Variable (2-4 turns).
    *   **Simulations**: 100-500 rollouts/turn using `poke-env`.
    *   **Evaluation Function ($f(s)$)**:
        $$ f(s) = W_1(HP_{diff}) + W_2(Positional) + W_3(WinCon_{safety}) + W_4(Inference_{gain}) $$
    *   **Nash Equilibrium**: Calculates the Mixed Strategy to prevent exploitation.

### Module E: The Conditioner (Psychology)
*   **Role**: Manages the "Meta-Game".
*   **Bluffing**: Intentionally lowers the weight of "Optimal" moves in early turns to lower the opponent's guard.
*   **Conditioning Score**: Tracks opponent's response to risk.
    *   If Opponent constantly predicts safe moves $\rightarrow$ Increase weight of "Double Switch".
    *   If Opponent plays safe $\rightarrow$ Increase weight of "Greedy Plays".

## 3. Implementation Stack
*   **Language**: Python 3.11
*   **Battle Engine**: `poke-env` (optimized fork for speed).
*   **Search**: Custom MCTS implementation with Alpha-Beta Pruning.
*   **Inference**: `pydantic` models for Bayesian updates.
*   **LLM Integration**: Cached calls to Gemini 1.5 Pro (for Strategy Module).

## 4. Development Roadmap
1.  **Skeleton**: Connect `poke-env` to Showdown and implement Random Player.
2.  **Tactician**: Implement Minimax with basic damage evaluation.
3.  **Inference**: Build the "Sherlock" module to track sets.
4.  **Strategist**: Hook up the LLM for Win-Con identification.
5.  **Integration**: Combine into `BattleMind` class.
