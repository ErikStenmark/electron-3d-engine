import { Physics } from "../engine/physics";
import { createTerrain, generateHeightmap, raiseEdges, ObjectGravity } from "../engine/terrain";
import { Mat4x4 } from "../engine/vecmat";
import { Object3D } from "../obj";
import { IScene, Scene } from "../scene/scene";

export class WalkingScene extends Scene implements IScene {
  private objects: { [key: string]: Object3D } = {};
  private objectGravity!: ObjectGravity;
  private readonly teapotOrbitCenter = { x: 0, y: 60, z: 10 };
  private teapotSelfRotation!: Mat4x4;

  constructor() {
    super();

    this.flying = false;
    this.physics = new Physics();

    this.setStartPosition({
      camera: [0, 30, 0],
    });

    this.setLight({
      direction: [0.5, 1, 0.5, 1],
      color: [1, 0.95, 0.9, 1],
      ambient: [0.6, 0.7, 0.9, 0.4],
    });

    this.skyboxImage = 'outer-space-background.jpg';
  }

  public async load() {
    this.objects = {};

    await this.setPlayerModel("camera.obj", "player-camera");

    const resolution = 64;
    const terrainSize = 100;
    const terrainHeightScale = 8;
    const heightmap = generateHeightmap(resolution, {
      seed: 42, noiseScale: 0.03, octaves: 5,
      worldOffsetX: -terrainSize / 2, worldOffsetZ: -terrainSize / 2,
      worldSize: terrainSize,
    });

    // --- Helper to create a terrain chunk ---
    const makeChunk = (
      id: string, name: string,
      offX: number, offZ: number,
      skipEdges: ('north' | 'south' | 'east' | 'west')[],
      opts?: { heightScale?: number; noiseScale?: number; octaves?: number; color?: [number,number,number,number] },
    ) => {
      const hs = opts?.heightScale ?? terrainHeightScale;
      const hm = generateHeightmap(resolution, {
        seed: 42, noiseScale: opts?.noiseScale ?? 0.03, octaves: opts?.octaves ?? 5,
        worldOffsetX: offX, worldOffsetZ: offZ,
        worldSize: terrainSize,
      });
      raiseEdges(hm, resolution, hs, 1.0, skipEdges);
      const obj = createTerrain({
        id, size: terrainSize, resolution,
        heightScale: hs, heightmap: hm,
        originX: offX, originZ: offZ,
      }, this.vecMat).setName(name).setGround(true);
      obj.get().color = opts?.color ?? [0.55, 0.55, 0.55, 1];
      return { obj, hm };
    };

    // --- North row (z: -150 to -50) — same noise params for seamless edges ---
    const nW = makeChunk('terrain-nw', 'Terrain North West',
      -terrainSize * 3/2, -terrainSize * 3/2, ['south', 'east']);
    this.objects["terrainNW"] = nW.obj;

    const nC = makeChunk('terrain-nc', 'Terrain North',
      -terrainSize / 2, -terrainSize * 3/2, ['south', 'east', 'west']);
    this.objects["terrainNC"] = nC.obj;

    const nE = makeChunk('terrain-ne', 'Terrain North East',
      terrainSize / 2, -terrainSize * 3/2, ['south', 'west']);
    this.objects["terrainNE"] = nE.obj;

    // --- Center row (z: -50 to 50) ---
    raiseEdges(heightmap, resolution, 8, 1.0, ['north', 'south', 'east', 'west']);
    this.terrainHeightmap = { data: heightmap, resolution };

    this.objects["terrain"] = createTerrain({
      id: 'terrain', size: terrainSize, resolution,
      heightScale: terrainHeightScale, heightmap,
    }, this.vecMat).setName("Terrain").setGround(true);
    this.objects["terrain"].get().color = [0.55, 0.55, 0.55, 1];

    const cW = makeChunk('terrain-cw', 'Terrain Center West',
      -terrainSize * 3/2, -terrainSize / 2, ['north', 'south', 'east']);
    this.objects["terrainCW"] = cW.obj;

    const cE = makeChunk('terrain-ce', 'Terrain Center East',
      terrainSize / 2, -terrainSize / 2, ['north', 'south', 'west']);
    this.objects["terrainCE"] = cE.obj;

    // --- South row (z: 50 to 150) ---
    const sC = makeChunk('terrain-sc', 'Terrain South',
      -terrainSize / 2, terrainSize / 2, ['north', 'east', 'west']);
    this.objects["terrain2"] = sC.obj;

    const sW = makeChunk('terrain-sw', 'Terrain South West',
      -terrainSize * 3/2, terrainSize / 2, ['north', 'east']);
    this.objects["terrainSW"] = sW.obj;

    const sE = makeChunk('terrain-se', 'Terrain South East',
      terrainSize / 2, terrainSize / 2, ['north', 'west']);
    this.objects["terrainSE"] = sE.obj;

    this.objectGravity = new ObjectGravity(heightmap, resolution, terrainSize, terrainHeightScale);

    this.objects["crate1"] = (
      await this.loader.load("cube-tx-n.obj", "cube")
    ).setName("Crate").setSolid(true).move([40, 20, -30, 0]);
    const texture = await this.loader.loadTexture("crate.png", "crate");
    if (texture) {
      this.objects["crate1"].setTexture(texture);
    }

    this.objects["crate2"] = this.objects["crate1"].clone("crate2")
      .setName("Crate 2")
      .move([6, 0, 0, 0]);

    this.objects["crate3"] = this.objects["crate1"].clone("crate3")
      .setName("Crate 3")
      .move([-6, 0, 0, 0]);

    // X-Wing: solid, large, tilted and stuck in the mountain ground
    this.objects["xwing"] = (
      await this.loader.load("x-wing.obj", "xwing-walk")
    ).setName("X-Wing").setSolid(true).scale(3);
    const tiltX = this.vecMat.matrixRotationXDeg(38);
    const tiltZ = this.vecMat.matrixRotationZDeg(22);
    this.objects["xwing"].applyMatrix(this.vecMat.matrixMultiplyMatrices(tiltZ, tiltX));
    this.objects["xwing"].move([0, 15, -65, 0]);

    // Teapot: red, flying path with self-orbit (no gravity)
    this.objects["teapot"] = (
      await this.loader.load("teaPot.obj", "teapot")
    ).setName("Teapot").setSolid(true);
    this.objects["teapot"].get().color = [0.9, 0.08, 0.05, 1];
    this.teapotSelfRotation = this.vecMat.matrixCreateIdentity();

    // Axis helper with a stepping crate beside it
    this.objects["axis"] = (
      await this.loader.load("axis-right-handed.obj", "axis")
    ).setName("Axis").setMeshCollision(true).move([-60, 12, 100, 0]);

    this.objects["axisStepCrate"] = this.objects["crate1"].clone("axisStepCrate")
      .setName("Axis Step Crate")
      .move([-41, 0, 35, 0]);

    // Airplane: meshCollision test with an irregular shape, with a crate beside it
    this.objects["airplane"] = (
      await this.loader.load("Airplane.obj", "airplane-walk")
    ).setName("Airplane").setMeshCollision(true).scale(0.10).move([10, 32, 20, 0]);

    this.objects["airplaneStepCrate"] = this.objects["crate1"].clone("airplaneStepCrate")
      .setName("Airplane Step Crate")
      .move([9, 0, 25, 0]);

    this.objectGravity.add(this.objects["crate1"]);
    this.objectGravity.add(this.objects["crate2"]);
    this.objectGravity.add(this.objects["crate3"]);
    this.objectGravity.add(this.objects["axisStepCrate"]);
    this.objectGravity.add(this.objects["airplaneStepCrate"]);

    this.scene = Object.values(this.objects).map((o) => o.get());
  }

  public update({
    elapsedTime,
    deltaTime,
  }: {
    elapsedTime: number;
    deltaTime: number;
  }) {
    this.objectGravity.update(deltaTime);

    // Teapot self-rotation: accumulate X and Y spins at different speeds
    const selfRotX = this.vecMat.matrixRotationXDeg(0.06 * deltaTime);
    const selfRotY = this.vecMat.matrixRotationYDeg(0.025 * deltaTime);
    this.teapotSelfRotation = this.vecMat.matrixMultiplyMatrices(
      this.teapotSelfRotation, selfRotX, selfRotY
    );

    // Teapot path: figure-8 along the Z axis (Lissajous 1:2)
    // selfRotation × translation so rotation is around local origin, not world position
    const { x: ox, y: oy, z: oz } = this.teapotOrbitCenter;
    const t = elapsedTime * 0.000075;
    const translation = this.vecMat.matrixTranslation(
      ox + Math.sin(2 * t) * 20,
      oy,
      oz + Math.sin(t) * 35
    );
    this.objects["teapot"].setModelMatrix(
      this.vecMat.matrixMultiplyMatrix(this.teapotSelfRotation, translation)
    );
  }
}
