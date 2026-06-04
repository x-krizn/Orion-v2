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
import { GameSettings, PlayerInput, GameplayAction } from "../types";
import { FXSystem } from "../fx/FXSystem";
import { SocketManager } from "../rendering/SocketManager";

export class CharacterController {
  private scene: Scene;
  private rootNode: TransformNode;
  private settings: GameSettings["movement"];
  
  public readonly socketManager: SocketManager = new SocketManager();
  
  // Custom visual components
  private proceduralVisualsRoot!: TransformNode;
  public torsoAssembly!: TransformNode;
  private customModelNode: TransformNode | null = null;
  private boundsSize: number;
  private trailEmitTimer = 0;

  // Souls Mech resources & stats
  public hp = 1000;
  public maxHp = 1000;
  public en = 100;
  public maxEn = 100;
  public heat = 0;
  public maxHeat = 100;
  public armor = 200;
  public maxArmor = 200;
  public isOverheated = false;
  private timeSinceDamage = 0;

  // Unified Action-State Framework
  public currentAction: GameplayAction | null = null;
  public stance: "standard" | "powerstance" = "standard";

  public triggerAction(action: GameplayAction): boolean {
    if (this.currentAction) {
      if (!this.currentAction.cancelable) {
        console.log(`[Action Warning]: Cannot execute "${action.name}" during committed "${this.currentAction.name}"`);
        return false;
      }
      this.cancelCurrentAction();
    }
    this.currentAction = { ...action, elapsed: 0 };
    console.log(`[Action State]: Started action "${action.name}" (${action.type}) duration ${action.duration}s`);
    return true;
  }

  public cancelCurrentAction(): boolean {
    if (this.currentAction) {
      if (!this.currentAction.cancelable) {
        console.log(`[Action Warning]: Action "${this.currentAction.name}" has animation commitment and cannot be canceled!`);
        return false;
      }
      console.log(`[Action Cancel]: Interrupted running action "${this.currentAction.name}" successfully.`);
      this.currentAction.onCancel?.();
      this.currentAction = null;
      return true;
    }
    return false;
  }

  // Aiming position (independent facing)
  private aimPoint: Vector3 | null = null;

  // Lists for custom meshes detected on user uploaded warrior models
  private customEyeGlowMeshes: Mesh[] = [];
  private customBoosterMeshes: Mesh[] = [];
  private customDashBoosterMeshes: Mesh[] = [];
  private customLeftGunArm: Mesh | null = null;
  private customRightGunArm: Mesh | null = null;
  private activeThemeColor: Color3 = new Color3(0, 0.94, 1.0); // Defaults to cyber cyan

  public onThemeColorDetected?: (color: Color3) => void;

  // Track original properties of custom imported character mesh to allow rotation/scaling overrides safely
  private originalBaseScale = new Vector3(1, 1, 1);
  private originalBaseRotation = new Vector3(0, 0, 0);
  private originalBaseQuaternion: Quaternion | null = null;
  private baseOffsetPos = new Vector3(0, 0, 0);
  private autoScaleFactor = 1.0;
  
  public customScaleMultiplier = 1.0;
  public customRotationYOffset = 0.0;

  // Precision alignment and customization settings (useful for Blockbench refining)
  private customOffsetX = 0;
  private customOffsetY = 0;
  private customOffsetZ = 0;
  private customMuzzleOffsetX = 0;
  private customMuzzleOffsetY = 0;
  private customMuzzleOffsetZ = 0;
  private customBobbingHeight = 0.08;
  private customBobbingSpeed = 1.0;
  private customTiltPitch = 0.12;
  private customSwayRoll = 0.04;
  private customCollisionRadius = 0.7;

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
  private dashCooldownDuration = 1.0;
  private dashSpeedMultiplier = 3.5;

  // Active Status Effects
  private activeStatusEffect: any = null;
  private statusEffectRemainingTimer = 0;

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

    // Instantiate decoupled upper Torso Assembly
    this.torsoAssembly = new TransformNode("mechTorsoAssembly", this.scene);
    this.torsoAssembly.parent = this.proceduralVisualsRoot;

    // 1. Torso/Chassis (Prism/Box combo)
    const torso = MeshBuilder.CreateBox("mechTorso", { width: 1.6, height: 1.2, depth: 1.2 }, this.scene);
    torso.position.set(0, 1.6, 0);
    torso.material = frameMat;
    torso.parent = this.torsoAssembly;
    this.flashMeshes.push(torso);

    // 2. Visor Head
    const head = MeshBuilder.CreateBox("mechHead", { width: 0.8, height: 0.4, depth: 0.7 }, this.scene);
    head.position.set(0, 2.3, 0.1);
    head.material = accentMat;
    head.parent = this.torsoAssembly;
    this.flashMeshes.push(head);

    const visor = MeshBuilder.CreateBox("mechVisor", { width: 0.6, height: 0.1, depth: 0.05 }, this.scene);
    visor.position.set(0, 2.3, 0.46);
    visor.material = visorMat;
    visor.parent = this.torsoAssembly;

    // 3. Right Gun Arm Assembly (Alternating weapon muzzle)
    const rightShoulder = MeshBuilder.CreateCylinder("rightShoulder", { diameter: 0.5, height: 0.4 }, this.scene);
    rightShoulder.position.set(1.05, 1.7, 0);
    rightShoulder.rotation.z = Math.PI / 2;
    rightShoulder.material = goldMat;
    rightShoulder.parent = this.torsoAssembly;

    this.rightGunArm = MeshBuilder.CreateCylinder("rightGunArm", { diameterTop: 0.25, diameterBottom: 0.35, height: 1.2 }, this.scene);
    this.rightGunArm.position.set(1.15, 1.3, 0.3);
    this.rightGunArm.rotation.x = Math.PI / 2; // Arm pointing forward
    this.rightGunArm.material = frameMat;
    this.rightGunArm.parent = this.torsoAssembly;
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
    leftShoulder.parent = this.torsoAssembly;

    this.leftGunArm = MeshBuilder.CreateCylinder("leftGunArm", { diameterTop: 0.25, diameterBottom: 0.35, height: 1.2 }, this.scene);
    this.leftGunArm.position.set(-1.15, 1.3, 0.3);
    this.leftGunArm.rotation.x = Math.PI / 2;
    this.leftGunArm.material = frameMat;
    this.leftGunArm.parent = this.torsoAssembly;
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

    // Trigger socket discovery scan on the newly loaded custom model
    this.socketManager.discoverSockets(node);

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
    this.customLeftGunArm = null;
    this.customRightGunArm = null;

    // Detect character theme color from model's emissive features (e.g. eyes/glow/visors)
    let detectedThemeColor: Color3 | null = null;
    node.getChildMeshes().forEach(mesh => {
      const mat = mesh.material as StandardMaterial;
      if (mat) {
        const meshName = mesh.name.toLowerCase();
        if (meshName.includes("glow") || meshName.includes("visor") || meshName.includes("eye") || meshName.includes("booster")) {
          if (mat.emissiveColor && (mat.emissiveColor.r > 0.05 || mat.emissiveColor.g > 0.05 || mat.emissiveColor.b > 0.05)) {
            detectedThemeColor = mat.emissiveColor.clone();
          } else if (mat.diffuseColor && (mat.diffuseColor.r > 0.05 || mat.diffuseColor.g > 0.05 || mat.diffuseColor.b > 0.05)) {
            detectedThemeColor = mat.diffuseColor.clone();
          }
        }
      }
    });

    if (detectedThemeColor) {
      console.log(`[Asset Integration]: Detected custom theme color from model:`, (detectedThemeColor as Color3).toHexString());
      this.activeThemeColor = detectedThemeColor;
      if (this.onThemeColorDetected) {
        this.onThemeColorDetected(detectedThemeColor);
      }
    }

    // Register shadow casting for all sub-meshes of this imported asset
    const shadowGenerators = this.scene.lights
      .map(light => light.getShadowGenerator())
      .filter((g): g is ShadowGenerator => g !== null);

    node.getChildMeshes().forEach(mesh => {
      mesh.receiveShadows = true;

      const meshName = mesh.name.toLowerCase();
      let isSpecialMesh = false;

      // Scan for weapon/arm/gun components based on naming
      if (meshName.includes("left") && (meshName.includes("gun") || meshName.includes("arm") || meshName.includes("weapon") || meshName.includes("barrel") || meshName.includes("muzzle") || meshName.includes("cannon") || meshName.includes("laser") || meshName.includes("shooter"))) {
        this.customLeftGunArm = mesh as Mesh;
      } else if (meshName.includes("right") && (meshName.includes("gun") || meshName.includes("arm") || meshName.includes("weapon") || meshName.includes("barrel") || meshName.includes("muzzle") || meshName.includes("cannon") || meshName.includes("laser") || meshName.includes("shooter"))) {
        this.customRightGunArm = mesh as Mesh;
      }

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

    // Fallback search by relative side-coordinates if some arm meshes were found without left/right naming
    if (!this.customLeftGunArm || !this.customRightGunArm) {
      node.getChildMeshes().forEach(mesh => {
        const meshName = mesh.name.toLowerCase();
        if (meshName.includes("gun") || meshName.includes("weapon") || meshName.includes("barrel") || meshName.includes("muzzle") || meshName.includes("cannon") || meshName.includes("laser") || meshName.includes("shooter")) {
          mesh.computeWorldMatrix(true);
          // Get local position relative to the main chassis
          const localPos = Vector3.TransformCoordinates(mesh.getAbsolutePosition(), node.getWorldMatrix().clone().invert());
          if (localPos.x < -0.15) {
            if (!this.customLeftGunArm) this.customLeftGunArm = mesh as Mesh;
          } else if (localPos.x > 0.15) {
            if (!this.customRightGunArm) this.customRightGunArm = mesh as Mesh;
          }
        }
      });
    }
  }

  /**
   * Apply combining original model factors and custom scaling/rotation offsets
   */
  public applyCustomModelTransforms(): void {
    if (!this.customModelNode) return;

    // Apply computed ground offset + manual coordinate shifts
    this.customModelNode.position.set(
      this.baseOffsetPos.x + this.customOffsetX,
      this.baseOffsetPos.y + this.customOffsetY,
      this.baseOffsetPos.z + this.customOffsetZ
    );

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
   * Attaches a module or weapon visual mesh to a named socket discovered on this player mech.
   */
  public attachModuleToSocket(moduleRoot: TransformNode, socketName: string): boolean {
    return this.socketManager.attachModuleToSocket(moduleRoot, socketName);
  }

  /**
   * Set extensive precision alignment parameters for custom imported models
   */
  public setCustomAlignment(settings: {
    offsetX?: number;
    offsetY?: number;
    offsetZ?: number;
    muzzleOffsetX?: number;
    muzzleOffsetY?: number;
    muzzleOffsetZ?: number;
    bobbingHeight?: number;
    bobbingSpeed?: number;
    tiltPitch?: number;
    swayRoll?: number;
    collisionRadius?: number;
  }): void {
    if (settings.offsetX !== undefined) this.customOffsetX = settings.offsetX;
    if (settings.offsetY !== undefined) this.customOffsetY = settings.offsetY;
    if (settings.offsetZ !== undefined) this.customOffsetZ = settings.offsetZ;
    if (settings.muzzleOffsetX !== undefined) this.customMuzzleOffsetX = settings.muzzleOffsetX;
    if (settings.muzzleOffsetY !== undefined) this.customMuzzleOffsetY = settings.muzzleOffsetY;
    if (settings.muzzleOffsetZ !== undefined) this.customMuzzleOffsetZ = settings.muzzleOffsetZ;
    if (settings.bobbingHeight !== undefined) this.customBobbingHeight = settings.bobbingHeight;
    if (settings.bobbingSpeed !== undefined) this.customBobbingSpeed = settings.bobbingSpeed;
    if (settings.tiltPitch !== undefined) this.customTiltPitch = settings.tiltPitch;
    if (settings.swayRoll !== undefined) this.customSwayRoll = settings.swayRoll;
    if (settings.collisionRadius !== undefined) this.customCollisionRadius = settings.collisionRadius;

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
    
    if (this.customModelNode) {
      // 1. Attempt to find matching weapon fire socket based on naming rules (Odd = port/left, Even = starboard/right)
      const socketName = this.activeArmToggle ? "socket_weapon_02" : "socket_weapon_01";
      const altSocketName = this.activeArmToggle ? "socket_arm_02" : "socket_arm_01";
      
      let targetSocket = this.socketManager.getSocket(socketName) || 
                         this.socketManager.getSocket(altSocketName) ||
                         this.socketManager.getSocket("socket_muzzle");

      if (targetSocket) {
        targetSocket.computeWorldMatrix(true);
        // Find if there's a child socket_muzzle or socket_fx underneath the active socket (e.g., nested in weapon attachment)
        const childNodes = targetSocket.getChildTransformNodes ? targetSocket.getChildTransformNodes(false) : [];
        const nestedMuzzle = childNodes.find(child => child.name.toLowerCase().startsWith("socket_muzzle")) ||
                             childNodes.find(child => child.name.toLowerCase().startsWith("socket_fx"));
        
        if (nestedMuzzle) {
          nestedMuzzle.computeWorldMatrix(true);
          return nestedMuzzle.getAbsolutePosition();
        }

        // Check meshes inside standard child array representing muzzle if no nested transform node parent
        const children = targetSocket.getChildren ? targetSocket.getChildren() : [];
        const nestedMuzzleMesh = children.find(child => child.name.toLowerCase().startsWith("socket_muzzle"));
        if (nestedMuzzleMesh) {
          (nestedMuzzleMesh as any).computeWorldMatrix(true);
          return (nestedMuzzleMesh as any).getAbsolutePosition();
        }

        return targetSocket.getAbsolutePosition();
      }

      // 2. Fallback to existing manual bounding calculations or gun arms if no socket matches
      const activeCustomArm = this.activeArmToggle ? this.customRightGunArm : this.customLeftGunArm;
      if (activeCustomArm) {
        // If we have custom arms detected, use its world matrix with a slight forward offset!
        const bounds = activeCustomArm.getHierarchyBoundingVectors(true);
        const center = bounds.max.add(bounds.min).scale(0.5);
        // Offset slightly forward on Z dimension (local forward) based on mesh bounding size + custom coordinate offset
        const localMuzzle = new Vector3(
          this.customMuzzleOffsetX * (this.activeArmToggle ? 1 : -1), 
          this.customMuzzleOffsetY, 
          ((bounds.max.z - center.z) || 0.6) + this.customMuzzleOffsetZ
        );
        return Vector3.TransformCoordinates(localMuzzle, activeCustomArm.getWorldMatrix());
      } else {
        // High fidelity fallback: calculate left/right arm offsets dynamically by the custom model size
        const bounds = this.customModelNode.getHierarchyBoundingVectors(true);
        const halfWidth = (bounds.max.x - bounds.min.x) * 0.4 || 0.7;
        const height = (bounds.max.y + bounds.min.y) * 0.55 || 1.25;
        const sideOffset = (this.activeArmToggle ? halfWidth : -halfWidth) + (this.customMuzzleOffsetX * (this.activeArmToggle ? 1 : -1));
        // Position firing vector slightly forward in local root coordinates
        const localMuzzle = new Vector3(sideOffset, height + this.customMuzzleOffsetY, 0.9 + this.customMuzzleOffsetZ);
        return Vector3.TransformCoordinates(localMuzzle, this.rootNode.getWorldMatrix());
      }
    }

    const gunArm = this.activeArmToggle ? this.rightGunArm : this.leftGunArm;
    
    // Calculate global position of arm barrel
    const muzzleLocalPos = new Vector3(0, 0.7, 0);
    return Vector3.TransformCoordinates(muzzleLocalPos, gunArm.getWorldMatrix());
  }

  /**
   * Dash mechanic that pushes player forward
   */
  public executeDash(direction: Vector3): boolean {
    if (this.dashCooldownTimer > 0 || this.isDashing || this.en < 22) return false;

    this.en -= 22;
    this.isDashing = true;
    this.dashCooldownTimer = this.dashCooldownDuration; // Cooldown from abilities configuration
    
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
  public update(deltaTimeSeconds: number, input: PlayerInput, fx?: FXSystem, obstacles?: Mesh[]): void {
    // Process Souls-mech resource metrics
    this.timeSinceDamage += deltaTimeSeconds;
    
    // Shield/Armor regeneration
    if (this.timeSinceDamage > 3.5 && this.armor < this.maxArmor) {
      this.armor = Math.min(this.maxArmor, this.armor + deltaTimeSeconds * 15.0);
    }
    
    // EN regeneration
    if (this.en < this.maxEn) {
      this.en = Math.min(this.maxEn, this.en + deltaTimeSeconds * 25.0);
    }
    
    // Heat cooling decay
    if (this.isOverheated) {
      this.heat = Math.max(0, this.heat - deltaTimeSeconds * 28.0);
      if (this.heat <= 0) {
        this.isOverheated = false;
        console.log("[Combat Warning]: System cooled and stabilized!");
      }
    } else if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - deltaTimeSeconds * 20.0);
    }

    // 1. Process cooldown timers
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= deltaTimeSeconds;
    }

    // Process gameplay actions ticking
    if (this.currentAction) {
      this.currentAction.elapsed += deltaTimeSeconds;
      if (this.currentAction.elapsed >= this.currentAction.duration) {
        const completed = this.currentAction;
        this.currentAction = null;
        console.log(`[Action Complete]: Unified Action Completed: "${completed.name}"`);
        if (completed.onComplete) {
          completed.onComplete();
        }
      }
    }

    // Process status effects
    if (this.statusEffectRemainingTimer > 0) {
      this.statusEffectRemainingTimer -= deltaTimeSeconds;
      if (this.statusEffectRemainingTimer <= 0) {
        this.activeStatusEffect = null;
        console.log("[DataManager]: Status effect expired on character.");
      } else if (fx && this.activeStatusEffect) {
        // Periodically emit active color-themed particles
        if (Math.random() < 0.25) {
          const auraColor = this.activeStatusEffect.particleColor;
          const auraPos = this.rootNode.position.add(new Vector3(
            (Math.random() - 0.5) * 1.6,
            0.1 + Math.random() * 1.8,
            (Math.random() - 0.5) * 1.6
          ));
          fx.spawnBoosterTrail(auraPos, new Vector3(0, 0.4, 0), true);
        }
      }
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

    let activeSpeed = this.settings.speed;
    if (this.currentAction) {
      if (this.currentAction.type === "stance_change") {
        activeSpeed *= 0.15; // Stance transitions heavily restrict translation
      } else if (this.currentAction.type === "channel" || this.currentAction.type === "charge") {
        activeSpeed *= 0.35; // Channeling/charging heavy weapon actions slows movement
      }
    }
    if (this.activeStatusEffect && this.activeStatusEffect.modifiers && this.activeStatusEffect.modifiers.speedMult !== undefined) {
      activeSpeed *= this.activeStatusEffect.modifiers.speedMult;
    }

    if (this.isDashing) {
      // Dash burst speed
      const dashSpeed = this.settings.speed * this.dashSpeedMultiplier;
      this.velocity.copyFrom(this.dashDirection).scaleInPlace(dashSpeed);
    } else if (input.moveDirection.length() > 0) {
      // Responsive uniform translation
      this.velocity.copyFrom(input.moveDirection).scaleInPlace(activeSpeed);

      // Determine rotation heading (Angle between X and Z dimensions)
      this.targetRotation = Math.atan2(input.moveDirection.x, input.moveDirection.z);
    }

    // Apply movement delta
    const movementDelta = this.velocity.scale(deltaTimeSeconds);
    this.rootNode.position.addInPlace(movementDelta);

    // High fidelity sliding collision detection and resolution against physical obstacles
    if (obstacles && obstacles.length > 0) {
      // Scale collision radius to fit the custom mech visual chassis if loaded
      const playerRadius = this.customModelNode ? this.customCollisionRadius : 0.7; 
      const playerPos = this.rootNode.position;

      for (const obstacle of obstacles) {
        if (!obstacle || obstacle.isDisposed() || !obstacle.isEnabled()) continue;

        // Fast distance squared pre-filtering (ignore distant obstacles to maximize performance)
        const dx = obstacle.position.x - playerPos.x;
        const dz = obstacle.position.z - playerPos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > 15.0) continue; // Skip distant boxes immediately

        const boundingInfo = obstacle.getBoundingInfo();
        const bbox = boundingInfo.boundingBox;
        const min = bbox.minimumWorld;
        const max = bbox.maximumWorld;

        // Overlap limits for collision axes
        const playerMinX = playerPos.x - playerRadius;
        const playerMaxX = playerPos.x + playerRadius;
        const playerMinZ = playerPos.z - playerRadius;
        const playerMaxZ = playerPos.z + playerRadius;

        // Intersection check on all three dimensions (AABB Intersection)
        if (playerMaxX > min.x && playerMinX < max.x &&
            playerMaxZ > min.z && playerMinZ < max.z &&
            playerPos.y + 2.0 > min.y && playerPos.y < max.y) {
          
          // Calculate overlap penetration counts on X and Z axes
          const overlapX1 = playerMaxX - min.x; // penetration pushing left
          const overlapX2 = max.x - playerMinX; // penetration pushing right
          const overlapZ1 = playerMaxZ - min.z; // penetration pushing backward
          const overlapZ2 = max.z - playerMinZ; // penetration pushing forward

          const minOverlapX = Math.min(overlapX1, overlapX2);
          const minOverlapZ = Math.min(overlapZ1, overlapZ2);

          // Resolve collision along the axis of shallowest penetration depth (creates smooth sliding!)
          if (minOverlapX < minOverlapZ) {
            if (overlapX1 < overlapX2) {
              playerPos.x -= overlapX1;
            } else {
              playerPos.x += overlapX2;
            }
          } else {
            if (overlapZ1 < overlapZ2) {
              playerPos.z -= overlapZ1;
            } else {
              playerPos.z += overlapZ2;
            }
          }
        }
      }
    }

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

    // Determine Torso facing direction (independent of movement)
    let targetFacingY = this.currentRotation;
    if (this.aimPoint) {
      const dir = this.aimPoint.subtract(this.rootNode.position);
      dir.y = 0;
      if (dir.length() > 0.1) {
        targetFacingY = Math.atan2(dir.x, dir.z);
      }
    }
    
    const diffFacing = targetFacingY - this.currentRotation;
    const wrappedDiffFacing = Math.atan2(Math.sin(diffFacing), Math.cos(diffFacing));

    if (this.torsoAssembly) {
      // Smoothly rotate torso assembly towards independent aiming direction
      const torsoRotStep = 8.0 * deltaTimeSeconds;
      let diffTorso = wrappedDiffFacing - this.torsoAssembly.rotation.y;
      let wrappedDiffTorso = Math.atan2(Math.sin(diffTorso), Math.cos(diffTorso));
      this.torsoAssembly.rotation.y += Math.max(-torsoRotStep, Math.min(torsoRotStep, wrappedDiffTorso));
    }

    // Add high-fidelity dynamic floating bobbing and tilting animations for custom mech models
    if (this.customModelNode) {
      // Hovering bobbing float on y-axis (adds beautiful metallic floating feeling)
      const bobbingFactor = Math.sin(this.pulseTimer * this.customBobbingSpeed) * this.customBobbingHeight; 
      
      // Pitch/roll tilting when moving
      let tiltPitch = 0;
      let tiltRoll = 0;
      const isMoving = input.moveDirection.length() > 0;
      if (isMoving) {
        // Tilt slightly forward in movement direction (relative to localized facing)
        tiltPitch = this.customTiltPitch;
        // Subtle swaying roll oscillation
        tiltRoll = Math.sin(this.pulseTimer * 1.5 * this.customBobbingSpeed) * this.customSwayRoll;
      } else if (this.isDashing) {
        // High speed forward tilt
        tiltPitch = this.customTiltPitch * 2.0;
      }
      
      // Position includes the baseline height offset + custom offset + dynamic vertical float
      this.customModelNode.position.set(
        this.baseOffsetPos.x + this.customOffsetX,
        this.baseOffsetPos.y + this.customOffsetY + bobbingFactor,
        this.baseOffsetPos.z + this.customOffsetZ
      );
      
      // Rotation combining the custom Y offset + yaw sway + pitch tilt + decoupled facing diff
      const finalYRot = this.customRotationYOffset + tiltRoll + wrappedDiffFacing;
      if (this.originalBaseQuaternion) {
        const extraRot = Quaternion.RotationYawPitchRoll(finalYRot, tiltPitch, 0);
        this.customModelNode.rotationQuaternion = this.originalBaseQuaternion.multiply(extraRot);
      } else {
        this.customModelNode.rotation.set(
          this.originalBaseRotation.x + tiltPitch,
          this.originalBaseRotation.y + finalYRot,
          this.originalBaseRotation.z
        );
      }
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

  public setAimPoint(point: Vector3 | null): void {
    this.aimPoint = point;
  }

  public takeDamage(amount: number): void {
    this.timeSinceDamage = 0;
    this.triggerImpactFlash();
    
    // 1. Parry Check: 100% damage deflection
    if (this.currentAction && this.currentAction.id === "parry_action") {
      console.log("[Parry Triggered]: Successful parry! Deflected all incoming damage.");
      this.currentAction = null; // Consume parry frame commitment
      return;
    }

    // 2. Shield Block Check: 80% damage reduction
    if (this.currentAction && this.currentAction.id === "aegis_block") {
      const blockedAmount = amount * 0.2;
      console.log(`[Shield Block]: Aegis Barrier absorbed damage! Reduced ${amount.toFixed(0)} to ${blockedAmount.toFixed(0)}`);
      amount = blockedAmount;
    }
    
    // Shield/Armor absorbs 100% of the damage if active
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    
    if (amount > 0) {
      this.hp = Math.max(0, this.hp - amount);
    }
  }

  public increaseHeat(amount: number): boolean {
    if (this.isOverheated) return true;
    this.heat = Math.min(this.maxHeat, this.heat + amount);
    if (this.heat >= this.maxHeat) {
      this.isOverheated = true;
      console.log("[Combat Warning]: System OVERHEAT! Weapons lock is active!");
    }
    return this.isOverheated;
  }

  public getDashCooldownProgress(): number {
    return Math.max(0, this.dashCooldownTimer);
  }

  public applyStatusEffect(effect: any): void {
    this.activeStatusEffect = effect;
    this.statusEffectRemainingTimer = effect.duration;
    console.log(`[Player]: Status effect ${effect.name} applied for ${effect.duration}s!`);
    
    // Impact flash
    this.triggerImpactFlash();
  }

  public getActiveStatusEffect(): any {
    return this.activeStatusEffect;
  }

  public getStatusEffectRemaining(): number {
    return Math.max(0, this.statusEffectRemainingTimer);
  }

  public updateDashConfig(cooldown: number, speedMultiplier: number): void {
    this.dashCooldownDuration = cooldown;
    this.dashSpeedMultiplier = speedMultiplier;
  }
}
