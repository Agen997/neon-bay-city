// Neon Bay — deterministic screenshot scenes, reached as ?shot=1..4.
// Each stages the game to show several systems at once, then freezes the
// world so the render is the same every time it loads.
import { CFG } from './config.js';
import { spawnThug } from './combat.js';
import { makeCar } from './vehicles.js';
import { addWanted } from './police.js';

function putPlayerInCar(G, x, y, angle) {
  const car = makeCar(x, y, angle, '#d43a3a', 'player');
  car.owner = 'player';
  G.cars.push(car);
  G.player.inCar = car;
  G.playerCar = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

function freeze(G) {
  G.shotMode = true;
  G.time = 12;
  G.clockMinutes = 10 * 60 + 24;
}

export function setupShot(G, n) {
  const p = G.player;
  const spots = G.world.spots;
  if (n === 1) {
    // Title over downtown: Rex on foot at the plaza, traffic passing.
    G.state = 'title';
    p.x = 1704;
    p.y = 1400;
    G.camera.x = 1552 - CFG.viewW / 2;
    G.camera.y = 1552 - CFG.viewH / 2;
    freeze(G);
    return;
  }
  if (n === 2) {
    // Driving in traffic downtown, first job on the HUD.
    G.state = 'playing';
    G.missions.index = 0;
    G.missions.step = 1;
    G.missions.timer = null;
    G.missions.target = { x: spots.garage.x, y: spots.garage.y, label: "Mara's garage", radius: 90 };
    putPlayerInCar(G, 1552, 1552, 0);
    // A few traffic cars right around the player.
    const near = [
      [1420, 1520, 0], [1700, 1584, Math.PI], [1552, 1320, Math.PI / 2], [1330, 1552, 0],
    ];
    for (const [x, y, a] of near) {
      const car = makeCar(x, y, a, '#3a7bd4', 'traffic');
      car.axis = 'x';
      car.dir = 1;
      car.road = y;
      car.speed = 0;
      G.cars.push(car);
    }
    G.camera.x = p.x - CFG.viewW / 2;
    G.camera.y = p.y - CFG.viewH / 2;
    freeze(G);
    return;
  }
  if (n === 3) {
    // Three-star police chase: Rex driving, cruisers on his tail.
    G.state = 'playing';
    G.missions.index = 1;
    G.missions.step = 1;
    G.missions.timer = 58;
    G.missions.target = { x: spots.marina.x, y: spots.marina.y, label: 'Marina', radius: 70 };
    putPlayerInCar(G, 1856, 1552, 0);
    addWanted(G, 3, 'NBPD pursuit');
    // Cruisers close behind and beside, mid-chase.
    const chase = [
      [1720, 1552, 0], [1780, 1584, 0], [1980, 1520, Math.PI],
    ];
    for (const [x, y, a] of chase) {
      const car = makeCar(x, y, a, '#e8e8e8', 'cop');
      car.hp = 120;
      G.cars.push(car);
      G.police.cruisers.push({ car });
    }
    G.police.cops.push({ x: 1900, y: 1480, hp: CFG.copHp, arrestT: 0, shootCd: 0.5 });
    G.camera.x = p.x - CFG.viewW / 2;
    G.camera.y = p.y - CFG.viewH / 2;
    freeze(G);
    return;
  }
  // Shot 4: the King boss fight on the lighthouse beach.
  G.state = 'playing';
  G.missions.index = 4;
  G.missions.step = 1;
  G.missions.timer = null;
  const beach = CFG.beach;
  const bcx = (beach.x0 + beach.x1) / 2;
  const bcy = (beach.y0 + beach.y1) / 2;
  G.missions.target = { x: bcx, y: bcy, label: 'Defeat King', radius: 720 };
  p.x = 3200;
  p.y = 1700;
  p.angle = -Math.PI / 2;
  p.hp = 78;
  const leash = { x0: beach.x0, y0: beach.y0, x1: beach.x1, y1: beach.y1 };
  const king = spawnThug(G, 3300, 1400, { hp: CFG.kingHp, speed: CFG.kingSpeed, king: true, leash, name: 'King' });
  G.missions.boss = king;
  spawnThug(G, 3220, 1500, { leash });
  spawnThug(G, 3350, 1700, { leash });
  spawnThug(G, 3200, 1900, { leash });
  spawnThug(G, 3380, 1150, { leash });
  G.camera.x = p.x - CFG.viewW / 2;
  G.camera.y = p.y - CFG.viewH / 2;
  freeze(G);
}
