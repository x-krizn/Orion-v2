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
} from "@babylonjs/core";
import { GameSettings, PerformanceStats, ModelAssetInfo, PlayerInput } from "../types";
import { InputController } from "../input/InputController";
import { IsometricCamera } from "../camera/IsometricCamera";
import { EnvironmentManager } from "../rendering/EnvironmentManager";
import { CharacterController } from "../movement/CharacterController";
import { FXSystem } from "../fx/FXSystem";

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
  
  // Placement coordination states
  public selectedLibraryItemId: string | null = null;
  public placementModeActive: boolean = false;

  // Callbacks
  private onAssetListChanged: (assets: ModelAssetInfo[]) => void = () => {};
  public onLibraryItemsChanged: (items: { id: string; name: string }[]) => void = () => {};

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
          const placedNode = this.environment.instantiateLibraryItem(this.selectedLibraryItemId, pickResult.pickedPoint);
          if (placedNode) {
            // Deploy cyber flare effect
            this.fx.spawnExplosion(pickResult.pickedPoint, 6, 0.45);
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
   * Alternating guns projectiles deployment
   */
  private fireActiveArm(): void {
    const muzzlePos = this.player.getMuzzlePointAndAlt();
    const targetPoint = this.get3DWorldPointerPos();

    // Spawn linear direction from weapon to ray coordinates
    const heading = targetPoint.subtract(muzzlePos);
    heading.y = 0; // Fixed 2D plane height logic
    heading.normalize();

    this.cameraSystem.triggerShake(0.18);
    this.fx.spawnLaserShell(muzzlePos, heading, 40, () => {
      // Collision hit impact trigger
      const hitPoint = muzzlePos.add(heading.scale(15)); // Mock impact point
      this.fx.spawnHitImpact(hitPoint);
      
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
   * Laser rail beam ability
   */
  private fireHeavyFusionGatling(): void {
    const muzzlePos = this.player.getMuzzlePointAndAlt();
    const targetPoint = this.get3DWorldPointerPos();

    this.cameraSystem.triggerShake(1.2);
    this.fx.spawnHeavyBeam(muzzlePos, targetPoint);
    this.fx.spawnExplosion(targetPoint, 10, 0.8);
    this.player.triggerImpactFlash();
  }

  /**
   * Heavy shell mortars landing on random bounds near pointer circles
   */
  private triggerTaticalOrbitalBombardment(): void {
    const centerPoint = this.get3DWorldPointerPos();
    this.cameraSystem.triggerShake(2.0);

    // Call falling shells sequentially with timeouts
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const offset = new Vector3(
          (Math.random() - 0.5) * 5,
          0,
          (Math.random() - 0.5) * 5
        );
        const blastLocation = centerPoint.add(offset);
        this.fx.spawnExplosion(blastLocation, 14, 1.2);
      }, i * 200);
    }
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
   * Automatically preload user uploaded custom models if they exist in the workspace assets paths
   */
  public async preloadDefaultAssets(): Promise<void> {
    // 1. Try preloading the player character model
    const warriorPath = "./assets/models/mechs/warriorTest.glb";
    try {
      console.log("[Preloader]: Attempting to load user custom mech warriorTest.glb...");
      const results = await SceneLoader.ImportMeshAsync("", "", warriorPath, this.scene, undefined, ".glb");
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
      console.log("[Preloader]: Successfully preloaded custom mech warriorTest.glb!");
    } catch (e) {
      console.log("[Preloader]: Custom warriorTest.glb is not present on workspace or could not load, using procedural model.", e);
    }

    // 2. Try preloading the arena environment model
    const enviroPath = "./assets/tiles/enviroTest.glb";
    try {
      console.log("[Preloader]: Attempting to load user custom environment enviroTest.glb...");
      await this.environment.preloadEnviroModelFromURL(enviroPath);
      console.log("[Preloader]: Successfully preloaded custom environment enviroTest.glb!");
    } catch (e) {
      console.log("[Preloader]: Custom enviroTest.glb is not present on workspace or could not load, using default grid layout.", e);
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
    this.player.update(deltaTimeSeconds, playerInputState, this.fx);
    this.cameraSystem.setTarget(this.player.getPosition());
    this.cameraSystem.update(deltaTimeSeconds);

    // Update Particles
    this.fx.update(deltaTimeSeconds);

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
    this.fx.clearAll();
    this.environment.clearCustomAssets();
    this.glowLayer?.dispose();
    this.defaultPipeline?.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
