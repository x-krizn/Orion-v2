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
  DirectionalLight,
  HemisphericLight,
  SceneLoader,
  TransformNode,
  ShadowGenerator,
  Texture,
  Quaternion,
} from "@babylonjs/core";
// Import GLTF/GLB loader module to register GLTF/GLB formats with SceneLoader
import "@babylonjs/loaders/glTF";
import { GameSettings, ModelAssetInfo } from "../types";

export interface CustomPropRecord {
  node: TransformNode;
  originalScale: Vector3;
  originalRotation: Vector3;
  originalQuaternion: Quaternion | null;
  baseOffsetPos: Vector3;
  autoScale: number;
  randomFloorRotation?: number; // Optional random rotation in radians for floor tiles
}

export interface LibraryItem {
  id: string;
  name: string;
  originalNode: TransformNode;
}

export class EnvironmentManager {
  private scene: Scene;
  private rootNode: TransformNode;
  private settings: GameSettings["rendering"]["environment"];
  
  // Lights
  private ambientLight!: HemisphericLight;
  private mainLight!: DirectionalLight;
  private shadowGenerator: ShadowGenerator | null = null;

  // Environment meshes
  private ground!: Mesh;
  private obstacles: Mesh[] = [];
  private glowingProps: Mesh[] = [];

  // Drag and drop asset tracking
  private loadedAssets: ModelAssetInfo[] = [];
  private onAssetListChanged: (assets: ModelAssetInfo[]) => void = () => {};

  // Custom prop transformations records
  public customPropsRecords: CustomPropRecord[] = [];
  public customPropsScaleMultiplier = 1.0;
  public customPropsRotationYOffset = 0.0;
  private kitScaleFactor: number = 1.0;

  // Modular Asset Library variables
  public libraryItems: LibraryItem[] = [];
  public enviroGroups: { [groupName: string]: TransformNode[] } = {};
  public isBogEnviroLoaded: boolean = false;
  public onLibraryItemsChanged: (items: { id: string; name: string }[]) => void = () => {};

  constructor(scene: Scene, settings: GameSettings["rendering"]["environment"], onAssetListChanged?: (assets: ModelAssetInfo[]) => void) {
    this.scene = scene;
    this.settings = settings;
    if (onAssetListChanged) {
      this.onAssetListChanged = onAssetListChanged;
    }

    // Anchor all environment content
    this.rootNode = new TransformNode("EnvironmentRoot", this.scene);

    this.initLighting();
    this.buildGridArena();
    this.buildProceduralCyberProps();
  }

  private initLighting(): void {
    // Soft, tinted hemispheric ambient light
    this.ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
    this.ambientLight.intensity = 0.25;
    
    // Select styling based on theme
    this.applyThemeColors();

    // Sharp directional light (simulating sun/moon for silhouettes)
    this.mainLight = new DirectionalLight("mainLight", new Vector3(-0.5, -1.0, -0.3), this.scene);
    this.mainLight.position = new Vector3(15, 30, 10);
    this.mainLight.intensity = 1.0;
    this.mainLight.diffuse = new Color3(0.9, 0.95, 1.0);
    
    // Shadows
    this.shadowGenerator = new ShadowGenerator(1024, this.mainLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;
    this.shadowGenerator.setDarkness(0.5);
  }

  private applyThemeColors(): void {
    switch (this.settings.theme) {
      case "cyber":
        this.ambientLight.diffuse = new Color3(0.05, 0.1, 0.25); // Deep blue sky
        this.ambientLight.groundColor = new Color3(0.005, 0.012, 0.03); // Almost black
        break;
      case "magma":
        this.ambientLight.diffuse = new Color3(0.2, 0.05, 0.05); // Volcanic glow
        this.ambientLight.groundColor = new Color3(0.04, 0.01, 0.0);
        break;
      case "wasteland":
        this.ambientLight.diffuse = new Color3(0.15, 0.12, 0.08); // Dust storms
        this.ambientLight.groundColor = new Color3(0.05, 0.04, 0.03);
        break;
      case "matrix":
        this.ambientLight.diffuse = new Color3(0.01, 0.18, 0.01); // Digital green
        this.ambientLight.groundColor = new Color3(0.0, 0.02, 0.0);
        break;
    }
  }

  private buildGridArena(): void {
    const size = this.settings.arenaSize;
    
    // Create actual floor mesh
    this.ground = MeshBuilder.CreateGround("cyberGround", { width: size, height: size }, this.scene);
    this.ground.parent = this.rootNode;
    this.ground.receiveShadows = true;

    // Build the grid lines shader or standard emissive texture fallback
    const groundMat = new StandardMaterial("groundMaterial", this.scene);
    groundMat.diffuseColor = new Color3(0.03, 0.04, 0.06);
    groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
    groundMat.specularPower = 32;

    // Use a custom grid diffuse map or custom emission to avoid loading external image assets
    // We can create a checkerboard or standard material
    groundMat.ambientColor = new Color3(0.0, 0.02, 0.05);
    
    // We'll draw nice procedural glowing grid lines on top of the ground using thin lines or custom cylinders!
    this.ground.material = groundMat;

    // Construct grid overlay with real geometry wireframes for razor-sharp visual styling
    const lineThickness = 0.02;
    const gridCount = Math.floor(size / this.settings.gridSpacing);
    const gridColor = this.getThemeColor();

    const gridLinesMat = new StandardMaterial("gridLinesMat", this.scene);
    gridLinesMat.emissiveColor = gridColor;
    gridLinesMat.disableLighting = true; // Make it full bright emissive

    for (let i = -gridCount / 2; i <= gridCount / 2; i++) {
      const coord = i * this.settings.gridSpacing;
      
      // X lines (parallel to Z)
      const lineX = MeshBuilder.CreateBox(`lineX_${i}`, { width: size, height: 0.02, depth: lineThickness }, this.scene);
      lineX.position.set(0, 0.005, coord);
      lineX.material = gridLinesMat;
      lineX.parent = this.rootNode;
      this.glowingProps.push(lineX);

      // Z lines (parallel to X)
      const lineZ = MeshBuilder.CreateBox(`lineZ_${i}`, { width: lineThickness, height: 0.02, depth: size }, this.scene);
      lineZ.position.set(coord, 0.005, 0);
      lineZ.material = gridLinesMat;
      lineZ.parent = this.rootNode;
      this.glowingProps.push(lineZ);
    }
  }

  private getThemeColor(): Color3 {
    switch (this.settings.theme) {
      case "cyber": return new Color3(0, 0.94, 1.0);     // Cyan-blue
      case "magma": return new Color3(1.0, 0.25, 0);     // Blazing Orange
      case "matrix": return new Color3(0.0, 1.0, 0.25);   // Console Green
      case "wasteland": return new Color3(0.85, 0.55, 0.2); // Faded yellow
    }
  }

  /**
   * Build beautiful modular visual props to give real 2.5D context
   */
  public buildProceduralCyberProps(): void {
    // Clean out existing props
    this.obstacles.forEach(o => o.dispose());
    this.obstacles = [];

    const size = this.settings.arenaSize;
    const count = 10;
    const themeColor = this.getThemeColor();

    const metalMat = new StandardMaterial("obstacleMetalMat", this.scene);
    metalMat.diffuseColor = new Color3(0.12, 0.14, 0.18);
    metalMat.specularColor = new Color3(0.4, 0.4, 0.4);
    metalMat.specularPower = 16;

    const energyMat = new StandardMaterial("obstacleEnergyMat", this.scene);
    energyMat.emissiveColor = themeColor;
    energyMat.disableLighting = true;

    // Draw some stylized barriers & generators
    const obstaclePositions = [
      new Vector3(-12, 0, 12),
      new Vector3(12, 0, -12),
      new Vector3(-15, 0, -8),
      new Vector3(15, 0, 8),
      new Vector3(-5, 0, 16),
      new Vector3(5, 0, -16),
    ];

    obstaclePositions.forEach((pos, idx) => {
      // Assemble a cyberpunk shielding generator
      const groupNode = new TransformNode(`genNode_${idx}`, this.scene);
      groupNode.position.copyFrom(pos);
      groupNode.parent = this.rootNode;

      // Base Pillar (Cylinder)
      const basePrism = MeshBuilder.CreateCylinder(`base_pillar_${idx}`, {
        diameter: 2.2,
        height: 1.5,
        tessellation: 6, // Low-poly hexagonal prism
      }, this.scene);
      basePrism.position.set(0, 0.75, 0);
      basePrism.material = metalMat;
      basePrism.parent = groupNode;
      basePrism.receiveShadows = true;
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(basePrism);
      }
      this.obstacles.push(basePrism);

      // Glowing core rings (Cylinders)
      const coreRing = MeshBuilder.CreateCylinder(`core_ring_${idx}`, {
        diameter: 2.3,
        height: 0.2,
        tessellation: 6,
      }, this.scene);
      coreRing.position.set(0, 0.8, 0);
      coreRing.material = energyMat;
      coreRing.parent = groupNode;
      this.glowingProps.push(coreRing);

      // Cap
      const capPrism = MeshBuilder.CreateCylinder(`cap_pillar_${idx}`, {
        diameterTop: 1.2,
        diameterBottom: 2.2,
        height: 0.8,
        tessellation: 6,
      }, this.scene);
      capPrism.position.set(0, 1.9, 0);
      capPrism.material = metalMat;
      capPrism.parent = groupNode;
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(capPrism);
      }
      this.obstacles.push(capPrism);

      // Energy Bar floating on top
      const emitterNode = MeshBuilder.CreateBox(`emitter_${idx}`, { width: 0.3, height: 3.5, depth: 0.3 }, this.scene);
      emitterNode.position.set(0, 3.5, 0);
      emitterNode.material = energyMat;
      emitterNode.parent = groupNode;
      this.glowingProps.push(emitterNode);
    });

    // Outer level borders/containment laser lines
    const half = size / 2 - 1;
    const borderGeoms = [
      { w: size, d: 0.1, x: 0, z: half },
      { w: size, d: 0.1, x: 0, z: -half },
      { w: 0.1, d: size, x: half, z: 0 },
      { w: 0.1, d: size, x: -half, z: 0 },
    ];

    const wallMat = new StandardMaterial("laserWallMat", this.scene);
    wallMat.diffuseColor = Color3.FromInts(10, 15, 20);
    wallMat.emissiveColor = themeColor.scale(0.3);

    borderGeoms.forEach((wall, idx) => {
      const laserMesh = MeshBuilder.CreateBox(`laserWall_${idx}`, { width: wall.w, height: 1.0, depth: wall.d }, this.scene);
      laserMesh.position.set(wall.x, 0.5, wall.z);
      laserMesh.material = wallMat;
      laserMesh.parent = this.rootNode;
      this.obstacles.push(laserMesh);
    });
  }

  /**
   * Updates game theme at runtime for easy debugging
   */
  public changeTheme(newTheme: "cyber" | "magma" | "wasteland" | "matrix"): void {
    this.settings.theme = newTheme;
    this.applyThemeColors();
    
    const themeColor = this.getThemeColor();
    this.glowingProps.forEach(prop => {
      const mat = prop.material as StandardMaterial;
      if (mat) {
        mat.emissiveColor = themeColor;
      }
    });

    this.obstacles.forEach(obs => {
      // Update laser wall materials
      if (obs.name.startsWith("laserWall")) {
        const mat = obs.material as StandardMaterial;
        if (mat) {
          mat.emissiveColor = themeColor.scale(0.3);
        }
      }
    });
  }

  /**
   * Identifies if a component represents a floor tile (has essentially one face/flat)
   */
  private checkIfFloorTile(node: TransformNode, name: string): boolean {
    const nameLower = name.toLowerCase();
    const isWalkable = nameLower.includes("floor") || nameLower.includes("tile") || nameLower.includes("ground") || nameLower.includes("pavement") || nameLower.includes("deck") || nameLower.includes("flat");
    
    node.computeWorldMatrix(true);
    const bounds = node.getHierarchyBoundingVectors(true);
    const sizeVec = bounds.max.subtract(bounds.min);
    const isFlat = sizeVec.y < 0.25 || (sizeVec.y < sizeVec.x * 0.15 && sizeVec.y < sizeVec.z * 0.15);
    
    return isWalkable || isFlat;
  }

  /**
   * Scans an imported environment root node recursively to discover and index bog kit components
   */
  public discoverEnviroGroups(importedRoot: TransformNode): boolean {
    this.enviroGroups = {};
    let foundAnyBogGroup = false;

    const scan = (node: any) => {
      if (!node) return;
      const name = node.name ? node.name.toLowerCase() : "";
      
      const possibleGroups = [
        "bog_floor", "bog_water", "bog_low", "bog_mid", 
        "bog_trees", "bog_tree", "bog_reeds", "bog_shrooms", "bog_shroom"
      ];
      
      const isGroupParent = possibleGroups.some(g => name === g || name.startsWith(g + "_parent") || name.endsWith(g + "s") || name.endsWith(g));
      
      if (isGroupParent) {
        let normalizedGroup = "";
        if (name.includes("floor")) normalizedGroup = "bog_floor";
        else if (name.includes("water")) normalizedGroup = "bog_water";
        else if (name.includes("low")) normalizedGroup = "bog_low";
        else if (name.includes("mid")) normalizedGroup = "bog_mid";
        else if (name.includes("tree")) normalizedGroup = "bog_trees";
        else if (name.includes("reed")) normalizedGroup = "bog_reeds";
        else if (name.includes("shroom")) normalizedGroup = "bog_shrooms";

        if (normalizedGroup) {
          if (!this.enviroGroups[normalizedGroup]) {
            this.enviroGroups[normalizedGroup] = [];
          }
          const children = node.getChildren ? node.getChildren() : [];
          children.forEach((child: any) => {
            if (child instanceof TransformNode || child instanceof Mesh) {
              this.enviroGroups[normalizedGroup].push(child);
              foundAnyBogGroup = true;
            }
          });
        }
      }

      const children = node.getChildren ? node.getChildren() : [];
      for (const child of children) {
        scan(child);
      }
    };

    scan(importedRoot);

    if (!foundAnyBogGroup) {
      const allTransformNodes: TransformNode[] = [];
      const collect = (node: any) => {
        if (!node) return;
        if (node instanceof TransformNode || node instanceof Mesh) {
          allTransformNodes.push(node);
        }
        const children = node.getChildren ? node.getChildren() : [];
        for (const child of children) {
          collect(child);
        }
      };
      collect(importedRoot);

      allTransformNodes.forEach(node => {
        const name = node.name ? node.name.toLowerCase() : "";
        let normalizedGroup = "";
        
        if (name.includes("floor") || name.includes("bog_floor_0")) normalizedGroup = "bog_floor";
        else if (name.includes("water") || name.includes("bog_water_0")) normalizedGroup = "bog_water";
        else if (name.includes("bog_low_0") || name.includes("low_0") || name === "bog_low") normalizedGroup = "bog_low";
        else if (name.includes("bog_mid_0") || name.includes("mid_0") || name === "bog_mid") normalizedGroup = "bog_mid";
        else if (name.includes("tree") || name.includes("bog_tree_0")) normalizedGroup = "bog_trees";
        else if (name.includes("reed") || name.includes("bog_reeds_0")) normalizedGroup = "bog_reeds";
        else if (name.includes("shroom") || name.includes("bog_shroom_0")) normalizedGroup = "bog_shrooms";

        if (normalizedGroup) {
          const childMeshes = node.getChildMeshes ? node.getChildMeshes(false) : [];
          const hasGeometry = (node instanceof Mesh && node.getTotalVertices() > 0) || childMeshes.some(m => m.getTotalVertices() > 0);
          
          if (hasGeometry) {
            if (!this.enviroGroups[normalizedGroup]) {
              this.enviroGroups[normalizedGroup] = [];
            }
            if (!this.enviroGroups[normalizedGroup].includes(node)) {
              this.enviroGroups[normalizedGroup].push(node);
              foundAnyBogGroup = true;
            }
          }
        }
      });
    }

    if (foundAnyBogGroup) {
      this.isBogEnviroLoaded = true;
      console.log(`[Asset Registry]: Discovered Bog Environment Groups:`, Object.keys(this.enviroGroups).map(k => `${k} (${this.enviroGroups[k].length} variants)`));
    }
    return foundAnyBogGroup;
  }

  /**
   * Safe getter to pick a random subcomponent variant from a discovered group
   */
  public pickRandomNodeFromGroup(groupName: string): TransformNode | null {
    const list = this.enviroGroups[groupName];
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * Instantiates a random subcomponent variant under parentNode
   */
  public instantiateRandomVariantFromGroup(groupName: string, parentNode: TransformNode): TransformNode | null {
    const original = this.pickRandomNodeFromGroup(groupName);
    if (!original) return null;

    const spawned = original.instantiateHierarchy(parentNode) as TransformNode;
    spawned.name = `PLACED_RANDOM_${groupName}_${Date.now()}`;
    spawned.setEnabled(true);

    spawned.computeWorldMatrix(true);
    spawned.getChildMeshes(false).forEach(m => {
      m.setEnabled(true);
      m.visibility = 1.0;
      m.receiveShadows = true;
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(m);
      }
    });

    return spawned;
  }

  /**
   * Streamlined helper to register a spawned custom environment node into tracked calibration maps
   */
  private registerPropRecord(spawned: TransformNode, originalNode: TransformNode, position: Vector3, scale: number, randomFloorRotation?: number): void {
    let originalRotation = new Vector3(0, 0, 0);
    let originalQuaternion: Quaternion | null = null;
    if (originalNode.rotationQuaternion) {
      originalQuaternion = originalNode.rotationQuaternion.clone();
    } else {
      originalRotation.copyFrom(originalNode.rotation);
    }

    const record: CustomPropRecord = {
      node: spawned,
      originalScale: originalNode.scaling.clone(),
      originalRotation,
      originalQuaternion,
      baseOffsetPos: position.clone(),
      autoScale: scale,
      randomFloorRotation
    };
    this.customPropsRecords.push(record);
    this.applySingleCustomPropTransforms(record);
  }

  /**
   * Handle drag and drop files and register the loaded GLTF/GLB models dynamically
   */
  public async loadGLBFile(file: File, loadPosition: Vector3, type: "character" | "environment" | "prop" = "environment"): Promise<void> {
    const url = URL.createObjectURL(file);
    try {
      const result = await SceneLoader.ImportMeshAsync("", "", url, this.scene, undefined, ".glb");
      
      const importedRoot = result.meshes[0];
      importedRoot.name = `DND_GLB_${file.name}_${Date.now()}`;
      importedRoot.parent = this.rootNode;

      // Extract children meshes or transform nodes that represent distinct modular entities
      importedRoot.computeWorldMatrix(true);
      result.meshes.forEach(m => m.computeWorldMatrix(true));

      const tempItems: LibraryItem[] = [];
      const leafMeshes = importedRoot.getChildMeshes(false);

      leafMeshes.forEach((mesh, idx) => {
        if (mesh.getTotalVertices() > 0) {
          mesh.computeWorldMatrix(true);
          mesh.setParent(importedRoot);
          tempItems.push({
            id: `lib_${mesh.name || mesh.id}_${idx}_${Date.now()}`,
            name: mesh.name,
            originalNode: mesh
          });
        }
      });

      // Final fallback: treat the whole imported node as a single element if nothing matches
      if (tempItems.length === 0) {
        tempItems.push({
          id: `lib_root_${Date.now()}`,
          name: file.name.replace(".glb", "").replace(".gltf", ""),
          originalNode: importedRoot
        });
      }

      this.libraryItems = tempItems;

      // Scan for structured bog environment kit
      const isBogKit = this.discoverEnviroGroups(importedRoot);

      // Default to kit scale factor 1.0 (or calibrate based on floor layout)
      this.kitScaleFactor = 1.0;

      // Detect if it is the custom environment kit "enviroTest" (usually containing "enviro" in filename or exactly 8 items)
      const isEnviroTest = file.name.toLowerCase().includes("enviro") || tempItems.length === 8;
      if (!isBogKit && isEnviroTest && tempItems.length > 1) {
        // High fidelity classification based on subcomponent names
        const floorTiles = tempItems.filter(item => {
          const ln = item.name.toLowerCase();
          const pn = item.originalNode.parent ? item.originalNode.parent.name.toLowerCase() : "";
          return ln.includes("floor") || ln.includes("tile") || ln.includes("ground") ||
                 pn.includes("floor") || pn.includes("tile") || pn.includes("ground");
        });

        const blocks = tempItems.filter(item => !floorTiles.includes(item));

        blocks.forEach(block => {
          const ln = block.name.toLowerCase();
          const pn = block.originalNode.parent ? block.originalNode.parent.name.toLowerCase() : "";
          
          if (ln.includes("obstacle") || pn.includes("obstacle")) {
            block.name = "enviroTest_obstacle";
          } else if (ln.includes("lowwall") || ln.includes("low_wall") || ln.includes("low wall") || pn.includes("lowwall") || pn.includes("low_wall") || pn.includes("low wall")) {
            block.name = "enviroTest_low_wall";
          } else if (ln.includes("midwall") || ln.includes("mid_wall") || ln.includes("mid wall") || pn.includes("midwall") || pn.includes("mid_wall") || pn.includes("mid wall")) {
            block.name = "enviroTest_mid_wall";
          } else if (ln.includes("highwall") || ln.includes("high_wall") || ln.includes("high wall") || pn.includes("highwall") || pn.includes("high_wall") || pn.includes("high wall")) {
            block.name = "enviroTest_high_wall";
          }
        });

        // Use height-sorting fallback for any unclassified blocks
        const unclassifiedBlocks = blocks.filter(b => !b.name.startsWith("enviroTest_"));
        if (unclassifiedBlocks.length > 0) {
          const sorted = [...unclassifiedBlocks].sort((a, b) => {
            a.originalNode.computeWorldMatrix(true);
            b.originalNode.computeWorldMatrix(true);
            const sizeA = a.originalNode.getHierarchyBoundingVectors(true).max.subtract(a.originalNode.getHierarchyBoundingVectors(true).min);
            const sizeB = b.originalNode.getHierarchyBoundingVectors(true).max.subtract(b.originalNode.getHierarchyBoundingVectors(true).min);
            return sizeA.y - sizeB.y;
          });
          if (sorted[0]) sorted[0].name = "enviroTest_obstacle";
          if (sorted[1]) sorted[1].name = "enviroTest_low_wall";
          if (sorted[2]) sorted[2].name = "enviroTest_mid_wall";
          if (sorted[3]) sorted[3].name = "enviroTest_high_wall";
        }

        if (floorTiles.length === 4) {
          const itemBounds = floorTiles.map(item => {
            item.originalNode.computeWorldMatrix(true);
            const bounds = item.originalNode.getHierarchyBoundingVectors(true);
            const center = bounds.max.add(bounds.min).scale(0.5);
            const size = bounds.max.subtract(bounds.min);
            return { item, center, size };
          });

          const sortedByLocalX = [...itemBounds].sort((a, b) => a.center.x - b.center.x);
          const sortedByLocalZ = [...itemBounds].sort((a, b) => a.center.z - b.center.z);

          floorTiles.forEach(item => {
            const cand = itemBounds.find(ib => ib.item === item)!;
            const isWest = sortedByLocalX.indexOf(cand) < 2;
            const isSouth = sortedByLocalZ.indexOf(cand) < 2;

            let suffix = "NE";
            if (!isWest && !isSouth) suffix = "NE";
            else if (isWest && !isSouth) suffix = "NW";
            else if (!isWest && isSouth) suffix = "SE";
            else if (isWest && isSouth) suffix = "SW";
            
            item.name = `enviroTest_floor_${suffix}`;
          });

          const refFloor = itemBounds[0];
          const floorWidth = Math.max(refFloor.size.x, refFloor.size.z);
          this.kitScaleFactor = floorWidth > 0.01 ? 4.0 / floorWidth : 1.0;
          console.log(`[EnviroTest Classification]: Calibrated floorWidth=${floorWidth}, kitScaleFactor set to ${this.kitScaleFactor}`);
        }
      }

      // Deactivate main library root node so it functions purely as an unrendered asset catalog pool
      if (this.libraryItems.length > 1) {
        importedRoot.setEnabled(false);
        result.meshes.forEach(m => {
          m.setEnabled(false);
          m.visibility = 0.0;
        });
      } else {
        importedRoot.setEnabled(true);
      }

      // Trigger callback with clean serializable items
      if (this.onLibraryItemsChanged) {
        this.onLibraryItemsChanged(this.libraryItems.map(item => ({ id: item.id, name: item.name })));
      }

      // Also support legacy records for full single-item scale syncing if only 1 item matched
      if (this.libraryItems.length === 1) {
        const item = this.libraryItems[0];
        importedRoot.setEnabled(true); // Ensure parent is active
        item.originalNode.setEnabled(true); // make visible since it's the only one
        const originalScale = item.originalNode.scaling.clone();
        let originalRotation = new Vector3(0, 0, 0);
        let originalQuaternion: Quaternion | null = null;
        if (item.originalNode.rotationQuaternion) {
          originalQuaternion = item.originalNode.rotationQuaternion.clone();
        } else {
          originalRotation.copyFrom(item.originalNode.rotation);
        }

        const bounds = item.originalNode.getHierarchyBoundingVectors(true);
        const sizeVec = bounds.max.subtract(bounds.min);
        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
        let autoScale = 1.0;
        if (maxDim > 0.01) {
          autoScale = 4.2 / maxDim;
        }

        const baseOffsetY = -bounds.min.y * autoScale;
        item.originalNode.position.set(loadPosition.x, baseOffsetY, loadPosition.z);

        const record: CustomPropRecord = {
          node: item.originalNode,
          originalScale,
          originalRotation,
          originalQuaternion,
          baseOffsetPos: new Vector3(loadPosition.x, baseOffsetY, loadPosition.z),
          autoScale
        };
        this.customPropsRecords.push(record);
        this.applySingleCustomPropTransforms(record);

        item.originalNode.getChildMeshes(true).forEach(m => {
          m.receiveShadows = true;
          m.setEnabled(true);
          m.visibility = 1.0;
          if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(m);
          }
        });
      }

      const uniqueId = `asset_${Date.now()}`;
      const newAsset: ModelAssetInfo = {
        id: uniqueId,
        name: file.name,
        type,
        source: "file",
        filePath: file.name,
        meshCount: result.meshes.length,
      };

      this.loadedAssets.push(newAsset);
      this.onAssetListChanged([...this.loadedAssets]);

      console.log(`GLB Asset Library parsed successfully: Discovered ${this.libraryItems.length} components.`);
    } catch (e: any) {
      console.error("Failed to load dropped GLB. Check format.", e);
      throw e;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Preload a custom environment kit from a standard relative URL path
   */
  public async preloadEnviroModelFromURL(url: string): Promise<void> {
    try {
      const result = await SceneLoader.ImportMeshAsync("", "", url, this.scene, undefined, ".glb");
      
      const importedRoot = result.meshes[0];
      importedRoot.name = `PRELOAD_ENVIRO_${Date.now()}`;
      importedRoot.parent = this.rootNode;

      importedRoot.computeWorldMatrix(true);
      result.meshes.forEach(m => m.computeWorldMatrix(true));

      const tempItems: LibraryItem[] = [];
      const leafMeshes = importedRoot.getChildMeshes(false);

      leafMeshes.forEach((mesh, idx) => {
        if (mesh.getTotalVertices() > 0) {
          mesh.computeWorldMatrix(true);
          mesh.setParent(importedRoot);
          tempItems.push({
            id: `lib_${mesh.name || mesh.id}_${idx}_${Date.now()}`,
            name: mesh.name,
            originalNode: mesh
          });
        }
      });

      if (tempItems.length === 0) {
        tempItems.push({
          id: `lib_root_${Date.now()}`,
          name: "enviroTest",
          originalNode: importedRoot
        });
      }

      this.libraryItems = tempItems;

      // Scan for structured bog environment kit
      const isBogKit = this.discoverEnviroGroups(importedRoot);

      // Default to kit scale factor 1.0 (or calibrate based on floor layout)
      this.kitScaleFactor = 1.0;

      // Classify
      if (!isBogKit && tempItems.length > 1) {
        const floorTiles = tempItems.filter(item => {
          const ln = item.name.toLowerCase();
          const pn = item.originalNode.parent ? item.originalNode.parent.name.toLowerCase() : "";
          return ln.includes("floor") || ln.includes("tile") || ln.includes("ground") ||
                 pn.includes("floor") || pn.includes("tile") || pn.includes("ground");
        });

        const blocks = tempItems.filter(item => !floorTiles.includes(item));

        blocks.forEach(block => {
          const ln = block.name.toLowerCase();
          const pn = block.originalNode.parent ? block.originalNode.parent.name.toLowerCase() : "";
          
          if (ln.includes("obstacle") || pn.includes("obstacle")) {
            block.name = "enviroTest_obstacle";
          } else if (ln.includes("lowwall") || ln.includes("low_wall") || ln.includes("low wall") || pn.includes("lowwall") || pn.includes("low_wall") || pn.includes("low wall")) {
            block.name = "enviroTest_low_wall";
          } else if (ln.includes("midwall") || ln.includes("mid_wall") || ln.includes("mid wall") || pn.includes("midwall") || pn.includes("mid_wall") || pn.includes("mid wall")) {
            block.name = "enviroTest_mid_wall";
          } else if (ln.includes("highwall") || ln.includes("high_wall") || ln.includes("high wall") || pn.includes("highwall") || pn.includes("high_wall") || pn.includes("high wall")) {
            block.name = "enviroTest_high_wall";
          }
        });

        // Use height-sorting fallback for any unclassified blocks
        const unclassifiedBlocks = blocks.filter(b => !b.name.startsWith("enviroTest_"));
        if (unclassifiedBlocks.length > 0) {
          const sorted = [...unclassifiedBlocks].sort((a, b) => {
            a.originalNode.computeWorldMatrix(true);
            b.originalNode.computeWorldMatrix(true);
            const sizeA = a.originalNode.getHierarchyBoundingVectors(true).max.subtract(a.originalNode.getHierarchyBoundingVectors(true).min);
            const sizeB = b.originalNode.getHierarchyBoundingVectors(true).max.subtract(b.originalNode.getHierarchyBoundingVectors(true).min);
            return sizeA.y - sizeB.y;
          });
          if (sorted[0]) sorted[0].name = "enviroTest_obstacle";
          if (sorted[1]) sorted[1].name = "enviroTest_low_wall";
          if (sorted[2]) sorted[2].name = "enviroTest_mid_wall";
          if (sorted[3]) sorted[3].name = "enviroTest_high_wall";
        }

        if (floorTiles.length === 4) {
          const itemBounds = floorTiles.map(item => {
            item.originalNode.computeWorldMatrix(true);
            const bounds = item.originalNode.getHierarchyBoundingVectors(true);
            const center = bounds.max.add(bounds.min).scale(0.5);
            const size = bounds.max.subtract(bounds.min);
            return { item, center, size };
          });

          const sortedByLocalX = [...itemBounds].sort((a, b) => a.center.x - b.center.x);
          const sortedByLocalZ = [...itemBounds].sort((a, b) => a.center.z - b.center.z);

          floorTiles.forEach(item => {
            const cand = itemBounds.find(ib => ib.item === item)!;
            const isWest = sortedByLocalX.indexOf(cand) < 2;
            const isSouth = sortedByLocalZ.indexOf(cand) < 2;

            let suffix = "NE";
            if (!isWest && !isSouth) suffix = "NE";
            else if (isWest && !isSouth) suffix = "NW";
            else if (!isWest && isSouth) suffix = "SE";
            else if (isWest && isSouth) suffix = "SW";
            
            item.name = `enviroTest_floor_${suffix}`;
          });

          const refFloor = itemBounds[0];
          const floorWidth = Math.max(refFloor.size.x, refFloor.size.z);
          this.kitScaleFactor = floorWidth > 0.01 ? 4.0 / floorWidth : 1.0;
          console.log(`[Preload Classification]: Calibrated floorWidth=${floorWidth}, Kit scale factor is ${this.kitScaleFactor}`);
        }
      }

      // Deactivate main library root node so it functions purely as an unrendered asset catalog pool
      if (this.libraryItems.length > 1) {
        importedRoot.setEnabled(false);
        result.meshes.forEach(m => {
          m.setEnabled(false);
          m.visibility = 0.0;
        });
      } else {
        importedRoot.setEnabled(true);
      }

      if (this.onLibraryItemsChanged) {
        this.onLibraryItemsChanged(this.libraryItems.map(item => ({ id: item.id, name: item.name })));
      }

      const filename = url.substring(url.lastIndexOf("/") + 1);
      const uniqueId = "asset_preloaded_enviro";
      const newAsset: ModelAssetInfo = {
        id: uniqueId,
        name: filename,
        type: "environment",
        source: "file",
        filePath: filename,
        meshCount: result.meshes.length,
      };

      this.loadedAssets.push(newAsset);
      this.onAssetListChanged([...this.loadedAssets]);

      console.log(`Preloaded Enviro GLB parsed successfully: Discovered ${this.libraryItems.length} components.`);

      // Automatically arrange layout on startup
      this.autoArrangeLibrary();

    } catch (e) {
      if (this.scene && !this.scene.isDisposed) {
        console.error("Failed to preload enviroTest.glb", e);
      }
    }
  }

  /**
   * Instantiates a single piece chosen from the asset library and places it at the clicked location
   */
  public instantiateLibraryItem(itemId: string, position: Vector3): TransformNode | null {
    const item = this.libraryItems.find(it => it.id === itemId);
    if (!item) return null;

    // Deep clone the hierarchy
    const spawnedNode = item.originalNode.instantiateHierarchy(this.rootNode) as TransformNode;
    spawnedNode.name = `PLACED_${item.name}_${Date.now()}`;
    spawnedNode.setEnabled(true);

    spawnedNode.computeWorldMatrix(true);
    const childrenMeshes = spawnedNode.getChildMeshes(false);
    
    // Fit boundaries so custom mesh fits a standard scale nicely
    const bounds = spawnedNode.getHierarchyBoundingVectors(true);
    const sizeVec = bounds.max.subtract(bounds.min);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    
    let scalingFactor = 1.0;
    const nameLower = item.name.toLowerCase();
    const isWalkable = nameLower.includes("floor") || nameLower.includes("tile") || nameLower.includes("ground") || nameLower.includes("pavement") || nameLower.includes("deck");

    if (maxDim > 0.01) {
      if (item.name.startsWith("enviroTest_")) {
        scalingFactor = this.kitScaleFactor;
      } else if (isWalkable) {
        scalingFactor = 1.0; // standard 1:1 scaling for floor segments
      } else if (nameLower.includes("wall") || nameLower.includes("barrier") || nameLower.includes("fence")) {
        scalingFactor = 3.5 / maxDim; // standard boundary wall height
      } else {
        scalingFactor = 2.5 / maxDim; // standard obstacle size
      }
    }

    // Set properties for rendering and shadows
    childrenMeshes.forEach(mesh => {
      mesh.setEnabled(true);
      mesh.visibility = 1.0;
      mesh.receiveShadows = true;
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(mesh);
      }

      // Physics obstacle registers to block gun fires/player movement unless walkable floor tiles/one-faced components
      const isFloor = this.checkIfFloorTile(spawnedNode, item.name);
      if (!isFloor && !isWalkable) {
        this.obstacles.push(mesh as Mesh);
      }
    });

    // Record original transforms for dynamic updating
    let originalRotation = new Vector3(0, 0, 0);
    let originalQuaternion: Quaternion | null = null;
    if (item.originalNode.rotationQuaternion) {
      originalQuaternion = item.originalNode.rotationQuaternion.clone();
    } else {
      originalRotation.copyFrom(item.originalNode.rotation);
    }

    const isFloor = this.checkIfFloorTile(spawnedNode, item.name);
    const randomFloorRotation = isFloor ? Math.floor(Math.random() * 4) * (Math.PI / 2) : undefined;

    const baseOffsetY = -bounds.min.y * scalingFactor;
    const record: CustomPropRecord = {
      node: spawnedNode,
      originalScale: item.originalNode.scaling.clone(),
      originalRotation,
      originalQuaternion,
      baseOffsetPos: new Vector3(position.x, baseOffsetY, position.z),
      autoScale: scalingFactor,
      randomFloorRotation
    };
    this.customPropsRecords.push(record);
    this.applySingleCustomPropTransforms(record);

    return spawnedNode;
  }

  /**
   * Arranges discovered model kit subcomponents logically in the arena based on naming conventions
   */
  public autoArrangeLibrary(): void {
    if (this.libraryItems.length === 0) return;

    // 1. Flush existing obstacles & custom models
    this.obstacles.forEach(o => {
      if (o && !o.isDisposed()) o.dispose();
    });
    this.obstacles = [];

    this.glowingProps.forEach(gp => {
      if (gp && !gp.isDisposed()) gp.dispose();
    });
    this.glowingProps = [];

    const meshesToDispose = this.scene.meshes.filter(m => 
      m.name.startsWith("PLACED_") || 
      m.name.startsWith("DND_GLB_AUTO_")
    );
    meshesToDispose.forEach(m => m.dispose());

    // Clear calibration records so we can register fresh auto-arranged records
    this.customPropsRecords = [];

    // Hide default grid plane if walkable floor tile components exist
    const hasFloorItem = this.libraryItems.some(item => {
      const n = item.name.toLowerCase();
      return n.includes("floor") || n.includes("tile") || n.includes("ground") || n.includes("pavement") || n.includes("deck") || n.includes("water") || n.includes("sea") || n.includes("ocean") || n.includes("lake");
    }) || this.isBogEnviroLoaded;

    if (hasFloorItem && this.ground) {
      this.ground.visibility = 0.0;
    }

    const arenaSize = this.settings.arenaSize;
    const scale = this.kitScaleFactor;

    // 2. Dual-mode Arranger
    if (this.isBogEnviroLoaded) {
      console.log(`[Procedural Gen]: Populating organic swampy Bog Environment...`);
      
      const spacingX = 4.0;
      const spacingZ = 4.0;
      const half = arenaSize / 2;

      // Spawns terrain grid
      for (let x = -half + spacingX/2; x <= half; x += spacingX) {
        for (let z = -half + spacingZ/2; z <= half; z += spacingZ) {
          // 20% water puddle segments probability, otherwise dry mossy terrain
          const isWater = Math.random() < 0.20 && this.enviroGroups["bog_water"] && this.enviroGroups["bog_water"].length > 0;
          const groupName = isWater ? "bog_water" : "bog_floor";

          const spawned = this.instantiateRandomVariantFromGroup(groupName, this.rootNode);
          if (spawned) {
            spawned.name = `DND_GLB_AUTO_${groupName.toUpperCase()}_${Date.now()}`;
            
            const bounds = spawned.getHierarchyBoundingVectors(true);
            const heightOffset = -bounds.min.y * scale;

            // Organic 90-degree relative rotation steps for floor tiles to prevent tile-grid repetition
            const randomRot = groupName === "bog_floor" ? Math.floor(Math.random() * 4) * (Math.PI / 2) : 0;

            const original = this.pickRandomNodeFromGroup(groupName)!;
            this.registerPropRecord(spawned, original, new Vector3(x, heightOffset, z), scale, randomRot);
          }
        }
      }

      // Spawns border boundary walls (only along the back-Z and left-X edge to preserve camera viewpoint visibility)
      const edgePositions: { pos: Vector3; rotY: number }[] = [];
      const farZ = half - spacingZ / 2;
      const leftX = -half + spacingX / 2;

      for (let x = leftX; x <= half; x += spacingX) {
        edgePositions.push({ pos: new Vector3(x, 0, farZ), rotY: 0 });
      }
      for (let z = -half + spacingZ / 2; z < farZ; z += spacingZ) {
        edgePositions.push({ pos: new Vector3(leftX, 0, z), rotY: 0 });
      }

      edgePositions.forEach(({ pos }) => {
        // Randomly determine masonry layout: either a double-stacked low wall (50%) or a single mid wall (50%)
        const randStack = Math.random() < 0.5;
        
        if (randStack && this.enviroGroups["bog_low"] && this.enviroGroups["bog_low"].length > 0) {
          // Bottom brick low wall
          const wall1 = this.instantiateRandomVariantFromGroup("bog_low", this.rootNode);
          if (wall1) {
            wall1.name = `DND_GLB_AUTO_WALL_LOW1_${Date.now()}`;
            const bounds1 = wall1.getHierarchyBoundingVectors(true);
            const heightOffset1 = -bounds1.min.y * scale;
            const original1 = this.pickRandomNodeFromGroup("bog_low")!;
            this.registerPropRecord(wall1, original1, new Vector3(pos.x, heightOffset1, pos.z), scale);

            wall1.getChildMeshes(false).forEach(m => this.obstacles.push(m as Mesh));

            // Top brick low wall stacked vertically on top
            const wall2 = this.instantiateRandomVariantFromGroup("bog_low", this.rootNode);
            if (wall2) {
              wall2.name = `DND_GLB_AUTO_WALL_LOW2_${Date.now()}`;
              const original2 = this.pickRandomNodeFromGroup("bog_low")!;
              const height1 = (bounds1.max.y - bounds1.min.y) * scale;
              // 0.1 units subtraction for clean masonry overlaps
              this.registerPropRecord(wall2, original2, new Vector3(pos.x, heightOffset1 + height1 - 0.1, pos.z), scale);

              wall2.getChildMeshes(false).forEach(m => this.obstacles.push(m as Mesh));
            }
          }
        } else if (this.enviroGroups["bog_mid"] && this.enviroGroups["bog_mid"].length > 0) {
          const wall = this.instantiateRandomVariantFromGroup("bog_mid", this.rootNode);
          if (wall) {
            wall.name = `DND_GLB_AUTO_WALL_MID_${Date.now()}`;
            const bounds = wall.getHierarchyBoundingVectors(true);
            const heightOffset = -bounds.min.y * scale;
            const original = this.pickRandomNodeFromGroup("bog_mid")!;
            this.registerPropRecord(wall, original, new Vector3(pos.x, heightOffset, pos.z), scale);

            wall.getChildMeshes(false).forEach(m => this.obstacles.push(m as Mesh));
          }
        }
      });

      // Spawns scenic flora over standard gameplay obstacle coordinates
      const obstacleSlots = [
        new Vector3(-12, 0, 12),
        new Vector3(12, 0, -12),
        new Vector3(-15, 0, -8),
        new Vector3(15, 0, 8),
        new Vector3(-5, 0, 16),
        new Vector3(5, 0, -16),
        new Vector3(-8, 0, -4),
        new Vector3(8, 0, 4),
        new Vector3(0, 0, -10),
        new Vector3(0, 0, 10),
      ];

      const floraPool = ["bog_trees", "bog_reeds", "bog_shrooms"];

      obstacleSlots.forEach((pos, idx) => {
        const groupName = floraPool[idx % floraPool.length];
        const spawned = this.instantiateRandomVariantFromGroup(groupName, this.rootNode);
        if (spawned) {
          spawned.name = `DND_GLB_AUTO_PROP_${groupName.toUpperCase()}_${Date.now()}`;
          const bounds = spawned.getHierarchyBoundingVectors(true);
          const heightOffset = -bounds.min.y * scale;
          const original = this.pickRandomNodeFromGroup(groupName)!;

          // Organic continuous rotation to make trees feel alive and unaligned
          const organicYRot = Math.random() * Math.PI * 2;

          this.registerPropRecord(spawned, original, new Vector3(pos.x, heightOffset, pos.z), scale, organicYRot);

          spawned.getChildMeshes(false).forEach(m => this.obstacles.push(m as Mesh));
        }
      });

    } else {
      // Legacy Cyber Assets pre-classification arranger for flat kit loaders
      const floors = this.libraryItems.filter(item => {
        const n = item.name.toLowerCase();
        return n.includes("floor") || n.includes("tile") || n.includes("ground") || n.includes("pavement") || n.includes("deck");
      });

      const water = this.libraryItems.filter(item => {
        const n = item.name.toLowerCase();
        return n.includes("water") || n.includes("sea") || n.includes("ocean") || n.includes("river") || n.includes("lake") || n.includes("fluid") || n.includes("lava");
      });

      const walls = this.libraryItems.filter(item => {
        const n = item.name.toLowerCase();
        return n.includes("wall") || n.includes("barrier") || n.includes("border") || n.includes("fence") || n.includes("gate") || n.includes("shield");
      });

      const props = this.libraryItems.filter(item => {
        const n = item.name.toLowerCase();
        return !floors.includes(item) && !water.includes(item) && !walls.includes(item);
      });

      // Spawns grid tiles (including floors and water surfaces)
      const gridSurfaces = [...floors, ...water];
      if (gridSurfaces.length > 0) {
        const referenceSurface = gridSurfaces[0];
        const tempNode = referenceSurface.originalNode.instantiateHierarchy(this.rootNode) as TransformNode;
        tempNode.computeWorldMatrix(true);
        const bVecs = tempNode.getHierarchyBoundingVectors(true);
        const tempSize = bVecs.max.subtract(bVecs.min);
        
        let initialScale = 1.0;
        if (referenceSurface.name.toLowerCase().includes("envirotest")) {
          initialScale = this.kitScaleFactor;
        }
        let spacingX = tempSize.x * initialScale;
        let spacingZ = tempSize.z * initialScale;
        tempNode.dispose();

        if (spacingX < 0.5) spacingX = 4.0;
        if (spacingZ < 0.5) spacingZ = 4.0;

        const half = arenaSize / 2;
        for (let x = -half + spacingX/2; x <= half; x += spacingX) {
          for (let z = -half + spacingZ/2; z <= half; z += spacingZ) {
            const surfaceItem = gridSurfaces[Math.floor(Math.random() * gridSurfaces.length)];
            const spawned = surfaceItem.originalNode.instantiateHierarchy(this.rootNode) as TransformNode;
            
            const typePrefix = water.includes(surfaceItem) ? "WATER" : "FLOOR";
            spawned.name = `DND_GLB_AUTO_${typePrefix}_${Date.now()}`;
            spawned.setEnabled(true);
            
            spawned.computeWorldMatrix(true);
            spawned.getChildMeshes(false).forEach(m => {
              m.setEnabled(true);
              m.visibility = 1.0;
              m.receiveShadows = true;
            });

            let originalRotation = new Vector3(0, 0, 0);
            let originalQuaternion: Quaternion | null = null;
            if (surfaceItem.originalNode.rotationQuaternion) {
              originalQuaternion = surfaceItem.originalNode.rotationQuaternion.clone();
            } else {
              originalRotation.copyFrom(surfaceItem.originalNode.rotation);
            }

            let itemScale = 1.0;
            if (surfaceItem.name.toLowerCase().includes("envirotest")) {
              itemScale = this.kitScaleFactor;
            }

            const bounds = spawned.getHierarchyBoundingVectors(true);
            const heightOffset = -bounds.min.y * itemScale;
            const randomFloorRotation = Math.floor(Math.random() * 4) * (Math.PI / 2);

            const record: CustomPropRecord = {
              node: spawned,
              originalScale: surfaceItem.originalNode.scaling.clone(),
              originalRotation,
              originalQuaternion,
              baseOffsetPos: new Vector3(x, heightOffset, z),
              autoScale: itemScale,
              randomFloorRotation
            };
            this.customPropsRecords.push(record);
            this.applySingleCustomPropTransforms(record);
          }
        }
      }

      // Spawns boundary walls
      if (walls.length > 0) {
        let spacingX = 4.0;
        let spacingZ = 4.0;
        if (gridSurfaces.length > 0) {
          const referenceFloor = gridSurfaces[0];
          const tempNode = referenceFloor.originalNode.instantiateHierarchy(this.rootNode) as TransformNode;
          tempNode.computeWorldMatrix(true);
          const bVecs = tempNode.getHierarchyBoundingVectors(true);
          const tempSize = bVecs.max.subtract(bVecs.min);
          let itemScale = 1.0;
          if (referenceFloor.name.toLowerCase().includes("envirotest")) {
            itemScale = this.kitScaleFactor;
          }
          spacingX = tempSize.x * itemScale;
          spacingZ = tempSize.z * itemScale;
          tempNode.dispose();
        }

        if (spacingX < 0.5) spacingX = 4.0;
        if (spacingZ < 0.5) spacingZ = 4.0;

        const half = arenaSize / 2;
        const edgePositions: { pos: Vector3; rotY: number }[] = [];
        const farZ = half - spacingZ / 2;
        const leftX = -half + spacingX / 2;

        for (let x = leftX; x <= half; x += spacingX) {
          edgePositions.push({ pos: new Vector3(x, 0, farZ), rotY: 0 });
        }
        for (let z = -half + spacingZ / 2; z < farZ; z += spacingZ) {
          edgePositions.push({ pos: new Vector3(leftX, 0, z), rotY: 0 });
        }

        edgePositions.forEach(({ pos }) => {
          const wallItem = walls[Math.floor(Math.random() * walls.length)];
          const spawned = wallItem.originalNode.instantiateHierarchy(this.rootNode) as TransformNode;
          spawned.name = `DND_GLB_AUTO_WALL_${Date.now()}`;
          spawned.setEnabled(true);

          spawned.computeWorldMatrix(true);
          spawned.getChildMeshes(false).forEach(m => {
            m.setEnabled(true);
            m.visibility = 1.0;
            m.receiveShadows = true;
            if (this.shadowGenerator) {
              this.shadowGenerator.addShadowCaster(m);
            }
            this.obstacles.push(m as Mesh);
          });

          const bounds = spawned.getHierarchyBoundingVectors(true);
          const sizeVec = bounds.max.subtract(bounds.min);
          const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
          let itemScale = 1.0;
          if (wallItem.name.startsWith("enviroTest_")) {
            itemScale = this.kitScaleFactor;
          } else if (maxDim > 0.01) {
            itemScale = 3.5 / maxDim;
          }

          const heightOffset = -bounds.min.y * itemScale;

          let originalRotation = new Vector3(0, 0, 0);
          let originalQuaternion: Quaternion | null = null;
          if (wallItem.originalNode.rotationQuaternion) {
            originalQuaternion = wallItem.originalNode.rotationQuaternion.clone();
          } else {
            originalRotation.copyFrom(wallItem.originalNode.rotation);
          }

          const record: CustomPropRecord = {
            node: spawned,
            originalScale: wallItem.originalNode.scaling.clone(),
            originalRotation,
            originalQuaternion,
            baseOffsetPos: new Vector3(pos.x, heightOffset, pos.z),
            autoScale: itemScale
          };
          this.customPropsRecords.push(record);
          this.applySingleCustomPropTransforms(record);
        });
      }

      // Spawns standard cyber obstacle properties
      if (props.length > 0) {
        const obstacleSlots = [
          new Vector3(-12, 0, 12),
          new Vector3(12, 0, -12),
          new Vector3(-15, 0, -8),
          new Vector3(15, 0, 8),
          new Vector3(-5, 0, 16),
          new Vector3(5, 0, -16),
          new Vector3(-8, 0, -4),
          new Vector3(8, 0, 4),
          new Vector3(0, 0, -10),
          new Vector3(0, 0, 10),
        ];

        obstacleSlots.forEach((pos, idx) => {
          const item = props[idx % props.length];
          const spawned = item.originalNode.instantiateHierarchy(this.rootNode) as TransformNode;
          spawned.name = `DND_GLB_AUTO_PROP_${Date.now()}`;
          spawned.setEnabled(true);

          spawned.computeWorldMatrix(true);
          spawned.getChildMeshes(false).forEach(m => {
            m.setEnabled(true);
            m.visibility = 1.0;
            m.receiveShadows = true;
            if (this.shadowGenerator) {
              this.shadowGenerator.addShadowCaster(m);
            }
            this.obstacles.push(m as Mesh);
          });

          const bounds = spawned.getHierarchyBoundingVectors(true);
          const sizeVec = bounds.max.subtract(bounds.min);
          const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
          let itemScale = 1.0;
          if (item.name.startsWith("enviroTest_")) {
            itemScale = this.kitScaleFactor;
          } else if (maxDim > 0.01) {
            itemScale = 3.2 / maxDim;
          }

          let originalRotation = new Vector3(0, 0, 0);
          let originalQuaternion: Quaternion | null = null;
          if (item.originalNode.rotationQuaternion) {
            originalQuaternion = item.originalNode.rotationQuaternion.clone();
          } else {
            originalRotation.copyFrom(item.originalNode.rotation);
          }

          const heightOffset = -bounds.min.y * itemScale;
          const record: CustomPropRecord = {
            node: spawned,
            originalScale: item.originalNode.scaling.clone(),
            originalRotation,
            originalQuaternion,
            baseOffsetPos: new Vector3(pos.x, heightOffset, pos.z),
            autoScale: itemScale
          };
          this.customPropsRecords.push(record);
          this.applySingleCustomPropTransforms(record);
        });
      }
    }
  }

  /**
   * Applies combining original factors, scaling multiplier, and rotation offset to a given prop record
   */
  private applySingleCustomPropTransforms(record: CustomPropRecord): void {
    const finalFactor = record.autoScale * this.customPropsScaleMultiplier;
    
    // Set Combined Scale
    record.node.scaling.set(
      record.originalScale.x * finalFactor,
      record.originalScale.y * finalFactor,
      record.originalScale.z * finalFactor
    );

    // Reposition with scale-adjusted ground floor and horizontal offsets
    record.node.position.set(
      record.baseOffsetPos.x * this.customPropsScaleMultiplier,
      record.baseOffsetPos.y * this.customPropsScaleMultiplier,
      record.baseOffsetPos.z * this.customPropsScaleMultiplier
    );

    // Set Combined Rotation.
    const isFloor = this.checkIfFloorTile(record.node, record.node.name);
    
    // Floor tiles are rotated by their stored random step rotation (0, 90, 180, 270)
    // 3-faced components are rotated 180 degrees (Math.PI) to face southwest (towards camera) or align with the viewport (sharing same facing as the mech).
    const alignOffset = isFloor ? (record.randomFloorRotation ?? 0) : Math.PI;
    const finalRotOffset = this.customPropsRotationYOffset + alignOffset;
    if (record.originalQuaternion) {
      const extraRot = Quaternion.RotationYawPitchRoll(finalRotOffset, 0, 0);
      record.node.rotationQuaternion = record.originalQuaternion.multiply(extraRot);
    } else {
      record.node.rotation.copyFrom(record.originalRotation);
      record.node.rotation.y += finalRotOffset;
    }
  }

  /**
   * Applies the updated transforms parameters to all custom props tracked in the scene
   */
  public setCustomPropsTransforms(scaleMultiplier: number, rotationDeg: number): void {
    this.customPropsScaleMultiplier = scaleMultiplier;
    this.customPropsRotationYOffset = rotationDeg * (Math.PI / 180);

    this.customPropsRecords.forEach(record => {
      if (record.node && !record.node.isDisposed()) {
        this.applySingleCustomPropTransforms(record);
      }
    });
  }

  /**
   * Clear out loaded modular custom meshes
   */
  public clearCustomAssets(): void {
    const meshesToDispose = this.scene.meshes.filter(m => 
      m.name.startsWith("DND_GLB_") || 
      m.name.startsWith("PLACED_") ||
      m.name.includes("DND_GLB_AUTO_")
    );
    meshesToDispose.forEach(m => m.dispose());
    
    this.libraryItems = [];
    this.customPropsRecords = [];
    this.loadedAssets = [];

    // Restore underlay grid visibility
    if (this.ground) {
      this.ground.visibility = 1.0;
    }

    // Rebuild default modular blocks to fill the arena empty void
    this.buildProceduralCyberProps();

    this.onAssetListChanged([]);
    if (this.onLibraryItemsChanged) {
      this.onLibraryItemsChanged([]);
    }
  }

  public getObstacles(): Mesh[] {
    return this.obstacles;
  }

  public getShadowGenerator(): ShadowGenerator | null {
    return this.shadowGenerator;
  }
}
