/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
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
import { CombatEntityState, HitReactionTier, StatusEffectType, ActionState } from "../combat/CombatTypes";
import { CombatEngine } from "../combat/CombatEngine";
import { COMBAT_TUNABLES, COMBAT_ACTIONS } from "../combat/CombatConfig";

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

  // Unified combat state
  public combatState!: CombatEntityState;

  // Souls Mech resources & stats (Getters/Setters routing through combatState to ensure 100% single source of truth)
  public get hp(): number { return this.combatState?.hp ?? 1000; }
  public set hp(val: number) { if (this.combatState) this.combatState.hp = val; }

  public get maxHp(): number { return this.combatState?.maxHp ?? 1000; }
  public set maxHp(val: number) { if (this.combatState) this.combatState.maxHp = val; }

  public get en(): number { return this.combatState?.en ?? 100; }
  public set en(val: number) { if (this.combatState) this.combatState.en = val; }

  public get maxEn(): number { return this.combatState?.maxEn ?? 100; }
  public set maxEn(val: number) { if (this.combatState) this.combatState.maxEn = val; }

  public get heat(): number { return this.combatState?.heat ?? 0; }
  public set heat(val: number) { if (this.combatState) this.combatState.heat = val; }

  public get maxHeat(): number { return this.combatState?.maxHeat ?? 100; }
  public set maxHeat(val: number) { if (this.combatState) this.combatState.maxHeat = val; }

  public get armor(): number { return this.combatState?.armor ?? 200; }
  public set armor(val: number) { if (this.combatState) this.combatState.armor = val; }

  public get maxArmor(): number { return this.combatState?.maxArmor ?? 200; }
  public set maxArmor(val: number) { if (this.combatState) this.combatState.maxArmor = val; }

  public get isOverheated(): boolean { return this.combatState?.isOverheated ?? false; }
  public set isOverheated(val: boolean) { if (this.combatState) this.combatState.isOverheated = val; }

  public get timeSinceDamage(): number { return this.combatState?.timeSinceDamage ?? 0; }
  public set timeSinceDamage(val: number) { if (this.combatState) this.combatState.timeSinceDamage = val; }

  // Unified Action-State Framework
  public currentAction: GameplayAction | null = null;
  public stance: "standard" | "powerstance" = "standard";

  public triggerAction(action: GameplayAction): boolean {
    if (this.currentAction) {
      const cAct = this.combatState.currentAction;
      const isCommittedPhase = this.combatState.actionState === ActionState.STARTUP || this.combatState.actionState === ActionState.ACTIVE;
      if (isCommittedPhase && cAct && cAct.allowCancel === false && !this.currentAction.cancelable) {
        console.log(`[Action Warning]: Cannot execute "${action.name}" during committed "${cAct.name}"`);
        return false;
      }
      this.cancelCurrentAction();
    }

    if ((action.type as string) === "skill" && CombatEngine.isActionRestricted(this.combatState, "no_skills")) {
      console.log(`[Action Warning]: Cannot use skills while SILENCED!`);
      return false;
    }
    if (((action.type as string) === "attack" || (action.type as string) === "charge" || (action.type as string) === "channel") && CombatEngine.isActionRestricted(this.combatState, "no_attacks")) {
      console.log(`[Action Warning]: Cannot attack while DISARMED!`);
      return false;
    }

    this.currentAction = { ...action, elapsed: 0, effectsTriggered: false } as any;
    
    const combatAction = COMBAT_ACTIONS[action.id] || {
      id: action.id,
      name: action.name,
      startup: 0,
      active: action.duration,
      recovery: 0,
      cancelable: action.cancelable,
      poiseValue: 20
    };
    
    this.combatState.currentAction = combatAction;
    if (combatAction.startup > 0) {
      this.combatState.actionState = ActionState.STARTUP;
      this.combatState.actionPhaseTimer = combatAction.startup;
    } else {
      this.combatState.actionState = ActionState.ACTIVE;
      this.combatState.actionPhaseTimer = combatAction.active;
    }

    // Pay action costs immediately upon initiation (EN and Heat)
    if (combatAction.enCost) {
      this.combatState.en = Math.max(0, this.combatState.en - combatAction.enCost);
    }
    if (combatAction.heatCost) {
      this.combatState.heat = Math.min(this.combatState.maxHeat, this.combatState.heat + combatAction.heatCost);
    }

    console.log(`[Action State]: Started action "${action.name}" (${action.type}). State: ${this.combatState.actionState}, Phase Timer: ${this.combatState.actionPhaseTimer}s`);
    return true;
  }

  public cancelCurrentAction(): boolean {
    if (this.currentAction) {
      const cAct = this.combatState.currentAction;
      if (cAct && cAct.allowCancel === false && !this.currentAction.cancelable) {
        console.log(`[Action Warning]: Action "${this.currentAction.name}" has animation commitment and cannot be canceled!`);
        return false;
      }
      console.log(`[Action Cancel]: Interrupted running action "${this.currentAction.name}" successfully.`);
      this.currentAction.onCancel?.();
      this.currentAction = null;
      
      // Sync combat state cancel
      this.combatState.actionState = ActionState.NEUTRAL;
      this.combatState.currentAction = null;
      this.combatState.actionPhaseTimer = 0;
      return true;
    }
    return false;
  }

  // Aiming position (independent facing)
  private aimPoint: Vector3 | null = null;

  // Lists for custom meshes detected on user uploaded warrior models
  private customFrameUpper: TransformNode | null = null;
  private customFrameLower: TransformNode | null = null;
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

  // Decoupled base transforms right after setParent mapping
  private decoupledFrameUpperBasePosition = new Vector3(0, 0, 0);
  private decoupledFrameUpperBaseRotation = new Vector3(0, 0, 0);
  private decoupledFrameUpperBaseQuaternion: Quaternion | null = null;
  private decoupledFrameUpperBaseScaling = new Vector3(1, 1, 1);

  private decoupledFrameLowerBasePosition = new Vector3(0, 0, 0);
  private decoupledFrameLowerBaseRotation = new Vector3(0, 0, 0);
  private decoupledFrameLowerBaseQuaternion: Quaternion | null = null;
  private decoupledFrameLowerBaseScaling = new Vector3(1, 1, 1);
  
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

  // Active Refracting Shield properties
  public shieldRefractionMultiplier: number = 1.35;
  public refractiveShieldBubble: Mesh | null = null;

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

    // Initialize core combat state variables
    this.combatState = CombatEngine.createDefaultCombatState(true);

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
    this.torsoAssembly.parent = this.rootNode;

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

    // High fidelity glass refraction shield layer mounting
    const shieldMat = new PBRMaterial("refractiveShieldMat", this.scene);
    shieldMat.linkRefractionWithTransparency = true;
    shieldMat.indexOfRefraction = this.shieldRefractionMultiplier;
    shieldMat.alpha = 0.35;
    shieldMat.microSurface = 0.85;
    shieldMat.albedoColor = new Color3(0.0, 0.95, 1.0); // Neon cyan energetical core
    shieldMat.emissiveColor = new Color3(0.0, 0.35, 0.5); // Emissive glowing energy boundaries
    shieldMat.reflectivityColor = new Color3(0.12, 0.12, 0.12);

    this.refractiveShieldBubble = MeshBuilder.CreateSphere("refractiveShieldBubble", { diameter: 3.2, segments: 24 }, this.scene);
    this.refractiveShieldBubble.position.set(0, 1.6, 0);
    this.refractiveShieldBubble.material = shieldMat;
    this.refractiveShieldBubble.parent = this.torsoAssembly;
    this.refractiveShieldBubble.setEnabled(false); // Hidden by default until activated
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
      if (this.customFrameUpper) {
        this.customFrameUpper.dispose();
        this.customFrameUpper = null;
      }
      if (this.customFrameLower) {
        this.customFrameLower.dispose();
        this.customFrameLower = null;
      }
    }

    // Toggle procedural children count on decoupled assembly safely
    if (this.torsoAssembly) {
      this.torsoAssembly.getChildren().forEach(child => {
        if (child !== this.customFrameUpper) {
          if (child instanceof TransformNode || child instanceof Mesh) {
            child.setEnabled(!hide);
          }
        }
      });
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
    if (this.customFrameUpper) {
      this.customFrameUpper.dispose();
      this.customFrameUpper = null;
    }
    if (this.customFrameLower) {
      this.customFrameLower.dispose();
      this.customFrameLower = null;
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

    // Scan recursively for frame_upper and frame_lower separation
    let frameUpper: TransformNode | null = null;
    let frameLower: TransformNode | null = null;

    const findFrames = (n: any) => {
      if (!n) return;
      const nameLower = n.name ? n.name.toLowerCase() : "";
      if (nameLower.includes("frame_upper")) {
        frameUpper = n;
      } else if (nameLower.includes("frame_lower")) {
        frameLower = n;
      }
      const children = n.getChildren ? n.getChildren() : [];
      for (const child of children) {
        findFrames(child);
      }
    };
    findFrames(node);

    if (frameUpper && frameLower) {
      console.log(`[Asset Integration]: Decoupling modular mech frame_upper and frame_lower...`);
      this.customFrameUpper = frameUpper;
      this.customFrameLower = frameLower;

      this.customFrameUpper.setParent(this.torsoAssembly);
      this.customFrameLower.setParent(this.rootNode);

      // Capture and store the perfect relative local base transforms derived by setParent
      this.decoupledFrameUpperBasePosition.copyFrom(this.customFrameUpper.position);
      this.decoupledFrameUpperBaseScaling.copyFrom(this.customFrameUpper.scaling);
      if (this.customFrameUpper.rotationQuaternion) {
        this.decoupledFrameUpperBaseQuaternion = this.customFrameUpper.rotationQuaternion.clone();
      } else {
        this.decoupledFrameUpperBaseRotation.copyFrom(this.customFrameUpper.rotation);
        this.decoupledFrameUpperBaseQuaternion = null;
      }

      this.decoupledFrameLowerBasePosition.copyFrom(this.customFrameLower.position);
      this.decoupledFrameLowerBaseScaling.copyFrom(this.customFrameLower.scaling);
      if (this.customFrameLower.rotationQuaternion) {
        this.decoupledFrameLowerBaseQuaternion = this.customFrameLower.rotationQuaternion.clone();
      } else {
        this.decoupledFrameLowerBaseRotation.copyFrom(this.customFrameLower.rotation);
        this.decoupledFrameLowerBaseQuaternion = null;
      }

      // Now apply initial positioning, scaling and rotations based on these accurate base transforms
      const finalFactor = this.autoScaleFactor * this.customScaleMultiplier;
      const rawOffsetHeight = -bounds.min.y;

      this.customFrameUpper.position.set(
        (this.decoupledFrameUpperBasePosition.x + this.customOffsetX) * finalFactor,
        (this.decoupledFrameUpperBasePosition.y + rawOffsetHeight + this.customOffsetY) * finalFactor,
        (this.decoupledFrameUpperBasePosition.z + this.customOffsetZ) * finalFactor
      );
      this.customFrameLower.position.set(
        (this.decoupledFrameLowerBasePosition.x + this.customOffsetX) * finalFactor,
        (this.decoupledFrameLowerBasePosition.y + rawOffsetHeight + this.customOffsetY) * finalFactor,
        (this.decoupledFrameLowerBasePosition.z + this.customOffsetZ) * finalFactor
      );

      this.customFrameUpper.scaling.set(
        this.decoupledFrameUpperBaseScaling.x * finalFactor,
        this.decoupledFrameUpperBaseScaling.y * finalFactor,
        this.decoupledFrameUpperBaseScaling.z * finalFactor
      );
      this.customFrameLower.scaling.set(
        this.decoupledFrameLowerBaseScaling.x * finalFactor,
        this.decoupledFrameLowerBaseScaling.y * finalFactor,
        this.decoupledFrameLowerBaseScaling.z * finalFactor
      );

      // Maintain GLB upright mapping plus custom Y rotation
      const extraRot = Quaternion.RotationYawPitchRoll(this.customRotationYOffset, 0, 0);
      if (this.decoupledFrameUpperBaseQuaternion) {
        this.customFrameUpper.rotationQuaternion = this.decoupledFrameUpperBaseQuaternion.multiply(extraRot);
      } else {
        this.customFrameUpper.rotationQuaternion = null;
        this.customFrameUpper.rotation.set(
          this.decoupledFrameUpperBaseRotation.x,
          this.decoupledFrameUpperBaseRotation.y + this.customRotationYOffset,
          this.decoupledFrameUpperBaseRotation.z
        );
      }

      if (this.decoupledFrameLowerBaseQuaternion) {
        this.customFrameLower.rotationQuaternion = this.decoupledFrameLowerBaseQuaternion.multiply(extraRot);
      } else {
        this.customFrameLower.rotationQuaternion = null;
        this.customFrameLower.rotation.set(
          this.decoupledFrameLowerBaseRotation.x,
          this.decoupledFrameLowerBaseRotation.y + this.customRotationYOffset,
          this.decoupledFrameLowerBaseRotation.z
        );
      }

      // We disable the imported root node representation so only decoupled components are rendered
      this.customModelNode.setEnabled(false);
    } else {
      this.applyCustomModelTransforms();
    }

    // Trigger socket discovery scan on the newly loaded custom model (register under root entity)
    this.socketManager.discoverSockets(this.rootNode);

    // Reset lists of special custom meshes before scanning
    this.customEyeGlowMeshes = [];
    this.customBoosterMeshes = [];
    this.customDashBoosterMeshes = [];
    this.customLeftGunArm = null;
    this.customRightGunArm = null;

    // Detect character theme color from model's emissive features (e.g. eyes/glow/visors)
    let detectedThemeColor: Color3 | null = null;

    const scanThemeAndMeshes = (n: any) => {
      if (!n) return;
      if (n instanceof Mesh) {
        const mesh = n;
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
      }
      const children = n.getChildren ? n.getChildren() : [];
      for (const child of children) {
        scanThemeAndMeshes(child);
      }
    };
    scanThemeAndMeshes(node);

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

    const setupMeshesAndShadows = (n: any) => {
      if (!n) return;
      if (n instanceof Mesh) {
        const mesh = n;
        mesh.receiveShadows = true;
        const meshName = mesh.name.toLowerCase();
        let isSpecialMesh = false;

        // Scan for weapon/arm/gun components based on naming
        if (meshName.includes("left") && (meshName.includes("gun") || meshName.includes("arm") || meshName.includes("weapon") || meshName.includes("barrel") || meshName.includes("muzzle") || meshName.includes("cannon") || meshName.includes("laser") || meshName.includes("shooter"))) {
          this.customLeftGunArm = mesh;
        } else if (meshName.includes("right") && (meshName.includes("gun") || meshName.includes("arm") || meshName.includes("weapon") || meshName.includes("barrel") || meshName.includes("muzzle") || meshName.includes("cannon") || meshName.includes("laser") || meshName.includes("shooter"))) {
          this.customRightGunArm = mesh;
        }

        if (meshName.includes("eyeglow") || (meshName.includes("eye") && meshName.includes("glow"))) {
          this.customEyeGlowMeshes.push(mesh);
          this.applyGlowColor(mesh, this.activeThemeColor);
          mesh.setEnabled(true);
          mesh.visibility = 1.0;
          isSpecialMesh = true;
        } else if (meshName.includes("dash") && (meshName.includes("thruster") || meshName.includes("booster") || meshName.includes("jet") || meshName.includes("effect"))) {
          this.customDashBoosterMeshes.push(mesh);
          this.applyGlowColor(mesh, new Color3(1.0, 0.35, 0.0).add(this.activeThemeColor).scale(0.5));
          mesh.setEnabled(false); // Hide dash specific boosters initially
          mesh.visibility = 1.0;
          isSpecialMesh = true;
        } else if (meshName.includes("booster") || meshName.includes("thruster") || meshName.includes("jet")) {
          this.customBoosterMeshes.push(mesh);
          this.applyGlowColor(mesh, this.activeThemeColor);
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
      }

      const children = n.getChildren ? n.getChildren() : [];
      for (const child of children) {
        setupMeshesAndShadows(child);
      }
    };
    setupMeshesAndShadows(node);

    // Fallback search by relative side-coordinates if some arm meshes were found without left/right naming
    if (!this.customLeftGunArm || !this.customRightGunArm) {
      const scanCoords = (n: any) => {
        if (!n) return;
        if (n instanceof Mesh) {
          const meshName = n.name.toLowerCase();
          if (meshName.includes("gun") || meshName.includes("weapon") || meshName.includes("barrel") || meshName.includes("muzzle") || meshName.includes("cannon") || meshName.includes("laser") || meshName.includes("shooter")) {
            n.computeWorldMatrix(true);
            const localPos = Vector3.TransformCoordinates(n.getAbsolutePosition(), node.getWorldMatrix().clone().invert());
            if (localPos.x < -0.15) {
              if (!this.customLeftGunArm) this.customLeftGunArm = n;
            } else if (localPos.x > 0.15) {
              if (!this.customRightGunArm) this.customRightGunArm = n;
            }
          }
        }
        const children = n.getChildren ? n.getChildren() : [];
        for (const child of children) {
          scanCoords(child);
        }
      };
      scanCoords(node);
    }

    // Enforce initial loadout visibilities
    this.updateEquipmentVisibility("pulse_cannon");
  }

  /**
   * Scans socket subtrees and renders only the currently equipped weapons, aux, etc.
   */
  public updateEquipmentVisibility(equippedWeaponId: string): void {
    if (!this.customModelNode) return;

    // Default equipped weapon variant name from the mech kit
    let activeWeaponName = "weapon_gatling_brushcutter";
    if (equippedWeaponId.toLowerCase().includes("pulse") || equippedWeaponId.toLowerCase().includes("vortex") || equippedWeaponId.toLowerCase().includes("lance")) {
      activeWeaponName = "weapon_rifle_gladius";
    }

    const showItem = (lower: string): boolean => {
      // Standard chassis features are always shown
      if (lower.startsWith("warrior_core_front") || 
          lower.startsWith("warrior_core_rear") || 
          lower.startsWith("warrior_helm") || 
          lower.startsWith("warrior_arm_01") || 
          lower.startsWith("warrior_arm_02") || 
          lower.startsWith("warrior_waist") || 
          lower.startsWith("warrior_leg_01") || 
          lower.startsWith("warrior_leg_02") ||
          lower.startsWith("warrior_aux_01") ||
          lower.startsWith("warrior_aux_02") ||
          lower.startsWith("warrior_aux_03") ||
          lower.startsWith("warrior_aux_04")) {
        return true;
      }

      // Handle weapon options swapping
      if (lower.startsWith("weapon_rifle_gladius")) {
        return activeWeaponName === "weapon_rifle_gladius";
      }
      if (lower.startsWith("weapon_gatling_brushcutter")) {
        return activeWeaponName === "weapon_gatling_brushcutter";
      }

      // Auxiliary weapons and launchers
      if (lower.startsWith("pilum_01")) {
        return true; // render equipped launcher
      }
      if (lower.startsWith("aux_02_launcher_mauler")) {
        return true; // render equipped auxiliary launcher
      }

      // Melee options
      if (lower.startsWith("melee_siegebreaker")) {
        return true; // render cool melee back-mount piece
      }
      if (lower.startsWith("melee_khopesh")) {
        return false;
      }

      return true;
    };

    const applyVisibility = (n: any) => {
      if (!n) return;
      if (n instanceof Mesh) {
        const lowerName = n.name.toLowerCase();
        const shouldShow = showItem(lowerName);
        n.setEnabled(shouldShow);
        n.visibility = shouldShow ? 1.0 : 0.0;
      }
      const children = n.getChildren ? n.getChildren() : [];
      for (const child of children) {
        applyVisibility(child);
      }
    };

    // Apply visibility overrides across root and decouple assemblies
    applyVisibility(this.customModelNode);
    if (this.customFrameUpper) applyVisibility(this.customFrameUpper);
    if (this.customFrameLower) applyVisibility(this.customFrameLower);
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
    if (this.combatState.currentAction && this.combatState.currentAction.allowDash === false) {
      console.log(`[Dash Blocked]: Cannot dash during committed action "${this.combatState.currentAction.name}"`);
      return false;
    }

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
    // Process Combat Core dynamic metrics
    CombatEngine.updateCombatState(this.combatState, deltaTimeSeconds, (ov) => {
      this.isOverheated = ov;
    });

    // Unified combat getters/setters keep these redundant copies synchronized safely 
    this.hp = this.combatState.hp;
    this.maxHp = this.combatState.maxHp;
    this.en = this.combatState.en;
    this.maxEn = this.combatState.maxEn;
    this.heat = this.combatState.heat;
    this.maxHeat = this.combatState.maxHeat;
    this.armor = this.combatState.armor;
    this.maxArmor = this.combatState.maxArmor;
    this.isOverheated = this.combatState.isOverheated;
    this.timeSinceDamage = this.combatState.timeSinceDamage;

    // Check if combat action needs to trigger active phase effects or complete
    if (this.currentAction) {
      const cs = this.combatState;
      
      // If we are in ACTIVE or RECOVERY phase, and have not triggered physical action effects yet, run onComplete!
      const isEffPhase = cs.actionState === ActionState.ACTIVE || cs.actionState === ActionState.RECOVERY;
      const isComStage = cs.currentAction;
      
      if (isEffPhase && isComStage && !(this.currentAction as any).effectsTriggered) {
        (this.currentAction as any).effectsTriggered = true;
        console.log(`[Action Physical Run]: Triggering effects for "${this.currentAction.name}"`);
        if (this.currentAction.onComplete) {
          this.currentAction.onComplete();
        }
      }

      if (cs.currentAction === null) {
        // Complete current action
        const completed = this.currentAction;
        this.currentAction = null;
        console.log(`[Combat State Sync]: Action Completed or Interrupted: "${completed.name}"`);
      } else {
        // Determine total elapsed time based on our discrete startup / active / recovery timers
        const actionConf = cs.currentAction;
        let totalElapsed = 0;
        if (cs.actionState === ActionState.STARTUP) {
          totalElapsed = actionConf.startup - cs.actionPhaseTimer;
        } else if (cs.actionState === ActionState.ACTIVE) {
          totalElapsed = actionConf.startup + (actionConf.active - cs.actionPhaseTimer);
        } else if (cs.actionState === ActionState.RECOVERY) {
          totalElapsed = actionConf.startup + actionConf.active + (actionConf.recovery - cs.actionPhaseTimer);
        }
        this.currentAction.elapsed = totalElapsed;
      }
    }

    // 1.5. Dynamic Refracting Shield Visual Updates
    if (this.currentAction && this.currentAction.id === "aegis_block") {
      this.refractiveShieldBubble?.setEnabled(true);
      if (this.refractiveShieldBubble) {
        const time = this.currentAction.elapsed || 0;
        const scalePulse = 1.0 + Math.sin(time * 12) * 0.05;
        this.refractiveShieldBubble.scaling.set(scalePulse, scalePulse, scalePulse);
        
        const mat = this.refractiveShieldBubble.material as PBRMaterial;
        if (mat) {
          const glowOsc = 0.35 + Math.sin(time * 8) * 0.1;
          mat.emissiveColor.set(0.0, glowOsc, glowOsc * 1.5);
          
          // Shimmer Index of Refraction matching the configured UI multiplier
          mat.indexOfRefraction = this.shieldRefractionMultiplier + Math.sin(time * 6) * 0.05;
        }
      }
    } else {
      this.refractiveShieldBubble?.setEnabled(false);
    }

    // 1. Process cooldown timers
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= deltaTimeSeconds;
    }

    // Process status effects timers and UI synchronization
    if (this.combatState.activeEffects.length > 0) {
      this.activeStatusEffect = this.combatState.activeEffects[0];
      this.statusEffectRemainingTimer = this.activeStatusEffect.duration;
      
      if (fx) {
        // Periodically emit active color-themed particles
        if (Math.random() < 0.25) {
          // Color based on active status effect type
          let auraColor = new Color3(0, 0.94, 1.0);
          switch(this.activeStatusEffect.type) {
            case StatusEffectType.BURN:
              auraColor = new Color3(1.0, 0.3, 0.0);
              break;
            case StatusEffectType.SHOCK:
              auraColor = new Color3(0.9, 0.9, 0.1);
              break;
            case StatusEffectType.CORRUPTION:
              auraColor = new Color3(0.5, 0.0, 0.8);
              break;
            case StatusEffectType.BLEED:
              auraColor = new Color3(0.8, 0.0, 0.0);
              break;
            case StatusEffectType.SLOW:
              auraColor = new Color3(0.3, 0.3, 0.5);
              break;
          }
          const auraPos = this.rootNode.position.add(new Vector3(
            (Math.random() - 0.5) * 1.6,
            0.1 + Math.random() * 1.8,
            (Math.random() - 0.5) * 1.6
          ));
          fx.spawnHitImpact(auraPos);
        }
      }
    } else {
      this.activeStatusEffect = null;
      this.statusEffectRemainingTimer = 0;
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
    
    // Apply status effect and overheat speed multipliers from the Combat Engine
    activeSpeed *= CombatEngine.getSpeedMultiplier(this.combatState);

    // Apply action commitment restrictions directly (lockMovement or reduceMovement)
    if (this.combatState.currentAction) {
      const activeAction = this.combatState.currentAction;
      if (activeAction.lockMovement) {
        activeSpeed = 0;
      } else if (activeAction.reduceMovement) {
        activeSpeed *= 0.5;
      }
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

    const lockFacing = this.combatState.currentAction?.lockFacing || false;
    const isLockedOn = this.combatState.lockState === "Locked" || this.combatState.lockState === "Acquiring";

    // 4. Smooth snap rotation orientation (no sluggish inertia, but pleasant interpolation)
    if ((input.moveDirection.length() > 0 || this.isDashing || isLockedOn) && !lockFacing) {
      let activeTargetRot = this.targetRotation;
      // If target locked, orient towards the locked target
      if (isLockedOn && this.aimPoint) {
        const toAim = this.aimPoint.subtract(this.rootNode.position);
        toAim.y = 0;
        if (toAim.length() > 0.1) {
          activeTargetRot = Math.atan2(toAim.x, toAim.z);
        }
      }

      // Interpolate angles over frames
      const diff = activeTargetRot - this.currentRotation;
      
      // Handle floating point wrapping (-PI to PI)
      let wrappedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
      
      const rotStep = this.settings.rotationSpeed * (deltaTimeSeconds * 60);
      this.currentRotation += Math.max(-rotStep, Math.min(rotStep, wrappedDiff));
      
      this.rootNode.rotation.y = this.currentRotation;
    }

    // Determine Torso facing direction (independent of movement)
    let targetFacingY = this.currentRotation;
    if (this.aimPoint && !lockFacing) {
      const dir = this.aimPoint.subtract(this.rootNode.position);
      dir.y = 0;
      if (dir.length() > 0.1) {
        targetFacingY = Math.atan2(dir.x, dir.z);
      }
    }
    
    const diffFacing = targetFacingY - this.currentRotation;
    const wrappedDiffFacing = Math.atan2(Math.sin(diffFacing), Math.cos(diffFacing));

    if (this.torsoAssembly && !lockFacing) {
      // Smoothly rotate torso assembly towards independent aiming direction
      const torsoRotStep = 8.0 * deltaTimeSeconds;
      let diffTorso = wrappedDiffFacing - this.torsoAssembly.rotation.y;
      let wrappedDiffTorso = Math.atan2(Math.sin(diffTorso), Math.cos(diffTorso));
      this.torsoAssembly.rotation.y += Math.max(-torsoRotStep, Math.min(torsoRotStep, wrappedDiffTorso));
    }

    // Add high-fidelity dynamic floating bobbing and tilting animations for custom mech models
    if (this.customFrameUpper && this.customFrameLower) {
      const finalFactor = this.autoScaleFactor * this.customScaleMultiplier;
      const rawOffsetHeight = this.autoScaleFactor > 0.01 ? (this.baseOffsetPos.y / this.autoScaleFactor) : 0.0;
      
      this.customFrameUpper.scaling.set(
        this.decoupledFrameUpperBaseScaling.x * finalFactor,
        this.decoupledFrameUpperBaseScaling.y * finalFactor,
        this.decoupledFrameUpperBaseScaling.z * finalFactor
      );
      this.customFrameLower.scaling.set(
        this.decoupledFrameLowerBaseScaling.x * finalFactor,
        this.decoupledFrameLowerBaseScaling.y * finalFactor,
        this.decoupledFrameLowerBaseScaling.z * finalFactor
      );

      // Hovering vertical float bob for lower body
      const bobbingFactor = Math.sin(this.pulseTimer * this.customBobbingSpeed) * this.customBobbingHeight;
      this.customFrameLower.position.set(
        (this.decoupledFrameLowerBasePosition.x + this.customOffsetX) * finalFactor,
        (this.decoupledFrameLowerBasePosition.y + rawOffsetHeight + this.customOffsetY) * finalFactor + bobbingFactor,
        (this.decoupledFrameLowerBasePosition.z + this.customOffsetZ) * finalFactor
      );

      // Tilting pitches and roll sways for upper body
      let tiltPitch = 0;
      let tiltRoll = 0;
      const isMoving = input.moveDirection.length() > 0;
      if (isMoving) {
        tiltPitch = this.customTiltPitch;
        tiltRoll = Math.sin(this.pulseTimer * 1.5 * this.customBobbingSpeed) * this.customSwayRoll;
      } else if (this.isDashing) {
        tiltPitch = this.customTiltPitch * 2.0;
      }

      this.customFrameUpper.position.set(
        (this.decoupledFrameUpperBasePosition.x + this.customOffsetX) * finalFactor,
        (this.decoupledFrameUpperBasePosition.y + rawOffsetHeight + this.customOffsetY) * finalFactor + bobbingFactor * 0.5,
        (this.decoupledFrameUpperBasePosition.z + this.customOffsetZ) * finalFactor
      );

      // Rotation for lower body Frame (combining original GLB mapping + custom slider offsets)
      const extraRotLower = Quaternion.RotationYawPitchRoll(this.customRotationYOffset, 0, 0);
      if (this.decoupledFrameLowerBaseQuaternion) {
        this.customFrameLower.rotationQuaternion = this.decoupledFrameLowerBaseQuaternion.multiply(extraRotLower);
      } else {
        this.customFrameLower.rotationQuaternion = null;
        this.customFrameLower.rotation.set(
          this.decoupledFrameLowerBaseRotation.x,
          this.decoupledFrameLowerBaseRotation.y + this.customRotationYOffset,
          this.decoupledFrameLowerBaseRotation.z
        );
      }

      // Rotation for upper body Frame (combining original GLB mapping + custom slider offsets + dynamic pitch/roll sways)
      const extraRotUpper = Quaternion.RotationYawPitchRoll(this.customRotationYOffset, tiltPitch, tiltRoll);
      if (this.decoupledFrameUpperBaseQuaternion) {
        this.customFrameUpper.rotationQuaternion = this.decoupledFrameUpperBaseQuaternion.multiply(extraRotUpper);
      } else {
        this.customFrameUpper.rotationQuaternion = null;
        this.customFrameUpper.rotation.set(
          this.decoupledFrameUpperBaseRotation.x + tiltPitch,
          this.decoupledFrameUpperBaseRotation.y + this.customRotationYOffset + tiltRoll,
          this.decoupledFrameUpperBaseRotation.z
        );
      }
    } else if (this.customModelNode) {
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
    // Delegate to standard high-fidelity coordinate-based combat resolution pipeline
    this.takeDamageFromPosition(amount, amount * 0.5, this.getPosition().add(new Vector3(0, 0, 2)));
  }

  public takeDamageFromPosition(amount: number, impact: number, attackerPos: Vector3): void {
    this.triggerImpactFlash();
    
    // 1. Parry Check: 100% damage deflection
    if (this.currentAction && this.currentAction.id === "parry_action") {
      console.log("[Parry Triggered]: Successful parry! Deflected all incoming damage.");
      this.currentAction = null; // Consume parry frame commitment
      this.combatState.currentAction = null;
      this.combatState.actionState = ActionState.NEUTRAL;
      return;
    }

    // 2. Resolve via standard combat pipeline
    const mockAttackerState = CombatEngine.createDefaultCombatState(false);
    
    const result = CombatEngine.resolveDamagePipeline(
      mockAttackerState,
      attackerPos,
      this.combatState,
      this.getPosition(),
      this.rootNode.rotation.y,
      amount,
      impact
    );

    // Sync old states
    this.hp = this.combatState.hp;
    this.armor = this.combatState.armor;
    this.isOverheated = this.combatState.isOverheated;

    if (result.actionInterrupted) {
      console.log(`[Action Interrupt]: Player action was interrupted!`);
      this.currentAction = null;
    }
  }

  public increaseHeat(amount: number): boolean {
    if (this.combatState.isOverheated) return true;
    this.combatState.heat = Math.min(this.combatState.maxHeat, this.combatState.heat + amount);
    if (this.combatState.heat >= this.combatState.maxHeat) {
      this.combatState.isOverheated = true;
      this.combatState.overheatCooldownTimer = COMBAT_TUNABLES.heatOverheatRecoverySecs;
      this.isOverheated = true;
      console.log("[Combat Warning]: System OVERHEAT! Coolant process engaged.");
    }
    this.heat = this.combatState.heat;
    return this.combatState.isOverheated;
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
