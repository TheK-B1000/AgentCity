# Competitive Pokemon Strategy: The Human Element
*Source Synthesis for Ultimate Showdown Agent*

## 1. The Art of Prediction (Yomi)
In competitive Pokemon, "Prediction" is not guessing; it is **Probabilistic Risk Assessment** based on incomplete information.

### Layers of Prediction
1.  **Level 0 (The Obvious Play)**: Using an Electric move on a Water type.
2.  **Level 1 (The Read)**: Predicting the opponent will switch their Water type to a Ground type, and using an Ice move instead.
3.  **Level 2 (The Double Down)**: Predicting the opponent *knows* you will predict the switch, so they *don't* switch, meaning you should just use the Electric move.
4.  **Level 3+ (Conditioning)**: Making "safe" plays early to convince the opponent you are passive, then making a risky read at a critical moment.

### Information Management
*   **Team Preview**: The most critical phase. An agent must map out the "Threat Matrix" (which of my mons counters theirs) immediately.
*   **Scouting**: Early turns are for information gathering (Sets, Items, Abilities). A generic "U-turn" is often better than a damage move if it reveals the opponent's defensive answer.
*   **Hiding Information**: Concealing a Choice Scarf or a niche coverage move until it secures a KO.

## 2. Risk vs. Reward
A battle is a sequence of turns where you maximize Expected Value ($EV$).
$$ EV = P(Success) \times Impact(Success) - P(Failure) \times Impact(Failure) $$

*   **The "Mid-Ground" Play**: A move that covers multiple opponent options (e.g., attacking the active *and* being neutral on the switch), even if it's not the "optimal" prediction for either.
*   **Win Conditions (WinCon)**: Identifying the one Pokemon on your team that *must* survive to clean up the end game. "Sacking" (sacrificing) other Pokemon to preserve the WinCon is a pro strategy.

## 3. Team Archetypes & Pacing
*   **Hyper Offense (HO)**: Trades HP for Momentum. Agent must prioritize speed and "breaking" walls.
*   **Stall**: Risk minimization. Agent must calculate long-term PP stalling and passive damage.
*   **Balance**: The most complex. Requires constant switching to maintain type advantage.

## 4. Key Heuristics for an Agent
*   **Do not lose to a single bad turn**: Avoid 50/50s if a safe 90/10 play exists, even if the reward is lower.
*   **Health as a Resource**: HP is not just "life"; it's currency to buy turns or damage.
*   **Momentum**: Being the one "threatening" is always better than reacting. Moves like U-turn/Volt Switch generate momentum.
