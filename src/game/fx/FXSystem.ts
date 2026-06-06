/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  TransformNode,
} from "@babylonjs/core";

interface ActiveLaser {
  mesh: Mesh;
  direction: Vector3;
  speed: number;
  distanceTraveled: number;
  maxDistance: number;
  damageCallback: () => void;
}

interface ActiveBeam {
  mesh: Mesh;
  material: StandardMaterial;
  life: number;
  maxLife: number;
}

interface ActiveExplosionFragment {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  maxLife: number;
}

interface ActiveTrailParticle {
  mesh: Mesh;
  material: StandardMaterial;
  velocity: Vector3;
  life: number;
  maxLife: number;
}

export interface CustomEffectData {
  id: string;
  name?: string;
  type: string;
  duration: number;
  emitterSocket?: string;
  color: string;
  emissive?: boolean;
  particleCount: number;
  lifetime: number;
  speed: number;
  size: number;
  spread: number;
  gravity?: number;
  blendMode?: string;
}

interface ActiveCustomParticle {
  mesh: Mesh;
  material: StandardMaterial;
  velocity: Vector3;
  gravity: number;
  life: number;
  maxLife: number;
}

export class FXSystem {
  private scene: Scene;
  private rootNode: TransformNode;
  
  // Custom Pools
  private lasers: ActiveLaser[] = [];
  private beams: ActiveBeam[] = [];
  private fragments: ActiveExplosionFragment[] = [];
  private trails: ActiveTrailParticle[] = [];
  private customParticles: ActiveCustomParticle[] = [];

  // Effect Definitions Registry
  private effectDefinitions: Map<string, CustomEffectData> = new Map();

  // Preview System state
  private activePreviewDefinition: CustomEffectData | null = null;
  private previewTimeAccumulator = 0;
  private previewIntervalTime = 0.5; // Seconds between repeat loops
  private previewTargetNode: any = null;

  // Reusable materials to optimize mobile performance and prevent memory pressure / WebGL compilations
  private fireColor: Color3 = new Color3(0, 0.94, 1.0); // Cyan default
  private laserShellMat!: StandardMaterial;
  private heavyBeamMat!: StandardMaterial;
  private debrisFireMat!: StandardMaterial;
  private debrisGoldMat!: StandardMaterial;
  private shockwaveRingMat!: StandardMaterial;
  private impactMat!: StandardMaterial;
  private boosterTrailMatOrange!: StandardMaterial;
  private boosterTrailMatPrimary!: StandardMaterial;
  private dynamicMatCache: Map<string, StandardMaterial> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
    this.rootNode = new TransformNode("FXSystemRoot", this.scene);
    this.initSharedMaterials();
    this.loadEffectDefinitions();
  }

  private initSharedMaterials(): void {
    this.laserShellMat = new StandardMaterial("laserShellMat", this.scene);
    this.laserShellMat.disableLighting = true;

    this.heavyBeamMat = new StandardMaterial("fusionBeamMat", this.scene);
    this.heavyBeamMat.alpha = 0.95;
    this.heavyBeamMat.disableLighting = true;

    this.debrisFireMat = new StandardMaterial("debrisFireMat", this.scene);
    this.debrisFireMat.disableLighting = true;

    this.debrisGoldMat = new StandardMaterial("debrisGoldMat", this.scene);
    this.debrisGoldMat.emissiveColor = new Color3(1.0, 0.4, 0.0);
    this.debrisGoldMat.disableLighting = true;

    this.shockwaveRingMat = new StandardMaterial("shockwaveRingMat", this.scene);
    this.shockwaveRingMat.disableLighting = true;

    this.impactMat = new StandardMaterial("impactMat", this.scene);
    this.impactMat.emissiveColor = new Color3(1.0, 1.0, 1.0);
    this.impactMat.disableLighting = true;

    this.boosterTrailMatOrange = new StandardMaterial("boosterTrailMatOrange", this.scene);
    this.boosterTrailMatOrange.emissiveColor = new Color3(1.0, 0.45, 0.0);
    this.boosterTrailMatOrange.disableLighting = true;
    this.boosterTrailMatOrange.alpha = 0.8;

    this.boosterTrailMatPrimary = new StandardMaterial("boosterTrailMatPrimary", this.scene);
    this.boosterTrailMatPrimary.disableLighting = true;
    this.boosterTrailMatPrimary.alpha = 0.8;

    this.updateSharedColors();
  }

  private updateSharedColors(): void {
    if (this.laserShellMat) this.laserShellMat.emissiveColor = this.fireColor;
    if (this.heavyBeamMat) this.heavyBeamMat.emissiveColor = this.fireColor;
    if (this.debrisFireMat) this.debrisFireMat.emissiveColor = this.fireColor;
    if (this.shockwaveRingMat) this.shockwaveRingMat.emissiveColor = this.fireColor;
    if (this.boosterTrailMatPrimary) this.boosterTrailMatPrimary.emissiveColor = this.fireColor;
  }

  private getCachedMaterial(hexColor: string, emissive: boolean, blendMode?: string): StandardMaterial {
    const key = `${hexColor.toLowerCase()}_${emissive}_${blendMode || "normal"}`;
    let mat = this.dynamicMatCache.get(key);
    if (!mat) {
      mat = new StandardMaterial("cachedFXMat_" + key, this.scene);
      const color = Color3.FromHexString(hexColor);
      mat.emissiveColor = color;
      mat.diffuseColor = color;
      mat.disableLighting = !emissive;
      if (blendMode === "additive") {
        mat.alphaMode = 1; // Babylon additive blend alpha mode
      }
      this.dynamicMatCache.set(key, mat);
    }
    return mat;
  }

  /**
   * Modulate active colors when theme transfers
   */
  public setThemeColors(primary: Color3): void {
    this.fireColor = primary;
    this.updateSharedColors();
  }

  /**
   * Spawns a physical laser ray, moving towards a heading vector
   */
  public spawnLaserShell(origin: Vector3, heading: Vector3, maxDist = 30, onHit: () => void): void {
    // Small capsule or elongated box pointing down the trajectory heading path
    const shell = MeshBuilder.CreateBox("laserShell", { width: 0.12, height: 0.12, depth: 0.8 }, this.scene);
    shell.position.copyFrom(origin);
    shell.material = this.laserShellMat;
    shell.parent = this.rootNode;

    // Orient mesh along traveling heading axis
    shell.lookAt(origin.add(heading));

    this.lasers.push({
      mesh: shell,
      direction: heading.normalizeToNew(),
      speed: 38.0, // High-speed projectiles
      distanceTraveled: 0,
      maxDistance: maxDist,
      damageCallback: onHit,
    });
  }

  /**
   * Draw a massive, stylized continuous rail beam showing energy connectivity
   */
  public spawnHeavyBeam(origin: Vector3, destination: Vector3): void {
    const diff = destination.subtract(origin);
    const length = diff.length();

    // Create a cylinder to act as the raw beam segment
    const beam = MeshBuilder.CreateCylinder("heavyBeamSegment", {
      diameter: 0.45,
      height: length,
    }, this.scene);
    
    // Position at midpoint
    const midpoint = origin.add(diff.scale(0.5));
    beam.position.copyFrom(midpoint);
    beam.parent = this.rootNode;
    beam.material = this.heavyBeamMat;

    // Rotate custom cylinder to match look direction
    beam.lookAt(destination);
    beam.rotate(Vector3.Right(), Math.PI / 2); // Align cylinder axis along vector

    this.beams.push({
      mesh: beam,
      material: this.heavyBeamMat,
      life: 0.25, // Fades rapid-fire (seconds)
      maxLife: 0.25,
    });

    // Spawn tiny muzzle glow sphere
    const flashGlow = MeshBuilder.CreateSphere("muzzleGlow", { diameter: 1.2 }, this.scene);
    flashGlow.position.copyFrom(origin);
    flashGlow.material = this.heavyBeamMat;
    flashGlow.parent = this.rootNode;

    this.beams.push({
      mesh: flashGlow,
      material: this.heavyBeamMat,
      life: 0.15,
      maxLife: 0.15,
    });
  }

  /**
   * Low-poly particle explosion consisting of scattered glowing micro-cubes
   */
  public spawnExplosion(center: Vector3, numDebris = 12, multiplier = 1.0): void {
    for (let i = 0; i < numDebris; i++) {
      const size = 0.2 + Math.random() * 0.35;
      const cube = MeshBuilder.CreateBox("debrisBox", { width: size, height: size, depth: size }, this.scene);
      cube.position.copyFrom(center);
      cube.parent = this.rootNode;
      // Alternate materials
      cube.material = (i % 2 === 0) ? this.debrisFireMat : this.debrisGoldMat;

      // Random unit vectors
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.3) * Math.PI; // skewed slightly upwards
      const speed = (2.5 + Math.random() * 6.5) * multiplier;

      const vel = new Vector3(
        Math.cos(angle) * Math.cos(elevation) * speed,
        Math.sin(elevation) * speed,
        Math.sin(angle) * Math.cos(elevation) * speed
      );

      this.fragments.push({
        mesh: cube,
        velocity: vel,
        life: 0.4 + Math.random() * 0.35,
        maxLife: 0.75,
      });
    }

    // Instant expanding shock wave ring
    const ring = MeshBuilder.CreateTorus("shockwaveRing", {
      diameter: 0.5,
      thickness: 0.1,
      tessellation: 12,
    }, this.scene);
    ring.position.copyFrom(center).addInPlace(new Vector3(0, 0.1, 0));
    ring.parent = this.rootNode;
    ring.material = this.shockwaveRingMat;

    this.beams.push({
      mesh: ring,
      material: this.shockwaveRingMat,
      life: 0.3,
      maxLife: 0.3,
    });
  }

  /**
   * Spawns an impact spark at the projectile point
   */
  public spawnHitImpact(point: Vector3): void {
    const hitSpark = MeshBuilder.CreateSphere("impactSpark", { diameter: 0.65 }, this.scene);
    hitSpark.position.copyFrom(point);
    hitSpark.material = this.impactMat;
    hitSpark.parent = this.rootNode;

    this.beams.push({
      mesh: hitSpark,
      material: this.impactMat,
      life: 0.08,
      maxLife: 0.08,
    });

    // 3 small high velocity sparks
    for (let i = 0; i < 4; i++) {
      const spk = MeshBuilder.CreateBox("sparkLine", { width: 0.05, height: 0.05, depth: 0.25 }, this.scene);
      spk.position.copyFrom(point);
      spk.parent = this.rootNode;
      spk.material = this.impactMat;

      const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
      const vel = new Vector3(Math.cos(angle) * 8, 1, Math.sin(angle) * 8);

      this.fragments.push({
        mesh: spk,
        velocity: vel,
        life: 0.15,
        maxLife: 0.15,
      });
    }
  }

  /**
   * Continuous loop animation updating active visual fragments, beam contractions, and laser movements
   */
  public update(deltaTimeSeconds: number): void {
    // 1. Process active standard lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const proj = this.lasers[i];
      const step = proj.direction.scale(proj.speed * deltaTimeSeconds);
      
      proj.mesh.position.addInPlace(step);
      proj.distanceTraveled += step.length();

      // Check collision bounds or out of bounds reach
      if (proj.distanceTraveled >= proj.maxDistance) {
        // Trigger impact at current position
        proj.damageCallback();
        
        proj.mesh.dispose();
        this.lasers.splice(i, 1);
      }
    }

    // 2. Process expanding rail beams, rings, or shockwaves
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const beam = this.beams[i];
      beam.life -= deltaTimeSeconds;

      if (beam.life <= 0) {
        beam.mesh.dispose();
        this.beams.splice(i, 1);
      } else {
        const progress = beam.life / beam.maxLife;

        // Visual morphs
        if (beam.mesh.name.startsWith("heavyBeamSegment")) {
          // Shrink width
          beam.mesh.scaling.x = progress;
          beam.mesh.scaling.z = progress;
        } else if (beam.mesh.name.startsWith("muzzleGlow") || beam.mesh.name.startsWith("impactSpark")) {
          // Fade alpha & size
          beam.mesh.scaling.setAll(progress);
        } else if (beam.mesh.name.startsWith("shockwaveRing")) {
          // Expand torus and fade
          const expFactor = (1.0 - progress) * 16.0;
          beam.mesh.scaling.set(expFactor, 1, expFactor);
        }

        beam.mesh.visibility = progress;
      }
    }

    // 3. Process physically scattered explosion fragments / sparks
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const frag = this.fragments[i];
      frag.life -= deltaTimeSeconds;

      if (frag.life <= 0) {
        frag.mesh.dispose();
        this.fragments.splice(i, 1);
      } else {
        // Move fragments under mock gravity downwards
        frag.velocity.y -= 9.8 * deltaTimeSeconds; // Gravity pulling fragments down
        const step = frag.velocity.scale(deltaTimeSeconds);
        frag.mesh.position.addInPlace(step);
        
        // Spin fragment
        frag.mesh.rotation.x += deltaTimeSeconds * 3;
        frag.mesh.rotation.y += deltaTimeSeconds * 4;

        // Shrink mesh
        const prog = frag.life / frag.maxLife;
        frag.mesh.scaling.setAll(prog);
      }
    }

    // 4. Process engine/thruster trails
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tail = this.trails[i];
      tail.life -= deltaTimeSeconds;

      if (tail.life <= 0) {
        tail.mesh.dispose();
        this.trails.splice(i, 1);
      } else {
        const step = tail.velocity.scale(deltaTimeSeconds);
        tail.mesh.position.addInPlace(step);

        const progress = tail.life / tail.maxLife;
        tail.mesh.scaling.setAll(progress);
        tail.mesh.visibility = progress * 0.8;
      }
    }

    // 5. Process custom FX Workbench / JSON-driven particles
    for (let i = this.customParticles.length - 1; i >= 0; i--) {
      const p = this.customParticles[i];
      p.life -= deltaTimeSeconds;

      if (p.life <= 0) {
        p.mesh.dispose();
        this.customParticles.splice(i, 1);
      } else {
        // Pull down by custom mock gravity setting
        p.velocity.y -= p.gravity * deltaTimeSeconds;
        const step = p.velocity.scale(deltaTimeSeconds);
        p.mesh.position.addInPlace(step);

        const progress = p.life / p.maxLife;
        p.mesh.scaling.setAll(progress);
        p.mesh.visibility = progress;
      }
    }

    // 6. Handle active live preview repetition/pulsing
    if (this.activePreviewDefinition) {
      this.previewTimeAccumulator += deltaTimeSeconds;
      if (this.previewTimeAccumulator >= this.previewIntervalTime) {
        this.previewTimeAccumulator = 0;
        this.spawnCustomEffect(this.activePreviewDefinition, this.previewTargetNode);
      }
    }
  }

  /**
   * Loads custom effect definitions from public effects.json dataset
   */
  public async loadEffectDefinitions(): Promise<void> {
    try {
      const response = await fetch("/data/effects.json");
      if (response.ok) {
        const list: CustomEffectData[] = await response.json();
        list.forEach(item => {
          this.effectDefinitions.set(item.id, item);
        });
        console.log(`[FXSystem]: Successfully loaded ${list.length} custom effects from static JSON.`);
      } else {
        throw new Error(`HTTP status ${response.status}`);
      }
    } catch (e) {
      console.warn("[FXSystem]: Could not load custom effects from /data/effects.json, utilizing local fallback presets.", e);
      // Stand-in declarative fallbacks
      const fallbacks: CustomEffectData[] = [
        {
          id: "aether_muzzle_flash",
          name: "Alpha-Aether Muzzle Pulse",
          type: "particle",
          duration: 0.25,
          emitterSocket: "socket_muzzle",
          color: "#7dfcff",
          emissive: true,
          particleCount: 60,
          lifetime: 0.22,
          speed: 9.5,
          size: 0.20,
          spread: 0.45,
          gravity: 0.0,
          blendMode: "additive"
        }
      ];
      fallbacks.forEach(item => {
        this.effectDefinitions.set(item.id, item);
      });
    }
  }

  /**
   * Spawns a registered custom effect by ID on the given coordinates/node
   */
  public playEffect(effectId: string, positionOrSocket: Vector3 | TransformNode | Mesh | null): void {
    const effect = this.effectDefinitions.get(effectId);
    if (!effect) {
      console.warn(`[FXSystem]: Effect definition not found for play request "${effectId}"`);
      return;
    }
    this.spawnCustomEffect(effect, positionOrSocket);
  }

  /**
   * Spawns a custom particle burst conforming to the declarative effect definition.
   */
  public spawnCustomEffect(effect: CustomEffectData, positionOrSocket: Vector3 | TransformNode | Mesh | null): void {
    let origin = new Vector3(0, 1.0, 0); // Default fallback

    if (positionOrSocket instanceof Vector3) {
      origin = positionOrSocket;
    } else if (positionOrSocket && (positionOrSocket as any).getAbsolutePosition) {
      (positionOrSocket as any).computeWorldMatrix(true);
      origin = (positionOrSocket as any).getAbsolutePosition();
    }

    const hexColor = effect.color || "#7dfcff";
    const fxMat = this.getCachedMaterial(hexColor, effect.emissive !== false, effect.blendMode);

    const count = effect.particleCount || 40;
    const gVal = typeof effect.gravity === "number" ? effect.gravity : 0;
    const sizeVal = effect.size || 0.15;
    const speedVal = effect.speed || 6;
    const lifetimeVal = effect.lifetime || 0.25;
    const spreadVal = effect.spread || 0.50;

    for (let i = 0; i < count; i++) {
      const pMesh = MeshBuilder.CreateBox("customFXParticle", { width: sizeVal, height: sizeVal, depth: sizeVal }, this.scene);
      pMesh.position.copyFrom(origin);
      pMesh.parent = this.rootNode;
      pMesh.material = fxMat;

      // Spherical trajectory logic using spread and speed
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2 - 1) * spreadVal);
      const rSpeed = speedVal * (0.5 + Math.random() * 1.0);

      const vel = new Vector3(
        Math.sin(phi) * Math.cos(theta) * rSpeed,
        Math.cos(phi) * rSpeed,
        Math.sin(phi) * Math.sin(theta) * rSpeed
      );

      this.customParticles.push({
        mesh: pMesh,
        material: fxMat,
        velocity: vel,
        gravity: gVal,
        life: lifetimeVal * (0.6 + Math.random() * 0.8),
        maxLife: lifetimeVal * 1.4
      });
    }
  }

  /**
   * Registers a callback definition for real-time sandbox re-running in viewport
   */
  public previewEffect(effectDefinition: CustomEffectData, socketNode?: TransformNode | Mesh | null): void {
    this.activePreviewDefinition = { ...effectDefinition };
    this.previewTargetNode = socketNode || null;
    this.previewTimeAccumulator = this.previewIntervalTime; // Triggers immediate initial blast
    console.log(`[FXSystem]: Visualizer workbench preview active:`, effectDefinition.id);
  }

  /**
   * Resets the active repetition preview loop
   */
  public restartPreview(): void {
    if (this.activePreviewDefinition) {
      this.previewTimeAccumulator = this.previewIntervalTime;
    }
  }

  /**
   * Stills the current visualizer repeat ticks
   */
  public stopPreview(): void {
    this.activePreviewDefinition = null;
    this.previewTargetNode = null;
  }

  /**
   * Updates preview parameters instantly from slider updates
   */
  public updatePreviewParams(partialParams: Partial<CustomEffectData>): void {
    if (this.activePreviewDefinition) {
      this.activePreviewDefinition = {
        ...this.activePreviewDefinition,
        ...partialParams
      };
    }
  }

  /**
   * Returns a copy of all loaded or default effect definitions
   */
  public getEffectDefinitionsList(): CustomEffectData[] {
    return Array.from(this.effectDefinitions.values());
  }

  /**
   * Retreive a specific custom effect metadata details
   */
  public getEffectDefinition(id: string): CustomEffectData | undefined {
    return this.effectDefinitions.get(id);
  }

  /**
   * Spawns a glowing engine exhaust trail drifting backwards/upwards
   */
  public spawnBoosterTrail(position: Vector3, direction: Vector3, isTorso = false): void {
    const trailMat = isTorso ? this.boosterTrailMatPrimary : this.boosterTrailMatOrange;
    const size = isTorso ? (0.12 + Math.random() * 0.1) : (0.08 + Math.random() * 0.08);
    const particle = MeshBuilder.CreateBox("trailParticle", { width: size, height: size, depth: size }, this.scene);
    particle.position.copyFrom(position);
    particle.parent = this.rootNode;
    particle.material = trailMat;

    // Disperse velocity slightly
    const velocity = direction.scale(1.5 + Math.random() * 2.0).add(new Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.2) * 0.4,
      (Math.random() - 0.5) * 0.5
    ));

    this.trails.push({
      mesh: particle,
      material: trailMat,
      velocity,
      life: 0.2 + Math.random() * 0.15,
      maxLife: 0.35,
    });
  }

  public getActiveCount(): number {
    return this.lasers.length + this.beams.length + this.fragments.length + this.trails.length;
  }

  /**
   * Spawns a visual effect directly from a registered socket.
   * If the socket object is provided, it extracts its absolute position.
   * Otherwise, it falls back to a provided standard position vector.
   */
  public spawnFromSocket(
    socket: TransformNode | Mesh | undefined,
    fallbackPos: Vector3,
    fxType: "laser" | "beam" | "explosion" | "trail",
    target?: Vector3,
    onHit?: () => void
  ): void {
    if (socket) {
      socket.computeWorldMatrix(true);
    }
    const origin = socket ? socket.getAbsolutePosition() : fallbackPos;
    
    switch (fxType) {
      case "laser":
        if (target) {
          const heading = target.subtract(origin).normalize();
          this.spawnLaserShell(origin, heading, 30, onHit || (() => {}));
        }
        break;
      case "beam":
        if (target) {
          this.spawnHeavyBeam(origin, target);
        }
        break;
      case "explosion":
        this.spawnExplosion(origin);
        break;
      case "trail":
        if (target) {
          this.spawnBoosterTrail(origin, target);
        }
        break;
    }
  }

  /**
   * Safe disposal buffer clean up
   */
  public clearAll(): void {
    this.lasers.forEach(l => l.mesh.dispose());
    this.beams.forEach(b => b.mesh.dispose());
    this.fragments.forEach(f => f.mesh.dispose());
    this.trails.forEach(t => t.mesh.dispose());
    this.lasers = [];
    this.beams = [];
    this.fragments = [];
    this.trails = [];
  }
}
