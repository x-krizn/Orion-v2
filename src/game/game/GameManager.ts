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
import { GameSettings, PerformanceStats, ModelAssetInfo, PlayerInput } from "../types";
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
  }[] = [];

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
    onLibraryItemsChanged?: (items: { id: string; name: string }[]) => void
  ) {
    this.canvas = canvas;
    this.onAssetListChanged = onAssetListChanged;
    if (onLibraryItemsChanged) {
      this.onLibraryItemsChanged = onLibraryItemsChanged;
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
      this.fireActiveArm();
    };

    this.input.onAbilityPressed = (index) => {
      if (index === 1) {
        // Laser sweep beam
        this.fireHeavyFusionGatling();
      } else if (index === 2) {
        // Perimeter tactical explosions
        this.triggerTaticalOrbitalBombardment();
      } else {
        // Short pulse emitter
        this.player.triggerImpactFlash();
        this.cameraSystem.triggerShake(0.4);
        this.fx.spawnExplosion(this.player.getPosition(), 6, 0.8);
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
    const weapon = this.getEquippedWeapon() || {
      id: "pulse_cannon",
      name: "Pulse Cannon",
      damage: 25,
      cooldown: 0.25,
      projectile: "pulse_projectile",
      rarity: "standard"
    };

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

    // Update Player & follow camera
    this.player.update(deltaTimeSeconds, playerInputState, this.fx, this.environment.getObstacles());
    this.cameraSystem.setTarget(this.player.getPosition());
    this.cameraSystem.update(deltaTimeSeconds);

    // Update Particles
    this.fx.update(deltaTimeSeconds);

    // Dynamic hover motion & orientation of spawned enemies facing player
    this.spawnedEnemies.forEach(enemy => {
      // Interpolate angles towards player heading
      const dir = this.player.getPosition().subtract(enemy.node.position);
      dir.y = 0;
      if (dir.length() > 0.1) {
        dir.normalize();
        const targetRotY = Math.atan2(dir.x, dir.z);
        const diffY = targetRotY - enemy.node.rotation.y;
        const wrapped = Math.atan2(Math.sin(diffY), Math.cos(diffY));
        enemy.node.rotation.y += wrapped * Math.min(1.0, deltaTimeSeconds * 3.5);
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
