// Drawing only: the world's state and the current screen in, pixels out. The whole floor is on
// screen at once, so every vision cone is drawn as a fan of rays clipped by the walls and desks
// it actually reaches — what the player sees is what the guards see. Flat shapes and canvas
// text throughout; the only glow is the gem's.

import {
  VIEW, HUD_HEIGHT, TILE, COLS, ROWS, PALETTE, FONT, VISION,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_WIN = 'win';

function isSolidTile(state, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  const tile = state.tiles[ty][tx];
  return tile === '#' || tile === 'D';
}

/** How far a ray from (x, y) along `angle` travels before it meets a wall or a desk. */
function castRay(state, x, y, angle, maxDistance) {
  const stepSize = 5;
  const steps = Math.ceil(maxDistance / stepSize);
  for (let i = 1; i <= steps; i += 1) {
    const distance = i * stepSize;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    if (isSolidTile(state, Math.floor(px / TILE), Math.floor((py - HUD_HEIGHT) / TILE))) {
      return distance - stepSize / 2;
    }
  }
  return maxDistance;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  function text(value, x, y, size, color, align = 'left', weight = 600) {
    context.font = `${weight} ${size}px ${FONT}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.fillText(value, x, y);
  }

  function drawTiles(state) {
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const tile = state.tiles[ty][tx];
        const x = tx * TILE;
        const y = HUD_HEIGHT + ty * TILE;
        if (tile === '#') {
          context.fillStyle = PALETTE.wall;
          context.fillRect(x, y, TILE, TILE);
          context.fillStyle = PALETTE.wallTop;
          context.fillRect(x, y, TILE, 5);
          continue;
        }
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
        if (tile === 'V') context.fillStyle = PALETTE.vaultFloor;
        if (tile === 's') context.fillStyle = PALETTE.rug;
        context.fillRect(x, y, TILE, TILE);
        if (tile === 's') {
          context.fillStyle = 'rgba(0, 0, 0, 0.25)';
          context.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
        }
        if (tile === 'D') {
          context.fillStyle = PALETTE.desk;
          context.fillRect(x + 2, y + 5, TILE - 4, TILE - 10);
          context.fillStyle = PALETTE.deskTop;
          context.fillRect(x + 2, y + 5, TILE - 4, 6);
          context.fillStyle = 'rgba(255, 255, 255, 0.5)';
          context.fillRect(x + 9, y + 15, 9, 6);
          context.fillRect(x + 22, y + 22, 11, 7);
        }
      }
    }
  }

  function drawExit(state) {
    const { x, y } = state.exit;
    const pulse = state.hasGem ? 0.6 + 0.4 * Math.sin(state.elapsed * 6) : 0.25;
    context.fillStyle = PALETTE.exit;
    context.fillRect(x - TILE / 2, y - TILE / 2, TILE, TILE);
    // The getaway van, side on: body, cab, windows and wheels.
    context.fillStyle = '#d7dde6';
    context.beginPath();
    context.roundRect(x - 17, y - 10, 34, 17, 3);
    context.fill();
    context.fillStyle = '#33404f';
    context.fillRect(x + 6, y - 7, 8, 6);
    context.fillRect(x - 14, y - 7, 12, 6);
    context.fillStyle = '#14171c';
    context.beginPath();
    context.arc(x - 10, y + 8, 4, 0, Math.PI * 2);
    context.arc(x + 11, y + 8, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = `rgba(242, 201, 76, ${pulse})`;
    context.lineWidth = 2;
    context.strokeRect(x - TILE / 2 + 1, y - TILE / 2 + 1, TILE - 2, TILE - 2);
  }

  function drawLoots(state) {
    for (const loot of state.loots) {
      if (loot.taken) continue;
      if (loot.kind === 'gem') {
        const bob = Math.sin(state.elapsed * 3 + loot.x) * 2;
        context.save();
        context.shadowColor = PALETTE.gem;
        context.shadowBlur = 16;
        context.fillStyle = PALETTE.gem;
        context.beginPath();
        context.moveTo(loot.x, loot.y - 11 + bob);
        context.lineTo(loot.x + 9, loot.y + bob);
        context.lineTo(loot.x, loot.y + 11 + bob);
        context.lineTo(loot.x - 9, loot.y + bob);
        context.closePath();
        context.fill();
        context.restore();
        context.fillStyle = 'rgba(255, 255, 255, 0.75)';
        context.beginPath();
        context.moveTo(loot.x, loot.y - 6 + bob);
        context.lineTo(loot.x + 4, loot.y + bob);
        context.lineTo(loot.x, loot.y + 6 + bob);
        context.lineTo(loot.x - 4, loot.y + bob);
        context.closePath();
        context.fill();
      } else {
        context.fillStyle = PALETTE.cash;
        context.beginPath();
        context.arc(loot.x, loot.y + 2, 9, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#4d9440';
        context.fillRect(loot.x - 4, loot.y - 11, 8, 5);
        text('$', loot.x, loot.y + 3, 12, '#10330c', 'center', 800);
      }
    }
  }

  function drawCone(state, watcher, range, halfAngle, rgb) {
    const rays = 26;
    context.beginPath();
    context.moveTo(watcher.x, watcher.y);
    for (let i = 0; i <= rays; i += 1) {
      const angle = watcher.angle - halfAngle + (2 * halfAngle * i) / rays;
      const distance = castRay(state, watcher.x, watcher.y, angle, range);
      context.lineTo(watcher.x + Math.cos(angle) * distance, watcher.y + Math.sin(angle) * distance);
    }
    context.closePath();
    const alpha = 0.13 + watcher.see * 0.13;
    context.fillStyle = `rgba(${rgb}, ${alpha})`;
    context.fill();
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      drawCone(state, guard, VISION.guardRange, VISION.guardHalfAngle,
        guard.see > 0.4 ? '255, 96, 66' : PALETTE.coneGuard);
    }
    for (const guard of state.guards) {
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardCap;
      context.beginPath();
      context.arc(guard.x, guard.y, 12, guard.angle - 2.2, guard.angle + 2.2);
      context.lineTo(guard.x, guard.y);
      context.closePath();
      context.fill();
      context.fillStyle = '#e8c39a';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 4, guard.y + Math.sin(guard.angle) * 4, 5, 0, Math.PI * 2);
      context.fill();
      if (guard.see > 0.55) {
        text('!', guard.x, guard.y - 24, 20, PALETTE.alarm, 'center', 800);
      }
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      drawCone(state, camera, VISION.cameraRange, VISION.cameraHalfAngle, PALETTE.coneCamera);
    }
    for (const camera of state.cameras) {
      context.save();
      context.translate(camera.x, camera.y);
      context.rotate(camera.angle);
      context.fillStyle = '#20242e';
      context.beginPath();
      context.roundRect(-4, -6, 15, 12, 3);
      context.fill();
      context.fillStyle = PALETTE.camera;
      context.beginPath();
      context.roundRect(8, -4, 6, 8, 2);
      context.fill();
      context.restore();
      const blink = camera.see > 0.1 || Math.sin(state.elapsed * 2.4 + camera.phase) > 0.4;
      if (blink) {
        context.fillStyle = PALETTE.alarm;
        context.beginPath();
        context.arc(camera.x, camera.y - 9, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.sneaking) {
      context.strokeStyle = 'rgba(232, 185, 60, 0.5)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(player.x, player.y, 16, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(player.x, player.y, 12, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.thiefTrim;
    context.lineWidth = 2;
    context.stroke();
    // The mask stripe turns the blob into a burglar; the sack shows once the gem is aboard.
    context.strokeStyle = '#dfe6f2';
    context.lineWidth = 3;
    context.beginPath();
    const ex = Math.cos(player.angle);
    const ey = Math.sin(player.angle);
    context.moveTo(player.x + ex * 3 - ey * 5, player.y + ey * 3 + ex * 5);
    context.lineTo(player.x + ex * 3 + ey * 5, player.y + ey * 3 - ex * 5);
    context.stroke();
    if (state.hasGem) {
      context.fillStyle = PALETTE.gem;
      context.beginPath();
      context.arc(player.x - ex * 10, player.y - ey * 10, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawAlarmVignette(state) {
    if (state.alarm < 45) return;
    const strength = (state.alarm - 45) / 55;
    const flash = state.exposure > 0 ? 0.12 + 0.1 * Math.sin(state.elapsed * 14) : 0;
    const gradient = context.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42,
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.78,
    );
    gradient.addColorStop(0, 'rgba(255, 40, 30, 0)');
    gradient.addColorStop(1, `rgba(255, 40, 30, ${0.26 * strength + flash})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawHud(state, muted) {
    context.fillStyle = '#11151f';
    context.fillRect(0, 0, VIEW.width, HUD_HEIGHT);
    context.fillStyle = 'rgba(255, 255, 255, 0.08)';
    context.fillRect(0, HUD_HEIGHT - 1, VIEW.width, 1);
    text(`FLOOR ${state.levelIndex + 1} · ${state.level.name.toUpperCase()}`, 14, HUD_HEIGHT / 2, 14, PALETTE.muted, 'left', 700);

    // The alarm meter, centre stage: it is the game's clock and its threat in one bar.
    const meterX = VIEW.width / 2 - 130;
    const meterY = HUD_HEIGHT / 2 - 8;
    text('ALARM', meterX - 10, HUD_HEIGHT / 2, 13, state.alarm > 70 ? PALETTE.alarm : PALETTE.muted, 'right', 800);
    context.fillStyle = '#05070b';
    context.beginPath();
    context.roundRect(meterX, meterY, 260, 16, 4);
    context.fill();
    if (state.alarm > 0) {
      const heat = state.alarm / 100;
      context.fillStyle = heat < 0.45 ? '#e8c93c' : heat < 0.75 ? '#f08c2e' : PALETTE.alarm;
      context.beginPath();
      context.roundRect(meterX + 2, meterY + 2, (260 - 4) * heat, 12, 3);
      context.fill();
    }
    context.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(meterX, meterY, 260, 16, 4);
    context.stroke();
    if (state.exposure > 0) {
      text('SPOTTED!', meterX + 272, HUD_HEIGHT / 2, 13, PALETTE.alarm, 'left', 800);
    }

    // Loot and score, right side.
    let right = VIEW.width - 14;
    const seconds = Math.floor(state.elapsed);
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    text(clock, right, HUD_HEIGHT / 2, 15, PALETTE.text, 'right', 700);
    right -= 52;
    text(String(state.score), right, HUD_HEIGHT / 2, 15, PALETTE.gold, 'right', 800);
    right -= String(state.score).length * 9 + 14;
    text(`$ ${state.cashTaken}/${state.cashTotal}`, right, HUD_HEIGHT / 2, 14, PALETTE.cash, 'right', 700);
    right -= 58;
    context.save();
    context.translate(right - 6, HUD_HEIGHT / 2);
    context.fillStyle = state.hasGem ? PALETTE.gem : 'rgba(255, 255, 255, 0.2)';
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(6, 0);
    context.lineTo(0, 8);
    context.lineTo(-6, 0);
    context.closePath();
    context.fill();
    context.restore();
    if (muted) text('MUTED', 14, VIEW.height - 12, 11, PALETTE.muted, 'left', 600);
  }

  function drawMessage(state) {
    if (state.messageTime <= 0 || !state.message) return;
    context.font = `600 15px ${FONT}`;
    const boxWidth = context.measureText(state.message).width + 28;
    context.fillStyle = 'rgba(5, 7, 11, 0.78)';
    context.beginPath();
    context.roundRect(VIEW.width / 2 - boxWidth / 2, VIEW.height - 42, boxWidth, 26, 6);
    context.fill();
    text(state.message, VIEW.width / 2, VIEW.height - 29, 15, PALETTE.text, 'center', 600);
  }

  function drawBanner(state) {
    if (state.elapsed > 2.4 || state.complete || state.caught) return;
    const alpha = state.elapsed < 1.9 ? 1 : (2.4 - state.elapsed) * 2;
    context.save();
    context.globalAlpha = Math.max(0, alpha);
    context.fillStyle = 'rgba(5, 7, 11, 0.72)';
    context.fillRect(0, HUD_HEIGHT + 190, VIEW.width, 92);
    text(`FLOOR ${state.levelIndex + 1} — ${state.level.name.toUpperCase()}`, VIEW.width / 2, HUD_HEIGHT + 222, 26, PALETTE.gold, 'center', 800);
    text('Lift the gem, fill your pockets, reach the van.', VIEW.width / 2, HUD_HEIGHT + 254, 15, PALETTE.text, 'center', 500);
    context.restore();
  }

  function drawPanel(title, titleColor, lines, prompt) {
    context.fillStyle = 'rgba(4, 6, 10, 0.66)';
    context.fillRect(0, HUD_HEIGHT, VIEW.width, VIEW.height - HUD_HEIGHT);
    const panelWidth = 620;
    const panelHeight = 118 + lines.length * 27 + 44;
    const x = (VIEW.width - panelWidth) / 2;
    const y = HUD_HEIGHT + (VIEW.height - HUD_HEIGHT - panelHeight) / 2;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x, y, panelWidth, panelHeight, 10);
    context.fill();
    context.strokeStyle = 'rgba(242, 201, 76, 0.35)';
    context.lineWidth = 1.5;
    context.stroke();
    text(title, VIEW.width / 2, y + 46, 40, titleColor, 'center', 800);
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 92 + i * 27, 16, PALETTE.text, 'center', 500);
    });
    if (prompt) text(prompt, VIEW.width / 2, y + panelHeight - 26, 16, PALETTE.gold, 'center', 700);
  }

  function lootLine(state) {
    const gem = state.hasGem ? 'Gem lifted' : 'Gem left in the vault';
    return `${gem} · Cash ${state.cashTaken} of ${state.cashTotal} · Score ${state.score}`;
  }

  /** Paint one frame. `screen` is one of the SCREEN_* values; `muted` shows the mute flag. */
  function draw(state, screen, muted) {
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    drawTiles(state);
    drawExit(state);
    drawLoots(state);
    drawCameras(state);
    drawGuards(state);
    drawPlayer(state);
    drawAlarmVignette(state);
    drawHud(state, muted);
    drawMessage(state);

    if (screen === SCREEN_PLAY) {
      drawBanner(state);
      return;
    }
    if (screen === SCREEN_TITLE) {
      drawPanel('MIDNIGHT VAULT', PALETTE.gold, [
        'A top-down stealth heist in three floors.',
        'Move: WASD or arrows · Tiptoe: hold Shift · Pause: P · Sound: M',
        'Cross in shadow and behind desks — being seen fills the ALARM.',
        'A full meter is not the end: break line of sight before it counts down.',
        'Take the gem from the vault, grab cash on the way, and reach the van.',
      ], 'Press ENTER to start the job');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', PALETTE.text, ['The guards hold their breath too.'], 'Press P to resume');
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('BUSTED!', PALETTE.alarm, [
        `Caught on floor ${state.levelIndex + 1}, ${Math.floor(state.elapsed)} seconds in.`,
        lootLine(state),
        'The loot is impounded. The floors reset; the lesson stays.',
      ], 'Press ENTER to try this floor again');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('CLEAN GETAWAY', PALETTE.gem, [
        lootLine(state),
        `Time bonus ${state.timeBonus} · ${Math.floor(state.elapsed)} seconds on the floor`,
      ], state.levelIndex + 1 < 3 ? 'Press ENTER for the next floor' : 'Press ENTER');
    } else if (screen === SCREEN_WIN) {
      drawPanel('MASTER THIEF', PALETTE.gold, [
        'All three floors emptied, and nobody can prove a thing.',
        `Final score ${state.score}`,
      ], 'Press ENTER to play again');
    }
  }

  return { draw };
}
