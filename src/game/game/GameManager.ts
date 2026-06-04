/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Engine,
  Scene,
  Vector3,
  Color3,
  GlowLayer,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  SceneLoader,
  StandardMaterial,
  MeshBuilder,
  TransformNode
} from "@babylonjs/core";
import { GameSettings, PerformanceStats, ModelAssetInfo, PlayerInput, GameplayAction } from "../types";
import { InputController } from "../input/InputController";
import { IsometricCamera } from "../camera/IsometricCamera";
import { EnvironmentManager } from "../rendering/EnvironmentManager";
import { CharacterController } from "../movement/CharacterController";
import { FXSystem } from "../fx/FXSystem";
import { DataManager, WeaponData, AbilityData, EnemyData, StatusEffectData, MapData } from "./DataManager";

export class GameManager {
  private engine!: Engine;
  private scene!: Scene;
  private canvas!: HTMLCanvasElement;
  
  // Settings instance
  private settings: GameSettings = {
    movement: {
      speed: 12.0,
      rotationSpeed: 0.15,
    },
    camera: {
      fov: 0.35, // low FOV (radians) to evoke modular 2.5D visual orthographic tracking
      distance: 36.0,
      minZoom: 15.0,
      maxZoom: 65.0,
      zoomSpeed: 0.08,
      followLerp: 0.08,
      pitch: 40 * (Math.PI / 180), // 40 degrees down pitch
      yaw: 45 * (Math.PI / 180),   // 45 degrees isometric yaw rotation
    },
    rendering: {
      shadows: true,
      postProcessing: {
        enabled: true,
        glowIntensity: 0.85,
        bloomWeight: 0.5,
        exposure: 1.1,
        tonemapping: ImageProcessingConfiguration.TONEMAPPING_ACES,
      },
      environment: {
        arenaSize: 50,
        gridSpacing: 2,
        theme: "magma",
      },
    },
  };

  // Systems
  public input!: InputController;
  public cameraSystem!: IsometricCamera;
  public environment!: EnvironmentManager;
  public player!: CharacterController;
  public fx!: FXSystem;

  // Post process references
  private glowLayer: GlowLayer | null = null;
  private defaultPipeline: DefaultRenderingPipeline | null = null;

  // Stats monitoring
  private lastFspUpdateTime = 0;
  private fpsDisplay = 0;
  private frameTimeDisplay = 0;
  private statsListeners: ((stats: PerformanceStats) => void)[] = [];

  // Drag and drop routing setting
  public dndMode: "character" | "environment" = "environment";
  private isDisposed = false;
  
  // Placement coordination states
  public selectedLibraryItemId: string | null = null;
  public placementModeActive: boolean = false;

  // Real-time loadouts & sandbox features
  public equippedWeaponId: string = "pulse_cannon";
  public spawnedEnemies: {
    node: TransformNode;
    data: EnemyData;
    health: number;
    maxHealth: number;
    lastAttackTime?: number;
  }[] = [];

  // Target Lock system structures
  public lockRange = 35.0; // Lock range stat (m)
  public lockSpeed = 2.0;  // Lock speed stat (secs to lock = 1 / lockSpeed)
  public lockCount = 1;    // Lock count stat (max targets)
  public lockRetention = true; // Lock retention metastat (locks do not break on turning away or distance)
  public persistentAimDirection: Vector3 | null = null;
  public lockedTargets: {
    enemy: {
      node: TransformNode;
      data: EnemyData;
      health: number;
      maxHealth: number;
    };
    progress: number; // 0 to 1
  }[] = [];
  public autoLockEnabled = true;

  // Callbacks
  private onAssetListChanged: (assets: ModelAssetInfo[]) => void = () => {};
  public onLibraryItemsChanged: (items: { id: string; name: string }[]) => void = () => {};

  public onWeaponsLoaded?: (weapons: WeaponData[]) => void;
  public onAbilitiesLoaded?: (abilities: AbilityData[]) => void;
  public onStatusEffectsLoaded?: (effects: StatusEffectData[]) => void;
  public onMapsLoaded?: (maps: MapData[]) => void;
  public onEnemiesLoaded?: (enemies: EnemyData[]) => void;

  constructor(
    canvas: HTMLCanvasElement, 
    onAssetListChanged: (assets: ModelAssetInfo[]) => void,
    onLibraryItemsChanged?: (items: { id: string; name: string }[]) => void,
    arenaSizeOverride?: number
  ) {
    this.canvas = canvas;
    this.onAssetListChanged = onAssetListChanged;
    if (onLibraryItemsChanged) {
      this.onLibraryItemsChanged = onLibraryItemsChanged;
    }

    if (arenaSizeOverride !== undefined) {
      this.settings.rendering.environment.arenaSize = arenaSizeOverride;
    }
    
    this.initEngine();
    this.initScene();
    this.initSystems();
    this.initPostProcessing();
    this.registerDragAndDrop();
    this.preloadDefaultAssets();
    this.startLoop();

    // Trigger data loading asynchronously at startup
    DataManager.getInstance().loadAllData().then(() => {
      this.onDataLoaded();
    });
  }

  private initEngine(): void {
    // Force Antialiasing & Stencil buffers for glossy rendering
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
    }, true);

    // Watch resize
    const resizeObserver = new ResizeObserver(() => {
      this.engine.resize();
    });
    resizeObserver.observe(this.canvas);
  }

  private initScene(): void {
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color3(0.01, 0.015, 0.025).toColor4(1.0);
  }

  private initSystems(): void {
    // 1. Inputs
    this.input = new InputController();

    // 2. FX System
    this.fx = new FXSystem(this.scene);

    // 3. Environment (Construct beautiful grid layout and buildings)
    this.environment = new EnvironmentManager(
      this.scene,
      this.settings.rendering.environment,
      (assets) => this.onAssetListChanged(assets)
    );
    this.environment.onLibraryItemsChanged = (items) => this.onLibraryItemsChanged(items);

    // 4. Character
    this.player = new CharacterController(
      this.scene,
      this.settings.movement,
      this.settings.rendering.environment.arenaSize
    );
    this.player.onThemeColorDetected = (color) => {
      this.fx.setThemeColors(color);
    };

    // Feed player shadow triggers
    const shadowGenerator = this.environment.getShadowGenerator();
    if (shadowGenerator) {
      this.player.setupShadowCasting(shadowGenerator);
    }

    // Set initial player theme color matching environmental settings
    const initialTheme = this.settings.rendering.environment.theme;
    let initialColor = new Color3(0, 0.94, 1.0);
    if (initialTheme === "magma") initialColor = new Color3(1.0, 0.25, 0.0);
    if (initialTheme === "matrix") initialColor = new Color3(0.0, 1.0, 0.25);
    if (initialTheme === "wasteland") initialColor = new Color3(0.85, 0.55, 0.2);
    this.player.setThemeColor(initialColor);

    // 5. Camera
    this.cameraSystem = new IsometricCamera(
      this.scene,
      this.canvas,
      this.player.getPosition(),
      this.settings.camera
    );

    // Provide camera system's current live yaw angle to input controller
    this.input.setCameraYawProvider(() => {
      return this.settings.camera.yaw;
    });

    // Bind Weapons/Dash events
    this.input.onDashPressed = () => {
      const state = this.input.getInputState();
      const didDash = this.player.executeDash(state.moveDirection);
      if (didDash) {
        this.cameraSystem.triggerShake(0.85);
        this.fx.spawnExplosion(this.player.getPosition().add(new Vector3(0, 0.25, 0)), 8, 0.4);
      }
    };

    this.input.onFirePressed = () => {
      if (this.placementModeActive && this.selectedLibraryItemId) {
        // Placement click handles spawning inside onPointerDown
        return;
      }
      this.triggerR1_Primary();
    };

    this.input.onAbilityPressed = (index) => {
      if (index === 1) {
        // Q / 1: Off-hand Primary L1 action
        this.triggerL1_OffPrimary();
      } else if (index === 2) {
        // E / 2: Off-hand Secondary L2 action
        this.triggerL2_OffSecondary();
      } else {
        // F: Main-hand Secondary R2 action
        this.triggerR2_Secondary();
      }
    };

    // Bind pointer down events for interactive Sandbox Modular Level Designer
    this.scene.onPointerDown = (evt, pickResult) => {
      if (this.placementModeActive && this.selectedLibraryItemId) {
        if (pickResult.hit && pickResult.pickedPoint && pickResult.pickedMesh && pickResult.pickedMesh.name === "cyberGround") {
          if (this.selectedLibraryItemId.startsWith("enemy_")) {
            const enemyId = this.selectedLibraryItemId.replace("enemy_", "");
            this.spawnEnemyAt(enemyId, pickResult.pickedPoint);
          } else {
            const placedNode = this.environment.instantiateLibraryItem(this.selectedLibraryItemId, pickResult.pickedPoint);
            if (placedNode) {
              // Deploy cyber flare effect
              this.fx.spawnExplosion(pickResult.pickedPoint, 6, 0.45);
            }
          }
        }
      } else {
        // Project Orion Combat Touch Controls
        if (pickResult.hit && pickResult.pickedPoint) {
          let hitEnemy: any = null;
          if (pickResult.pickedMesh) {
            const mesh = pickResult.pickedMesh;
            // Trace the hierarchy (up to three levels) to locate any matching spawned enemy root node
            hitEnemy = this.spawnedEnemies.find(e => 
              e.node === mesh || 
              e.node === mesh.parent || 
              (mesh.parent && e.node === mesh.parent.parent)
            );
          }

          if (hitEnemy) {
            console.log(`[Target Lock]: Direct pointer-lock targeting acquired on ${hitEnemy.data.name}`);
            this.toggleTargetLock(hitEnemy);
          } else {
            // Screen clicks and touches calibrate the independent torso facing orientation direction
            const playerPos = this.player.getPosition();
            const dir = pickResult.pickedPoint.subtract(playerPos);
            dir.y = 0;
            if (dir.length() > 0.1) {
              dir.normalize();
              this.persistentAimDirection = dir;
              console.log(`[Aim Facing]: Persistent mech torso facing direction recalibrated: ${this.persistentAimDirection.toString()}`);
            }
          }
        }
      }
    };
  }

  private initPostProcessing(): void {
    const renderingEnabled = this.settings.rendering.postProcessing.enabled;

    // Glow Layer (Emissive materials Bloom enhancer)
    if (renderingEnabled) {
      this.glowLayer = new GlowLayer("emissiveGlow", this.scene, {
        mainTextureRatio: 0.5, // Optimize for mobile FPS
        blurKernelSize: 16,
      });
      this.glowLayer.intensity = this.settings.rendering.postProcessing.glowIntensity;

      // Default Rendering Pipeline mapping Bloom & ACES
      this.defaultPipeline = new DefaultRenderingPipeline(
        "cyberDefaultPipeline",
        true, // HDR rendering
        this.scene,
        [this.cameraSystem.getCameraInstance()]
      );

      this.defaultPipeline.bloomEnabled = true;
      this.defaultPipeline.bloomWeight = this.settings.rendering.postProcessing.bloomWeight;
      this.defaultPipeline.bloomKernel = 16;
      
      this.defaultPipeline.imageProcessingEnabled = true;
      this.defaultPipeline.imageProcessing.toneMappingEnabled = true;
      this.defaultPipeline.imageProcessing.toneMappingType = this.settings.rendering.postProcessing.tonemapping;
      this.defaultPipeline.imageProcessing.exposure = this.settings.rendering.postProcessing.exposure;
    }
  }

  /**
   * Translates 2D screen mouse position into 3D world rays resting on our floor plane
   */
  public get3DWorldPointerPos(): Vector3 {
    const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh.name === "cyberGround");
    if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
      return pickInfo.pickedPoint;
    }
    // Return point ahead of player if target not hit
    const forward = new Vector3(Math.sin(this.player.getRootNode().rotation.y), 0, Math.cos(this.player.getRootNode().rotation.y));
    return this.player.getPosition().add(forward.scale(5));
  }

  /**
   * Alternating guns projectiles deployment using dynamic data-driven weapon stats
   */
  private fireActiveArm(): void {
    if (this.player.isOverheated) {
      console.log("[Combat Warning]: System OVERHEATED! Cannot fire while coolant cycle completes.");
      return;
    }

    const weapon = this.getEquippedWeapon() || {
      id: "pulse_cannon",
      name: "Pulse Cannon",
      damage: 25,
      cooldown: 0.25,
      projectile: "pulse_projectile",
      rarity: "standard"
    };

    // Increments Heat stat
    this.player.increaseHeat(8);

    const muzzlePos = this.player.getMuzzlePointAndAlt();
    const targetPoint = this.get3DWorldPointerPos();

    // Spawn linear direction from weapon to ray coordinates
    const heading = targetPoint.subtract(muzzlePos);
    heading.y = 0; // Fixed 2D plane height logic
    heading.normalize();

    // Dynamic weapon shake based on rarity/power
    let shakeStrength = 0.18;
    if (weapon.rarity === "rare") shakeStrength = 0.3;
    if (weapon.rarity === "epic") shakeStrength = 0.5;
    if (weapon.rarity === "legendary") shakeStrength = 0.85;
    this.cameraSystem.triggerShake(shakeStrength);

    // Fetch active status effects on user
    const activeEffect = this.player.getActiveStatusEffect();

    this.fx.spawnLaserShell(muzzlePos, heading, 40, () => {
      // Collision hit impact trigger
      const hitPoint = muzzlePos.add(heading.scale(15)); // Mock impact point
      this.fx.spawnHitImpact(hitPoint);
      
      // Calculate active base damage and overlay status buffs
      let finalDamage = weapon.damage;
      if (activeEffect && activeEffect.modifiers && activeEffect.modifiers.damageMult !== undefined) {
        finalDamage *= activeEffect.modifiers.damageMult;
      }

      // Check bullet intersection hits against spawned enemies
      this.spawnedEnemies.forEach((enemy, index) => {
        const dist = Vector3.Distance(enemy.node.position, hitPoint);
        // Generous collision hitbox with scale influence
        if (dist < 3.2 * enemy.data.scale) {
          enemy.health -= finalDamage;
          this.fx.spawnExplosion(enemy.node.position, 4, 0.3);
          console.log(`[Combat]: Bullet Impact! Enemy: ${enemy.data.name}, Damage: ${finalDamage.toFixed(0)}, Health: ${enemy.health}/${enemy.maxHealth}`);

          this.handleSuccessfulHit(enemy);

          if (enemy.health <= 0) {
            this.fx.spawnExplosion(enemy.node.position, 16, 1.4);
            this.cameraSystem.triggerShake(1.0);
            enemy.node.dispose();
            this.spawnedEnemies.splice(index, 1);
          }
        }
      });

      // Random obstacles collision check
      const obstacles = this.environment.getObstacles();
      // Small chance to animate obstacles pulsing when hit
      obstacles.forEach(obs => {
        if (Vector3.Distance(obs.position, hitPoint) < 3) {
          this.fx.spawnExplosion(hitPoint, 4, 0.4);
        }
      });
    });
  }

  /**
   * Laser rail beam ability reading from abilities.json config
   */
  private fireHeavyFusionGatling(): void {
    if (this.player.isOverheated) {
      console.log("[Combat Warning]: System OVERHEATED! Cannot fire heavy weapons.");
      return;
    }

    // Accumulates secondary heat
    this.player.increaseHeat(18);

    const muzzlePos = this.player.getMuzzlePointAndAlt();
    const targetPoint = this.get3DWorldPointerPos();

    const config = DataManager.getInstance().getAbilityById("heavy_railbeam") || {
      damage: 150,
      range: 25,
      intensity: 1.2
    };

    const shakeFactor = 1.0 * (config.intensity || 1.2);
    this.cameraSystem.triggerShake(shakeFactor);
    this.fx.spawnHeavyBeam(muzzlePos, targetPoint);
    this.fx.spawnExplosion(targetPoint, 10, 0.8);
    this.player.triggerImpactFlash();

    // Beam weapon collision check with wide hit area
    const activeEffect = this.player.getActiveStatusEffect();
    let finalDamage = config.damage || 150;
    if (activeEffect && activeEffect.modifiers && activeEffect.modifiers.damageMult !== undefined) {
      finalDamage *= activeEffect.modifiers.damageMult;
    }

    this.spawnedEnemies.forEach((enemy, index) => {
      const dist = Vector3.Distance(enemy.node.position, targetPoint);
      if (dist < 5.0 * enemy.data.scale) {
        enemy.health -= finalDamage;
        this.fx.spawnExplosion(enemy.node.position, 6, 0.5);
        console.log(`[Combat]: Railbeam Burn! Enemy: ${enemy.data.name}, Damage: ${finalDamage.toFixed(0)}, Health: ${enemy.health}/${enemy.maxHealth}`);

        this.handleSuccessfulHit(enemy);

        if (enemy.health <= 0) {
          this.fx.spawnExplosion(enemy.node.position, 16, 1.4);
          this.cameraSystem.triggerShake(1.2);
          enemy.node.dispose();
          this.spawnedEnemies.splice(index, 1);
        }
      }
    });
  }

  /**
   * Heavy shell mortars landing on random bounds near pointer circles reading from abilities.json config
   */
  private triggerTaticalOrbitalBombardment(): void {
    const centerPoint = this.get3DWorldPointerPos();

    const config = DataManager.getInstance().getAbilityById("tactical_bombardment") || {
      damage: 200,
      strikeCount: 4,
      spread: 5,
      intensity: 1.5
    };

    const shakeFactor = 1.35 * (config.intensity || 1.5);
    this.cameraSystem.triggerShake(shakeFactor);

    const strikes = config.strikeCount || 4;
    const spread = config.spread || 5;
    const baseDamage = config.damage || 200;

    const activeEffect = this.player.getActiveStatusEffect();
    let finalDamage = baseDamage;
    if (activeEffect && activeEffect.modifiers && activeEffect.modifiers.damageMult !== undefined) {
      finalDamage *= activeEffect.modifiers.damageMult;
    }

    // Call falling shells sequentially with timeouts
    for (let i = 0; i < strikes; i++) {
      setTimeout(() => {
        const offset = new Vector3(
          (Math.random() - 0.5) * spread,
          0,
          (Math.random() - 0.5) * spread
        );
        const blastLocation = centerPoint.add(offset);
        this.fx.spawnExplosion(blastLocation, 14, 1.2);

        // Check if any enemy is caught in mortar explosion radius
        this.spawnedEnemies.forEach((enemy, index) => {
          const dist = Vector3.Distance(enemy.node.position, blastLocation);
          if (dist < 4.2 * enemy.data.scale) {
            enemy.health -= finalDamage;
            this.fx.spawnExplosion(enemy.node.position, 7, 0.6);
            console.log(`[Combat]: Mortar Impact! Enemy: ${enemy.data.name}, Damage: ${finalDamage.toFixed(0)}, Health: ${enemy.health}/${enemy.maxHealth}`);

            if (enemy.health <= 0) {
              this.fx.spawnExplosion(enemy.node.position, 16, 1.4);
              this.cameraSystem.triggerShake(1.5);
              enemy.node.dispose();
              this.spawnedEnemies.splice(index, 1);
            }
          }
        });
      }, i * 200);
    }
  }

  private onDataLoaded(): void {
    console.log("[GameManager]: Runtime configuration loaded. Applying dynamic stats...");
    const dataManager = DataManager.getInstance();
    
    // Find dash ability if present to update character physics
    const dash = dataManager.abilities.find(a => a.id.includes("dash") || a.id.includes("propulsion"));
    if (dash && this.player) {
      this.player.updateDashConfig(dash.cooldown, dash.speedMultiplier || 3.5);
    }

    // Expose weapons to HUD
    if (this.onWeaponsLoaded) {
      this.onWeaponsLoaded(dataManager.weapons);
    }
    // Expose abilities to HUD
    if (this.onAbilitiesLoaded) {
      this.onAbilitiesLoaded(dataManager.abilities);
    }
    // Expose status effects to HUD
    if (this.onStatusEffectsLoaded) {
      this.onStatusEffectsLoaded(dataManager.statusEffects);
    }
    // Expose maps to HUD
    if (this.onMapsLoaded) {
      this.onMapsLoaded(dataManager.maps);
    }
    // Expose enemies to HUD
    if (this.onEnemiesLoaded) {
      this.onEnemiesLoaded(dataManager.enemies);
    }

    // Combine standard Custom Asset list with our newly loaded spawnable enemies list for sandbox selection!
    const libraryItemsList = [
      ...dataManager.enemies.map(e => ({ id: `enemy_${e.id}`, name: `💀 Spawn: ${e.name}` })),
    ];
    this.onLibraryItemsChanged(libraryItemsList);
  }

  public spawnEnemyAt(enemyId: string, position: Vector3): void {
    const data = DataManager.getInstance().getEnemyById(enemyId);
    if (!data) return;

    // Build a beautiful 3D representation representing this enemy
    const enemyRoot = new TransformNode(`enemy_spawn_${data.id}_${Date.now()}`, this.scene);
    enemyRoot.position.copyFrom(position);
    enemyRoot.position.y = 0;

    // Frame/Chassis material and styling
    const frameMat = new StandardMaterial(`mat_enemy_${data.id}_${Date.now()}`, this.scene);
    frameMat.diffuseColor = new Color3(data.color.r, data.color.g, data.color.b);
    frameMat.emissiveColor = new Color3(data.color.r * 0.25, data.color.g * 0.25, data.color.b * 0.25);
    frameMat.specularColor = new Color3(0.5, 0.5, 0.5);

    // Body Cylinder
    const body = MeshBuilder.CreateCylinder(`enemyBody_${data.id}`, {
      diameterTop: 0.8 * data.scale,
      diameterBottom: 1.2 * data.scale,
      height: 1.6 * data.scale
    }, this.scene);
    body.position.y = (1.6 * data.scale) / 2;
    body.material = frameMat;
    body.parent = enemyRoot;

    // Glowing Eyes Indicator
    const eyeMat = new StandardMaterial(`enemyEyeMat_${data.id}`, this.scene);
    eyeMat.emissiveColor = new Color3(1.0, 0, 0);
    const eye = MeshBuilder.CreateBox(`enemyEye_${data.id}`, {
      width: 0.7 * data.scale,
      height: 0.15 * data.scale,
      depth: 0.2 * data.scale
    }, this.scene);
    eye.position.set(0, 1.2 * data.scale, 0.5 * data.scale);
    eye.material = eyeMat;
    eye.parent = enemyRoot;

    // Feed shadows if possible
    const shadowGenerator = this.environment.getShadowGenerator();
    if (shadowGenerator) {
      shadowGenerator.addShadowCaster(body);
    }

    // Register active list
    this.spawnedEnemies.push({
      node: enemyRoot,
      data: data,
      health: data.health,
      maxHealth: data.health
    });

    // Deploy spawn splash particle
    this.fx.spawnExplosion(position, 8, 0.6);
    this.player.triggerImpactFlash();
    console.log(`[GameManager]: Spawned enemy ${data.name} at coordinates ${position.toString()}`);
  }

  public triggerPlayerStatusEffect(effectId: string): void {
    const effect = DataManager.getInstance().getStatusEffectById(effectId);
    if (effect && this.player) {
      this.player.applyStatusEffect(effect);
      this.fx.spawnExplosion(this.player.getPosition(), 8, 0.8);
    }
  }

  public equipWeapon(weaponId: string): void {
    const data = DataManager.getInstance().getWeaponById(weaponId);
    if (data) {
      this.equippedWeaponId = weaponId;
      console.log(`[Combat]: Equipped weapon: ${data.name}`);
      this.player.triggerImpactFlash();
      this.fx.spawnExplosion(this.player.getPosition(), 6, 0.6);
    }
  }

  public getEquippedWeapon(): WeaponData | undefined {
    return DataManager.getInstance().getWeaponById(this.equippedWeaponId);
  }

  /**
   * Subscribe to rendering cycle statistics
   */
  public addPerformanceListener(listener: (stats: PerformanceStats) => void): void {
    this.statsListeners.push(listener);
  }

  /**
   * Propagate custom mech scale and rotation to active character controller
   */
  public setCustomChassisTransforms(scale: number, rotationDeg: number): void {
    if (this.player) {
      this.player.setCustomTransforms(scale, rotationDeg);
    }
  }

  /**
   * Propagate fine visual alignments for custom character models
   */
  public setCustomChassisAlignment(settings: any): void {
    if (this.player) {
      this.player.setCustomAlignment(settings);
    }
  }

  /**
   * Propagate custom props scale and rotation to environment manager
   */
  public setCustomPropsTransforms(scale: number, rotationDeg: number): void {
    if (this.environment) {
      this.environment.setCustomPropsTransforms(scale, rotationDeg);
    }
  }

  /**
   * Manual or dropped file trigger loader handler
   */
  public async handleInjectedFile(file: File): Promise<void> {
    if (file.name.endsWith(".glb") || file.name.endsWith(".gltf")) {
      const targetWorldPos = this.get3DWorldPointerPos();
      
      // If the uploaded file is warriorTest.glb or enviroTest.glb, upload it to the workspace server to persist it permanently
      if (file.name === "warriorTest.glb" || file.name === "enviroTest.glb") {
        this.uploadAssetToServer(file);
      }
      
      try {
        if (this.dndMode === "character") {
          // Wait for model parsing
          const results = await SceneLoader.ImportMeshAsync("", "", URL.createObjectURL(file), this.scene, undefined, ".glb");
          const modelRoot = results.meshes[0];
          
          this.player.attachCustomModel(modelRoot);
          
          const list: ModelAssetInfo = {
            id: `user_character_${Date.now()}`,
            name: file.name,
            type: "character",
            source: "file",
            meshCount: results.meshes.length,
          };
          this.onAssetListChanged([list]);
          console.log("Hot-swapped player mech model with custom file.");
        } else {
          // Add as modular building
          await this.environment.loadGLBFile(file, targetWorldPos, "environment");
          this.fx.spawnExplosion(targetWorldPos, 12, 0.7);
        }
      } catch (err) {
        console.error("Mesh injection error", err);
      }
    }
  }

  /**
   * Safe asynchronous upload of GLB custom assets to Express backend workspace so that they are permanent
   */
  private async uploadAssetToServer(file: File): Promise<void> {
    try {
      console.log(`[Asset Sync]: Syncing custom model "${file.name}" to workspace disk storage helper...`);
      const response = await fetch("/api/upload-asset", {
        method: "POST",
        headers: {
          "x-file-name": file.name,
          "content-type": "application/octet-stream"
        },
        body: file
      });
      if (response.ok) {
        console.log(`[Asset Sync]: Successfully saved and synchronized "${file.name}" on disk workspace! File path will be tracked by git.`);
      } else {
        const errText = await response.text();
        console.warn(`[Asset Sync]: Server refused tracking/saving for "${file.name}":`, errText);
      }
    } catch (e) {
      console.warn(`[Asset Sync]: Network error during upload to server for "${file.name}":`, e);
    }
  }

  /**
   * Setup Drag & Drop handlers to capture GLTF/GLB local structures directly
   */
  private registerDragAndDrop(): void {
    const urlParams = new URL(window.location.href).searchParams;
    const isEditMode = urlParams.get("mode") === "edit";
    if (!isEditMode) return;

    const dropZone = window;

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      
      if (!e.dataTransfer || e.dataTransfer.files.length === 0) return;

      const file = e.dataTransfer.files[0];
      await this.handleInjectedFile(file);
    });
  }

  /**
   * Helper to verify if a path actually has a valid GLB before loading it
   */
  private async verifyGLBPath(url: string): Promise<boolean> {
    if (this.isDisposed || (this.scene && this.scene.isDisposed)) return false;
    try {
      const response = await fetch(url);
      if (this.isDisposed || (this.scene && this.scene.isDisposed)) return false;
      if (!response.ok) return false;
      
      const contentType = response.headers.get("content-type") || "";
      if (contentType.toLowerCase().includes("text/html") || contentType.toLowerCase().includes("text/plain")) {
        return false;
      }
      
      const buf = await response.arrayBuffer();
      if (this.isDisposed || (this.scene && this.scene.isDisposed)) return false;
      if (buf.byteLength < 4) return false;
      
      const view = new DataView(buf);
      const magic = view.getUint32(0, true);
      const magicBig = view.getUint32(0, false);
      
      // GLB binary magic is 0x46546C67 (ASCII "glTF" in little-endian order) or 0x676C5446 in big-endian order
      return magic === 0x46546C67 || magicBig === 0x676C5446;
    } catch {
      return false;
    }
  }

  /**
   * Automatically preload user uploaded custom models if they exist in the workspace assets paths
   */
  public async preloadDefaultAssets(): Promise<void> {
    if (this.isDisposed || (this.scene && this.scene.isDisposed)) return;

    // 1. Try preloading the player character model
    const warriorPaths = [
      "./assets/models/mechs/warriorTest.glb",
      "/assets/models/mechs/warriorTest.glb",
      "https://raw.githubusercontent.com/x-krizn/Orion-v2/main/public/assets/models/mechs/warriorTest.glb"
    ];
    
    let loadedWarrior = false;
    for (const path of warriorPaths) {
      if (this.isDisposed || (this.scene && this.scene.isDisposed)) return;
      try {
        console.log(`[Preloader]: Verifying custom mech warriorTest.glb at ${path}...`);
        const isValid = await this.verifyGLBPath(path);
        if (this.isDisposed || (this.scene && this.scene.isDisposed)) return;
        if (!isValid) {
          console.log(`[Preloader]: Path ${path} does not contain a valid GLB asset. Skipping...`);
          continue;
        }

        console.log(`[Preloader]: Path verified! Attempting to load user custom mech warriorTest.glb via ${path}...`);
        const results = await SceneLoader.ImportMeshAsync("", "", path, this.scene, undefined, ".glb");
        if (this.isDisposed || (this.scene && this.scene.isDisposed)) return;
        const modelRoot = results.meshes[0];
        
        this.player.attachCustomModel(modelRoot);
        
        const list: ModelAssetInfo = {
          id: "preloaded_warrior",
          name: "warriorTest.glb",
          type: "character",
          source: "file",
          meshCount: results.meshes.length,
        };
        this.onAssetListChanged([list]);
        console.log(`[Preloader]: Successfully preloaded custom mech warriorTest.glb via ${path}!`);
        loadedWarrior = true;
        break; // Stop on first success
      } catch (e) {
        if (!this.isDisposed && this.scene && !this.scene.isDisposed) {
          console.warn(`[Preloader]: Path ${path} unsuccessful for warriorTest.glb:`, e);
        }
      }
    }
    if (!loadedWarrior && !this.isDisposed && this.scene && !this.scene.isDisposed) {
      console.log("[Preloader]: Custom warriorTest.glb is not present on workspace or could not load on any path, using procedural model.");
    }

    // 2. Try preloading the arena environment model
    const enviroPaths = [
      "./assets/tiles/enviroTest.glb",
      "/assets/tiles/enviroTest.glb",
      "https://raw.githubusercontent.com/x-krizn/Orion-v2/main/public/assets/tiles/enviroTest.glb"
    ];
    
    let loadedEnviro = false;
    for (const path of enviroPaths) {
      if (this.isDisposed || (this.scene && this.scene.isDisposed)) return;
      try {
        console.log(`[Preloader]: Verifying custom environment enviroTest.glb at ${path}...`);
        const isValid = await this.verifyGLBPath(path);
        if (this.isDisposed || (this.scene && this.scene.isDisposed)) return;
        if (!isValid) {
          console.log(`[Preloader]: Path ${path} does not contain a valid GLB asset. Skipping...`);
          continue;
        }

        console.log(`[Preloader]: Path verified! Attempting to load user custom environment enviroTest.glb via ${path}...`);
        await this.environment.preloadEnviroModelFromURL(path);
        if (this.isDisposed || (this.scene && this.scene.isDisposed)) return;
        console.log(`[Preloader]: Successfully preloaded custom environment enviroTest.glb via ${path}!`);
        loadedEnviro = true;
        break; // Stop on first success
      } catch (e) {
        if (!this.isDisposed && this.scene && !this.scene.isDisposed) {
          console.warn(`[Preloader]: Path ${path} unsuccessful for enviroTest.glb:`, e);
        }
      }
    }
    if (!loadedEnviro && !this.isDisposed && this.scene && !this.scene.isDisposed) {
      console.log("[Preloader]: Custom enviroTest.glb is not present on workspace or could not load on any path, using default grid layout.");
    }
  }

  private startLoop(): void {
    this.engine.runRenderLoop(() => {
      const deltaTimeSeconds = this.engine.getDeltaTime() / 1000.0;
      
      // Update subsystems
      this.update(deltaTimeSeconds);

      // Draw frames
      this.scene.render();
    });
  }

  private update(deltaTimeSeconds: number): void {
    const playerInputState = this.input.getInputState();

    // 1. Line of Sight & Range checks on locked targets
    const playerPos = this.player.getPosition();
    const obstacles = this.environment.getObstacles();

    this.lockedTargets = this.lockedTargets.filter(lt => {
      // Check if enemy still exists in spawnedEnemies
      const exists = this.spawnedEnemies.some(e => e === lt.enemy);
      if (!exists) return false;

      // Check distance is within lockRange (only if lock retention is disabled)
      const targetPos = lt.enemy.node.position;
      if (!this.lockRetention) {
        const dist = Vector3.Distance(playerPos, targetPos);
        if (dist > this.lockRange) {
          console.log(`[Target Lock]: Locked target ${lt.enemy.data.name} exceeded maximum range ${this.lockRange}m`);
          return false;
        }
      }

      // Check Line of Sight (LoS)
      let hasLoS = true;
      const rayDir = targetPos.subtract(playerPos);
      const totalDist = rayDir.length();
      rayDir.normalize();

      for (const obstacle of obstacles) {
        const obsCenter = obstacle.position;
        const v = obsCenter.subtract(playerPos);
        const projection = Vector3.Dot(v, rayDir);
        
        if (projection > 1.0 && projection < totalDist - 1.0) {
          const closestSegmentPt = playerPos.add(rayDir.scale(projection));
          const radialDist = Vector3.Distance(closestSegmentPt, obsCenter);
          const obstacleRadius = 2.2; // default cyber column radius is standard
          if (radialDist < obstacleRadius) {
            hasLoS = false;
            break;
          }
        }
      }

      if (!hasLoS) {
        console.log(`[Target Lock]: Target ${lt.enemy.data.name} lock broken due to loss of line-of-sight!`);
        return false;
      }

      // Charge up lock acquisition progress (Lock Speed stat!)
      if (lt.progress < 1.0) {
        lt.progress = Math.min(1.0, lt.progress + deltaTimeSeconds * this.lockSpeed);
      }

      return true;
    });

    // 2. Auto-lock closest valid target if we have 0 locks and autoLock is active
    if (this.autoLockEnabled && this.lockedTargets.length === 0 && this.spawnedEnemies.length > 0) {
      let closestEnemy: any = null;
      let closestDist = this.lockRange;

      this.spawnedEnemies.forEach(enemy => {
        let hasLoS = true;
        const targetPos = enemy.node.position;
        const rayDir = targetPos.subtract(playerPos);
        const dist = rayDir.length();
        rayDir.normalize();

        if (dist < closestDist) {
          for (const obstacle of obstacles) {
            const obsCenter = obstacle.position;
            const v = obsCenter.subtract(playerPos);
            const projection = Vector3.Dot(v, rayDir);
            if (projection > 1.0 && projection < dist - 1.0) {
              const closestSegmentPt = playerPos.add(rayDir.scale(projection));
              const radialDist = Vector3.Distance(closestSegmentPt, obsCenter);
              if (radialDist < 2.2) {
                hasLoS = false;
                break;
              }
            }
          }
          if (hasLoS) {
            closestDist = dist;
            closestEnemy = enemy;
          }
        }
      });

      if (closestEnemy) {
        this.lockedTargets.push({
          enemy: closestEnemy,
          progress: 1.0
        });
      }
    }

    // 3. Set independent aiming position based on locked target or cursor/persistent touch tap
    if (this.lockedTargets.length > 0 && this.lockedTargets[0].progress >= 1.0) {
      this.player.setAimPoint(this.lockedTargets[0].enemy.node.position);
    } else if (this.persistentAimDirection) {
      this.player.setAimPoint(this.player.getPosition().add(this.persistentAimDirection.scale(10.0)));
    } else {
      const pointerPt = this.get3DWorldPointerPos();
      this.player.setAimPoint(pointerPt);
    }

    // Update Player & follow camera
    this.player.update(deltaTimeSeconds, playerInputState, this.fx, this.environment.getObstacles());
    this.cameraSystem.setTarget(this.player.getPosition());
    this.cameraSystem.update(deltaTimeSeconds);

    // Update Particles
    this.fx.update(deltaTimeSeconds);

    // Dynamic hover motion & orientation of spawned enemies facing player + chasing AI
    this.spawnedEnemies.forEach(enemy => {
      // Interpolate angles towards player heading
      const dir = this.player.getPosition().subtract(enemy.node.position);
      dir.y = 0;
      const length = dir.length();
      
      if (length > 0.1) {
        dir.normalize();
        const targetRotY = Math.atan2(dir.x, dir.z);
        const diffY = targetRotY - enemy.node.rotation.y;
        const wrapped = Math.atan2(Math.sin(diffY), Math.cos(diffY));
        enemy.node.rotation.y += wrapped * Math.min(1.0, deltaTimeSeconds * 3.5);
      }
      
      // Melee and Chasing AI
      if (length > 2.8) {
        // Chase player
        enemy.node.position.addInPlace(dir.scale(deltaTimeSeconds * 3.0));
      } else {
        // Melee attack player
        const now = Date.now();
        if (!enemy.lastAttackTime || now - enemy.lastAttackTime > 1800) {
          enemy.lastAttackTime = now;
          this.player.takeDamage(45);
          this.cameraSystem.triggerShake(0.6);
          this.fx.spawnExplosion(playerPos.add(new Vector3(0, 1.0, 0)), 4, 0.35);
        }
      }
      
      // Floating bounce animation loop
      const hoverCycle = (performance.now() / 1000.0) * 3.0 + enemy.node.position.x * 2.0;
      const yOffset = Math.sin(hoverCycle) * 0.12 * enemy.data.scale;
      const children = enemy.node.getChildMeshes();
      children.forEach(mesh => {
        if (mesh.name.includes("Body")) {
          mesh.position.y = ((1.6 * enemy.data.scale) / 2) + yOffset;
        } else if (mesh.name.includes("Eye")) {
          mesh.position.y = (1.2 * enemy.data.scale) + yOffset;
        }
      });
    });

    // Reset instant triggers
    this.input.clearTriggers();

    // Broadcast frame rate metrics at 500ms bounds intervals
    const now = performance.now();
    if (now - this.lastFspUpdateTime > 500) {
      this.fpsDisplay = Math.round(this.engine.getFps());
      this.frameTimeDisplay = parseFloat((deltaTimeSeconds * 1000.0).toFixed(1));
      
      const statPkg: PerformanceStats = {
        fps: this.fpsDisplay,
        frameTime: this.frameTimeDisplay,
        drawCalls: (this.scene.getEngine() as any)._drawCalls?.current ?? 
                   (this.scene.getEngine() as any).drawCalls ?? 
                   (this.scene.getActiveMeshes?.()?.length ?? 142),
        meshCount: this.scene.meshes.length,
        activeParticles: this.fx.getActiveCount(),
        verticesCount: this.scene.getTotalVertices(),
      };

      this.statsListeners.forEach(listener => listener(statPkg));
      this.lastFspUpdateTime = now;
    }
  }

  /**
   * Handle Live visual adjustment panels changes
   */
  public updateRenderingSettings(key: keyof GameSettings["rendering"]["postProcessing"], value: any): void {
    const postConfig = this.settings.rendering.postProcessing;
    if (key in postConfig) {
      (postConfig as any)[key] = value;
    }

    if (key === "enabled") {
      this.glowLayer?.dispose();
      this.defaultPipeline?.dispose();
      this.glowLayer = null;
      this.defaultPipeline = null;
      this.initPostProcessing();
    } else {
      if (this.glowLayer && key === "glowIntensity") {
        this.glowLayer.intensity = value;
      }
      if (this.defaultPipeline) {
        if (key === "bloomWeight") {
          this.defaultPipeline.bloomWeight = value;
        }
        if (key === "exposure") {
          this.defaultPipeline.imageProcessing.exposure = value;
        }
      }
    }
  }

  public updateCameraConfig(key: keyof GameSettings["camera"], value: number): void {
    this.settings.camera[key] = value;
    this.cameraSystem.updateConfig({ [key]: value });
  }

  public changeTheme(theme: "cyber" | "magma" | "wasteland" | "matrix"): void {
    this.environment.changeTheme(theme);
    
    // Convert primary glows matching themes
    let primaryColor = new Color3(0, 0.94, 1.0);
    if (theme === "magma") primaryColor = new Color3(1.0, 0.25, 0.0);
    if (theme === "matrix") primaryColor = new Color3(0.0, 1.0, 0.25);
    if (theme === "wasteland") primaryColor = new Color3(0.85, 0.55, 0.2);

    this.fx.setThemeColors(primaryColor);
    this.player.setThemeColor(primaryColor);
  }

  public toggleTargetLock(enemy: any): void {
    const activeLockIdx = this.lockedTargets.findIndex(lt => lt.enemy === enemy);
    if (activeLockIdx >= 0) {
      this.lockedTargets.splice(activeLockIdx, 1);
      console.log(`[Target Lock]: Broke lock on enemy ${enemy.data.name}`);
      return;
    }
    
    // Check lock distance
    const dist = Vector3.Distance(this.player.getPosition(), enemy.node.position);
    if (dist > this.lockRange) {
      console.log(`[Target Lock]: Cannot lock ${enemy.data.name}, out of range (${dist.toFixed(1)}m > ${this.lockRange}m)`);
      return;
    }
    
    // Respect Lock Count stat
    if (this.lockedTargets.length >= this.lockCount) {
      this.lockedTargets.shift();
    }
    
    this.lockedTargets.push({
      enemy: enemy,
      progress: 0.0 // starts acquiring at lockSpeed rate
    });
    console.log(`[Target Lock]: Acquiring lock on enemy ${enemy.data.name}`);
  }

  public handleSuccessfulHit(enemy: any): void {
    if (this.lockedTargets.length === 0) {
      this.toggleTargetLock(enemy);
    }
  }

  // ===================================================================
  // PROJECT ORION COMBAT ENGINE & INPUT COUPLING METHODS
  // ===================================================================

  private damageEnemy(enemy: any, amount: number): void {
    enemy.health -= amount;
    this.fx.spawnExplosion(enemy.node.position, 4, 0.35);
    console.log(`[Combat Damage]: Dealt ${amount} damage to ${enemy.data.name}. HP: ${enemy.health}/${enemy.maxHealth}`);
    this.handleSuccessfulHit(enemy);
    
    if (enemy.health <= 0) {
      this.fx.spawnExplosion(enemy.node.position, 16, 1.4);
      this.cameraSystem.triggerShake(1.0);
      enemy.node.dispose();
      const idx = this.spawnedEnemies.indexOf(enemy);
      if (idx >= 0) {
        this.spawnedEnemies.splice(idx, 1);
      }
    }
  }

  public triggerR1_Primary(): void {
    if (this.player.isOverheated) {
      console.log("[Combat Warning]: Cannons locked due to overheat scan.");
      return;
    }
    const isPowerstance = this.player.stance === "powerstance";
    
    if (!isPowerstance) {
      // Standard R1: Quick rifle burst bullet (cancelable)
      const action: GameplayAction = {
        id: "standard_r1",
        name: "PULSE MULTI-FIRE",
        duration: 0.15,
        elapsed: 0,
        cancelable: true,
        type: "skill",
        onComplete: () => {
          this.fireActiveArm();
        }
      };
      this.player.triggerAction(action);
    } else {
      // Powerstance R1: Powerstance Dual Blade Slash Arc sweep
      const action: GameplayAction = {
        id: "powerstance_r1",
        name: "DUAL BLADE SLASH",
        duration: 0.32,
        elapsed: 0,
        cancelable: true,
        type: "skill",
        onComplete: () => {
          this.player.increaseHeat(12);
          const playerPos = this.player.getPosition();
          this.fx.spawnExplosion(playerPos, 12, 0.9);
          this.cameraSystem.triggerShake(0.32);
          
          const forward = this.player.getRootNode().forward || new Vector3(0, 0, 1);
          const targets = [...this.spawnedEnemies];
          targets.forEach(e => {
            const toEnemy = e.node.position.subtract(playerPos);
            const dist = toEnemy.length();
            if (dist < 6.8) {
              toEnemy.normalize();
              const dot = Vector3.Dot(forward, toEnemy);
              if (dot > 0.32) { // 72 degree forward sweep cone
                this.damageEnemy(e, 145);
              }
            }
          });
        }
      };
      this.player.triggerAction(action);
    }
  }

  public triggerR2_Secondary(): void {
    if (this.player.isOverheated) return;
    const isPowerstance = this.player.stance === "powerstance";

    if (!isPowerstance) {
      // Standard R2: Charged Launcher Mortar Strike (cancelable)
      const action: GameplayAction = {
        id: "standard_r2",
        name: "MORTAR TARGETING",
        duration: 1.1,
        elapsed: 0,
        cancelable: true,
        type: "charge",
        onComplete: () => {
          this.player.increaseHeat(20);
          this.triggerTaticalOrbitalBombardment();
        }
      };
      this.player.triggerAction(action);
    } else {
      // Powerstance R2: Arcane Cross Wave
      const action: GameplayAction = {
        id: "powerstance_r2",
        name: "CROSS ENERGY WAVE",
        duration: 0.85,
        elapsed: 0,
        cancelable: true,
        type: "charge",
        onComplete: () => {
          this.player.increaseHeat(18);
          const playerPos = this.player.getPosition();
          const forward = this.player.getRootNode().forward || new Vector3(0, 0, 1);
          
          // Triple fiery cascading explosions traveling forward
          for (let i = 1; i <= 3; i++) {
            const impactPoint = playerPos.add(forward.scale(i * 4.6));
            setTimeout(() => {
              if (this.isDisposed) return;
              this.fx.spawnExplosion(impactPoint, 6, 0.8);
              this.cameraSystem.triggerShake(0.3);
              const targets = [...this.spawnedEnemies];
              targets.forEach(e => {
                if (Vector3.Distance(e.node.position, impactPoint) < 4.2) {
                  this.damageEnemy(e, 190);
                }
              });
            }, i * 140);
          }
        }
      };
      this.player.triggerAction(action);
    }
  }

  public triggerL1_OffPrimary(): void {
    const isPowerstance = this.player.stance === "powerstance";

    if (!isPowerstance) {
      // Standard L1: Aegis Shield Barrier Block (2.2s channel)
      const cost = 15;
      if (this.player.en < cost) {
        console.log("[Combat Block]: Deficient EN energy!");
        return;
      }
      this.player.en -= cost;
      
      const action: GameplayAction = {
        id: "aegis_block",
        name: "AEGIS SHIELD BARRIER",
        duration: 2.2,
        elapsed: 0,
        cancelable: true,
        type: "channel",
        onComplete: () => {
          console.log("[Shield Collapse]: Barrier down.");
        }
      };
      this.player.triggerAction(action);
    } else {
      // Powerstance L1: Deflection Shield Parry
      const action: GameplayAction = {
        id: "parry_action",
        name: "DEFLECTION DEFLECT PARRY",
        duration: 0.45,
        elapsed: 0,
        cancelable: true,
        type: "skill",
        onComplete: () => {
          console.log("[Parry Expire]: Deflection frames expired.");
        }
      };
      this.player.triggerAction(action);
    }
  }

  public triggerL2_OffSecondary(): void {
    if (this.player.isOverheated) return;
    const isPowerstance = this.player.stance === "powerstance";

    if (!isPowerstance) {
      // Standard L2: Railbeam Sweep charging
      const action: GameplayAction = {
        id: "standard_l2",
        name: "FUSION RAILBEAM CHARGE",
        duration: 1.5,
        elapsed: 0,
        cancelable: true,
        type: "channel",
        onComplete: () => {
          this.player.increaseHeat(22);
          this.fireHeavyFusionGatling();
        }
      };
      this.player.triggerAction(action);
    } else {
      // Powerstance L2: Arcane Cross Vortex (Channel spinning dual blade blade vortex)
      const action: GameplayAction = {
        id: "powerstance_l2",
        name: "ARCANE BLADE VORTEX",
        duration: 1.8,
        elapsed: 0,
        cancelable: true,
        type: "channel",
        onComplete: () => {
          this.player.increaseHeat(24);
          const pos = this.player.getPosition();
          // Burst 6 surrounding shockwave nodes
          for (let j = 0; j < 6; j++) {
            const angle = (j / 6) * Math.PI * 2;
            const auraPt = pos.add(new Vector3(Math.cos(angle) * 4.8, 0, Math.sin(angle) * 4.8));
            this.fx.spawnExplosion(auraPt, 5, 0.6);
          }
          this.cameraSystem.triggerShake(0.6);
          const targets = [...this.spawnedEnemies];
          targets.forEach(e => {
            if (Vector3.Distance(e.node.position, pos) < 7.2) {
              this.damageEnemy(e, 275);
            }
          });
        }
      };
      this.player.triggerAction(action);
    }
  }

  public triggerButtonDash(): void {
    const cost = 25;
    if (this.player.en < cost) {
      console.log("[Dash Cancel]: Low energy!");
      return;
    }
    
    // Check running action cancelable
    if (this.player.currentAction) {
      if (this.player.currentAction.cancelable) {
        this.player.cancelCurrentAction();
      } else {
        console.log("[Dash Cancel]: Cannot interrupt committed stance swap!");
        return;
      }
    }
    
    this.player.en -= cost;
    this.input.triggerDash();
  }

  public triggerStanceSwap(): void {
    if (this.player.isOverheated) {
      console.log("[Combat Warning]: System overheated! Cannot toggle slots.");
      return;
    }
    const currentStance = this.player.stance;
    const nextStance = currentStance === "standard" ? "powerstance" : "standard";

    const action: GameplayAction = {
      id: "stance_swap",
      name: `CALIBRATING socket ${nextStance.toUpperCase()}`,
      duration: 1.25,
      elapsed: 0,
      cancelable: false, // animation commitment!
      type: "stance_change",
      onComplete: () => {
        this.player.stance = nextStance;
        if (nextStance === "powerstance") {
          // Fire blade orange
          const magma = new Color3(1.0, 0.42, 0.0);
          this.player.setThemeColor(magma);
          this.fx.setThemeColors(magma);
        } else {
          // Classic cyber cyan
          const cyan = new Color3(0.0, 0.85, 1.0);
          this.player.setThemeColor(cyan);
          this.fx.setThemeColors(cyan);
        }
        this.fx.spawnExplosion(this.player.getPosition(), 10, 1.2);
        this.cameraSystem.triggerShake(0.55);
        console.log(`[Stance Shift]: Re-aligned sockets to slot ${nextStance.toUpperCase()}`);
      }
    };
    this.player.triggerAction(action);
  }

  public triggerActionCancel(): void {
    if (this.player.currentAction) {
      if (this.player.currentAction.cancelable) {
        this.player.cancelCurrentAction();
        this.fx.spawnHitImpact(this.player.getPosition().add(new Vector3(0, 1.2, 0)));
      } else {
        console.log("[Action Intercept]: Cannot cancel committed transition!");
      }
    } else {
      // Clear target locks if no action is running
      this.lockedTargets = [];
      console.log("[Target Lock]: Manually cleared all locks.");
    }
  }

  public triggerContextAction(): void {
    const cost = 20;
    if (this.player.en < cost) {
      console.log("[Combat Action]: Low energy resist!");
      return;
    }

    const action: GameplayAction = {
      id: "core_burst",
      name: "CORE SHOCKWAVE",
      duration: 0.6,
      elapsed: 0,
      cancelable: true,
      type: "activation",
      onComplete: () => {
        this.player.en -= cost;
        this.player.triggerImpactFlash();
        this.cameraSystem.triggerShake(0.6);
        this.fx.spawnExplosion(this.player.getPosition(), 10, 1.45);
        
        const playerPos = this.player.getPosition();
        const targets = [...this.spawnedEnemies];
        targets.forEach(e => {
          const dist = Vector3.Distance(playerPos, e.node.position);
          if (dist < 8.2) {
            const dir = e.node.position.subtract(playerPos);
            dir.y = 0;
            dir.normalize();
            e.node.position.addInPlace(dir.scale(3.5)); // knockback displacement
            this.damageEnemy(e, 120);
          }
        });
      }
    };
    this.player.triggerAction(action);
  }

  /**
   * Clean up assets
   */
  public dispose(): void {
    this.isDisposed = true;
    this.fx.clearAll();
    this.environment.clearCustomAssets();
    this.glowLayer?.dispose();
    this.defaultPipeline?.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
