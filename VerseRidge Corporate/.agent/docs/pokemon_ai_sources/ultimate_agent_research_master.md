# The Ultimate Pokemon Showdown Agent: Pro-Level Knowledge Synthesis

## I. Competitive Game Theory & AI Architecture

### 1. Nash Equilibrium in Simultaneous Move Games
Pokemon is a simultaneous-turn game. Optimality is defined by the **Nash Equilibrium (NE)** of the payoff matrix.
*   **The Payoff Matrix**: For any turn, calculate a 9x9 matrix (4 moves + 5 switches for each player).
*   **The Reward Function**: Payoff should not be just damage. It must be a mixture of:
    *   $\Delta HP$ (Health difference).
    *   $\Delta Progress$ (Status inflicted, hazards cleared).
    *   $\Delta Information$ (Revealing enemy items/moves).
*   **Expectiminimax**: A variant of Minimax that accounts for stochasticity (accuracy/crits). Nodes are evaluated as $V = \sum P_i \times V_i$.

### 2. Monte Carlo Tree Search (MCTS) vs. Deep Search
*   **MCTS** is superior for late-game scenarios where the game-tree is deep but the branching factor is reduced (fewer Pokemon left).
*   **UCT (Upper Confidence Bound for Trees)**: Balancing exploration (new move paths) and exploitation (known good moves).
*   **Pro Tip**: "PokeChamp" research suggests using an LLM to evaluate MCTS leaf nodes instead of random rollouts, providing a "strategic intuition" to the simulation.

## II. Professional Competitive Strategy (Smogon Standard)

### 3. The Threat Matrix & Win Condition (WinCon)
Pro players identify the "WinCon" at Team Preview.
*   **Counter-Mapping**: For every enemy Pokemon, identify which of your Pokemon can:
    *   **Switch-in** (Defensive check).
    *   **Force out** (Offensive check).
*   **Sacrificing (Sacking)**: The AI must learn when the value of a Pokemon is zero (e.g., fainted HP, or useless against remaining team) and use it as "fodder" to gain a safe switch-in for the WinCon.

### 4. Psychological Layer: Conditioning & Bluffing
*   **Conditioning**: Intentionally repeating a "safe" play to bake it into the opponent's prediction model, then deviating.
    *   *Agent Logic*: Track "Opponent Tendency" (Do they play safe or risky?). Adjust NE calculation with a "Bias Weight" based on history.
*   **Bluffing**: Leading the opponent to believe you have a specific item (e.g., Choice Scarf) by making moves that imply that speed tier, then revealing a Life Orb or setup move at 25% HP.

### 5. Advanced Mechanics Handling
*   **Choice Locking**: Identifying when the agent *must* move or when the *opponent* is locked.
*   **Pivoting (U-turn/Volt Switch)**: The value of these moves is higher than their damage because they generate a "Switch after they switch" opportunity, effectively allowing a Level 1 Prediction for free.
*   **Tera Management**: Terastallization is the ultimate "Bluff/Conditioning" tool. The agent must evaluate the "Tera Value" of all 6 team members every turn.

## III. Implementation Blueprint for the "Battle Mind"

1.  **Inference Module**: Uses Bayesian updates to narrow down enemy sets based on:
    *   % Damage taken (Item/Bulk check).
    *   Move revealed (Set check).
    *   Speed Order (Scarf/Stat check).
2.  **Strategic Module (LLM)**: Analyzes the battle log to provide textual "Strategic Advice" to the search engine.
3.  **Tactical Module (Nash Solver)**: Solves the payoff matrix for the current turn based on search results and Strategic Advice.
