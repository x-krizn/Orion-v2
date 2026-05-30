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
  Tools,
  ShadowGenerator,
  Quaternion,
} from "@babylonjs/core";
import { GameSettings, PlayerInput } from "../types";
import { FXSystem } from "../fx/FXSystem";

export class CharacterController {
  private scene: Scene;
  private rootNode: TransformNode;
  private settings: GameSettings["movement"];
  
  // Custom visual components
  private proceduralVisualsRoot!: TransformNode;
  private customModelNode: TransformNode | null = null;
  private boundsSize: number;
  private trailEmitTimer = 0;

  // Lists for custom meshes detected on user uploaded warrior models
  private customEyeGlowMeshes: Mesh[] = [];
  private customBoosterMeshes: Mesh[] = [];
  private customDashBoosterMeshes: Mesh[] = [];
  private activeThemeColor: Color3 = new Color3(0, 0.94, 1.0); // Defaults to cyber cyan

  // Track original properties of custom imported character mesh to allow rotation/scaling overrides safely
  private originalBaseScale = new Vector3(1, 1, 1);
  private originalBaseRotation = new Vector3(0, 0, 0);
  private originalBaseQuaternion: Quaternion | null = null;
  private baseOffsetPos = new Vector3(0, 0, 0);
  private autoScaleFactor = 1.0;
  
  public customScaleMultiplier = 1.0;
  public customRotationYOffset = 0.0;

  // Visual sub-meshes for flashing
  private flashMeshes: Mesh[] = [];
  private pulseMaterials: StandardMaterial[] = [];
  private pulseTimer = 0;

  // Physics state
  private velocity: Vector3 = Vector3.Zero();
  private targetRotation = 0;
  private currentRotation = 0;

  // Firing arms reference for muzzle flash positioning
  private leftGunArm!: Mesh;
  private rightGunArm!: Mesh;
  private activeArmToggle = false; // Alternating fire

  // Dash state
  private isDashing = false;
  private dashCooldownTimer = 0;
  private dashDirection: Vector3 = new Vector3(0, 0, 1);

  constructor(scene: Scene, settings: GameSettings["movement"], boundsSize: number) {
    this.scene = scene;
    this.settings = settings;
    // Arena boundaries limit movement (slightly smaller than map size)
    this.boundsSize = boundsSize / 2 - 2;

    this.rootNode = new TransformNode("PlayerMechRoot", this.scene);
    this.rootNode.position.set(0, 0, 0);

    this.buildProceduralMech();
  }

  public getRootNode(): TransformNode {
    return this.rootNode;
  }

  public getPosition(): Vector3 {
    return this.rootNode.position;
  }

  /**
   * Builds an incredibly striking low-poly modular mech with emissive details
   */
  private buildProceduralMech(): void {
    this.proceduralVisualsRoot = new TransformNode("ProceduralMechVisuals", this.scene);
    this.proceduralVisualsRoot.parent = this.rootNode;

    // Define standard materials
    const frameMat = new StandardMaterial("mechFrameMat", this.scene);
    frameMat.diffuseColor = new Color3(0.18, 0.2, 0.24); // Dark heavy titanium
    frameMat.specularColor = new Color3(0.5, 0.5, 0.5);
    frameMat.specularPower = 32;

    const accentMat = new StandardMaterial("mechAccentMat", this.scene);
    accentMat.diffuseColor = new Color3(0.1, 0.12, 0.15);
    accentMat.emissiveColor = new Color3(0.1, 0, 0.2); // Core purple undertone

    const visorMat = new StandardMaterial("mechVisorMat", this.scene);
    visorMat.diffuseColor = new Color3(0, 0, 0);
    visorMat.emissiveColor = new Color3(0, 0.94, 1.0); // Bright glowing cyan visor
    visorMat.disableLighting = true;
    this.pulseMaterials.push(visorMat);

    const goldMat = new StandardMaterial("mechJointsMat", this.scene);
    goldMat.diffuseColor = new Color3(0.7, 0.45, 0.05);
    goldMat.specularColor = new Color3(0.9, 0.7, 0.2);

    // 1. Torso/Chassis (Prism/Box combo)
    const torso = MeshBuilder.CreateBox("mechTorso", { width: 1.6, height: 1.2, depth: 1.2 }, this.scene);
    torso.position.set(0, 1.6, 0);
    torso.material = frameMat;
    torso.parent = this.proceduralVisualsRoot;
    this.flashMeshes.push(torso);

    // 2. Visor Head
    const head = MeshBuilder.CreateBox("mechHead", { width: 0.8, height: 0.4, depth: 0.7 }, this.scene);
    head.position.set(0, 2.3, 0.1);
    head.material = accentMat;
    head.parent = this.proceduralVisualsRoot;
    this.flashMeshes.push(head);

    const visor = MeshBuilder.CreateBox("mechVisor", { width: 0.6, height: 0.1, depth: 0.05 }, this.scene);
    visor.position.set(0, 2.3, 0.46);
    visor.material = visorMat;
    visor.parent = this.proceduralVisualsRoot;

    // 3. Right Gun Arm Assembly (Alternating weapon muzzle)
    const rightShoulder = MeshBuilder.CreateCylinder("rightShoulder", { diameter: 0.5, height: 0.4 }, this.scene);
    rightShoulder.position.set(1.05, 1.7, 0);
    rightShoulder.rotation.z = Math.PI / 2;
    rightShoulder.material = goldMat;
    rightShoulder.parent = this.proceduralVisualsRoot;

    this.rightGunArm = MeshBuilder.CreateCylinder("rightGunArm", { diameterTop: 0.25, diameterBottom: 0.35, height: 1.2 }, this.scene);
    this.rightGunArm.position.set(1.15, 1.3, 0.3);
    this.rightGunArm.rotation.x = Math.PI / 2; // Arm pointing forward
    this.rightGunArm.material = frameMat;
    this.rightGunArm.parent = this.proceduralVisualsRoot;
    this.flashMeshes.push(this.rightGunArm);

    // Right emitter glow barrel
    const rightBarrel = MeshBuilder.CreateCylinder("rightBarrel", { diameter: 0.15, height: 0.4 }, this.scene);
    rightBarrel.position.set(0, 0.7, 0); // Position at head tip of arm
    rightBarrel.material = visorMat;
    rightBarrel.parent = this.rightGunArm;

    // 4. Left Gun Arm Assembly
    const leftShoulder = MeshBuilder.CreateCylinder("leftShoulder", { diameter: 0.5, height: 0.4 }, this.scene);
    leftShoulder.position.set(-1.05, 1.7, 0);
    leftShoulder.rotation.z = Math.PI / 2;
    leftShoulder.material = goldMat;
    leftShoulder.parent = this.proceduralVisualsRoot;

    this.leftGunArm = MeshBuilder.CreateCylinder("leftGunArm", { diameterTop: 0.25, diameterBottom: 0.35, height: 1.2 }, this.scene);
    this.leftGunArm.position.set(-1.15, 1.3, 0.3);
    this.leftGunArm.rotation.x = Math.PI / 2;
    this.leftGunArm.material = frameMat;
    this.leftGunArm.parent = this.proceduralVisualsRoot;
    this.flashMeshes.push(this.leftGunArm);

    // Left emitter glow barrel
    const leftBarrel = MeshBuilder.CreateCylinder("leftBarrel", { diameter: 0.12, height: 0.4 }, this.scene);
    leftBarrel.position.set(0, 0.7, 0);
    leftBarrel.material = visorMat;
    leftBarrel.parent = this.leftGunArm;

    // 5. Hover Engine / Thruster (Legs replacement for responsive sci-fi aesthetic)
    const hoverBase = MeshBuilder.CreateCylinder("hoverBase", { diameterTop: 1.1, diameterBottom: 0.5, height: 0.8, tessellation: 8 }, this.scene);
    hoverBase.position.set(0, 0.7, 0);
    hoverBase.material = accentMat;
    hoverBase.parent = this.proceduralVisualsRoot;
    this.flashMeshes.push(hoverBase);

    const thrusterPlate = MeshBuilder.CreateCylinder("thrusterPlate", { diameter: 0.9, height: 0.1 }, this.scene);
    thrusterPlate.position.set(0, 0.35, 0);
    thrusterPlate.material = goldMat;
    thrusterPlate.parent = hoverBase;

    // Glowing combustion ring
    const combustionMat = new StandardMaterial("combustionMat", this.scene);
    combustionMat.emissiveColor = new Color3(1.0, 0.25, 0); // Orange propulsion
    combustionMat.disableLighting = true;
    this.pulseMaterials.push(combustionMat);

    const combustionZone = MeshBuilder.CreateCylinder("combustionZone", { diameter: 0.7, height: 0.05 }, this.scene);
    combustionZone.position.set(0, 0.25, 0);
    combustionZone.material = combustionMat;
    combustionZone.parent = hoverBase;
  }

  /**
   * Swap out local assets for standard drag-dropped models
   */
  public hideProceduralModel(hide: boolean): void {
    if (hide) {
      this.proceduralVisualsRoot.setEnabled(false);
    } else {
      this.proceduralVisualsRoot.setEnabled(true);
      if (this.customModelNode) {
        this.customModelNode.dispose();
        this.customModelNode = null;
      }
    }
  }

  /**
   * Helper to configure glowing emissive material properties on imported meshes
   */
  private applyGlowColor(mesh: Mesh, color: Color3): void {
    const mat = mesh.material;
    if (mat) {
      if ('emissiveColor' in mat) {
        (mat as any).emissiveColor = color;
      }
      if ('emissiveIntensity' in mat) {
        (mat as any).emissiveIntensity = 2.0;
      }
      if ('useEmissiveAsIllumination' in mat) {
        (mat as any).useEmissiveAsIllumination = true;
      }
      if ('disableLighting' in mat) {
        (mat as any).disableLighting = true;
      }
    }
  }

  /**
   * Configure character active colors to match theme
   */
  public setThemeColor(color: Color3): void {
    this.activeThemeColor = color;
    
    // Dynamically update the colors on active custom meshes
    this.customEyeGlowMeshes.forEach(mesh => {
      this.applyGlowColor(mesh, color);
    });
    this.customBoosterMeshes.forEach(mesh => {
      this.applyGlowColor(mesh, color);
    });
    this.customDashBoosterMeshes.forEach(mesh => {
      this.applyGlowColor(mesh, new Color3(1.0, 0.35, 0.0).add(color).scale(0.5));
    });
  }

  /**
   * Installs imported asset mesh inside Player transform frame
   */
  public attachCustomModel(node: TransformNode): void {
    if (this.customModelNode) {
      this.customModelNode.dispose();
    }
    
    this.hideProceduralModel(true);
    
    this.customModelNode = node;
    this.customModelNode.parent = this.rootNode;
    this.customModelNode.position.set(0, 0, 0);

    // Track original transform parameters before applying dynamic offsets
    this.originalBaseScale.copyFrom(this.customModelNode.scaling);
    if (this.customModelNode.rotationQuaternion) {
      this.originalBaseQuaternion = this.customModelNode.rotationQuaternion.clone();
    } else {
      this.originalBaseRotation.copyFrom(this.customModelNode.rotation);
      this.originalBaseQuaternion = null;
    }

    // Force system matrix computation to obtain accurate bounding vectors
    node.computeWorldMatrix(true);
    node.getChildMeshes().forEach(m => m.computeWorldMatrix(true));

    const bounds = node.getHierarchyBoundingVectors(true);
    const size = bounds.max.subtract(bounds.min);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Compute base scaling factor to make character exactly 2.4 units tall
    if (maxDim > 0.01) {
      this.autoScaleFactor = 2.4 / maxDim;
      // Offset so base of the model sits exactly on ground level (y=0)
      this.baseOffsetPos.set(0, -bounds.min.y * this.autoScaleFactor, 0);
    } else {
      this.autoScaleFactor = 1.0;
      this.baseOffsetPos.set(0, 0, 0);
    }

    this.customScaleMultiplier = 1.0;
    this.customRotationYOffset = Math.PI; // Default to 180 degrees rotation (Math.PI radians) to face forward

    // Apply scaling, offset and rotation transformations
    this.applyCustomModelTransforms();

    // Reset lists of special custom meshes before scanning
    this.customEyeGlowMeshes = [];
    this.customBoosterMeshes = [];
    this.customDashBoosterMeshes = [];

    // Register shadow casting for all sub-meshes of this imported asset
    const shadowGenerators = this.scene.lights
      .map(light => light.getShadowGenerator())
      .filter((g): g is ShadowGenerator => g !== null);

    node.getChildMeshes().forEach(mesh => {
      mesh.receiveShadows = true;

      const meshName = mesh.name.toLowerCase();
      let isSpecialMesh = false;

      if (meshName.includes("eyeglow") || (meshName.includes("eye") && meshName.includes("glow"))) {
        this.customEyeGlowMeshes.push(mesh as Mesh);
        this.applyGlowColor(mesh as Mesh, this.activeThemeColor);
        mesh.setEnabled(true);
        mesh.visibility = 1.0;
        isSpecialMesh = true;
      } else if (meshName.includes("dash") && (meshName.includes("thruster") || meshName.includes("booster") || meshName.includes("jet") || meshName.includes("effect"))) {
        this.customDashBoosterMeshes.push(mesh as Mesh);
        this.applyGlowColor(mesh as Mesh, new Color3(1.0, 0.35, 0.0).add(this.activeThemeColor).scale(0.5));
        mesh.setEnabled(false); // Hide dash specific boosters initially
        mesh.visibility = 1.0;
        isSpecialMesh = true;
      } else if (meshName.includes("booster") || meshName.includes("thruster") || meshName.includes("jet")) {
        this.customBoosterMeshes.push(mesh as Mesh);
        this.applyGlowColor(mesh as Mesh, this.activeThemeColor);
        mesh.setEnabled(false); // Hide boosters initially
        mesh.visibility = 1.0;
        isSpecialMesh = true;
      }

      if (!isSpecialMesh) {
        mesh.setEnabled(true);
        mesh.visibility = 1.0;
      }

      shadowGenerators.forEach(sg => {
        sg.addShadowCaster(mesh);
      });
    });
  }

  /**
   * Apply combining original model factors and custom scaling/rotation offsets
   */
  public applyCustomModelTransforms(): void {
    if (!this.customModelNode) return;

    // Apply computed ground offset
    this.customModelNode.position.copyFrom(this.baseOffsetPos);

    // Apply combined scale
    const finalFactor = this.autoScaleFactor * this.customScaleMultiplier;
    this.customModelNode.scaling.set(
      this.originalBaseScale.x * finalFactor,
      this.originalBaseScale.y * finalFactor,
      this.originalBaseScale.z * finalFactor
    );

    // Apply combined rotation (Quaternion vs Euler safety wrapper)
    if (this.originalBaseQuaternion) {
      const extraRot = Quaternion.RotationYawPitchRoll(this.customRotationYOffset, 0, 0);
      this.customModelNode.rotationQuaternion = this.originalBaseQuaternion.multiply(extraRot);
    } else {
      this.customModelNode.rotation.copyFrom(this.originalBaseRotation);
      this.customModelNode.rotation.y += this.customRotationYOffset;
    }
  }

  /**
   * Expose manual transform updates for mobile sliders
   */
  public setCustomTransforms(scaleMultiplier: number, rotationDeg: number): void {
    this.customScaleMultiplier = scaleMultiplier;
    this.customRotationYOffset = rotationDeg * (Math.PI / 180);
    this.applyCustomModelTransforms();
  }

  /**
   * Connect character structures to cast shadow bounds
   */
  public setupShadowCasting(shadowGenerator: ShadowGenerator): void {
    this.flashMeshes.forEach(mesh => {
      shadowGenerator.addShadowCaster(mesh);
    });
  }

  /**
   * Flashes material white when projectile impact or custom damage hooks trigger
   */
  public triggerImpactFlash(): void {
    this.flashMeshes.forEach(mesh => {
      const mat = mesh.material as StandardMaterial;
      if (mat) {
        // Boost specular/emissive briefly
        const prevEmissive = mat.emissiveColor.clone();
        mat.emissiveColor = new Color3(1.0, 1.0, 1.0);
        setTimeout(() => {
          mat.emissiveColor = prevEmissive;
        }, 100);
      }
    });
  }

  /**
   * Swaps alternating gun arm positions and exports current muzzle point in global coordinate vectors
   */
  public getMuzzlePointAndAlt(): Vector3 {
    this.activeArmToggle = !this.activeArmToggle;
    const gunArm = this.activeArmToggle ? this.rightGunArm : this.leftGunArm;
    
    // Calculate global position of arm barrel
    const muzzleLocalPos = new Vector3(0, 0.7, 0);
    return Vector3.TransformCoordinates(muzzleLocalPos, gunArm.getWorldMatrix());
  }

  /**
   * Dash mechanic that pushes player forward
   */
  public executeDash(direction: Vector3): boolean {
    if (this.dashCooldownTimer > 0 || this.isDashing) return false;

    this.isDashing = true;
    this.dashCooldownTimer = 1.0; // 1 second cooldown
    
    // If direction is zero, dash forward (along current heading)
    if (direction.length() === 0) {
      this.dashDirection.set(
        Math.sin(this.currentRotation),
        0,
        Math.cos(this.currentRotation)
      );
    } else {
      this.dashDirection.copyFrom(direction);
    }
    this.dashDirection.normalize();

    // End dash state after duration
    setTimeout(() => {
      this.isDashing = false;
    }, 120);

    return true;
  }

  /**
   * Physical loop computation. Takes raw inputs and computes responsive, snapping movement
   */
  public update(deltaTimeSeconds: number, input: PlayerInput, fx?: FXSystem): void {
    // 1. Process cooldown timers
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= deltaTimeSeconds;
    }

    // 2. Pulse emissive rings over time index
    this.pulseTimer += deltaTimeSeconds * 4;
    const pulseFactor = 0.75 + Math.sin(this.pulseTimer) * 0.25;
    this.pulseMaterials.forEach(m => {
      // Modulate glowing intensity smoothly
      if (m.name === "mechVisorMat") {
        m.emissiveColor = new Color3(0, 0.94 * pulseFactor, 1.0 * pulseFactor);
      } else if (m.name === "combustionMat") {
        m.emissiveColor = new Color3(1.0 * pulseFactor, 0.25 * pulseFactor, 0);
      }
    });

    // Also pulse custom imported eyeglow elements if present
    if (this.customModelNode && this.customEyeGlowMeshes.length > 0) {
      this.customEyeGlowMeshes.forEach(mesh => {
        const mat = mesh.material;
        if (mat && 'emissiveColor' in mat) {
          (mat as any).emissiveColor = this.activeThemeColor.scale(pulseFactor);
        }
      });
    }

    // 3. Compute frame velocity vectors
    this.velocity.setAll(0);

    if (this.isDashing) {
      // Dash burst speed
      const dashSpeed = this.settings.speed * 3.5;
      this.velocity.copyFrom(this.dashDirection).scaleInPlace(dashSpeed);
    } else if (input.moveDirection.length() > 0) {
      // Responsive uniform translation
      this.velocity.copyFrom(input.moveDirection).scaleInPlace(this.settings.speed);

      // Determine rotation heading (Angle between X and Z dimensions)
      this.targetRotation = Math.atan2(input.moveDirection.x, input.moveDirection.z);
    }

    // Apply movement delta
    const movementDelta = this.velocity.scale(deltaTimeSeconds);
    this.rootNode.position.addInPlace(movementDelta);

    // Enforce strict map bounds limit to avoid flying outside
    this.rootNode.position.x = Math.max(-this.boundsSize, Math.min(this.boundsSize, this.rootNode.position.x));
    this.rootNode.position.z = Math.max(-this.boundsSize, Math.min(this.boundsSize, this.rootNode.position.z));

    // Keep ground lock
    this.rootNode.position.y = 0;

    // 4. Smooth snap rotation orientation (no sluggish inertia, but pleasant interpolation)
    if (input.moveDirection.length() > 0 || this.isDashing) {
      // Interpolate angles over frames
      const diff = this.targetRotation - this.currentRotation;
      
      // Handle floating point wrapping (-PI to PI)
      let wrappedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
      
      const rotStep = this.settings.rotationSpeed * (deltaTimeSeconds * 60);
      this.currentRotation += Math.max(-rotStep, Math.min(rotStep, wrappedDiff));
      
      this.rootNode.rotation.y = this.currentRotation;
    }

    // 5. Emit active engine booster trails and toggle custom model booster visibilities
    if (fx) {
      const isMoving = input.moveDirection.length() > 0;

      // Update visibility/state of custom model boosters if present
      if (this.customModelNode) {
        if (this.isDashing) {
          this.customBoosterMeshes.forEach(mesh => mesh.setEnabled(true));
          this.customDashBoosterMeshes.forEach(mesh => mesh.setEnabled(true));
        } else if (isMoving) {
          this.customBoosterMeshes.forEach(mesh => mesh.setEnabled(true));
          this.customDashBoosterMeshes.forEach(mesh => mesh.setEnabled(false));
        } else {
          this.customBoosterMeshes.forEach(mesh => mesh.setEnabled(false));
          this.customDashBoosterMeshes.forEach(mesh => mesh.setEnabled(false));
        }
      }

      if (isMoving || this.isDashing) {
        this.trailEmitTimer += deltaTimeSeconds;
        if (this.trailEmitTimer >= 0.05) {
          this.trailEmitTimer = 0;

          // Backward direction opposite to current heading
          const backDir = new Vector3(
            -Math.sin(this.currentRotation),
            0.05,
            -Math.cos(this.currentRotation)
          );

          if (this.customModelNode && (this.customBoosterMeshes.length > 0 || this.customDashBoosterMeshes.length > 0)) {
            // High fidelity custom model booster anchoring!
            // First emit from standard boosters when moving or dashing
            this.customBoosterMeshes.forEach(mesh => {
              fx.spawnBoosterTrail(mesh.getAbsolutePosition(), backDir, false);
            });
            // If dashing, also emit extra super-charged trails from dash specific boosters
            if (this.isDashing) {
              this.customDashBoosterMeshes.forEach(mesh => {
                fx.spawnBoosterTrail(mesh.getAbsolutePosition(), backDir, true);
              });
            }
          } else {
            // Procedural fallback behavior
            // Foot thrust trail (behind hoverBase)
            const feetPos = this.rootNode.position.add(backDir.scale(0.3)).add(new Vector3(0, 0.15, 0));
            fx.spawnBoosterTrail(feetPos, backDir, false);

            // Core/Torso back thrust trail
            const torsoPos = this.rootNode.position.add(backDir.scale(0.6)).add(new Vector3(0, 1.6, 0));
            fx.spawnBoosterTrail(torsoPos, backDir, true);
          }
        }
      }
    }
  }

  public getDashCooldownProgress(): number {
    return Math.max(0, this.dashCooldownTimer);
  }
}
