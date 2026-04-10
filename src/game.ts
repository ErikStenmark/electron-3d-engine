import { Game } from './engine/game';
import { SceneProvider } from './scene';
import { ComplexObjectsScene } from './scenes/complex-objects-scene';
import { LotsOfBoxes } from './scenes/lots-of-boxes';
import { GiganticAmountOfBoxes } from './scenes/gigantic-amount-of-boxes';
import { WalkingScene } from './scenes/walking-scene';
import { exportHeightmapToImage } from './engine/terrain';

export default class WalkingGame extends Game {
  private sceneProvider: SceneProvider;

  constructor() {
    super();

    this.sceneProvider = new SceneProvider({
      complexObjects: new ComplexObjectsScene(),
      boxes: new LotsOfBoxes(),
      giganticBoxes: new GiganticAmountOfBoxes(),
      walking: new WalkingScene(),
    });
  }

  protected async onGameLoad(): Promise<void> {
    this.scene = await this.sceneProvider.getCurrent();
    this.resetPosition();
  }

  protected onGameUpdate(): void {
    this.handleToggle('n', async () => {
      const scene = await this.sceneProvider.getNext();
      if (scene) {
        this.scene = scene;
        this.resetPosition();
      }
    });

    this.handleToggle('x', async () => {
      const hm = this.scene.getTerrainHeightmap();
      if (hm) {
        const fileName = `terrain-heightmap-${Date.now()}.png`;
        await exportHeightmapToImage(hm.data, hm.resolution, fileName);
        console.log(`Heightmap exported to files/${fileName}`);
      }
    });
  }
}
