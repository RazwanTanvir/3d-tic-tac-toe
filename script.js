/**
 * QUBIC 3D — Spatial 3×3×3 Tic-Tac-Toe
 * Pure HTML5 / CSS3D / ES6 Spatial Game Engine, AI, & Procedural Audio
 */

(() => {
  'use strict';

  /* =========================================================================
   * 1. PROCEDURAL WEB AUDIO SYNTHESIZER
   * ========================================================================= */
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    tone(freq, type = 'sine', duration = 0.12, vol = 0.12, slideTo = null, delay = 0) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    playHover(layer = 1) {
      const base = [520, 440, 360][layer] || 440;
      this.tone(base, 'sine', 0.045, 0.03);
    }

    playPlace(player, layer = 1) {
      const layerShift = (2 - layer) * 55;
      if (player === 'X') {
        this.tone(380 + layerShift, 'triangle', 0.14, 0.13, 620 + layerShift);
        this.tone(760 + layerShift, 'sine', 0.18, 0.07, null, 0.03);
      } else {
        this.tone(310 + layerShift, 'sine', 0.16, 0.14, 460 + layerShift);
        this.tone(465 + layerShift, 'triangle', 0.19, 0.08, null, 0.03);
      }
    }

    playHint() {
      this.tone(587.33, 'sine', 0.14, 0.1, null, 0);
      this.tone(880, 'sine', 0.22, 0.11, null, 0.07);
    }

    playUndo() {
      this.tone(480, 'triangle', 0.12, 0.09, 280);
    }

    playWin(player) {
      const notes = player === 'X'
        ? [523.25, 659.25, 783.99, 1046.5]
        : [440, 554.37, 659.25, 880];
      notes.forEach((n, i) => {
        this.tone(n, 'triangle', 0.36, 0.14, null, i * 0.085);
        this.tone(n * 1.5, 'sine', 0.32, 0.06, null, i * 0.085 + 0.02);
      });
    }

    playDraw() {
      this.tone(340, 'sawtooth', 0.18, 0.07, 290, 0);
      this.tone(280, 'triangle', 0.26, 0.08, 220, 0.12);
    }
  }

  /* =========================================================================
   * 2. WINNING LINES GENERATOR (49 LINES IN 3×3×3 / 8 IN CLASSIC 3×3)
   * ========================================================================= */
  function idxOf(l, r, c) {
    return l * 9 + r * 3 + c;
  }

  function coordsOf(idx) {
    const l = Math.floor(idx / 9);
    const rem = idx % 9;
    const r = Math.floor(rem / 3);
    const c = rem % 3;
    return { l, r, c };
  }

  function formatCoord(idx, isClassic = false) {
    const { l, r, c } = coordsOf(idx);
    if (isClassic) return `R${r + 1}·C${c + 1}`;
    const nexus = l === 1 && r === 1 && c === 1 ? ' ★' : '';
    return `L${l + 1}·R${r + 1}·C${c + 1}${nexus}`;
  }

  function buildWinLines() {
    const lines = [];

    // 1. Single-layer rows, columns, and flat diagonals (24 lines)
    for (let l = 0; l < 3; l++) {
      const layerNum = l + 1;
      for (let r = 0; r < 3; r++) {
        lines.push({
          cells: [idxOf(l, r, 0), idxOf(l, r, 1), idxOf(l, r, 2)],
          type: `Layer ${layerNum} Horizontal Row`,
          category: 'planar',
          layer: l
        });
      }
      for (let c = 0; c < 3; c++) {
        lines.push({
          cells: [idxOf(l, 0, c), idxOf(l, 1, c), idxOf(l, 2, c)],
          type: `Layer ${layerNum} Depth Column`,
          category: 'planar',
          layer: l
        });
      }
      lines.push({
        cells: [idxOf(l, 0, 0), idxOf(l, 1, 1), idxOf(l, 2, 2)],
        type: `Layer ${layerNum} Diagonal`,
        category: 'planar',
        layer: l
      });
      lines.push({
        cells: [idxOf(l, 0, 2), idxOf(l, 1, 1), idxOf(l, 2, 0)],
        type: `Layer ${layerNum} Diagonal`,
        category: 'planar',
        layer: l
      });
    }

    // 2. Vertical Pillars across layers (9 lines)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        lines.push({
          cells: [idxOf(0, r, c), idxOf(1, r, c), idxOf(2, r, c)],
          type: `Vertical Pillar (R${r + 1}·C${c + 1})`,
          category: 'pillar'
        });
      }
    }

    // 3. Staircase Diagonals along constant Row (6 lines)
    for (let r = 0; r < 3; r++) {
      lines.push({
        cells: [idxOf(0, r, 0), idxOf(1, r, 1), idxOf(2, r, 2)],
        type: `Row ${r + 1} 3D Staircase Diagonal`,
        category: 'staircase'
      });
      lines.push({
        cells: [idxOf(0, r, 2), idxOf(1, r, 1), idxOf(2, r, 0)],
        type: `Row ${r + 1} 3D Staircase Diagonal`,
        category: 'staircase'
      });
    }

    // 4. Staircase Diagonals along constant Column (6 lines)
    for (let c = 0; c < 3; c++) {
      lines.push({
        cells: [idxOf(0, 0, c), idxOf(1, 1, c), idxOf(2, 2, c)],
        type: `Col ${c + 1} 3D Staircase Diagonal`,
        category: 'staircase'
      });
      lines.push({
        cells: [idxOf(0, 2, c), idxOf(1, 1, c), idxOf(2, 0, c)],
        type: `Col ${c + 1} 3D Staircase Diagonal`,
        category: 'staircase'
      });
    }

    // 5. True 3D Space Diagonals through the Center Nexus (4 lines)
    lines.push({
      cells: [idxOf(0, 0, 0), idxOf(1, 1, 1), idxOf(2, 2, 2)],
      type: '3D Apex Space Diagonal',
      category: 'space'
    });
    lines.push({
      cells: [idxOf(0, 0, 2), idxOf(1, 1, 1), idxOf(2, 2, 0)],
      type: '3D Apex Space Diagonal',
      category: 'space'
    });
    lines.push({
      cells: [idxOf(0, 2, 0), idxOf(1, 1, 1), idxOf(2, 0, 2)],
      type: '3D Apex Space Diagonal',
      category: 'space'
    });
    lines.push({
      cells: [idxOf(0, 2, 2), idxOf(1, 1, 1), idxOf(2, 0, 0)],
      type: '3D Apex Space Diagonal',
      category: 'space'
    });

    return lines;
  }

  const ALL_3D_LINES = buildWinLines(); // 49 lines
  const CLASSIC_LINES = ALL_3D_LINES.filter((ln) => ln.layer === 1); // 8 lines on middle layer

  // Precompute how many winning lines intersect each cell
  function computeCellPower(lines) {
    const counts = new Array(27).fill(0);
    for (const ln of lines) {
      for (const cellIdx of ln.cells) {
        counts[cellIdx]++;
      }
    }
    return counts;
  }

  const POWER_3D = computeCellPower(ALL_3D_LINES);
  const POWER_CLASSIC = computeCellPower(CLASSIC_LINES);

  /* =========================================================================
   * 3. SPATIAL AI & TACTICAL HINT ENGINE
   * ========================================================================= */
  class SpatialAI {
    static getValidMoves(board, gridMode) {
      const moves = [];
      for (let i = 0; i < 27; i++) {
        if (gridMode === 'classic' && Math.floor(i / 9) !== 1) continue;
        if (board[i] === null) moves.push(i);
      }
      return moves;
    }

    static findImmediateWins(board, player, lines) {
      const wins = [];
      for (const ln of lines) {
        const [a, b, c] = ln.cells;
        const vals = [board[a], board[b], board[c]];
        const pCount = vals.filter((v) => v === player).length;
        const emptyCount = vals.filter((v) => v === null).length;
        if (pCount === 2 && emptyCount === 1) {
          const target = ln.cells[vals.indexOf(null)];
          wins.push({ cell: target, line: ln });
        }
      }
      return wins;
    }

    static evaluateBoard(board, maxPlayer, minPlayer, lines, powerTable) {
      let score = 0;
      let maxThreats = 0;
      let minThreats = 0;

      for (const ln of lines) {
        let maxCount = 0;
        let minCount = 0;
        for (const idx of ln.cells) {
          if (board[idx] === maxPlayer) maxCount++;
          else if (board[idx] === minPlayer) minCount++;
        }

        if (maxCount > 0 && minCount > 0) continue; // blocked line

        if (maxCount === 3) return 100000;
        if (minCount === 3) return -100000;

        if (maxCount === 2) {
          score += 180;
          maxThreats++;
        } else if (maxCount === 1) {
          score += 18;
        }

        if (minCount === 2) {
          score -= 195;
          minThreats++;
        } else if (minCount === 1) {
          score -= 18;
        }
      }

      // Double-threat (Fork) bonus
      if (maxThreats >= 2) score += 650 * maxThreats;
      if (minThreats >= 2) score -= 700 * minThreats;

      // Positional synergy (center nexus = 13 lines, corners = 7 lines)
      for (let i = 0; i < 27; i++) {
        if (board[i] === maxPlayer) score += powerTable[i] * 3;
        else if (board[i] === minPlayer) score -= powerTable[i] * 3;
      }

      return score;
    }

    static analyzeBestMove(board, player, difficulty = 'hard', gridMode = '3d') {
      const opponent = player === 'X' ? 'O' : 'X';
      const lines = gridMode === '3d' ? ALL_3D_LINES : CLASSIC_LINES;
      const powerTable = gridMode === '3d' ? POWER_3D : POWER_CLASSIC;
      const validMoves = this.getValidMoves(board, gridMode);

      if (validMoves.length === 0) return null;

      // 1. Check immediate winning move
      const ownWins = this.findImmediateWins(board, player, lines);
      if (ownWins.length > 0) {
        return {
          cell: ownWins[0].cell,
          reason: `Completes ${ownWins[0].line.type} for immediate victory!`
        };
      }

      // 2. Check immediate opponent threat to block (even Easy blocks 75% of the time)
      const oppWins = this.findImmediateWins(board, opponent, lines);
      if (oppWins.length > 0 && (difficulty !== 'easy' || Math.random() < 0.72)) {
        return {
          cell: oppWins[0].cell,
          reason: `Critical block against opponent's ${oppWins[0].line.type}!`
        };
      }

      // Easy mode: mostly playful positional + random moves
      if (difficulty === 'easy') {
        const randomCell = validMoves[Math.floor(Math.random() * validMoves.length)];
        return {
          cell: randomCell,
          reason: `Open position intersecting ${powerTable[randomCell]} win lines.`
        };
      }

      // 3. Center Nexus priority if available on opening turns
      const centerIdx = 13; // (1, 1, 1)
      if (board[centerIdx] === null && (difficulty === 'hard' || Math.random() < 0.65)) {
        return {
          cell: centerIdx,
          reason: gridMode === '3d'
            ? 'Captures the Center Nexus (L2·R2·C2), controlling 13 winning lines!'
            : 'Captures the center square, controlling 4 winning lines!'
        };
      }

      // 4. Lookahead search (Depth 2 for Medium, Depth 3 with Alpha-Beta beam pruning for Hard)
      const scoredMoves = validMoves.map((move) => {
        board[move] = player;
        const baseEval = this.evaluateBoard(board, player, opponent, lines, powerTable);
        // Check if this move creates a fork (2+ simultaneous threats)
        const createdThreats = this.findImmediateWins(board, player, lines).length;
        board[move] = null;
        return { move, baseEval, createdThreats };
      });

      scoredMoves.sort((a, b) => b.baseEval - a.baseEval);

      if (difficulty === 'medium') {
        const topSlice = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
        const pick = topSlice[Math.floor(Math.random() * topSlice.length)];
        return {
          cell: pick.move,
          reason: pick.createdThreats >= 2
            ? `Creates a double-threat fork (${pick.createdThreats} simultaneous win lines)!`
            : `Strong spatial control (${powerTable[pick.move]} intersecting lines).`
        };
      }

      // Grandmaster (Hard): 2-ply adversarial minimax over top candidate moves
      const candidates = scoredMoves.slice(0, Math.min(10, scoredMoves.length));
      let bestMove = candidates[0].move;
      let bestVal = -Infinity;
      let bestMeta = candidates[0];

      for (const cand of candidates) {
        const m = cand.move;
        board[m] = player;

        // Simulate opponent's strongest response
        const oppMoves = this.getValidMoves(board, gridMode);
        let worstReply = Infinity;

        for (const om of oppMoves) {
          board[om] = opponent;
          const val = this.evaluateBoard(board, player, opponent, lines, powerTable);
          if (val < worstReply) worstReply = val;
          board[om] = null;
        }

        const finalScore = oppMoves.length === 0 ? cand.baseEval : worstReply;
        board[m] = null;

        if (finalScore > bestVal) {
          bestVal = finalScore;
          bestMove = m;
          bestMeta = cand;
        }
      }

      let reason = `Optimal strategic node (${powerTable[bestMove]} win lines).`;
      if (bestMeta.createdThreats >= 2) {
        reason = `Creates an unstoppable ${bestMeta.createdThreats}-way spatial fork!`;
      } else if (bestMeta.createdThreats === 1) {
        reason = `Forces opponent on the defensive while building ${powerTable[bestMove]}-line synergy.`;
      } else if (powerTable[bestMove] === 7) {
        reason = `Secures a 3D Corner Vertex controlling 7 multi-planar lines.`;
      }

      return { cell: bestMove, reason };
    }
  }

  /* =========================================================================
   * 4. AMBIENT & CELEBRATION PARTICLE CANVAS
   * ========================================================================= */
  class ParticleFX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.stars = [];
      this.sparks = [];
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.initStars();
      this.loop();
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    initStars() {
      this.stars = Array.from({ length: 55 }, () => ({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: Math.random() * 1.6 + 0.4,
        alpha: Math.random() * 0.5 + 0.15,
        vy: -(Math.random() * 0.18 + 0.04),
        hue: Math.random() > 0.5 ? 190 : 345
      }));
    }

    burstWin(player) {
      const cx = this.width * 0.5;
      const cy = this.height * 0.52;
      const color = player === 'X' ? '#22d3ee' : '#fb7185';
      for (let i = 0; i < 85; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6.5 + 1.8;
        this.sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          r: Math.random() * 3.2 + 1.5,
          alpha: 1,
          color: i % 5 === 0 ? '#ffffff' : color
        });
      }
    }

    loop() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      for (const s of this.stars) {
        s.y += s.vy;
        if (s.y < 0) {
          s.y = this.height;
          s.x = Math.random() * this.width;
        }
        this.ctx.fillStyle = `hsla(${s.hue}, 90%, 72%, ${s.alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        this.ctx.fill();
      }

      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const p = this.sparks[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.09; // subtle gravity
        p.vx *= 0.985;
        p.alpha -= 0.015;
        if (p.alpha <= 0) {
          this.sparks.splice(i, 1);
          continue;
        }
        this.ctx.save();
        this.ctx.globalAlpha = p.alpha;
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }

      requestAnimationFrame(() => this.loop());
    }
  }

  /* =========================================================================
   * 5. MAIN 3D SPATIAL GAME CONTROLLER
   * ========================================================================= */
  class QubicGameApp {
    constructor() {
      this.sound = new SoundEngine();
      this.fx = new ParticleFX(document.getElementById('fx-canvas'));

      // Spatial Constants
      this.CELL_STEP = 92;
      this.BASE_LAYER_GAP = 114;

      // Game State
      this.board = new Array(27).fill(null);
      this.currentTurn = 'X';
      this.gameMode = 'ai';       // 'ai' | 'pvp'
      this.aiDifficulty = 'hard'; // 'easy' | 'medium' | 'hard'
      this.gridMode = '3d';       // '3d' | 'classic'
      this.gameOver = false;
      this.winningLine = null;
      this.moveHistory = [];      // [{ cell, player, moveNum }]
      this.hintCell = null;
      this.aiTimer = null;

      // Spatial View State
      this.camPitch = -24;
      this.camYaw = -36;
      this.camZoom = 1;
      this.explodePct = 100;
      this.isolatedLayer = 'all'; // 'all' | 0 | 1 | 2
      this.xrayEnabled = true;
      this.autoRotate = false;

      // Pointer / Orbit Drag Tracking
      this.isDragging = false;
      this.dragMoved = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.lastPointerX = 0;
      this.lastPointerY = 0;

      // Scores
      this.scores = this.loadScores();

      // DOM References
      this.cacheDOM();
      this.buildSceneDOM();
      this.buildSlicesDOM();
      this.bindEvents();
      this.updateCameraCSS(false);
      this.updateScoreboardUI();
      this.updateTelemetry(null);
      this.startAutoRotateLoop();
    }

    loadScores() {
      try {
        const raw = localStorage.getItem('qubic3d_scores_v1');
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      return { X: 0, O: 0, draws: 0 };
    }

    saveScores() {
      try {
        localStorage.setItem('qubic3d_scores_v1', JSON.stringify(this.scores));
      } catch (_) {}
    }

    cacheDOM() {
      this.sceneEl = document.getElementById('scene-3d');
      this.viewportEl = document.getElementById('viewport-stage');
      this.layersGroupEl = document.getElementById('layers-group');
      this.pillarsGroupEl = document.getElementById('pillars-group');
      this.beamsGroupEl = document.getElementById('beams-group');
      this.slicesContainerEl = document.getElementById('slices-container');

      this.statusBannerEl = document.getElementById('status-banner');
      this.statusDotEl = document.getElementById('status-dot');
      this.statusTextEl = document.getElementById('status-text');
      this.coordValueEl = document.getElementById('coord-value');

      this.scoreCardX = document.getElementById('score-card-x');
      this.scoreCardO = document.getElementById('score-card-o');
      this.scoreXEl = document.getElementById('score-x');
      this.scoreOEl = document.getElementById('score-o');
      this.scoreDrawsEl = document.getElementById('score-draws');
      this.labelPlayerX = document.getElementById('label-player-x');
      this.labelPlayerO = document.getElementById('label-player-o');
      this.turnTagX = document.getElementById('turn-tag-x');
      this.turnTagO = document.getElementById('turn-tag-o');

      this.moveListEl = document.getElementById('move-list');
      this.moveCounterEl = document.getElementById('move-counter');
      this.btnUndo = document.getElementById('btn-undo');
      this.btnHint = document.getElementById('btn-hint');

      this.telTotalLines = document.getElementById('tel-total-lines');
      this.telCellPower = document.getElementById('tel-cell-power');
      this.telThreats = document.getElementById('tel-threats');
      this.tacticalNote = document.getElementById('tactical-note');

      this.cell3dEls = [];
      this.layerPlaneEls = [];
      this.pillarEls = [];
      this.sliceCellEls = [];
      this.sliceCardEls = [];
    }

    /* ---------------------------------------------------------------------
     * BUILD 3D DOM (3 LAYER PLANES, 9 VERTICAL PILLARS, 27 3D CELLS)
     * --------------------------------------------------------------------- */
    buildSceneDOM() {
      this.layersGroupEl.innerHTML = '';
      this.pillarsGroupEl.innerHTML = '';
      this.cell3dEls = new Array(27);
      this.layerPlaneEls = [];
      this.pillarEls = [];

      // 1. Vertical Pillars connecting the 9 (r, c) columns across layers
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const x = (c - 1) * this.CELL_STEP;
          const z = (r - 1) * this.CELL_STEP;
          const pillar = document.createElement('div');
          pillar.className = 'pillar-line';
          pillar.dataset.x = x;
          pillar.dataset.z = z;
          this.pillarsGroupEl.appendChild(pillar);
          this.pillarEls.push(pillar);
        }
      }

      // 2. Layer Planes & 27 3D Cell Nodes
      const layerNames = ['L1 · TOP LAYER', 'L2 · MID NEXUS', 'L3 · BASE LAYER'];
      for (let l = 0; l < 3; l++) {
        const plane = document.createElement('div');
        plane.className = 'layer-plane';
        plane.dataset.layer = l;

        const tag = document.createElement('div');
        tag.className = 'layer-plane-tag';
        tag.textContent = layerNames[l];
        plane.appendChild(tag);

        this.layersGroupEl.appendChild(plane);
        this.layerPlaneEls.push(plane);

        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const idx = idxOf(l, r, c);
            const cellNode = document.createElement('div');
            cellNode.className = 'cell-3d';
            if (idx === 13) cellNode.classList.add('is-nexus');
            cellNode.dataset.idx = idx;
            cellNode.dataset.layer = l;

            const pad = document.createElement('div');
            pad.className = 'cell-pad';

            const coordSpan = document.createElement('span');
            coordSpan.className = 'pad-coord';
            coordSpan.textContent = idx === 13 ? '★' : `${r + 1}·${c + 1}`;
            pad.appendChild(coordSpan);

            const pieceAnchor = document.createElement('div');
            pieceAnchor.className = 'piece-anchor';

            cellNode.appendChild(pad);
            cellNode.appendChild(pieceAnchor);

            // Pointer Events on the 3D Pad
            pad.addEventListener('pointerenter', () => this.onCellHover(idx, true));
            pad.addEventListener('pointerleave', () => this.onCellLeave(idx));
            pad.addEventListener('click', (e) => {
              e.stopPropagation();
              if (this.dragMoved) return;
              this.handleCellSelect(idx);
            });

            this.layersGroupEl.appendChild(cellNode);
            this.cell3dEls[idx] = cellNode;
          }
        }
      }

      this.updateSpatialPositions();
    }

    updateSpatialPositions() {
      const gap = this.BASE_LAYER_GAP * (this.explodePct / 100);
      const isClassic = this.gridMode === 'classic';

      // Update Vertical Pillars
      for (const pillar of this.pillarEls) {
        const x = Number(pillar.dataset.x);
        const z = Number(pillar.dataset.z);
        pillar.style.display = isClassic ? 'none' : 'block';
        pillar.style.height = `${gap * 2}px`;
        pillar.style.top = `${-gap}px`;
        pillar.style.transform = `translate3d(${x}px, 0px, ${z}px)`;
      }

      // Update Layer Planes
      for (let l = 0; l < 3; l++) {
        const y = (l - 1) * gap;
        const plane = this.layerPlaneEls[l];
        const hiddenInClassic = isClassic && l !== 1;
        plane.style.display = hiddenInClassic ? 'none' : 'block';
        plane.style.transform = `translate3d(0px, ${y}px, 0px) rotateX(90deg)`;

        const dimmed = !isClassic && this.isolatedLayer !== 'all' && Number(this.isolatedLayer) !== l;
        plane.classList.toggle('dimmed', dimmed);
      }

      // Update 27 Cell Nodes
      for (let idx = 0; idx < 27; idx++) {
        const { l, r, c } = coordsOf(idx);
        const x = (c - 1) * this.CELL_STEP;
        const y = (l - 1) * gap;
        const z = (r - 1) * this.CELL_STEP;

        const cellEl = this.cell3dEls[idx];
        const hiddenInClassic = isClassic && l !== 1;
        cellEl.style.display = hiddenInClassic ? 'none' : 'block';
        cellEl.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;

        const dimmed = !isClassic && this.isolatedLayer !== 'all' && Number(this.isolatedLayer) !== l;
        cellEl.classList.toggle('dimmed', dimmed);
      }

      // If winning beam is active, keep it locked onto the cells
      if (this.winningLine) {
        this.renderWinningLaser(this.winningLine.cells, this.board[this.winningLine.cells[0]]);
      }
    }

    getCell3DCoords(idx) {
      const gap = this.BASE_LAYER_GAP * (this.explodePct / 100);
      const { l, r, c } = coordsOf(idx);
      return {
        x: (c - 1) * this.CELL_STEP,
        y: (l - 1) * gap,
        z: (r - 1) * this.CELL_STEP
      };
    }

    /* ---------------------------------------------------------------------
     * BUILD 2D TACTICAL LAYER SLICES (RIGHT PANEL)
     * --------------------------------------------------------------------- */
    buildSlicesDOM() {
      this.slicesContainerEl.innerHTML = '';
      this.sliceCellEls = new Array(27);
      this.sliceCardEls = [];

      const meta = [
        { title: 'Layer 1 · Top', tag: 'Z-Upper' },
        { title: 'Layer 2 · Middle', tag: 'Z-Nexus ★' },
        { title: 'Layer 3 · Bottom', tag: 'Z-Base' }
      ];

      for (let l = 0; l < 3; l++) {
        const card = document.createElement('div');
        card.className = 'slice-card';
        card.dataset.layer = l;

        const info = document.createElement('div');
        info.className = 'slice-info';

        const title = document.createElement('div');
        title.className = 'slice-title';
        title.textContent = meta[l].title;

        const tag = document.createElement('div');
        tag.className = 'slice-tag';
        tag.textContent = meta[l].tag;

        const focusBtn = document.createElement('button');
        focusBtn.className = 'slice-focus-btn';
        focusBtn.textContent = 'Isolate';
        focusBtn.addEventListener('click', () => {
          const next = this.isolatedLayer === String(l) ? 'all' : String(l);
          this.setIsolatedLayer(next);
        });

        info.appendChild(title);
        info.appendChild(tag);
        info.appendChild(focusBtn);

        const grid = document.createElement('div');
        grid.className = 'slice-grid';

        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const idx = idxOf(l, r, c);
            const btn = document.createElement('button');
            btn.className = 'slice-cell';
            if (idx === 13) btn.classList.add('is-nexus');
            btn.dataset.idx = idx;
            btn.setAttribute('aria-label', `Layer ${l + 1} Row ${r + 1} Column ${c + 1}`);

            btn.addEventListener('pointerenter', () => this.onCellHover(idx, false));
            btn.addEventListener('pointerleave', () => this.onCellLeave(idx));
            btn.addEventListener('click', () => this.handleCellSelect(idx));

            grid.appendChild(btn);
            this.sliceCellEls[idx] = btn;
          }
        }

        card.appendChild(info);
        card.appendChild(grid);
        this.slicesContainerEl.appendChild(card);
        this.sliceCardEls.push(card);
      }
    }

    /* ---------------------------------------------------------------------
     * HOVER, GHOST PREVIEW & X-RAY THREAT RADAR
     * --------------------------------------------------------------------- */
    onCellHover(idx, from3D = true) {
      const { l } = coordsOf(idx);
      this.coordValueEl.textContent = formatCoord(idx, this.gridMode === 'classic');

      this.cell3dEls[idx].classList.add('synced-hover');
      this.sliceCellEls[idx].classList.add('synced-hover');

      if (!this.gameOver && this.board[idx] === null && !this.isAITurn()) {
        if (from3D) this.sound.playHover(l);
        this.showGhostPreview(idx, this.currentTurn);
      }

      if (this.xrayEnabled && !this.gameOver) {
        this.highlightIntersectingLines(idx);
      }

      this.updateTelemetry(idx);
    }

    onCellLeave(idx) {
      this.coordValueEl.textContent = '—';
      this.cell3dEls[idx].classList.remove('synced-hover');
      this.sliceCellEls[idx].classList.remove('synced-hover');
      this.clearGhostPreview(idx);
      this.clearRadarHighlights();
    }

    showGhostPreview(idx, player) {
      if (this.board[idx] !== null) return;
      const anchor = this.cell3dEls[idx].querySelector('.piece-anchor');
      anchor.innerHTML = this.createPieceMarkup(player, true);
    }

    clearGhostPreview(idx) {
      if (this.board[idx] !== null) return;
      const anchor = this.cell3dEls[idx].querySelector('.piece-anchor');
      anchor.innerHTML = '';
    }

    highlightIntersectingLines(idx) {
      this.clearRadarHighlights();
      const lines = this.gridMode === '3d' ? ALL_3D_LINES : CLASSIC_LINES;

      for (const ln of lines) {
        if (!ln.cells.includes(idx)) continue;
        const vals = ln.cells.map((c) => this.board[c]);
        const hasX = vals.includes('X');
        const hasO = vals.includes('O');
        if (hasX && hasO) continue; // blocked line

        const filledCount = vals.filter((v) => v !== null).length;
        const isCritical = filledCount === 2 && this.board[idx] === null;

        for (const cIdx of ln.cells) {
          this.cell3dEls[cIdx].classList.add(isCritical ? 'radar-threat' : 'radar-line');
          this.sliceCellEls[cIdx].classList.add('radar-line');
        }
      }
    }

    clearRadarHighlights() {
      for (let i = 0; i < 27; i++) {
        this.cell3dEls[i].classList.remove('radar-line', 'radar-threat');
        this.sliceCellEls[i].classList.remove('radar-line');
      }
    }

    /* ---------------------------------------------------------------------
     * GAMEPLAY & TURN ENGINE
     * --------------------------------------------------------------------- */
    isAITurn() {
      return this.gameMode === 'ai' && this.currentTurn === 'O' && !this.gameOver;
    }

    handleCellSelect(idx) {
      if (this.gameOver) return;
      if (this.isAITurn()) return;
      if (this.board[idx] !== null) return;
      if (this.gridMode === 'classic' && Math.floor(idx / 9) !== 1) return;

      this.executeMove(idx, this.currentTurn);

      if (!this.gameOver && this.gameMode === 'ai' && this.currentTurn === 'O') {
        this.triggerAIMove();
      }
    }

    executeMove(idx, player) {
      this.clearHintHighlight();
      this.clearRadarHighlights();

      this.board[idx] = player;
      this.moveHistory.push({
        cell: idx,
        player,
        moveNum: this.moveHistory.length + 1
      });

      const { l } = coordsOf(idx);
      this.sound.playPlace(player, l);

      // Render 3D Piece & 2D Slice Mark
      this.renderCellState(idx);
      this.highlightLastMove(idx);
      this.updateMoveLogUI();

      // Check for Win or Draw
      const lines = this.gridMode === '3d' ? ALL_3D_LINES : CLASSIC_LINES;
      const winMatch = this.checkWin(lines);

      if (winMatch) {
        this.finishGameWithWin(winMatch, player);
        return;
      }

      const maxMoves = this.gridMode === '3d' ? 27 : 9;
      if (this.moveHistory.length >= maxMoves) {
        this.finishGameWithDraw();
        return;
      }

      // Advance Turn
      this.currentTurn = player === 'X' ? 'O' : 'X';
      this.updateTurnUI();
      this.updateTelemetry(null);
    }

    createPieceMarkup(player, isGhost = false) {
      const lower = player.toLowerCase();
      const ghostClass = isGhost ? 'ghost-preview' : '';
      return `
        <div class="piece-base-halo ${lower} ${ghostClass}"></div>
        <div class="piece-billboard ${ghostClass}">
          <div class="holo-${lower}"></div>
        </div>
      `;
    }

    renderCellState(idx) {
      const val = this.board[idx];
      const anchor = this.cell3dEls[idx].querySelector('.piece-anchor');
      const sliceBtn = this.sliceCellEls[idx];

      sliceBtn.classList.remove('x', 'o');
      if (val === null) {
        anchor.innerHTML = '';
        sliceBtn.textContent = '';
      } else {
        anchor.innerHTML = this.createPieceMarkup(val, false);
        sliceBtn.classList.add(val.toLowerCase());
        sliceBtn.textContent = val === 'X' ? '✕' : '◯';
      }
    }

    highlightLastMove(lastIdx) {
      for (let i = 0; i < 27; i++) {
        this.cell3dEls[i].classList.toggle('last-move', i === lastIdx);
      }
    }

    checkWin(lines) {
      for (const ln of lines) {
        const [a, b, c] = ln.cells;
        if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
          return ln;
        }
      }
      return null;
    }

    finishGameWithWin(winLine, winner) {
      this.gameOver = true;
      this.winningLine = winLine;
      this.scores[winner]++;
      this.saveScores();
      this.updateScoreboardUI();

      for (const cIdx of winLine.cells) {
        this.cell3dEls[cIdx].classList.add('win-cell');
        this.sliceCellEls[cIdx].classList.add('win-cell');
      }

      this.renderWinningLaser(winLine.cells, winner);
      this.sound.playWin(winner);
      this.fx.burstWin(winner);

      const winnerLabel = winner === 'X'
        ? (this.gameMode === 'ai' ? 'You (Player X) Win' : 'Player X Wins')
        : (this.gameMode === 'ai' ? 'AI (Player O) Wins' : 'Player O Wins');

      this.statusBannerEl.classList.remove('win-x', 'win-o');
      this.statusBannerEl.classList.add(winner === 'X' ? 'win-x' : 'win-o');
      this.statusDotEl.style.background = winner === 'X' ? 'var(--x-primary)' : 'var(--o-primary)';
      this.statusTextEl.textContent = `${winnerLabel} via ${winLine.type}!`;
      this.tacticalNote.innerHTML = `Victory Alignment: <strong>${winLine.type}</strong> (${winLine.cells.map((i) => formatCoord(i, this.gridMode === 'classic')).join(' → ')})`;
      this.btnUndo.disabled = this.moveHistory.length === 0;
    }

    finishGameWithDraw() {
      this.gameOver = true;
      this.scores.draws++;
      this.saveScores();
      this.updateScoreboardUI();
      this.sound.playDraw();

      this.statusDotEl.style.background = 'var(--accent-gold)';
      this.statusTextEl.textContent = 'Spatial Grid Locked — It’s a Draw!';
    }

    /* ---------------------------------------------------------------------
     * 3D VOLUMETRIC WINNING LASER BEAM
     * --------------------------------------------------------------------- */
    renderWinningLaser(cells, winner) {
      this.beamsGroupEl.innerHTML = '';
      const p1 = this.getCell3DCoords(cells[0]);
      const p2 = this.getCell3DCoords(cells[2]);

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;

      const dist = Math.hypot(dx, dy, dz) + 52;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const mz = (p1.z + p2.z) / 2;

      const rxz = Math.hypot(dx, dz);
      const yawRad = Math.atan2(-dz, dx);
      const pitchZRad = Math.atan2(dy, rxz);

      const beam = document.createElement('div');
      beam.className = 'laser-beam-3d';
      beam.style.width = `${dist}px`;
      beam.style.left = `${-dist / 2}px`;
      beam.style.setProperty('--beam-color', winner === 'X' ? '#22d3ee' : '#fb7185');
      beam.style.transform = `translate3d(${mx}px, ${my}px, ${mz}px) rotateY(${yawRad}rad) rotateZ(${pitchZRad}rad)`;

      beam.innerHTML = `
        <div class="laser-plane"></div>
        <div class="laser-plane cross"></div>
      `;

      this.beamsGroupEl.appendChild(beam);
    }

    /* ---------------------------------------------------------------------
     * AI TURN, UNDO, & TACTICAL HINT
     * --------------------------------------------------------------------- */
    triggerAIMove() {
      clearTimeout(this.aiTimer);
      this.statusTextEl.textContent = 'AI is computing spatial trajectories...';
      this.btnUndo.disabled = true;

      this.aiTimer = setTimeout(() => {
        if (this.gameOver) return;
        const decision = SpatialAI.analyzeBestMove(
          this.board,
          'O',
          this.aiDifficulty,
          this.gridMode
        );
        if (decision && decision.cell !== undefined) {
          this.executeMove(decision.cell, 'O');
        }
      }, 420);
    }

    undoMove() {
      if (this.moveHistory.length === 0) return;
      clearTimeout(this.aiTimer);
      this.clearHintHighlight();
      this.clearRadarHighlights();

      // If playing vs AI and it's Player X's turn (or game over), undo back to Player X's previous state
      let steps = 1;
      if (this.gameMode === 'ai' && this.moveHistory.length >= 2 && this.currentTurn === 'X') {
        steps = 2;
      } else if (this.gameMode === 'ai' && this.gameOver && this.moveHistory[this.moveHistory.length - 1].player === 'O') {
        steps = 2;
      }

      for (let s = 0; s < steps && this.moveHistory.length > 0; s++) {
        const last = this.moveHistory.pop();
        this.board[last.cell] = null;
        this.renderCellState(last.cell);
      }

      this.gameOver = false;
      this.winningLine = null;
      this.beamsGroupEl.innerHTML = '';
      this.statusBannerEl.classList.remove('win-x', 'win-o');

      for (let i = 0; i < 27; i++) {
        this.cell3dEls[i].classList.remove('win-cell');
        this.sliceCellEls[i].classList.remove('win-cell');
      }

      const prevMove = this.moveHistory[this.moveHistory.length - 1];
      this.highlightLastMove(prevMove ? prevMove.cell : -1);
      this.currentTurn = this.moveHistory.length % 2 === 0 ? 'X' : 'O';

      this.sound.playUndo();
      this.updateTurnUI();
      this.updateMoveLogUI();
      this.updateTelemetry(null);
    }

    requestHint() {
      if (this.gameOver || this.isAITurn()) return;
      this.clearHintHighlight();

      const recommendation = SpatialAI.analyzeBestMove(
        this.board,
        this.currentTurn,
        'hard',
        this.gridMode
      );

      if (!recommendation) return;

      this.hintCell = recommendation.cell;
      this.cell3dEls[this.hintCell].classList.add('hint-target');
      this.sliceCellEls[this.hintCell].classList.add('hint-target');
      this.sound.playHint();

      const coordStr = formatCoord(this.hintCell, this.gridMode === 'classic');
      this.tacticalNote.innerHTML = `<strong>AI Hint (${coordStr}):</strong> ${recommendation.reason}`;
      this.statusTextEl.textContent = `Recommended Move: ${coordStr}`;
    }

    clearHintHighlight() {
      if (this.hintCell !== null) {
        this.cell3dEls[this.hintCell].classList.remove('hint-target');
        this.sliceCellEls[this.hintCell].classList.remove('hint-target');
        this.hintCell = null;
      }
    }

    resetGame() {
      clearTimeout(this.aiTimer);
      this.board.fill(null);
      this.currentTurn = 'X';
      this.gameOver = false;
      this.winningLine = null;
      this.moveHistory = [];
      this.clearHintHighlight();
      this.clearRadarHighlights();
      this.beamsGroupEl.innerHTML = '';
      this.statusBannerEl.classList.remove('win-x', 'win-o');

      for (let i = 0; i < 27; i++) {
        this.cell3dEls[i].classList.remove('win-cell', 'last-move');
        this.sliceCellEls[i].classList.remove('win-cell');
        this.renderCellState(i);
      }

      this.updateTurnUI();
      this.updateMoveLogUI();
      this.updateTelemetry(null);
    }

    /* ---------------------------------------------------------------------
     * UI SYNCHRONIZATION (TURN, SCOREBOARD, TELEMETRY, MOVE LOG)
     * --------------------------------------------------------------------- */
    updateTurnUI() {
      document.body.classList.toggle('turn-o', this.currentTurn === 'O');
      this.scoreCardX.classList.toggle('active-turn', this.currentTurn === 'X');
      this.scoreCardO.classList.toggle('active-turn', this.currentTurn === 'O');

      const diffNames = { easy: 'CASUAL', medium: 'TACTICAL', hard: 'GRANDMASTER' };
      this.labelPlayerX.textContent = this.gameMode === 'ai' ? 'YOU (X)' : 'PLAYER X';
      this.labelPlayerO.textContent = this.gameMode === 'ai'
        ? `AI · ${diffNames[this.aiDifficulty]}`
        : 'PLAYER O';

      if (this.currentTurn === 'X') {
        this.turnTagX.textContent = 'ACTIVE TURN';
        this.turnTagO.textContent = 'STANDBY';
        this.statusDotEl.style.background = 'var(--x-primary)';
        this.statusDotEl.style.boxShadow = '0 0 10px var(--x-primary)';
        this.statusTextEl.textContent = this.gameMode === 'ai'
          ? 'Your turn (X) — Place a mark in 3D space'
          : 'Player X’s turn — Select any empty cell';
      } else {
        this.turnTagX.textContent = 'STANDBY';
        this.turnTagO.textContent = this.gameMode === 'ai' ? 'COMPUTING' : 'ACTIVE TURN';
        this.statusDotEl.style.background = 'var(--o-primary)';
        this.statusDotEl.style.boxShadow = '0 0 10px var(--o-primary)';
        this.statusTextEl.textContent = this.gameMode === 'ai'
          ? 'AI is analyzing spatial lines...'
          : 'Player O’s turn — Select any empty cell';
      }

      this.btnUndo.disabled = this.moveHistory.length === 0 || this.isAITurn();
    }

    updateScoreboardUI() {
      this.scoreXEl.textContent = this.scores.X;
      this.scoreOEl.textContent = this.scores.O;
      this.scoreDrawsEl.textContent = this.scores.draws;
    }

    updateMoveLogUI() {
      const maxMoves = this.gridMode === '3d' ? 27 : 9;
      this.moveCounterEl.textContent = `${this.moveHistory.length} / ${maxMoves}`;

      if (this.moveHistory.length === 0) {
        this.moveListEl.innerHTML = `<div class="empty-history">Click any cell in the 3D cube or 2D slices to begin.</div>`;
        return;
      }

      this.moveListEl.innerHTML = '';
      for (let i = this.moveHistory.length - 1; i >= 0; i--) {
        const item = this.moveHistory[i];
        const row = document.createElement('div');
        row.className = 'move-item';
        row.innerHTML = `
          <span class="move-badge ${item.player.toLowerCase()}">#${item.moveNum} · ${item.player}</span>
          <span class="move-coord">${formatCoord(item.cell, this.gridMode === 'classic')}</span>
        `;
        row.addEventListener('pointerenter', () => this.onCellHover(item.cell, false));
        row.addEventListener('pointerleave', () => this.onCellLeave(item.cell));
        this.moveListEl.appendChild(row);
      }
    }

    updateTelemetry(hoveredIdx = null) {
      const lines = this.gridMode === '3d' ? ALL_3D_LINES : CLASSIC_LINES;
      const powerTable = this.gridMode === '3d' ? POWER_3D : POWER_CLASSIC;

      // Count open unblocked winning lines
      let activeLines = 0;
      for (const ln of lines) {
        const vals = ln.cells.map((c) => this.board[c]);
        if (!(vals.includes('X') && vals.includes('O'))) activeLines++;
      }
      this.telTotalLines.textContent = `${activeLines} / ${lines.length}`;

      if (hoveredIdx !== null) {
        this.telCellPower.textContent = `${powerTable[hoveredIdx]} intersecting lines`;
      } else {
        this.telCellPower.textContent = 'Hover a cell';
      }

      const xThreats = SpatialAI.findImmediateWins(this.board, 'X', lines).length;
      const oThreats = SpatialAI.findImmediateWins(this.board, 'O', lines).length;
      const totalThreats = xThreats + oThreats;

      if (totalThreats === 0) {
        this.telThreats.textContent = 'None active';
        this.telThreats.classList.remove('danger');
      } else {
        this.telThreats.textContent = `X: ${xThreats} | O: ${oThreats} Alert!`;
        this.telThreats.classList.add('danger');
      }
    }

    /* ---------------------------------------------------------------------
     * CAMERA ORBIT, ZOOM, LAYER ISOLATION & KEYBOARD SHORTCUTS
     * --------------------------------------------------------------------- */
    updateCameraCSS(smooth = false) {
      this.sceneEl.classList.toggle('smooth-cam', smooth);
      document.documentElement.style.setProperty('--cam-pitch', `${this.camPitch.toFixed(2)}deg`);
      document.documentElement.style.setProperty('--cam-yaw', `${this.camYaw.toFixed(2)}deg`);
      document.documentElement.style.setProperty('--cam-zoom', this.camZoom.toFixed(3));
    }

    setCameraPreset(preset) {
      const presets = {
        iso:   { pitch: -24, yaw: -36 },
        top:   { pitch: -82, yaw: 0 },
        front: { pitch: -8,  yaw: 0 },
        side:  { pitch: -10, yaw: -88 }
      };
      const target = presets[preset] || presets.iso;
      this.camPitch = target.pitch;
      this.camYaw = target.yaw;
      this.updateCameraCSS(true);

      document.querySelectorAll('.cam-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.cam === preset);
      });
    }

    setIsolatedLayer(layerVal) {
      this.isolatedLayer = String(layerVal);
      document.querySelectorAll('.layer-pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.layer === this.isolatedLayer);
      });
      this.sliceCardEls.forEach((card, idx) => {
        const focused = this.isolatedLayer === String(idx);
        card.classList.toggle('focused-layer', focused);
        const btn = card.querySelector('.slice-focus-btn');
        if (btn) btn.textContent = focused ? 'Show All' : 'Isolate';
      });
      this.updateSpatialPositions();
    }

    startAutoRotateLoop() {
      const step = () => {
        if (this.autoRotate && !this.isDragging) {
          this.camYaw = (this.camYaw + 0.22) % 360;
          this.updateCameraCSS(false);
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    bindEvents() {
      // 1. Pointer Orbit Controls on 3D Viewport
      this.viewportEl.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.hud-top') || e.target.closest('.hud-bottom')) return;
        this.isDragging = true;
        this.dragMoved = false;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.viewportEl.classList.add('dragging');
      });

      window.addEventListener('pointermove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;

        if (Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY) > 6) {
          this.dragMoved = true;
        }

        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;

        this.camYaw += dx * 0.45;
        this.camPitch = Math.max(-85, Math.min(45, this.camPitch - dy * 0.42));
        this.updateCameraCSS(false);

        document.querySelectorAll('.cam-btn').forEach((b) => b.classList.remove('active'));
      });

      window.addEventListener('pointerup', () => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.viewportEl.classList.remove('dragging');
      });

      // 2. Scroll Zoom on 3D Viewport
      this.viewportEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        this.camZoom = Math.max(0.62, Math.min(1.48, this.camZoom + delta));
        this.updateCameraCSS(false);
      }, { passive: false });

      // 3. Camera Preset Dock
      document.querySelectorAll('.cam-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.setCameraPreset(btn.dataset.cam));
      });

      document.getElementById('btn-reset-cam').addEventListener('click', () => {
        this.camZoom = 1;
        this.setCameraPreset('iso');
      });

      // 4. Layer Separation Slider
      const explodeSlider = document.getElementById('slider-explode');
      const explodeVal = document.getElementById('explode-val');
      explodeSlider.addEventListener('input', (e) => {
        this.explodePct = Number(e.target.value);
        explodeVal.textContent = `${this.explodePct}%`;
        this.updateSpatialPositions();
      });

      // 5. Layer Isolation Pills
      document.querySelectorAll('.layer-pill').forEach((btn) => {
        btn.addEventListener('click', () => this.setIsolatedLayer(btn.dataset.layer));
      });

      // 6. Toggle Switches (X-Ray Radar & Auto-Orbit)
      document.getElementById('toggle-xray').addEventListener('change', (e) => {
        this.xrayEnabled = e.target.checked;
        if (!this.xrayEnabled) this.clearRadarHighlights();
      });

      document.getElementById('toggle-autorotate').addEventListener('change', (e) => {
        this.autoRotate = e.target.checked;
      });

      // 7. Game Mode (vs AI / 2P)
      document.querySelectorAll('[data-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.gameMode = btn.dataset.mode;
          document.querySelectorAll('[data-mode]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
          document.getElementById('ai-difficulty-group').classList.toggle('hidden', this.gameMode !== 'ai');
          this.resetGame();
        });
      });

      // 8. AI Difficulty
      document.querySelectorAll('[data-diff]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.aiDifficulty = btn.dataset.diff;
          document.querySelectorAll('[data-diff]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
          this.resetGame();
        });
      });

      // 9. Grid Dimension (3x3x3 Cube vs 3x3 Classic)
      document.querySelectorAll('[data-grid]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.gridMode = btn.dataset.grid;
          document.querySelectorAll('[data-grid]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
          const isClassic = this.gridMode === 'classic';
          document.getElementById('explode-slider-group').classList.toggle('hidden', isClassic);
          document.getElementById('layer-filter-group').classList.toggle('hidden', isClassic);

          this.sliceCardEls[0].classList.toggle('hidden', isClassic);
          this.sliceCardEls[2].classList.toggle('hidden', isClassic);

          this.isolatedLayer = 'all';
          this.updateSpatialPositions();
          this.resetGame();
        });
      });

      // 10. Action Buttons (New Game, Undo, Hint, Sound, Rules Modal)
      document.getElementById('btn-new-game').addEventListener('click', () => this.resetGame());
      this.btnUndo.addEventListener('click', () => this.undoMove());
      this.btnHint.addEventListener('click', () => this.requestHint());

      document.getElementById('btn-sound').addEventListener('click', () => {
        this.sound.enabled = !this.sound.enabled;
        document.getElementById('icon-sound-on').classList.toggle('hidden', !this.sound.enabled);
        document.getElementById('icon-sound-off').classList.toggle('hidden', this.sound.enabled);
      });

      const rulesModal = document.getElementById('rules-modal');
      document.getElementById('btn-rules').addEventListener('click', () => {
        rulesModal.classList.remove('hidden');
      });
      document.getElementById('btn-close-modal').addEventListener('click', () => {
        rulesModal.classList.add('hidden');
      });
      document.getElementById('btn-got-it').addEventListener('click', () => {
        rulesModal.classList.add('hidden');
      });
      rulesModal.addEventListener('click', (e) => {
        if (e.target === rulesModal) rulesModal.classList.add('hidden');
      });

      // 11. Keyboard Shortcuts
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const key = e.key.toLowerCase();
        if (key === '0') this.setIsolatedLayer('all');
        else if (key === '1') this.setIsolatedLayer('0');
        else if (key === '2') this.setIsolatedLayer('1');
        else if (key === '3') this.setIsolatedLayer('2');
        else if (key === 'h') this.requestHint();
        else if (key === 'z') this.undoMove();
        else if (key === 'r') {
          this.camZoom = 1;
          this.setCameraPreset('iso');
        } else if (key === 'm') {
          document.getElementById('btn-sound').click();
        } else if (key === '?' || key === '/') {
          rulesModal.classList.toggle('hidden');
        } else if (key === 'escape') {
          rulesModal.classList.add('hidden');
        }
      });
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.qubicApp = new QubicGameApp();
  });
})();
