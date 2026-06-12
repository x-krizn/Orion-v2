# Project ORION - Machine-Readable Project Index

This file serves as a permanent, machine-readable project index and architectural blueprint for Project ORION (Mech Combat Sandbox). It documents the structural layout, core modules, interface boundaries, and system integration patterns to facilitate automated maintenance, development, and high-fidelity AI refactoring.

---

## High-Level Architecture Overview

Project ORION is a vertical-slice 2.5D Mech Combat Sandbox built with **React 18+**, **Vite**, **TypeScript**, and **BabylonJS 7.x**. The architecture is structured into highly modular layers containing robust interfaces, decoupling visual representation from core combat systems.

```
+--------------------------------------------------------+
|                      React UI Layer                    |
|       (App.tsx, BootSequence, Pointer touch HUDs)      |
+---------------------------+----------------------------+
                            |
                            v [Instantiates & Controls]
+--------------------------------------------------------+
|                     central GameManager                |
|  (Loop coordinator, Target Lock Pipeline, raycasts)   |
+----+----------------------+-----------------------+----+
     |                      |                       |
     | [Calculates]         | [Input Proxy]         | [Translates]
     v                      v                       v
+---------------+     +---------------+     +---------------+
| Combat Engine |     | Input System  |     | Camera System |
| (Combat stats |     | (PC, Gamepad, |     | (Isometric    |
| & parameters) |     | touch inputs) |     | camera lerps) |
+---------------+     +---------------+     +---------------+
     |                      |                       |
     |                      v [Drives]              v [Arranges]
     |                +---------------+     +---------------+
     +--------------->| CharacterCtrl |     | EnviroManager |
                      | (Mech split,  |     | (Grid arenas, |
                      | sockets, attachment)| modular kits)|
                      +---------------+     +---------------+
                            |                       |
                            v [Spawns effects]      |
                      +---------------+             |
                      |   FX System   |             |
                      | (Beams, laser |<------------+
                      | projectiles,  |
                      | hit impacts)  |
                      +---------------+
```

### Major Systems Breakdown
1. **Coordination & Entry Gateways**: Hydrates the React component tree and hooks up high-frequency Pointer Capture touch zones, diagnostics panels, and the neural coupling boot sequence.
2. **Central Simulation Coordinator (`GameManager`)**: Executes the main Babylon rendering loop, queries terrain raycasts, orchestrates Line of Sight target calculations, structures offscreen warning markers, and directs model drops.
3. **Pure Logic State Machine (`CombatEngine`)**: Tracks and calculates HP/EN resource scales, guards resistance levels, stagger recovery periods, and damage multipliers. Highly deterministic.
4. **Input Event Translation (`InputSystem`)**: Detects active hardware profiles, maps customizable key bindings, and decodes composite touch coordinates.
5. **Aesthetic Rendering & Visual Alignment**:
   - `CharacterController` controls hover motions, coordinate offsets, and modular mech splits.
   - `EnvironmentManager` arranges layout geometry, registers thematic styles, and auto-classifies GLB kits.
   - `SocketManager` scans recursive named nodes (`socket_`) to perform exact attachment parenting.
   - `FXSystem` manages pooled visual arrays (lasers, shockwaves, rail beams).

---

## Directory & File Index

### /package.json

Purpose:
Defines project dependencies, compiler metadata, and development server execution commands.

Owns:
- Scripts mapping (dev, build, start commands)
- Dependency catalogs (React, Babylon, Tailwind)
- Compiler target parameters

Does NOT Own:
- Code logic implementation
- Thematic styling configurations
- Asset cache directories

Dependencies:
- None.

Used By:
- Bundlers, development runners, package managers.

Safe To Modify:
- Yes, to register secondary npm utility libraries.
- Cautions: Dev server scripts **must** bind strictly to host `0.0.0.0` and port `3000`.

---

### /tsconfig.json

Purpose:
Configures the TypeScript compiler settings.

Owns:
- Strict typings guidelines
- Modules resolution patterns
- Path mapping aliases

Does NOT Own:
- Static models loaders
- Production bundlers configuration

Dependencies:
- None.

Used By:
- TypeScript compiler (`tsc`), Vite bundlers.

Safe To Modify:
- Yes, to adjust compilation strictness or global compiler targets.

---

### /vite.config.ts

Purpose:
Configures Vite plugin chains, servers, and asset builds.

Owns:
- Port routing layers
- React and Tailwind integration plugins
- Custom HMR watch overrides for sandboxed AI workspaces

Does NOT Own:
- Production Express routing controls
- Game loop clock updates

Imports:

| Import | Purpose |
|--------|---------|
| `defineConfig` | Wraps compilation settings with type definitions |
| `react` | Attaches React compilation support |
| `tailwindcss` | Connects inline CSS utility builders |

Exports:

| Export | Purpose |
|--------|---------|
| `default` | Configuration object read by Vite processes |

Dependencies:
- None.

Used By:
- Bundling engines, development servers.

Safe To Modify:
- Yes, to append compilation rules or bundle visualizers.
- Cautions: Do not remove the custom `DISABLE_HMR` check that ensures stable rendering during live workspace edits.

---

### /server.ts

Purpose:
Provides a full-stack production server and persistence API.

Owns:
- Express setup and serving
- Real-time disk upload routing (`/api/upload-asset`) to save custom mechs
- Static SPA routing fallbacks

Does NOT Own:
- Game simulation loop
- 3D coordinate translations

Imports:

| Import | Purpose |
|--------|---------|
| `express` | Boots the HTTP and API router layer |
| `path` | Resolves cross-platform local directories paths |
| `createViteServer` | Incorporates dev middleware in non-production builds |

Dependencies:
- `/vite.config.ts` (for development middleware initialization).

Used By:
- Node compiler runners.

Safe To Modify:
- Yes, to add secondary API routes, database proxies, or custom AI endpoints.
- Cautions: Port bindings **must** remain locked to port `3000` on host `0.0.0.0`.

---

### /.env.example

Purpose:
Documents environmental variable bindings and secret placeholders.

Owns:
- Core integration secrets placeholders

Does NOT Own:
- Active production environment values

Dependencies:
- None.

Safe To Modify:
- Yes, when introducing secondary variable declarations.

---

### /metadata.json

Purpose:
Stores application metadata, security tokens, and permission arrays.

Owns:
- App display name and descriptions
- Camera, microphone, or geolocation frame authorization list
- Platforms capabilities tokens (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`)

Does NOT Own:
- Client state properties
- Backend storage models

Dependencies:
- None.

Used By:
- Orchestrator deployment panels, security filters.

Safe To Modify:
- Yes, to revise app metadata or request hardware permissions.
- Cautions: Do not delete existing structural values.

---

### /src/main.tsx

Purpose:
Serves as the client-side entry point for bundling and hydrates the service worker.

Owns:
- Client bootstrapper mounting
- PWA local Service Worker registration

Does NOT Own:
- Visual UI states manager
- Game logic updates

Imports:

| Import | Purpose |
|--------|---------|
| `React` | Incorporates standard virtual nodes |
| `ReactDOM` | Hydrates the root HTML node |
| `App` | Imports the root UI component |
| `registerSW` | Handles client caching and offline PWA support |

Exports:
- None.

Major Blocks:

| Block | Purpose |
|------|---------|
| root renderer | Invokes virtual container on `#root` |
| worker loader | Dynamically triggers PWA registration logic |

Dependencies:
- `/src/App.tsx`.

Used By:
- `/index.html`.

Safe To Modify:
- Yes, to install global React context providers or custom application crash boundaries.

---

### /src/App.tsx

Purpose:
Integrates React UI state management, touch screen virtual joysticks, diagnostic panels, and sandbox settings.

Owns:
- Diagnostics overlays toggles (`showTelemetry`, `showCombatDebug`)
- Pointer Capture hooks resolving multitouch virtual sticks
- Calibration inputs tracking scale, rotation, and coordinate offsets for visual models
- Diagnostic panels plotting FPS, frame timings, and draw counts

Does NOT Own:
- 3D collision mechanics
- Sockets alignments actions

Imports:

| Import | Purpose |
|--------|---------|
| `GameManager` | Launches and controls the Babylon 3D loop |
| `InputManager` | Reads or alters custom settings |
| `BootSequence` | Renders the opening authenticating interface |
| `lucide-react` | Imports standardized icons |

Exports:

| Export | Purpose |
|--------|---------|
| `default` | Root UI component of the client framework |

Major Blocks:

| Block | Purpose |
|------|---------|
| performance listeners | Pulls live metrics from 3D renderer |
| pointer captures | Updates joystick transforms and signals the InputController |
| overlay slider cards | Translates local values to 3D modifiers |

Dependencies:
- `/src/game/game/GameManager.ts`
- `/src/game/input/InputSystem.ts`
- `/src/components/BootSequence.tsx`
- `/src/game/types.ts`

Used By:
- `/src/main.tsx`.

Safe To Modify:
- Yes. You can entirely re-evaluate layout distribution, styles, colour highlights, and add custom UI modules.

---

### /src/components/BootSequence.tsx

Purpose:
Provides an interactive loading screen simulating a mech diagnostics boot sequence.

Owns:
- Progress step timing delays
- Interactive pilot identity registration input
- Transition triggers signaling initialization completion

Does NOT Own:
- Actual files loading
- 3D loop setup

Imports:
- `React`, standard hooks.

Exports:

| Export | Purpose |
|--------|---------|
| `BootSequence` | Renders the authenticating terminal panel |

Major Blocks:

| Block | Purpose |
|------|---------|
| step ticker loop | Sequences mock logs with custom delays |
| confirm handler | Executes neural link simulation transition |

Dependencies:
- None.

Used By:
- `/src/App.tsx`.

Safe To Modify:
- Yes, to change simulated checks, adapt sequence logs, or customize design layouts.

---

### /src/game/types.ts

Purpose:
Defines global TypeScript type specifications, interfaces, and shared state structures.

Owns:
- Interfaces for system profiles (`GameSettings`)
- Input structures models (`PlayerInput`)
- Diagnostic objects (`PerformanceStats`)
- Spawnable custom asset representations (`ModelAssetInfo`, `GameplayAction`)

Does NOT Own:
- Concrete gameplay calculation code

Dependencies:
- None.

Used By:
- `GameManager`, `App`, `CharacterController`, `InputController`, `DataManager`, `IsometricCamera`, `EnvironmentManager`.

Safe To Modify:
- Yes, when expanding capabilities descriptors or tracking variables.

---

### /src/game/camera/IsometricCamera.ts

Purpose:
Implements a 2.5D follow camera system with zoom boundaries and camera shake.

Owns:
- Cam zoom boundaries (`minZoom`, `maxZoom`)
- Dynamic 3D tracking offsets targets
- Screen shake simulation arrays (frequency, translation multipliers)

Does NOT Own:
- Character direction calculations
- Terrain floor generation

Imports:
- `@babylonjs/core` camera and target structures.

Exports:

| Export | Purpose |
|--------|---------|
| `IsometricCamera` | Handles orthographic-like follow tracking and shake effects |

Major Blocks:

| Block | Purpose |
|------|---------|
| `constructor` | Instantiates target camera and binds inputs |
| `update` | Runs position smoothing lerps |
| `triggerShake` | Sets shake parameters to simulate heavy explosions |

Dependencies:
- `/src/game/types.ts`.

Used By:
- `/src/game/game/GameManager.ts`.

Safe To Modify:
- Yes, to change camera interpolation rates, tracking distance default scales, or modify camera shake decays.

---

### /src/game/combat/CombatTypes.ts

Purpose:
Defines data structures, enums, and state interfaces representing the combat status of entities.

Owns:
- Lock-on states (`LockState`)
- Entity action phases (`ActionState`)
- Status effect templates (`StatusEffectType`)
- Stagger and poise configurations (`HitReactionTier`)

Does NOT Own:
- Actual physical entity properties (forces, velocities)

Dependencies:
- None.

Used By:
- `CombatEngine`, `CombatConfig`, `CharacterController`, `GameManager`.

Safe To Modify:
- Yes, to declare new action phases or support custom buffs.

---

### /src/game/combat/CombatConfig.ts

Purpose:
Centralizes combat physics, weapon attributes, and poise-decay ratios.

Owns:
- Constants for resource ticks (`COMBAT_TUNABLES`)
- Buff/debuff configurations (`STATUS_EFFECT_CONFIGS`)
- Weapon balance figures (`WEAPON_COMBAT_STATS`)
- Attack animation timings (`COMBAT_ACTIONS`)

Does NOT Own:
- Dynamic entity status records

Imports:
- `/src/game/combat/CombatTypes.ts`.

Exports:
- `COMBAT_TUNABLES`, `STATUS_EFFECT_CONFIGS`, `HIT_REACTION_CONFIGS`, `WEAPON_COMBAT_STATS`, `COMBAT_ACTIONS`.

Dependencies:
- `/src/game/combat/CombatTypes.ts`.

Used By:
- `CombatEngine`, `CharacterController`, `GameManager`.

Safe To Modify:
- Yes. This is the master config file for game tuning. Update to change weapons damage, status effects multipliers, speed limits, or startup/active frames.

---

### /src/game/combat/CombatEngine.ts

Purpose:
A pure, deterministic data-processing utility that calculates and updates core combat states.

Owns:
- Combat state initialization (`createDefaultCombatState`)
- Shield, EN, and temperature metrics calculations
- Poise decay cycles, stagger, and guard-break indicators
- Damage resolution pipelines (`resolveDamagePipeline`) accounting for armor calculations

Does NOT Own:
- Particle generation (delegates to FXSystem)
- Input reading (delegates to InputController)

Imports:
- `CombatTypes`, `CombatConfig`.

Exports:

| Export | Purpose |
|--------|---------|
| `CombatEngine` | Stateless calculators for entity combat variables |

Major Blocks:

| Block | Purpose |
|------|---------|
| `createDefaultCombatState` | Formulates initial statistics |
| `updateCombatState` | Performs time-step calculations |
| `resolveDamagePipeline` | Executes damage calculations against resistances |

Dependencies:
- `/src/game/combat/CombatTypes.ts`
- `/src/game/combat/CombatConfig.ts`

Used By:
- `/src/game/game/GameManager.ts`
- `/src/game/movement/CharacterController.ts`.

Safe To Modify:
- Yes, to adjust defense math, customize status ticks, or refactor hit reactions. Ensure type boundaries are strictly maintained.

---

### /src/game/fx/FXSystem.ts

Purpose:
Responsible for visual effects generation and object-pooled visual particles.

Owns:
- Projectiles shells, shockwaves, laser lines, and explosion meshes
- Multi-colored theme color mappings
- Custom effects templates loaded from static definitions

Does NOT Own:
- Hitbox registrations (handled by GameManager)
- Physical boundaries checking

Imports:
- `@babylonjs/core` rendering and particle utilities.

Exports:

| Export | Purpose |
|--------|---------|
| `FXSystem` | Manages visual feedback spawning and garbage collection |

Major Blocks:

| Block | Purpose |
|------|---------|
| `spawnLaserShell` | Spawns a glowing laser projectile |
| `spawnHeavyBeam` | Creates a persistent high-energy beam |
| `spawnExplosion` | Spawns a multi-stage radial particle explosion |
| `update` | Updates active projectiles and active pools |

Dependencies:
- None.

Used By:
- `GameManager`, `CharacterController`.

Safe To Modify:
- Yes, to register secondary aesthetic particles or scale custom visual effects.

---

### /src/game/game/DataManager.ts

Purpose:
Loads, validates, and provides fallbacks for static game configuration databases.

Owns:
- Asynchronous fetching of JSON game data files
- Fallback in-memory backups for weapons, stats, enemies, and maps

Does NOT Own:
- Projectiles spawning or combat algorithms

Exports:

| Export | Purpose |
|--------|---------|
| `DataManager` | Static database provider and fallback engine |

Major Blocks:

| Block | Purpose |
|------|---------|
| `loadAllData` | Fetches JSON files asynchronously |
| `populateFallbackDefaults` | Mounts in-code collections as a robust fallback |

Dependencies:
- `/src/game/types.ts`.

Used By:
- `/src/game/game/GameManager.ts`.

Safe To Modify:
- Yes, to expand fallback values or register new static entries.

---

### /src/game/game/GameManager.ts

Purpose:
Acts as the main orchestrator, binding the Babylon runtime, input proxies, and sandbox coordinators.

Owns:
- BabylonJS engine lifecycle hookups and viewport sizing
- Simulation iteration updates and timing cycles propagation
- Line of Sight target checks and multi-locking progression management
- Model asset uploads, drag-and-drop routing, and startup scene preloads

Does NOT Own:
- Hardware controllers polling logic directly (delegated to InputManager)

Imports:
- Core Babylon utilities, `InputController`, `IsometricCamera`, `EnvironmentManager`, `CharacterController`, `FXSystem`, `DataManager`.

Exports:

| Export | Purpose |
|--------|---------|
| `GameManager` | Chief simulator coordinating rendering loops and modules |

Major Blocks:

| Block | Purpose |
|------|---------|
| `initScene` | Configures 3D elements and buffers |
| `preloadDefaultAssets` | Preloads custom mechs and environment kits from disk |
| `update` | Orchestrates target-lock updates, enemy AI chasing, and physics loops |
| `spawnEnemyAt` | Spawns an enemy and registers its combat state |

Dependencies:
- `/src/game/types.ts`, `/src/game/input/InputController.ts`, `/src/game/camera/IsometricCamera.ts`, `/src/game/rendering/EnvironmentManager.ts`, `/src/game/movement/CharacterController.ts`, `/src/game/fx/FXSystem.ts`, `/src/game/game/DataManager.ts`.

Used By:
- `/src/App.tsx`.

Safe To Modify:
- Yes, to integrate new game loops, customize target acquisition, or add sandbox configurations. Keep logic clean by delegating tasks to sub-managers.

---

### /src/game/input/InputSystem.ts

Purpose:
Acts as the multi-device input system, handling active hardware profile detection and settings serialization.

Owns:
- Keystroke buffers, Gamepad WebAPI adapters, and virtual touch sticks
- Dynamic device hot-swapping mapping (PC, Gamepad, Touch)
- Tap-vs-hold timing threshold calculations
- Local settings serialization to localStorage

Does NOT Own:
- Multi-vector movement translation based on camera orientation

Exports:

| Export | Purpose |
|--------|---------|
| `InputManager` | Central singleton manager coordinating input devices |
| `DEFAULT_SETTINGS` | Standard key scheme and deadzone definitions |
| Adapters | Platform-specific adapters (`KeyboardMouseInputAdapter`, `GamepadInputAdapter`, `TouchInputAdapter`) |

Major Blocks:

| Block | Purpose |
|------|---------|
| `update` | Measures holding frames and active devices |
| `saveSettings` / `loadSettings` | Keybindings state serialization |

Dependencies:
- None.

Used By:
- `InputController`, `CharacterController`, `/src/App.tsx`.

Safe To Modify:
- Yes, when mapping secondary actions, expanding calibration deadzones, or adjusting touch analog sizes.

---

### /src/game/input/InputController.ts

Purpose:
Provides a backward-compatible proxy forwarding legacy input hooks to the unified `InputManager` singleton.

Owns:
- InputState mappings conversion (`PlayerInput`)
- Virtual overlay button callback triggers
- Client movement coordinate translation relative to camera yaw

Does NOT Own:
- Native keyboard listeners (delegated to KeyboardMouseInputAdapter)
- LocalStorage config buffers (delegated to InputManager)

Imports:
- `InputManager`, Babylon vectors.

Exports:

| Export | Purpose |
|--------|---------|
| `InputController` | Compatibility wrapper bridging legacy code and the central InputManager |

Major Blocks:

| Block | Purpose |
|------|---------|
| `getInputState` | Assembled composite structures and fires event callbacks |
| `triggerAbility` | Simulates high-frequency key hits for touch control buttons |

Dependencies:
- `/src/game/types.ts`
- `/src/game/input/InputSystem.ts`.

Used By:
- `/src/game/game/GameManager.ts`.

Safe To Modify:
- Yes, when adding legacy control metrics or translating coordinate heading calculations.

---

### /src/game/movement/CharacterController.ts

Purpose:
Coordinates physical character kinematics, visual transformations, and modular model integration.

Owns:
- Player kinematics (gravity, velocity, acceleration vector updates)
- Bounding-sphere coordinates checks and arena boundary limits
- Decoupling imported models (separating lower chassis from independent rotating upper torso assemblies)
- Socket registration catalogs and active weapon visibility swaps

Does NOT Own:
- Global target selections calculations (handled by GameManager)

Imports:
- Babylon vectors, `FXSystem`, `SocketManager`, `CombatEngine`, `CombatConfig`, `CombatTypes`.

Exports:

| Export | Purpose |
|--------|---------|
| `CharacterController` | Custom character physical kinematics and modular mesh alignment manager |

Major Blocks:

| Block | Purpose |
|------|---------|
| `buildProceduralMech` | Generates a fallback procedural mech with geometric meshes |
| `attachCustomModel` | Splits imported GLBs, aligns joints, and updates materials |
| `updateEquipmentVisibility` | Swaps weapon visibility states based on equipped loadout |
| `update` | Governs resource ticking, direction tracking, and movement translation |

Dependencies:
- `/src/game/types.ts`, `/src/game/fx/FXSystem.ts`, `/src/game/rendering/SocketManager.ts`, `/src/game/combat/CombatTypes.ts`, `/src/game/combat/CombatEngine.ts`, `/src/game/combat/CombatConfig.ts`.

Used By:
- `/src/game/game/GameManager.ts`.

Safe To Modify:
- Yes. You can change procedural meshes, modify jump/dash velocity metrics, adjust collision radii, or configure additional subcomponents splits.

---

### /src/game/rendering/EnvironmentManager.ts

Purpose:
Generates floor tile arrangements, grid visual overlays, and classifies drag-and-dropped level assets.

Owns:
- High-fidelity glowing floor grid lines
- Static obstacles physics boundaries lists
- Auto-classification parsing rules (sorting meshes by name into low/mid/high walls or floor tiles)
- Organic vegetation placement generators

Does NOT Own:
- Active weapon model attachments

Imports:
- Babylon meshes generators, `@babylonjs/loaders/glTF`.

Exports:

| Export | Purpose |
|--------|---------|
| `EnvironmentManager` | Grid overlay builder and level assets classifier |

Major Blocks:

| Block | Purpose |
|------|---------|
| `buildGridArena` | Creates glowing grid lines on the floor |
| `loadGLBFile` / `preloadEnviroModelFromURL` | Integrates dropped or preloaded GLB tiles |
| `discoverEnviroGroups` | Recursively scans for structural subgroups (e.g. bog terrain kits) |
| `autoArrangeLibrary` | Re-arranges classified items into structured arena maps |

Dependencies:
- `/src/game/types.ts`.

Used By:
- `/src/game/game/GameManager.ts`.

Safe To Modify:
- Yes, to adjust arena default sizes, include secondary environment themes, customize grid graphics, or change asset classification criteria.

---

### /src/game/rendering/SocketManager.ts

Purpose:
Auto-discovers, monitors, and parents weapon attachment nodes prefixed with `socket_`.

Owns:
- Model attachment points list (`socket_weapon_01`, `socket_muzzle`, etc.)
- Deep recursive scanning triggers
- Alignment snapping and scaling offsets resets
- Port-vs-starboard orientation checking (mirroring left and right fire points)

Does NOT Own:
- Mesh loading from disk files

Imports:
- `@babylonjs/core` transform controllers.

Exports:

| Export | Purpose |
|--------|---------|
| `SocketManager` | Attaches weaponry accessories and handles local transforms alignment |

Major Blocks:

| Block | Purpose |
|------|---------|
| `discoverSockets` | Performs a deep recursive scan of subtrees to map sockets |
| `attachModuleToSocket` | parents modular meshes, centering translation and rotation |

Dependencies:
- None.

Used By:
- `/src/game/movement/CharacterController.ts`.

Safe To Modify:
- Yes, to map alternative suffix formats, auto-rotate specific modules, or change mirroring rules.

---

## Static Assets & Local Storage Directories

### `/public/data/`
Static sandbox configuration catalog folders.
- `abilities.json`: Ability stats (damage, cooldown, intensity) for rail beams, shockwaves, and bombardments.
- `effects.json`: Custom visual templates configurations.
- `enemies.json`: Custom enemy specifications (HP, scales, colors, speeds) for boss/grunt minions, loaded into the sandbox selector.
- `maps.json`: Arena template descriptors.
- `statusEffects.json`: Active modifiers for health boosts, weapon damage boosts, and cooling rate bonuses.
- `weapons.json`: Rarity ratings and base parameters for Gatling guns, cannons, and vortex launchers.

### `/public/assets/`
Directory containing static GLB 3D models.
- `models/`: Stores standard mech models (e.g., `warriorTest.glb`, `mech_frame.glb` preloads).
- `tiles/`: Stores modular tile sets for procedural arena generation (e.g., `enviroTest.glb`, `bog_enviro.glb`).

### `/src/assets/`
React-specific local compilation asset folder.
- `images/`: Thematic illustrations and UI backdrops (including `menu_background_1780583746459.png` for menus).
