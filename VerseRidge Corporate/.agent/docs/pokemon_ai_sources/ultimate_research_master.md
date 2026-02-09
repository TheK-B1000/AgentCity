# The Ultimate Pokemon Showdown Agent: Master Research Document

## I. Mathematical Foundations (The Nash Solver)
Competitive Pokemon is a simultaneous, turn-based, two-player zero-sum game with imperfect information and stochasticity.

### 1. The Payoff Matrix
Every turn must be modeled as a strategic game where both players choose an action (Move or Switch) simultaneously.
*   **Dimensions**: Typically a 9x9 matrix (4 moves, 5 potential switch-ins).
*   **Value Function**: Utility should not be based solely on immediate $\Delta HP$. A robust Utility Function ($U$) must include:
    *   $HP_{norm}$: Normalized remaining HP of your team vs opponent.
    *   $Positional$: Bonuses for hazards (Stealth Rock), status inflicted, and items removed (Knock Off).
    *   $Inference$: Bonus for revealing opponent information (Moves/Item/Ability).
*   **Nash Equilibrium**: The agent should solve for the Mixed Strategy Equilibrium, providing a probability distribution over its moves to prevent becoming predictable.

### 2. Expectiminimax & MCTS
*   **Expectiminimax**: Necessary for handling "Chance" nodes (Accuracy, Crits, Secondary effects).
*   **Monte Carlo Tree Search (MCTS)**: Used to explore deeper into the game tree (e.g., Turn + 3). Use fixed iterations (e.g., 100 per turn) to fit within the 20s Showdown timer.

## II. Pro-Level Strategic Heuristics (Smogon Meta)

### 3. The Art of Prediction (Yomi)
"Prediction" in high-level play is the ability to read the opponent's risk-tolerance.
*   **Level 0 (The Safe Play)**: Move that hits the current active Pokemon hardest.
*   **Level 1 (The Read)**: Move that targets the most likely switch-in.
*   **Conditioning**: Intentionally making "safe" plays 3-4 times to "teach" the opponent you are passive, then making a high-risk Level 1 read on a critical turn.

### 4. Information Warfare
*   **Set Inference**: The AI must compute the "Possible Sets" for every enemy Pokemon.
    *   *Bayesian Update*: If an enemy Gholdengo takes 12% from Stealth Rock, it is NOT wearing Heavy-Duty Boots. Update its movepool/item probabilities immediately.
*   **Bluffing**: Intentionally moving as if holding an item you don't have (e.g., waiting 1 second to simulate "Selection lag" or using moves that imply a specific set).

### 5. Win Conditions (Win-Cons) and Sacking
*   **Win-Con Mapping**: At Team Preview, total the possible KOs. Identify the "Cleaner" (the Pokemon that can win if its counters are removed).
*   **Calculated Sacrificing**: The AI must value a Pokemon's life at 0 if it has no utility left, using it to absorb a hit for a clean switch to the Win-Con.

## III. Battle Mind Architecture

1.  **Cortex**: Orchestrates the loop. Input: Battle State. Output: Command.
2.  **Inference Engine**: Tracks "Unknowns". Filters out impossible sets based on revealed data.
3.  **Strategy Module (LLM)**: Analyzes the *vibe* of the match. Is the opponent playing aggressive or stall? Adjusts the Nash Solver weights accordingly.
4.  **Game Engine (Poke-Env)**: Simulates outcomes for the Expectiminimax search.
