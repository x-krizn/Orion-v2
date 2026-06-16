/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3, Color3, Scene, HemisphericLight, DirectionalLight, Mesh, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import { WorldNode, WorldNodeId, NodeAmbienceSettings } from "./WorldNodeTypes";

// Scratch structures to optimize GC / avoid per-frame allocations
const scratchDiff = new Vector3();
const scratchPlayerPos = new Vector3();

export class WorldNodeSystem {
  private nodes: WorldNode[] = [];
  private activeNodeId: WorldNodeId | null = null;
  private prevActiveNodeId: WorldNodeId | null = null;
  
  // Transition styling variables (lerped over time)
  private currentRawFogColor: Color3 = new Color3(0.01, 0.015, 0.025);
  private currentFogDensity: number = 0.005;
  private currentLightColor: Color3 = new Color3(0.9, 0.95, 1.0);
  private currentLightIntensity: number = 1.0;
  
  // Visual transition properties
  private lerpSpeed: number = 2.0; // speed of ambient transitions
  
  // Throttle timer for computational safety (mobile-friendly check spacing)
  private checkInterval: number = 0.1; // 100ms
  private timeSinceLastCheck: number = 0;

  // Particle Ambience Pool
  private activeAirParticles: Mesh[] = [];
  private particleMat!: StandardMaterial;
  private currentParticleType: "embers" | "toxic_spits" | "spores" | "fog" | "none" = "none";
  private rootParticleNode: any = null;

  constructor() {
    this.initNodes();
  }

  /**
   * Defines the static locations, boundaries, and individual atmospheres for the 7 Bog sector nodes
   */
  private initNodes(): void {
    this.nodes = [
      {
        id: WorldNodeId.WAKE_SITE,
        name: "Syncing Wake Site",
        description: "An isolated neural calibration platform shrouded in soft mists.",
        center: new Vector3(0, 0, 0),
        radius: 6.0,
        ambience: {
          fogColor: new Color3(0.04, 0.06, 0.1),
          fogDensity: 0.018,
          lightColor: new Color3(0.6, 0.75, 0.9),
          lightIntensity: 0.8,
          particleType: "none",
          audioCueId: "ambience_calm"
        },
        preloadModels: ["models/enemies/scout.glb"]
      },
      {
        id: WorldNodeId.ORC_SKIRMISH,
        name: "Rust-Mud Outpost",
        description: "Iron scaffolds and spilled scrap metal. Scene of aggressive ambush.",
        center: new Vector3(0, 0, 8.0),
        radius: 8.0,
        ambience: {
          fogColor: new Color3(0.12, 0.09, 0.06),
          fogDensity: 0.025,
          lightColor: new Color3(0.85, 0.7, 0.5),
          lightIntensity: 0.95,
          particleType: "embers",
          audioCueId: "ambience_battle"
        },
        preloadModels: ["models/enemies/orc_raider.glb"]
      },
      {
        id: WorldNodeId.POE_BEACON,
        name: "Poe's Holo-Beacon",
        description: "A flicker of bright tactical light cutting through the marshland haze.",
        center: new Vector3(8.0, 0, 8.0),
        radius: 6.0,
        ambience: {
          fogColor: new Color3(0.03, 0.08, 0.12),
          fogDensity: 0.015,
          lightColor: new Color3(0.3, 0.8, 1.0),
          lightIntensity: 1.1,
          particleType: "spores",
          audioCueId: "ambience_mysterious"
        }
      },
      {
        id: WorldNodeId.BOG_CROSSING,
        name: "Bog Hound Crossing",
        description: "Sinking tracks and thick brush of hungry marsh predators.",
        center: new Vector3(3.0, 0, -2.0),
        radius: 9.0,
        ambience: {
          fogColor: new Color3(0.06, 0.08, 0.05),
          fogDensity: 0.035,
          lightColor: new Color3(0.65, 0.7, 0.55),
          lightIntensity: 0.75,
          particleType: "fog",
          audioCueId: "ambience_danger"
        },
        preloadModels: ["models/enemies/bog_hound.glb"]
      },
      {
        id: WorldNodeId.BEDIVERE_REST,
        name: "Bedivere's Rest campfire",
        description: "A roaring thermal furnace. Gentle safety zone with coolant replenishment.",
        center: new Vector3(-8.0, 0, -8.0),
        radius: 6.5,
        ambience: {
          fogColor: new Color3(0.15, 0.05, 0.03),
          fogDensity: 0.012,
          lightColor: new Color3(1.0, 0.5, 0.2),
          lightIntensity: 1.4,
          particleType: "embers",
          audioCueId: "ambience_safe"
        }
      },
      {
        id: WorldNodeId.WURM_SIGNS,
        name: "Toxic Tunnel Lair",
        description: "Slinking slime-covered cracks. Acidity spikes in local monitors.",
        center: new Vector3(0, 0, 12.0),
        radius: 7.0,
        ambience: {
          fogColor: new Color3(0.09, 0.12, 0.05),
          fogDensity: 0.045,
          lightColor: new Color3(0.55, 0.85, 0.4),
          lightIntensity: 0.65,
          particleType: "toxic_spits",
          audioCueId: "ambience_tension"
        },
        preloadModels: ["models/enemies/wurmling.glb"]
      },
      {
        id: WorldNodeId.WURM_ARENA,
        name: "Titan's Sinking Arena",
        description: "Gargantuan mud hollow shaking from seismic pressure.",
        center: new Vector3(0, 0, 18.0),
        radius: 13.0,
        ambience: {
          fogColor: new Color3(0.18, 0.05, 0.14),
          fogDensity: 0.03,
          lightColor: new Color3(0.9, 0.4, 0.82),
          lightIntensity: 1.2,
          particleType: "spores",
          audioCueId: "ambience_boss"
        },
        preloadModels: ["models/enemies/wurm_boss.glb"]
      }
    ];
  }

  /**
   * Initializes the lightweight ambient particle mesh pool
   */
  private initParticlePool(scene: Scene): void {
    if (this.rootParticleNode) return; // already loaded

    this.rootParticleNode = scene.getTransformNodeByName("WorldAmbientParticles") || scene;
    
    this.particleMat = new StandardMaterial("worldParticleMat", scene);
    this.particleMat.disableLighting = true;
    this.particleMat.backFaceCulling = false;

    const numParticles = 25;
    for (let i = 0; i < numParticles; i++) {
      // Create tiny flat plane billboards or miniature spheres to reflect light
      const p = MeshBuilder.CreateBox(`ambient_particle_${i}`, { size: 0.18 }, scene);
      p.material = this.particleMat;
      p.checkCollisions = false;
      p.isPickable = false;
      
      // Randomize initial location around the camera
      p.position.set(
        (Math.random() - 0.5) * 20.0,
        Math.random() * 6.0,
        (Math.random() - 0.5) * 20.0
      );

      this.activeAirParticles.push(p);
    }
  }

  /**
   * Retrieves the current nodes list
   */
  public getNodes(): WorldNode[] {
    return this.nodes;
  }

  /**
   * Returns the node containing the player's coordinate, or null if in wilderness voids
   */
  public getActiveNode(): WorldNode | null {
    if (!this.activeNodeId) return null;
    return this.nodes.find(n => n.id === this.activeNodeId) || null;
  }

  /**
   * Triggers the continuous lerp updates for the scene fog/light and ambient wrap particles
   */
  public update(deltaTimeSeconds: number, gameManager: any): void {
    const player = gameManager.player;
    if (!player) return;

    const scene = gameManager.scene;
    if (!scene) return;

    // Load visual particles to scene
    this.initParticlePool(scene);

    // Dynamic player safety position check
    const playerPos = player.getPosition();
    scratchPlayerPos.copyFrom(playerPos);

    // Spatial check throttling (avoids heavy operations every single tick)
    this.timeSinceLastCheck += deltaTimeSeconds;
    if (this.timeSinceLastCheck >= this.checkInterval) {
      this.timeSinceLastCheck = 0;
      this.evaluateActiveNode(playerPos, gameManager);
    }

    // Step 2: Smoothly Interpolate Theme Ambience Params
    this.applyAmbienceInterpolation(deltaTimeSeconds, scene);

    // Step 3: Run Atmospheric Particles translation & warp loop near player
    this.updateAtmosphericParticles(deltaTimeSeconds, scratchPlayerPos);
  }

  /**
   * Determines active region containment, handling entry/exit trigger cascades securely
   */
  private evaluateActiveNode(playerPos: Vector3, gameManager: any): void {
    let detectedId: WorldNodeId | null = null;
    let closestDist: number = Infinity;

    // Find closest containing node
    for (const node of this.nodes) {
      playerPos.subtractToRef(node.center, scratchDiff);
      scratchDiff.y = 0;
      const distance = scratchDiff.length();
      
      if (distance <= node.radius && distance < closestDist) {
        detectedId = node.id;
        closestDist = distance;
      }
    }

    // Handle transition cascades if region boundary crossed
    if (detectedId !== this.activeNodeId) {
      const prevId = this.activeNodeId;
      this.activeNodeId = detectedId;

      if (prevId) {
        const prevNode = this.nodes.find(n => n.id === prevId);
        if (prevNode && prevNode.onExit) {
          prevNode.onExit(gameManager);
        }
        console.log(`[WorldNodeSystem]: Left world node: ${prevId}`);
      }

      if (detectedId) {
        const nextNode = this.nodes.find(n => n.id === detectedId);
        if (nextNode) {
          if (nextNode.onEntry) {
            nextNode.onEntry(gameManager);
          }
          this.currentParticleType = nextNode.ambience.particleType;
          console.log(`[WorldNodeSystem]: Entered world node: ${nextNode.name} (${detectedId})`);
          
          // Audio cues trigger logs
          if (nextNode.ambience.audioCueId) {
            console.log(`[WorldNodeSystem]: Dispatched audio track cue swap: ${nextNode.ambience.audioCueId}`);
          }
        }
      } else {
        this.currentParticleType = "none";
        console.log(`[WorldNodeSystem]: Entered Wilderness Void`);
      }
    }
  }

  /**
   * Lerps scene parameters towards current active node settings or falls back to clear base Cyber layout
   */
  private applyAmbienceInterpolation(deltaTimeSeconds: number, scene: Scene): void {
    const activeNode = this.getActiveNode();
    
    // Fallback/Default sector ambience if in the void
    const targetFogColor = activeNode ? activeNode.ambience.fogColor : new Color3(0.01, 0.015, 0.025);
    const targetFogDensity = activeNode ? activeNode.ambience.fogDensity : 0.005;
    const targetLightColor = activeNode ? activeNode.ambience.lightColor : new Color3(0.9, 0.95, 1.0);
    const targetLightIntensity = activeNode ? activeNode.ambience.lightIntensity : 1.0;

    // Linearly interpolate current metrics
    Color3.LerpToRef(this.currentRawFogColor, targetFogColor, deltaTimeSeconds * this.lerpSpeed, this.currentRawFogColor);
    this.currentFogDensity += (targetFogDensity - this.currentFogDensity) * (1 - Math.exp(-deltaTimeSeconds * this.lerpSpeed));
    Color3.LerpToRef(this.currentLightColor, targetLightColor, deltaTimeSeconds * this.lerpSpeed, this.currentLightColor);
    this.currentLightIntensity += (targetLightIntensity - this.currentLightIntensity) * (1 - Math.exp(-deltaTimeSeconds * this.lerpSpeed));

    // Propagate variables directly into BabylonJS Scene Fog Layer
    scene.fogEnabled = true;
    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogColor.copyFrom(this.currentRawFogColor);
    scene.fogDensity = this.currentFogDensity;
    scene.clearColor = this.currentRawFogColor.toColor4(1.0);

    // Retrieve and update the existing lights managed by EnvironmentManager securely
    const ambientLight = scene.getLightByName("ambientLight") as HemisphericLight;
    if (ambientLight) {
      ambientLight.diffuse.copyFrom(this.currentLightColor);
      ambientLight.intensity = this.currentLightIntensity * 0.45;
    }

    const mainLight = scene.getLightByName("mainLight") as DirectionalLight;
    if (mainLight) {
      mainLight.diffuse.copyFrom(this.currentLightColor);
      mainLight.intensity = this.currentLightIntensity;
    }
  }

  /**
   * Lightweight atmospheric particle updater. Wraps particles in a local cage surrounding player coordinates
   */
  private updateAtmosphericParticles(deltaTimeSeconds: number, playerPos: Vector3): void {
    if (this.currentParticleType === "none" || this.activeAirParticles.length === 0) {
      this.activeAirParticles.forEach(p => {
        p.setEnabled(false);
      });
      return;
    }

    const cageRadius = 14.0;
    const hoverScale = 0.4;

    // Tailor colors of particles dynamically
    let targetColor = new Color3(0.8, 0.8, 0.8);
    if (this.currentParticleType === "embers") {
      targetColor = new Color3(1.0, 0.4, 0.0);
    } else if (this.currentParticleType === "spores") {
      targetColor = new Color3(0.1, 0.8, 0.95);
    } else if (this.currentParticleType === "toxic_spits") {
      targetColor = new Color3(0.5, 0.9, 0.1);
    } else if (this.currentParticleType === "fog") {
      targetColor = new Color3(0.3, 0.35, 0.4);
    }

    this.particleMat.emissiveColor.copyFrom(targetColor);

    this.activeAirParticles.forEach((p, idx) => {
      p.setEnabled(true);

      // Simple physics/movement drift
      const speedSeed = (idx % 3) + 1.0;
      p.position.y -= deltaTimeSeconds * 0.8 * speedSeed;
      p.position.x += Math.sin((performance.now() / 1500) + idx) * deltaTimeSeconds * 0.4;
      p.position.z += Math.cos((performance.now() / 2000) + idx) * deltaTimeSeconds * 0.4;

      // Wrap-around bounds relative to player Pos (keeps particles localized cheaply!)
      const dx = p.position.x - playerPos.x;
      const dz = p.position.z - playerPos.z;

      if (Math.abs(dx) > cageRadius) {
        p.position.x = playerPos.x - Math.sign(dx) * (cageRadius - 1.0);
      }
      if (Math.abs(dz) > cageRadius) {
        p.position.z = playerPos.z - Math.sign(dz) * (cageRadius - 1.0);
      }
      if (p.position.y < playerPos.y - 1.0) {
        p.position.y = playerPos.y + 6.0 + Math.random() * 2.0;
      }
    });
  }

  /**
   * Performs deep cleanup, tearing down active particle meshes safely upon system destruction
   */
  public dispose(): void {
    this.activeAirParticles.forEach(p => {
      p.dispose();
    });
    this.activeAirParticles = [];
    if (this.particleMat) {
      this.particleMat.dispose();
    }
  }
}
