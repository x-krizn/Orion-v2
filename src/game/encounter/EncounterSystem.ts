/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3 } from "@babylonjs/core";
import { EnemyAIState } from "../enemy/EnemyConfig";

export enum EncounterStep {
  WAKE = "WAKE",
  TUTORIAL = "TUTORIAL",
  ORC_SKIRMISH = "ORC_SKIRMISH",
  POE_MEETING = "POE_MEETING",
  BOG_CROSSING = "BOG_CROSSING",
  BEDIVERE_REST = "BEDIVERE_REST",
  WURM_SIGNS = "WURM_SIGNS",
  WURM_BOSS = "WURM_BOSS",
  VICTORY = "VICTORY",
  CREDITS = "CREDITS"
}

export class EncounterSystem {
  private currentStep: EncounterStep = EncounterStep.WAKE;
  private lastSafeStep: EncounterStep = EncounterStep.WAKE;
  
  public objectiveText: string = "Wake up and calibrate your movement controls.";
  public dialogueText: string = "";
  public dialogueSpeaker: string = "System Frame Voice";
  
  private stepInitialized: boolean = false;
  private stepTimer: number = 0;
  private conversationIndex: number = 0;
  private spawnCompleted: boolean = false;
  private initialSetupRun: boolean = false;

  private readonly STORAGE_KEY = "orion_furthest_safe_step";

  constructor() {
    this.loadCheckpoint();
  }

  public getStep(): EncounterStep {
    return this.currentStep;
  }

  public getObjectiveText(): string {
    return this.objectiveText;
  }

  public getDialogue(): { speaker: string; text: string } {
    return { speaker: this.dialogueSpeaker, text: this.dialogueText };
  }

  /**
   * Reset progress back to the very first step
   */
  public resetToStart(gameManager: any): void {
    this.currentStep = EncounterStep.WAKE;
    this.lastSafeStep = EncounterStep.WAKE;
    this.saveCheckpoint();
    this.resetStepState();
    this.reinstateCheckpoint(gameManager, EncounterStep.WAKE);
  }

  /**
   * Safe steps are state points where we preserve progression and spawn on player death
   */
  private isSafeStep(step: EncounterStep): boolean {
    return [
      EncounterStep.WAKE,
      EncounterStep.POE_MEETING,
      EncounterStep.BEDIVERE_REST,
      EncounterStep.VICTORY
    ].includes(step);
  }

  private resetStepState(): void {
    this.stepInitialized = false;
    this.stepTimer = 0;
    this.conversationIndex = 0;
    this.spawnCompleted = false;
  }

  /**
   * Saves progression to LocalStorage
   */
  public saveCheckpoint(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, this.lastSafeStep);
      console.log(`[EncounterSystem]: Saved progression checkpoint at step ${this.lastSafeStep}`);
    } catch (e) {
      console.warn("Could not write checkpoint to localStorage:", e);
    }
  }

  /**
   * Loads progression from LocalStorage
   */
  public loadCheckpoint(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved && Object.values(EncounterStep).includes(saved as EncounterStep)) {
        this.currentStep = saved as EncounterStep;
        this.lastSafeStep = saved as EncounterStep;
        console.log(`[EncounterSystem]: Restored progression checkpoint: ${this.currentStep}`);
      }
    } catch (e) {
      console.warn("Could not read checkpoint from localStorage:", e);
    }
  }

  /**
   * Triggers the retry workflow, resetting characters and teleporting to checkpoint
   */
  public triggerDeathRetry(gameManager: any): void {
    console.log(`[EncounterSystem]: Player fell in battle! Teleporting to last safe step: ${this.lastSafeStep}`);
    this.currentStep = this.lastSafeStep;
    this.resetStepState();
    this.reinstateCheckpoint(gameManager, this.lastSafeStep);
  }

  /**
   * Reinstate game conditions (clean enemies, heal player, align transforms)
   */
  private reinstateCheckpoint(gameManager: any, step: EncounterStep): void {
    const player = gameManager.player;
    if (player) {
      // Heal the player completely
      player.combatState.hp = player.combatState.maxHp;
      player.hp = player.combatState.maxHp;
      player.combatState.heat = 0;
      player.heat = 0;
      player.combatState.isOverheated = false;
      player.isOverheated = false;
      
      // Place player at standard origin
      player.getRootNode().position.set(0, 0, 0);
    }

    // Clean all active enemies
    if (gameManager.spawnedEnemies) {
      gameManager.spawnedEnemies.forEach((e: any) => {
        if (e.node) e.node.dispose();
      });
      gameManager.spawnedEnemies = [];
    }

    if (gameManager.targetingSystem) {
      gameManager.targetingSystem.clearTargets();
    }

    // Visual impact alert
    if (gameManager.fx) {
      gameManager.fx.spawnExplosion(new Vector3(0, 0.5, 0), 10, 0.7);
    }
    if (gameManager.cameraSystem) {
      gameManager.cameraSystem.triggerShake(0.8);
    }

    console.log(`[EncounterSystem]: Successfully reinstated checkpoint parameters for ${step}. Player healed.`);
  }

  /**
   * Main updater method called per-tick in the central GameManager loop
   */
  public update(deltaTimeSeconds: number, gameManager: any): void {
    const player = gameManager.player;
    if (!player) return;

    // Check player death state
    if (player.hp <= 0) {
      this.triggerDeathRetry(gameManager);
      return;
    }

    this.stepTimer += deltaTimeSeconds;

    switch (this.currentStep) {
      case EncounterStep.WAKE:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "Awaken: Calibrate locomotion systems. Move around with WASD or Arrow Keys.";
          this.dialogueSpeaker = "Artificial Frame Voice";
          this.dialogueText = "Syncing pilot neural receptors... Standby. Movement channels unlocked.";
          player.getRootNode().position.set(0, 0, 0);
        }

        // Complete once player has moved slightly or 5s has passed
        const startDist = player.getPosition().length();
        if (startDist > 3.0 || this.stepTimer > 5.5) {
          this.transitionTo(EncounterStep.TUTORIAL, gameManager);
        }
        break;

      case EncounterStep.TUTORIAL:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "Calibrate Cannons: Left-click (R1) to shoot the target Drone hovering nearby.";
          this.dialogueSpeaker = "Artificial Frame Voice";
          this.dialogueText = "Weapon calibration required. Drone launched. Use Left Click to fire pulse arrays.";
          
          // Spawn single test drone scout
          gameManager.spawnEnemyAt("enemy_scout", new Vector3(0, 0, 10.0));
          this.spawnCompleted = true;
        }

        // Finish when the drone is defeated
        if (this.spawnCompleted && gameManager.spawnedEnemies.length === 0) {
          this.transitionTo(EncounterStep.ORC_SKIRMISH, gameManager);
        }
        break;

      case EncounterStep.ORC_SKIRMISH:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "Ambush: Repel the Orc Raiders invading our mud sector (0/2 liquidated).";
          this.dialogueSpeaker = "Tactical Frame Scanner";
          this.dialogueText = "Warning! Local biome hostiles detected. High strength bipedal Orc biological signatures approaching!";
          
          // Spawn two orc raiders
          gameManager.spawnEnemyAt("orc_raider", new Vector3(7.5, 0, 8.0));
          gameManager.spawnEnemyAt("orc_raider", new Vector3(-7.5, 0, 8.0));
          this.spawnCompleted = true;
        }

        const remainingOrcs = gameManager.spawnedEnemies.filter((e: any) => e.data.id === "orc_raider").length;
        this.objectiveText = `Ambush: Repel the Orc Raiders invading our mud sector (${2 - remainingOrcs}/2 eliminated).`;

        if (this.spawnCompleted && remainingOrcs === 0) {
          this.transitionTo(EncounterStep.POE_MEETING, gameManager);
        }
        break;

      case EncounterStep.POE_MEETING:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "Swamp Scout: Approach Poe's Holo-Beacon console (near X:8, Z:8) to decode data.";
          this.dialogueSpeaker = "Holo-Transceiver";
          this.dialogueText = "...Static... Is anyone there...? Beware of the marsh... it has eyes...";
          this.conversationIndex = 0;
          this.spawnCompleted = false;

          // Spawn beacon decoration (orange fire particles) to highlight Poe's location
          if (gameManager.fx) {
            gameManager.fx.spawnExplosion(new Vector3(8, 0.4, 8), 12, 0.8);
          }
        }

        const poeNode = gameManager.worldNodeSystem.getActiveNode();
        const inPoeBeaconNode = poeNode && poeNode.id === "POE_BEACON";
        if (inPoeBeaconNode && !this.spawnCompleted) {
          this.spawnCompleted = true;
          this.stepTimer = 0; // Reset timer for dialogues
        }

        if (this.spawnCompleted) {
          if (this.conversationIndex === 0) {
            this.dialogueSpeaker = "Poe (Swamp Vagrant)";
            this.dialogueText = "'Ah, a real Frame! Thought I was dead. Listen, the Gigantic Bog Wurm has gone feral. You must destroy it!'";
            if (this.stepTimer > 4.5) {
              this.conversationIndex = 1;
              this.stepTimer = 0;
            }
          } else if (this.conversationIndex === 1) {
            this.dialogueSpeaker = "Poe (Swamp Vagrant)";
            this.dialogueText = "'Head south-west. Stop by Bedivere's Rest campfire to stoke energy filters, then plunge into its lair.'";
            if (this.stepTimer > 4.5) {
              this.transitionTo(EncounterStep.BOG_CROSSING, gameManager);
            }
          }
        }
        break;

      case EncounterStep.BOG_CROSSING:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "Bog Crossing: Survive the sprinting Bog Hounds (0/3 defeated).";
          this.dialogueSpeaker = "Tactical Frame Scanner";
          this.dialogueText = "Acoustic scans show pack predators. Bog Hounds tunneling in! Avoid high-frequency biting!";
          
          gameManager.spawnEnemyAt("bog_hound", new Vector3(0, 0, 11.0));
          gameManager.spawnEnemyAt("bog_hound", new Vector3(9.0, 0, 4.0));
          gameManager.spawnEnemyAt("bog_hound", new Vector3(-9.0, 0, -4.0));
          this.spawnCompleted = true;
        }

        const remainingHounds = gameManager.spawnedEnemies.filter((e: any) => e.data.id === "bog_hound").length;
        this.objectiveText = `Bog Crossing: Survive the sprinting Bog Hounds (${3 - remainingHounds}/3 eliminated).`;

        if (this.spawnCompleted && remainingHounds === 0) {
          this.transitionTo(EncounterStep.BEDIVERE_REST, gameManager);
        }
        break;

      case EncounterStep.BEDIVERE_REST:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "Safe Camp: Walk close to Bedivere's campfire (near X:-8, Z:-8) to stoke filters.";
          this.dialogueSpeaker = "Bedivere (Camp Sentinel)";
          this.dialogueText = "'Rest here, champion. Restoring a Frame takes thermal soot. stoke up your shield battery.'";
          
          // Spawn bonfire sparkles
          if (gameManager.fx) {
            gameManager.fx.spawnExplosion(new Vector3(-8, 0.4, -8), 10, 0.5);
          }
        }

        const restNode = gameManager.worldNodeSystem.getActiveNode();
        const inRestNode = restNode && restNode.id === "BEDIVERE_REST";
        if (inRestNode) {
          // Continuously restore HP while near
          player.combatState.hp = Math.min(player.combatState.maxHp, player.combatState.hp + deltaTimeSeconds * 40);
          player.hp = player.combatState.hp;
          player.combatState.heat = Math.max(0, player.combatState.heat - deltaTimeSeconds * 60);
          player.heat = player.combatState.heat;
          
          this.dialogueSpeaker = "Bedivere (Camp Sentinel)";
          this.dialogueText = "'There you go, pilot. Clean coolant lines. Just beyond this camp is the Titan's mud tunnel.'";
          
          if (this.stepTimer > 6.0) {
            this.transitionTo(EncounterStep.WURM_SIGNS, gameManager);
          }
        }
        break;

      case EncounterStep.WURM_SIGNS:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "Tunnel Lair: Defeat the toxic Wurmling defenders (0/3 defeated).";
          this.dialogueSpeaker = "Chemical Indicator";
          this.dialogueText = "High sulfur acidity found. Wurmling spawn approaching. Beware of green sludge spits!";
          
          gameManager.spawnEnemyAt("wurmling", new Vector3(8.0, 0, 10.0));
          gameManager.spawnEnemyAt("wurmling", new Vector3(-8.0, 0, 10.0));
          gameManager.spawnEnemyAt("wurmling", new Vector3(0, 0, 14.0));
          this.spawnCompleted = true;
        }

        const remainingWurmlings = gameManager.spawnedEnemies.filter((e: any) => e.data.id === "wurmling").length;
        this.objectiveText = `Tunnel Lair: Defeat the toxic Wurmling defenders (${3 - remainingWurmlings}/3 eliminated).`;

        if (this.spawnCompleted && remainingWurmlings === 0) {
          this.transitionTo(EncounterStep.WURM_BOSS, gameManager);
        }
        break;

      case EncounterStep.WURM_BOSS:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "BOSS BATTLE: Eradicate the colossal Gigantic Bog Wurm!";
          this.dialogueSpeaker = "Seismic Frame Sensors";
          this.dialogueText = "EARTHQUAKE DETECTED! Ground displacement exceeding standard tolerances! IT HAS ARRIVED!";
          
          // Spawn Giant Wurm Boss
          gameManager.spawnEnemyAt("wurm_boss", new Vector3(0, 0, 16.0));
          this.spawnCompleted = true;
        }

        const boss = gameManager.spawnedEnemies.find((e: any) => e.data.id === "wurm_boss");
        if (boss) {
          const bossPct = Math.round((boss.health / boss.maxHealth) * 100);
          this.objectiveText = `BOSS BATTLE: Slay Gigantic Bog Wurm! Strength Indicator: [${bossPct}% HP remaining]`;
        } else {
          this.objectiveText = "BOSS BATTLE: Slay Gigantic Bog Wurm! (0% HP remaining)";
        }

        if (this.spawnCompleted && !boss) {
          this.transitionTo(EncounterStep.VICTORY, gameManager);
        }
        break;

      case EncounterStep.VICTORY:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "Bog Purified: The toxic core has been severed safely.";
          this.dialogueSpeaker = "Neural Uplink Sync";
          this.dialogueText = "Severe signatures cleared. Central ecological systems stabilized. Well done, Pilot!";
        }

        if (this.stepTimer > 5.5) {
          this.transitionTo(EncounterStep.CREDITS, gameManager);
        }
        break;

      case EncounterStep.CREDITS:
        if (!this.stepInitialized) {
          this.stepInitialized = true;
          this.objectiveText = "Bog Demo Completed successfully! Thanks for playing Orbit Orion.";
          this.dialogueSpeaker = "Project Orion Creators";
          this.dialogueText = "Developed by your AI General Architecture Specialist Agent on Google AI Studio 3.5. Excellent flying!";
        }
        break;
    }
  }

  /**
   * Helper to execute transition from step to step, handling checks and saving achievements
   */
  private transitionTo(nextStep: EncounterStep, gameManager: any): void {
    console.log(`[EncounterSystem]: Completed step ${this.currentStep} -> Transitioning to ${nextStep}`);
    
    // Clear dead references and stray targets
    if (gameManager.targetingSystem) {
      gameManager.targetingSystem.clearTargets();
    }

    this.currentStep = nextStep;
    
    // Check if this step is a safe/checkpoint save point
    if (this.isSafeStep(nextStep)) {
      this.lastSafeStep = nextStep;
      this.saveCheckpoint();
    }

    this.resetStepState();

    // Trigger positive progress sound/flash visuals
    if (gameManager.fx) {
      gameManager.fx.spawnExplosion(new Vector3(0, 0.4, 0), 14, 0.82);
    }
    if (gameManager.cameraSystem) {
      gameManager.cameraSystem.triggerShake(0.4);
    }
  }
}
