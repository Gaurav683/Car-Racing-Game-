const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const mapCanvas = document.getElementById('minimap');
const mapCtx = mapCanvas.getContext('2d');
const healthEl = document.getElementById('health');
const healthBar = document.getElementById('healthBar');
const ammoEl = document.getElementById('ammo');
const killsEl = document.getElementById('kills');
const zoneEl = document.getElementById('zone');
const medkitsEl = document.getElementById('medkits');
const overlay = document.getElementById('overlay');
const toastEl = document.getElementById('toast');
const rifleBtn = document.getElementById('rifleBtn');
const shotgunBtn = document.getElementById('shotgunBtn');

const WORLD = { width: 3000, height: 3000 };
const BOT_COUNT = 12;
const keys = Object.create(null);
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };
const camera = { x: 0, y: 0 };
const backgroundCanvas = document.createElement('canvas');
backgroundCanvas.width = WORLD.width;
backgroundCanvas.height = WORLD.height;
const backgroundCtx = backgroundCanvas.getContext('2d');
const weapons = {
  rifle: { name: 'RIFLE', magazine: 30, ammo: 30, reserve: 90, damage: 34, rate: 0.14, speed: 900, spread: 0.035, pellets: 1, unlocked: true },
  shotgun: { name: 'SHOTGUN', magazine: 6, ammo: 6, reserve: 30, damage: 17, rate: 0.62, speed: 720, spread: 0.34, pellets: 6, unlocked: false },
};

const player = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  radius: 16,
  speed: 235,
  health: 100,
  medkits: 2,
  angle: 0,
  kills: 0,
  cooldown: 0,
  reloading: 0,
  weapon: 'rifle',
  inVehicle: false,
  flash: 0,
};

let bots = [];
let bullets = [];
let loot = [];
let particles = [];
let gameRunning = false;
let lastTime = 0;
let toastTimer = 0;
let screenShake = 0;
let damageFlash = 0;
let hitMarker = 0;
let audioContext;
let zone = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  radius: 1420,
  stage: 0,
  hold: 18,
  shrinking: false,
  shrinkFrom: 1420,
  shrinkDuration: 25,
};

const zoneStages = [1060, 770, 520, 320, 170];
const buildings = [
  { x: 410, y: 390, w: 240, h: 150, color: '#968667' },
  { x: 790, y: 720, w: 180, h: 220, color: '#8b7960' },
  { x: 1230, y: 330, w: 290, h: 180, color: '#9b8a69' },
  { x: 1990, y: 470, w: 210, h: 170, color: '#82785f' },
  { x: 2440, y: 820, w: 260, h: 180, color: '#9d8d6a' },
  { x: 360, y: 1330, w: 270, h: 190, color: '#8e8063' },
  { x: 950, y: 1570, w: 210, h: 170, color: '#9e8965' },
  { x: 1440, y: 1170, w: 300, h: 190, color: '#8c7c60' },
  { x: 2170, y: 1450, w: 260, h: 190, color: '#9b8b6a' },
  { x: 2570, y: 1910, w: 220, h: 200, color: '#88795e' },
  { x: 570, y: 2240, w: 220, h: 190, color: '#9c8a67' },
  { x: 1230, y: 2460, w: 300, h: 180, color: '#8f8065' },
  { x: 1880, y: 2220, w: 230, h: 190, color: '#a18e6b' },
  { x: 2290, y: 2580, w: 230, h: 160, color: '#8c7c5e' },
];
const trees = [];

for (let i = 0; i < 165; i += 1) {
  trees.push({ x: random(60, WORLD.width - 60), y: random(60, WORLD.height - 60), r: random(12, 24) });
}

function hash(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function buildBattlefield() {
  const terrain = backgroundCtx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
  terrain.addColorStop(0, '#718656');
  terrain.addColorStop(0.52, '#60794c');
  terrain.addColorStop(1, '#4d6947');
  backgroundCtx.fillStyle = terrain;
  backgroundCtx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (let y = 0; y < WORLD.height; y += 86) {
    for (let x = 0; x < WORLD.width; x += 86) {
      const shade = hash(x, y);
      backgroundCtx.fillStyle = shade > 0.53 ? 'rgba(177, 185, 112, 0.055)' : 'rgba(20, 48, 34, 0.055)';
      backgroundCtx.beginPath();
      backgroundCtx.ellipse(x + hash(y, x) * 55, y + shade * 42, 24 + shade * 34, 14 + shade * 20, shade * 3, 0, Math.PI * 2);
      backgroundCtx.fill();
    }
  }

  backgroundCtx.fillStyle = '#756e51';
  backgroundCtx.fillRect(0, 1420, WORLD.width, 130);
  backgroundCtx.fillRect(1435, 0, 130, WORLD.height);
  backgroundCtx.fillStyle = 'rgba(48, 47, 36, 0.18)';
  backgroundCtx.fillRect(0, 1420, WORLD.width, 9);
  backgroundCtx.fillRect(1435, 0, 9, WORLD.height);
  backgroundCtx.fillRect(0, 1541, WORLD.width, 9);
  backgroundCtx.fillRect(1556, 0, 9, WORLD.height);
  backgroundCtx.fillStyle = 'rgba(221, 213, 172, 0.58)';
  for (let x = 10; x < WORLD.width; x += 64) backgroundCtx.fillRect(x, 1483, 27, 3);
  for (let y = 10; y < WORLD.height; y += 64) backgroundCtx.fillRect(1498, y, 3, 27);

  for (let y = 28; y < WORLD.height; y += 48) {
    for (let x = 28; x < WORLD.width; x += 48) {
      const variation = hash(x, y);
      const px = x + (hash(y, x) - 0.5) * 24;
      const py = y + (variation - 0.5) * 24;
      backgroundCtx.strokeStyle = variation > 0.5 ? 'rgba(203, 214, 137, 0.22)' : 'rgba(28, 62, 37, 0.24)';
      backgroundCtx.lineWidth = 1.4;
      backgroundCtx.beginPath();
      backgroundCtx.moveTo(px, py);
      backgroundCtx.lineTo(px + (variation - 0.5) * 8, py - 4 - variation * 5);
      backgroundCtx.stroke();
    }
  }

  for (const tree of trees) drawTree(backgroundCtx, tree);
  for (const building of buildings) drawBuilding(backgroundCtx, building);

  backgroundCtx.strokeStyle = '#b6bd88';
  backgroundCtx.lineWidth = 14;
  backgroundCtx.strokeRect(4, 4, WORLD.width - 8, WORLD.height - 8);
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimer = 1.8;
}

function playTone(frequency, duration, type = 'square', volume = 0.025) {
  try {
    audioContext = audioContext || new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn('Audio playback is unavailable.', error);
  }
}

function resetWeaponState() {
  weapons.rifle.ammo = weapons.rifle.magazine;
  weapons.rifle.reserve = 90;
  weapons.shotgun.ammo = weapons.shotgun.magazine;
  weapons.shotgun.reserve = 30;
  weapons.shotgun.unlocked = false;
}

function startGame() {
  gameRunning = true;
  mouse.down = false;
  screenShake = 0;
  damageFlash = 0;
  hitMarker = 0;
  player.x = WORLD.width / 2;
  player.y = WORLD.height / 2;
  player.health = 100;
  player.medkits = 2;
  player.kills = 0;
  player.cooldown = 0;
  player.reloading = 0;
  player.weapon = 'rifle';
  player.inVehicle = false;
  resetWeaponState();
  bullets = [];
  loot = [];
  particles = [];
  bots = [];
  zone = { x: WORLD.width / 2, y: WORLD.height / 2, radius: 1420, stage: 0, hold: 18, shrinking: false, shrinkFrom: 1420, shrinkDuration: 25 };

  for (let i = 0; i < BOT_COUNT; i += 1) spawnBot();
  for (let i = 0; i < 30; i += 1) spawnLoot();

  for (const code of Object.keys(keys)) keys[code] = false;
  overlay.classList.remove('visible');
  lastTime = 0;
  updateHUD();
}

function finishGame(won) {
  if (!gameRunning) return;
  gameRunning = false;
  mouse.down = false;
  overlay.innerHTML = `
    <section class="panel">
      <p class="eyebrow">MATCH COMPLETE</p>
      <h1>${won ? 'Chicken dinner!' : 'You were eliminated'}</h1>
      <p>${won ? 'You are the last one standing.' : 'Drop back in and try a new strategy.'}<br>Eliminations: ${player.kills} / ${BOT_COUNT}</p>
      <button id="startBtn" type="button">PLAY AGAIN</button>
    </section>
  `;
  document.getElementById('startBtn').addEventListener('click', startGame);
  overlay.classList.add('visible');
}

function updateHUD() {
  const weapon = weapons[player.weapon];
  healthEl.textContent = Math.ceil(player.health);
  healthBar.style.width = `${clamp(player.health, 0, 100)}%`;
  healthBar.style.background = player.health < 30 ? '#ff6b5d' : '#a7e467';
  ammoEl.textContent = `${weapon.name} ${weapon.ammo}/${weapon.reserve}${player.reloading > 0 ? ' · RELOAD' : ''}`;
  killsEl.textContent = `${player.kills} / ${BOT_COUNT}`;
  zoneEl.textContent = zone.shrinking ? `SHRINK ${Math.ceil(zone.hold)}s` : `${Math.ceil(zone.hold)}s`;
  medkitsEl.textContent = `MEDKITS ${player.medkits}`;
  rifleBtn.classList.toggle('active', player.weapon === 'rifle');
  shotgunBtn.classList.toggle('active', player.weapon === 'shotgun');
  shotgunBtn.classList.toggle('locked', !weapons.shotgun.unlocked);
}

function spawnBot() {
  let x = player.x;
  let y = player.y;
  for (let tries = 0; tries < 30 && distance(x, y, player.x, player.y) < 520; tries += 1) {
    x = random(120, WORLD.width - 120);
    y = random(120, WORLD.height - 120);
  }
  bots.push({
    x, y, radius: 15, health: 100, angle: 0,
    speed: random(76, 96),
    cooldown: random(1, 2.4),
    wanderAngle: random(0, Math.PI * 2),
    wanderTime: random(1, 3),
    color: ['#d77b59', '#c4a75d', '#a8b48c', '#c17c70'][Math.floor(Math.random() * 4)],
  });
}

function spawnLoot(x, y, type) {
  if (typeof x !== 'number' || typeof y !== 'number') {
    x = random(100, WORLD.width - 100);
    y = random(100, WORLD.height - 100);
    for (let tries = 0; tries < 30 && buildings.some((building) => circleHitsRect(x, y, 20, building)); tries += 1) {
      x = random(100, WORLD.width - 100);
      y = random(100, WORLD.height - 100);
    }
  }
  const lootType = type || ['ammo', 'medkit', 'shotgun', 'ammo'][Math.floor(Math.random() * 4)];
  loot.push({ x, y, type: lootType, radius: 11, pulse: random(0, Math.PI * 2) });
}

function selectWeapon(name) {
  if (name === 'shotgun' && !weapons.shotgun.unlocked) {
    showToast('Find a shotgun pickup first');
    return;
  }
  player.weapon = name;
  player.reloading = 0;
  updateHUD();
}

function reload() {
  const weapon = weapons[player.weapon];
  if (player.reloading > 0 || weapon.ammo === weapon.magazine || weapon.reserve <= 0) return;
  player.reloading = player.weapon === 'shotgun' ? 1.45 : 1.15;
  showToast('Reloading…');
}

function useMedkit() {
  if (player.medkits <= 0 || player.health >= 95 || !gameRunning) return;
  player.medkits -= 1;
  player.health = Math.min(100, player.health + 45);
  createParticles(player.x, player.y, '#a7e467', 14);
  playTone(620, 0.16, 'sine', 0.04);
  showToast('First aid used +45');
  updateHUD();
}

function shoot(shooter = player, isBot = false) {
  if (!gameRunning) return;
  if (!isBot && player.reloading > 0) return;

  const weapon = isBot ? { ammo: 1, damage: 6, rate: 1.25, speed: 490, spread: 0.25, pellets: 1 } : weapons[player.weapon];
  if (!isBot && (weapon.ammo <= 0 || shooter.cooldown > 0)) {
    if (weapon.ammo <= 0) reload();
    return;
  }

  const targetAngle = isBot ? shooter.angle : player.angle;
  shooter.flash = 0.075;
  for (let i = 0; i < weapon.pellets; i += 1) {
    const angle = targetAngle + random(-weapon.spread, weapon.spread);
    bullets.push({
      x: shooter.x + Math.cos(angle) * (shooter.radius + 9),
      y: shooter.y + Math.sin(angle) * (shooter.radius + 9),
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      life: 1.25,
      damage: weapon.damage,
      owner: isBot ? 'bot' : 'player',
      radius: isBot ? 3 : 4,
      trail: 0.035,
    });
  }

  if (!isBot) {
    weapon.ammo -= 1;
    shooter.cooldown = weapon.rate;
    playTone(player.weapon === 'shotgun' ? 105 : 175, 0.07, 'sawtooth', 0.018);
  } else {
    shooter.cooldown = weapon.rate + random(0, 0.65);
  }
}

function createParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x, y,
      vx: random(-120, 120),
      vy: random(-120, 120),
      life: random(0.25, 0.65),
      radius: random(2, 4),
      color,
    });
  }
}

function cameraPosition() {
  camera.x = clamp(player.x - canvas.width / 2, 0, WORLD.width - canvas.width);
  camera.y = clamp(player.y - canvas.height / 2, 0, WORLD.height - canvas.height);
}

function circleHitsRect(x, y, radius, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.w);
  const closestY = clamp(y, rect.y, rect.y + rect.h);
  return distance(x, y, closestX, closestY) < radius;
}

function moveWithBuildings(entity, dx, dy) {
  const nextX = clamp(entity.x + dx, entity.radius, WORLD.width - entity.radius);
  if (!buildings.some((building) => circleHitsRect(nextX, entity.y, entity.radius, building))) entity.x = nextX;
  const nextY = clamp(entity.y + dy, entity.radius, WORLD.height - entity.radius);
  if (!buildings.some((building) => circleHitsRect(entity.x, nextY, entity.radius, building))) entity.y = nextY;
}

function handleInput(delta) {
  let mx = Number(Boolean(keys.KeyD || keys.ArrowRight)) - Number(Boolean(keys.KeyA || keys.ArrowLeft));
  let my = Number(Boolean(keys.KeyS || keys.ArrowDown)) - Number(Boolean(keys.KeyW || keys.ArrowUp));
  const magnitude = Math.hypot(mx, my) || 1;
  const speed = player.inVehicle ? 390 : player.speed;
  moveWithBuildings(player, (mx / magnitude) * speed * delta, (my / magnitude) * speed * delta);
  if (mouse.down) shoot();
}

function toggleVehicle() {
  if (player.inVehicle) {
    player.inVehicle = false;
    player.radius = 16;
    showToast('Exited buggy');
    return;
  }
  if (distance(player.x, player.y, WORLD.width / 2 + 65, WORLD.height / 2 + 38) < 90) {
    player.inVehicle = true;
    player.radius = 22;
    showToast('Buggy: faster movement');
  } else {
    showToast('Buggy is near the drop point');
  }
}

function collectLoot() {
  for (let i = loot.length - 1; i >= 0; i -= 1) {
    const item = loot[i];
    if (distance(player.x, player.y, item.x, item.y) > player.radius + item.radius + 5) continue;

    if (item.type === 'ammo') {
      weapons.rifle.reserve += 30;
      weapons.shotgun.reserve += 8;
      showToast('Ammo picked up');
    } else if (item.type === 'medkit') {
      player.medkits += 1;
      showToast('Medkit picked up');
    } else {
      weapons.shotgun.unlocked = true;
      player.weapon = 'shotgun';
      showToast('Shotgun acquired · press 2');
    }

    playTone(720, 0.12, 'sine', 0.035);
    createParticles(item.x, item.y, '#c4f06b', 8);
    loot.splice(i, 1);
    updateHUD();
  }
}

function updateZone(delta) {
  zone.hold -= delta;
  if (zone.hold <= 0) {
    if (!zone.shrinking) {
      zone.shrinking = true;
      zone.hold = 25;
      zone.shrinkFrom = zone.radius;
      zone.shrinkDuration = zone.hold;
      showToast('Safe zone is shrinking!');
    } else {
      zone.shrinking = false;
      zone.stage += 1;
      if (zone.stage >= zoneStages.length) {
        zone.hold = 20;
        zone.shrinking = true;
      } else {
        zone.hold = Math.max(12, 20 - zone.stage);
        zone.x += random(-100, 100);
        zone.y += random(-100, 100);
      }
    }
  }

  if (zone.shrinking) {
    const target = zoneStages[Math.min(zone.stage, zoneStages.length - 1)];
    const progress = 1 - clamp(zone.hold / zone.shrinkDuration, 0, 1);
    zone.radius = zone.shrinkFrom + (target - zone.shrinkFrom) * progress;
  }

  if (distance(player.x, player.y, zone.x, zone.y) > zone.radius) {
    player.health -= 8 * delta;
  }
}

function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.life -= delta;
    let remove = bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > WORLD.width || bullet.y > WORLD.height;

    if (!remove && buildings.some((building) => bullet.x > building.x && bullet.x < building.x + building.w && bullet.y > building.y && bullet.y < building.y + building.h)) {
      createParticles(bullet.x, bullet.y, '#d6c6a5', 3);
      remove = true;
    }

    if (!remove && bullet.owner === 'player') {
      for (let j = bots.length - 1; j >= 0; j -= 1) {
        const bot = bots[j];
        if (distance(bullet.x, bullet.y, bot.x, bot.y) >= bullet.radius + bot.radius) continue;
        bot.health -= bullet.damage;
        hitMarker = 0.14;
        createParticles(bullet.x, bullet.y, '#ffcb8c', 4);
        remove = true;
        if (bot.health <= 0) {
          createParticles(bot.x, bot.y, '#d77b59', 14);
          player.kills += 1;
          if (Math.random() < 0.8) spawnLoot(bot.x, bot.y, Math.random() < 0.42 ? 'ammo' : 'medkit');
          bots.splice(j, 1);
        }
        break;
      }
    } else if (!remove && bullet.owner === 'bot' && distance(bullet.x, bullet.y, player.x, player.y) < bullet.radius + player.radius) {
      player.health -= bullet.damage;
      screenShake = Math.min(7, screenShake + 2.8);
      damageFlash = 0.22;
      createParticles(bullet.x, bullet.y, '#ff6b5d', 4);
      remove = true;
    }

    if (remove) bullets.splice(i, 1);
  }
}

function updateBots(delta) {
  for (const bot of bots) {
    bot.cooldown -= delta;
    bot.wanderTime -= delta;
    const range = distance(bot.x, bot.y, player.x, player.y);
    const hasLineOfSight = range < 580 && !buildings.some((building) => lineHitsRect(bot.x, bot.y, player.x, player.y, building));

    if (hasLineOfSight) {
      bot.angle = Math.atan2(player.y - bot.y, player.x - bot.x);
      if (range > 230) {
        moveWithBuildings(bot, Math.cos(bot.angle) * bot.speed * delta, Math.sin(bot.angle) * bot.speed * delta);
      }
      if (bot.cooldown <= 0 && range < 450) shoot(bot, true);
    } else {
      if (bot.wanderTime <= 0) {
        bot.wanderAngle = random(0, Math.PI * 2);
        bot.wanderTime = random(1, 3);
      }
      moveWithBuildings(bot, Math.cos(bot.wanderAngle) * bot.speed * 0.45 * delta, Math.sin(bot.wanderAngle) * bot.speed * 0.45 * delta);
    }
  }
}

function lineHitsRect(x1, y1, x2, y2, rect) {
  const steps = 12;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h) return true;
  }
  return false;
}

function update(delta) {
  if (!gameRunning) return;
  handleInput(delta);
  cameraPosition();
  player.angle = Math.atan2(mouse.y + camera.y - player.y, mouse.x + camera.x - player.x);

  player.cooldown = Math.max(0, player.cooldown - delta);
  player.flash = Math.max(0, player.flash - delta);
  damageFlash = Math.max(0, damageFlash - delta);
  hitMarker = Math.max(0, hitMarker - delta);
  screenShake = Math.max(0, screenShake - 20 * delta);
  for (const bot of bots) bot.flash = Math.max(0, (bot.flash || 0) - delta);
  if (player.reloading > 0) {
    player.reloading -= delta;
    if (player.reloading <= 0) {
      const weapon = weapons[player.weapon];
      const needed = weapon.magazine - weapon.ammo;
      const loaded = Math.min(needed, weapon.reserve);
      weapon.ammo += loaded;
      weapon.reserve -= loaded;
      showToast(`${weapon.name} reloaded`);
    }
  }

  updateZone(delta);
  updateBots(delta);
  updateBullets(delta);
  collectLoot();

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
    if (particle.life <= 0) particles.splice(i, 1);
  }

  toastTimer -= delta;
  if (toastTimer <= 0) toastEl.classList.remove('show');
  updateHUD();

  if (player.health <= 0) {
    player.health = 0;
    finishGame(false);
    return;
  }
  if (bots.length === 0) {
    finishGame(true);
  }
}

function drawTree(target, tree) {
  target.fillStyle = 'rgba(20, 32, 20, 0.32)';
  target.beginPath();
  target.ellipse(tree.x + 7, tree.y + 10, tree.r * 1.35, tree.r * 0.92, 0, 0, Math.PI * 2);
  target.fill();
  target.fillStyle = '#263d2b';
  target.beginPath();
  target.arc(tree.x, tree.y, tree.r * 1.1, 0, Math.PI * 2);
  target.fill();
  target.fillStyle = '#35563a';
  target.beginPath();
  target.arc(tree.x - tree.r * 0.2, tree.y - tree.r * 0.25, tree.r * 0.78, 0, Math.PI * 2);
  target.fill();
  target.fillStyle = '#557649';
  target.beginPath();
  target.arc(tree.x - tree.r * 0.28, tree.y - tree.r * 0.32, tree.r * 0.44, 0, Math.PI * 2);
  target.fill();
  target.fillStyle = 'rgba(174, 193, 111, 0.28)';
  target.beginPath();
  target.arc(tree.x + tree.r * 0.2, tree.y - tree.r * 0.35, tree.r * 0.2, 0, Math.PI * 2);
  target.fill();
}

function drawBuilding(target, building) {
  target.fillStyle = 'rgba(22, 29, 20, 0.42)';
  target.fillRect(building.x + 14, building.y + 17, building.w, building.h);
  target.fillStyle = '#554f3d';
  target.fillRect(building.x - 4, building.y - 4, building.w + 8, building.h + 8);
  target.fillStyle = building.color;
  target.fillRect(building.x, building.y, building.w, building.h);
  const roof = target.createLinearGradient(building.x, building.y, building.x + building.w, building.y + building.h);
  roof.addColorStop(0, '#a99a78');
  roof.addColorStop(1, '#80775d');
  target.fillStyle = roof;
  target.fillRect(building.x + 8, building.y + 8, building.w - 16, building.h - 16);
  target.strokeStyle = 'rgba(53, 48, 36, 0.55)';
  target.lineWidth = 3;
  target.strokeRect(building.x + 15, building.y + 15, building.w - 30, building.h - 30);
  target.fillStyle = '#4c4a3b';
  target.fillRect(building.x + building.w / 2 - 16, building.y + building.h - 31, 32, 31);
  target.fillStyle = '#b5c3a0';
  target.fillRect(building.x + 27, building.y + 27, 27, 20);
  target.fillRect(building.x + building.w - 54, building.y + 27, 27, 20);
  target.fillStyle = 'rgba(230, 223, 186, 0.26)';
  for (let x = building.x + 20; x < building.x + building.w - 10; x += 28) {
    target.fillRect(x, building.y + 5, 2, building.h - 10);
  }
}

function drawSoldier(entity, isPlayer) {
  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.rotate(entity.angle);

  if (isPlayer && player.inVehicle) {
    ctx.fillStyle = '#b7a765';
    ctx.fillRect(-21, -14, 42, 28);
    ctx.fillStyle = '#343b2d';
    ctx.fillRect(-10, -11, 20, 22);
    ctx.fillStyle = '#22271e';
    ctx.fillRect(-15, -20, 9, 5);
    ctx.fillRect(7, -20, 9, 5);
    ctx.fillRect(-15, 15, 9, 5);
    ctx.fillRect(7, 15, 9, 5);
    ctx.restore();
    return;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(1, 5, entity.radius + 3, entity.radius * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isPlayer ? '#486c47' : entity.color;
  ctx.strokeStyle = 'rgba(22, 30, 20, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isPlayer ? '#273b2b' : '#564b38';
  ctx.fillRect(-10, -5, 17, 15);
  ctx.fillStyle = isPlayer ? '#c1ab79' : '#d6bd8b';
  ctx.beginPath();
  ctx.arc(4, -2, entity.radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20271d';
  ctx.fillRect(7, -4, entity.radius + (isPlayer && player.weapon === 'shotgun' ? 21 : 14), 7);
  ctx.fillStyle = '#9b8b65';
  ctx.fillRect(-7, 9, 6, 8);
  ctx.fillRect(4, 9, 6, 8);
  ctx.fillStyle = '#31372a';
  ctx.fillRect(-9, 14, 7, 5);
  ctx.fillRect(3, 14, 7, 5);
  ctx.fillStyle = '#c9d5a5';
  ctx.fillRect(-6, -entity.radius + 1, 10, 4);
  if (entity.flash > 0) {
    ctx.fillStyle = `rgba(255, 224, 135, ${entity.flash / 0.075})`;
    ctx.beginPath();
    ctx.moveTo(entity.radius + 12, -1);
    ctx.lineTo(entity.radius + 29, -7);
    ctx.lineTo(entity.radius + 25, 0);
    ctx.lineTo(entity.radius + 29, 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawLoot(item) {
  const y = item.y + Math.sin(item.pulse) * 3;
  ctx.save();
  ctx.shadowColor = item.type === 'medkit' ? '#9fe875' : item.type === 'shotgun' ? '#ffc266' : '#81e5ef';
  ctx.shadowBlur = 14;
  ctx.fillStyle = item.type === 'medkit' ? '#8edb69' : item.type === 'shotgun' ? '#e5a84e' : '#63cdd7';
  ctx.fillRect(item.x - 9, y - 8, 18, 16);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#17221b';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.type === 'medkit' ? '+' : item.type === 'shotgun' ? 'S' : 'A', item.x, y);
  ctx.restore();
}

function drawWorld() {
  cameraPosition();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (backgroundCanvas.dataset.ready !== 'true') {
    buildBattlefield();
    backgroundCanvas.dataset.ready = 'true';
  }

  const shakeX = screenShake > 0 ? random(-screenShake, screenShake) : 0;
  const shakeY = screenShake > 0 ? random(-screenShake, screenShake) : 0;
  ctx.drawImage(backgroundCanvas, camera.x, camera.y, canvas.width, canvas.height, shakeX, shakeY, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

  ctx.fillStyle = 'rgba(120, 35, 40, 0.23)';
  ctx.beginPath();
  ctx.rect(0, 0, WORLD.width, WORLD.height);
  ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.strokeStyle = '#a9e3ed';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
  ctx.stroke();

  for (const item of loot) drawLoot(item);

  for (const bullet of bullets) {
    ctx.strokeStyle = bullet.owner === 'player' ? 'rgba(255, 225, 133, 0.62)' : 'rgba(255, 105, 88, 0.48)';
    ctx.lineWidth = bullet.owner === 'player' ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(bullet.x - bullet.vx * 0.028, bullet.y - bullet.vy * 0.028);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.fillStyle = bullet.owner === 'player' ? '#ffe58a' : '#ff735f';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const bot of bots) {
    drawSoldier(bot, false);
    ctx.fillStyle = 'rgba(18, 23, 18, 0.8)';
    ctx.fillRect(bot.x - 17, bot.y - 27, 34, 4);
    ctx.fillStyle = '#e36d5f';
    ctx.fillRect(bot.x - 17, bot.y - 27, 34 * clamp(bot.health / 100, 0, 1), 4);
  }

  drawSoldier(player, true);
  for (const particle of particles) {
    ctx.globalAlpha = clamp(particle.life * 1.8, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawScreenEffects();
  drawMinimap();
}

function drawScreenEffects() {
  const vignette = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.22, canvas.width / 2, canvas.height / 2, canvas.width * 0.72);
  vignette.addColorStop(0, 'rgba(12, 18, 12, 0)');
  vignette.addColorStop(1, 'rgba(10, 16, 13, 0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (damageFlash > 0) {
    ctx.fillStyle = `rgba(255, 50, 37, ${damageFlash * 0.24})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (mouse.x > 0 && mouse.y > 0) {
    ctx.strokeStyle = hitMarker > 0 ? '#fff1aa' : 'rgba(241, 247, 220, 0.82)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, hitMarker > 0 ? 9 : 6, 0, Math.PI * 2);
    ctx.moveTo(mouse.x - 14, mouse.y);
    ctx.lineTo(mouse.x - 8, mouse.y);
    ctx.moveTo(mouse.x + 8, mouse.y);
    ctx.lineTo(mouse.x + 14, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 14);
    ctx.lineTo(mouse.x, mouse.y - 8);
    ctx.moveTo(mouse.x, mouse.y + 8);
    ctx.lineTo(mouse.x, mouse.y + 14);
    if (hitMarker > 0) {
      ctx.moveTo(mouse.x - 5, mouse.y - 5);
      ctx.lineTo(mouse.x - 10, mouse.y - 10);
      ctx.moveTo(mouse.x + 5, mouse.y - 5);
      ctx.lineTo(mouse.x + 10, mouse.y - 10);
      ctx.moveTo(mouse.x - 5, mouse.y + 5);
      ctx.lineTo(mouse.x - 10, mouse.y + 10);
      ctx.moveTo(mouse.x + 5, mouse.y + 5);
      ctx.lineTo(mouse.x + 10, mouse.y + 10);
    }
    ctx.stroke();
  }
}

function drawMinimap() {
  const scale = mapCanvas.width / WORLD.width;
  mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.fillStyle = '#61744d';
  mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.fillStyle = '#776d50';
  mapCtx.fillRect(0, 1430 * scale, mapCanvas.width, 110 * scale);
  mapCtx.fillRect(1445 * scale, 0, 110 * scale, mapCanvas.height);

  mapCtx.fillStyle = '#9b8865';
  for (const building of buildings) mapCtx.fillRect(building.x * scale, building.y * scale, building.w * scale, building.h * scale);

  mapCtx.strokeStyle = '#a9e3ed';
  mapCtx.lineWidth = 2;
  mapCtx.beginPath();
  mapCtx.arc(zone.x * scale, zone.y * scale, zone.radius * scale, 0, Math.PI * 2);
  mapCtx.stroke();

  for (const bot of bots) {
    mapCtx.fillStyle = '#ef715f';
    mapCtx.fillRect(bot.x * scale - 2, bot.y * scale - 2, 4, 4);
  }

  mapCtx.fillStyle = '#d7fa82';
  mapCtx.beginPath();
  mapCtx.arc(player.x * scale, player.y * scale, 4, 0, Math.PI * 2);
  mapCtx.fill();

  const viewW = canvas.width * scale;
  const viewH = canvas.height * scale;
  mapCtx.strokeStyle = 'rgba(255,255,255,0.55)';
  mapCtx.lineWidth = 1;
  mapCtx.strokeRect(camera.x * scale, camera.y * scale, viewW, viewH);
}

function updateAim(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
  mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
}

function loop(timestamp) {
  const delta = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.04);
  lastTime = timestamp;
  update(delta);
  drawWorld();
  requestAnimationFrame(loop);
}

function handleKeyDown(event) {
  keys[event.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.repeat) return;

  if (event.code === 'Digit1') selectWeapon('rifle');
  if (event.code === 'Digit2') selectWeapon('shotgun');
  if (event.code === 'KeyR') reload();
  if (event.code === 'KeyF') useMedkit();
  if (event.code === 'KeyE' && gameRunning) toggleVehicle();
  if (event.code === 'Space' && gameRunning) shoot();
}

function handleKeyUp(event) {
  keys[event.code] = false;
}

canvas.addEventListener('pointermove', updateAim);
canvas.addEventListener('pointerdown', (event) => {
  updateAim(event);
  if (gameRunning && event.button === 0) {
    mouse.down = true;
    shoot();
  }
});
window.addEventListener('pointerup', () => { mouse.down = false; });
window.addEventListener('pointercancel', () => { mouse.down = false; });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('pointerleave', () => { mouse.down = false; });
canvas.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
window.addEventListener('blur', () => {
  mouse.down = false;
  for (const code of Object.keys(keys)) keys[code] = false;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    mouse.down = false;
    for (const code of Object.keys(keys)) keys[code] = false;
  }
});

document.getElementById('startBtn').addEventListener('click', startGame);
rifleBtn.addEventListener('click', () => selectWeapon('rifle'));
shotgunBtn.addEventListener('click', () => selectWeapon('shotgun'));
document.getElementById('reloadBtn').addEventListener('click', reload);
document.getElementById('healBtn').addEventListener('click', useMedkit);
document.getElementById('fireBtn').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  mouse.down = true;
  shoot();
});
document.getElementById('fireBtn').addEventListener('pointerup', () => { mouse.down = false; });

for (const button of document.querySelectorAll('.dpad button')) {
  const code = button.dataset.key;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    keys[code] = true;
  });
  for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
    button.addEventListener(eventName, () => { keys[code] = false; });
  }
}

updateHUD();
buildBattlefield();
backgroundCanvas.dataset.ready = 'true';
requestAnimationFrame(loop);
