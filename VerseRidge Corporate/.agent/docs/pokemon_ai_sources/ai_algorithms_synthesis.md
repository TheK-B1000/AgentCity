# Game AI Architecture for Pokemon
*Source Synthesis for Ultimate Showdown Agent*

## 1. The Challenge: Partial Observability & Stochasticity
Pokemon is a game of **Imperfect Information** (Enemy sets unknown) and **High Variance** (Accuracy, Crits, Status effects).
*   **State Space**: $10^{15+}$ states (Moves $\times$ Items $\times$ HP $\times$ Status $\times$ Field).
*   **Branching Factor**: High. Each turn has ~4 moves + ~5 switches = 9 options per player. Simultaneous turns = $9 \times 9 = 81$ outcomes per turn.

## 2. Minimax (and Expectimax)
The standard for turn-based games.
*   **Vanilla Minimax**: Assumes opponent plays optimally (Nash Equilibrium). Good for "safe" play.
*   **Expectimax**: Accounts for probability (e.g., 85% accuracy move, critical hit chance).
    *   *Node Value* = $\sum (Probability \times Score)$
*   **Depth**: Due to branching, depth is usually limited to 2-3 turns.
*   **Evaluation Function (Heuristic)**:
    $$ Score = \alpha(HP_{diff}) + \beta(Type_{advantage}) + \gamma(Status) + \delta(Momentum) $$

## 3. Monte Carlo Tree Search (MCTS)
Used when the search space is too deep to traverse.
*   **Simulations**: Play random games to the end from the current state.
*   **Application**: "PokeGod" bot uses MCTS to estimate the win rate of a move.
*   **Pros**: Handles end-game scenarios well (where depth > 3 is needed).
*   **Cons**: Slow. "Random" simulations in Pokemon are noisy due to complex mechanics.

## 4. Reinforcement Learning (RL)
*   **Deep Q-Networks (DQN)**: Train a neural network to predict the value of a state.
*   **Self-Play**: AlphaGo style. The agent plays against itself millions of times.
*   **Challenges**:
    *   **Reward Shaping**: Is dealing 10% damage good? Not if it triggers a counter-strategy. Evaluating position is hard.
    *   **Generalization**: An RL agent trained on Gen 8 OU might fail in Gen 9 because it memorized specific matchups rather than general concepts.

## 5. Hybrid Approach (The "Ultimate" Mind)
*   **Knowledge Base (LLM)**: "PokeChamp" uses LLMs to "reason" about the matchup (qualitative).
*   **Search (Minimax)**: Uses the LLM's reasoning to prune the search tree (quantitative).
*   **Example**:
    1.  LLM: "Iron Valiant forces a switch here." -> Prune all non-switch opponent moves.
    2.  Minimax: Calculate the best move assuming opponent switches.
