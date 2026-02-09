# Technology Stack

This document outlines the preferred technologies and tools.

## Core Languages & Frameworks
- **Primary:** JavaScript/TypeScript, Node.js.
- **Frontend:** HTML5, Vanilla CSS, Vite, Next.js.
- **Game Dev:** 100% Deterministic logic. N64 graphics (LOD, mipmapping).
- **Voxel Engines:** **Phase-Step Movement System** (preventing floating-point drift), Recursive Raycast Marker logic, `execute align xyz` centering.
- **Vanilla Constraints:** Strictly Vanilla MC Functions (1.20.4+); avoid caret-firing or `hasitem` drift.

## Design & Engineering Philosophy
- **Component-First:** Build the "Filter" (logic/search engine) before the game/UI (Context: PokeLink).
- **Modular Design:** Strict adherence to Single Responsibility Principle (SRP).
- **Logic over Pseudocode:** Fully implemented, deterministic logic.
- **Visuals:** Modern, premium aesthetics (glassmorphism, vibrant colors).

## Search & Data
- **Quantum Engine:** Data extraction into clean JSON.
- **Networking:** Ethernet frames, latency-critical systems.
