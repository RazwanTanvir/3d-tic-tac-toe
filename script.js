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
  const VOID_3D_LINES = ALL_3D_LINES.filter((ln) => !ln.cells.includes(13)); // 36 lines (Void Core mode)
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
  const POWER_VOID_3D = computeCellPower(VOID_3D_LINES);
  const POWER_CLASSIC = computeCellPower(CLASSIC_LINES);

  // Precompute all 15 planes of the 3x3x3 cube (each plane has 9 cells and 8 win lines)
  // Controlling 3+ unblocked cells in a single plane is the primary geometric setup for forks.
  function buildPlanes3D() {
    const planes = [];
    // 3 Horizontal layers (l = 0,1,2)
    for (let l = 0; l < 3; l++) {
      const cells = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push(idxOf(l, r, c));
      planes.push(cells);
    }
    // 3 Row slices (r = 0,1,2)
    for (let r = 0; r < 3; r++) {
      const cells = [];
      for (let l = 0; l < 3; l++) for (let c = 0; c < 3; c++) cells.push(idxOf(l, r, c));
      planes.push(cells);
    }
    // 3 Column slices (c = 0,1,2)
    for (let c = 0; c < 3; c++) {
      const cells = [];
      for (let l = 0; l < 3; l++) for (let r = 0; r < 3; r++) cells.push(idxOf(l, r, c));
      planes.push(cells);
    }
    // 6 Diagonal planes (2 in XY across Z, 2 in XZ across Y, 2 in YZ across X)
    const diag1 = [], diag2 = [], diag3 = [], diag4 = [], diag5 = [], diag6 = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        diag1.push(idxOf(i, j, j));
        diag2.push(idxOf(i, j, 2 - j));
        diag3.push(idxOf(j, i, j));
        diag4.push(idxOf(j, i, 2 - j));
        diag5.push(idxOf(j, j, i));
        diag6.push(idxOf(j, 2 - j, i));
      }
    }
    planes.push(diag1, diag2, diag3, diag4, diag5, diag6);
    return planes.map((cells) => {
      let mask = 0;
      for (const c of cells) mask |= (1 << c);
      return mask;
    });
  }

  const PLANE_MASKS_3D = buildPlanes3D();

  // Precompute bitmasks for lines
  function enrichLinesWithBitmasks(lines) {
    return lines.map((ln) => {
      const [a, b, c] = ln.cells;
      return {
        ...ln,
        mask: (1 << a) | (1 << b) | (1 << c),
        m0: 1 << a,
        m1: 1 << b,
        m2: 1 << c,
        c0: a,
        c1: b,
        c2: c
      };
    });
  }

  const BIT_LINES_3D = enrichLinesWithBitmasks(ALL_3D_LINES);
  const BIT_LINES_VOID_3D = enrichLinesWithBitmasks(VOID_3D_LINES);
  const BIT_LINES_CLASSIC = enrichLinesWithBitmasks(CLASSIC_LINES);

  function popcount32(x) {
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }

  /* =========================================================================
   * 3. GRANDMASTER SPATIAL AI (BITBOARD + VCF + ITERATIVE ALPHA-BETA SOLVER)
   * ========================================================================= */
  class SpatialAI {
    static boardToMasks(board, player) {
      const opponent = player === 'X' ? 'O' : 'X';
      let pMask = 0;
      let oMask = 0;
      for (let i = 0; i < 27; i++) {
        if (board[i] === player) pMask |= (1 << i);
        else if (board[i] === opponent) oMask |= (1 << i);
      }
      return { pMask, oMask };
    }

    static getValidMoves(board, gridMode, centerRule = 'standard', moveCount = 0) {
      const moves = [];
      for (let i = 0; i < 27; i++) {
        if (gridMode === 'classic' && Math.floor(i / 9) !== 1) continue;
        if (gridMode === '3d' && i === 13) {
          if (centerRule === 'void') continue;
          if (centerRule === 'turn1' && moveCount === 0) continue;
        }
        if (board[i] === null) moves.push(i);
      }
      return moves;
    }

    static findImmediateWins(board, player, lines) {
      const wins = [];
      const seen = new Set();
      for (const ln of lines) {
        const [a, b, c] = ln.cells;
        const va = board[a], vb = board[b], vc = board[c];
        let pCount = 0;
        let emptyIdx = -1;
        if (va === player) pCount++; else if (va === null) emptyIdx = a;
        if (vb === player) pCount++; else if (vb === null) emptyIdx = b;
        if (vc === player) pCount++; else if (vc === null) emptyIdx = c;
        if (pCount === 2 && emptyIdx !== -1 && !seen.has(emptyIdx)) {
          seen.add(emptyIdx);
          wins.push({ cell: emptyIdx, line: ln });
        }
      }
      return wins;
    }

    // Fast Bitboard threat finder: returns bitmask of all cells that complete a 3-in-a-row for pMask
    static getWinningMoveMask(pMask, oMask, bitLines) {
      let winCellsMask = 0;
      for (let i = 0; i < bitLines.length; i++) {
        const ln = bitLines[i];
        if ((oMask & ln.mask) !== 0) continue;
        const pInLine = pMask & ln.mask;
        if (pInLine === (ln.m0 | ln.m1)) winCellsMask |= ln.m2;
        else if (pInLine === (ln.m0 | ln.m2)) winCellsMask |= ln.m1;
        else if (pInLine === (ln.m1 | ln.m2)) winCellsMask |= ln.m0;
      }
      return winCellsMask;
    }

    static hasWon(pMask, bitLines) {
      for (let i = 0; i < bitLines.length; i++) {
        const m = bitLines[i].mask;
        if ((pMask & m) === m) return true;
      }
      return false;
    }

    /**
     * VCF (Victory by Continuous Forcing) Solver:
     * Searches forcing sequences where attacker plays a move that creates an immediate threat,
     * forcing defender to block that exact cell, leading to a double-threat fork!
     * Returns the winning first move index (0..26), or -1 if no forced sequence exists.
     */
    static searchVCF(pMask, oMask, bitLines, validCells, depthLeft) {
      // 1. Can attacker win immediately on this turn?
      const myWins = this.getWinningMoveMask(pMask, oMask, bitLines);
      if (myWins !== 0) {
        return 31 - Math.clz32(myWins & -myWins);
      }
      if (depthLeft <= 0) return -1;

      // 2. Is attacker forced to block an opponent threat first?
      const oppWins = this.getWinningMoveMask(oMask, pMask, bitLines);
      const oppWinCount = popcount32(oppWins);
      if (oppWinCount >= 2) return -1; // Defender already has an unstoppable fork

      const occupied = pMask | oMask;

      if (oppWinCount === 1) {
        // Attacker MUST play the single blocking cell; only continue if that block is itself a forcing move
        const forcedBlockBit = oppWins;
        const forcedCell = 31 - Math.clz32(forcedBlockBit);
        const nextPMask = pMask | forcedBlockBit;
        const createdThreats = this.getWinningMoveMask(nextPMask, oMask, bitLines);
        const threatCount = popcount32(createdThreats);
        if (threatCount >= 2) return forcedCell;
        if (threatCount === 1) {
          const replyBit = createdThreats;
          const nextOMask = oMask | replyBit;
          // Ensure defender's forced reply doesn't simultaneously win for defender
          if (!this.hasWon(nextOMask, bitLines)) {
            const sub = this.searchVCF(nextPMask, nextOMask, bitLines, validCells, depthLeft - 1);
            if (sub !== -1) return forcedCell;
          }
        }
        return -1;
      }

      // 3. Attacker is free to choose any move that creates >= 1 immediate threat
      // First pass: check if any single move immediately creates a double threat (fork) while not allowing opponent counter-win
      for (let i = 0; i < validCells.length; i++) {
        const cell = validCells[i];
        const bit = 1 << cell;
        if ((occupied & bit) !== 0) continue;

        const nextPMask = pMask | bit;
        const threats = this.getWinningMoveMask(nextPMask, oMask, bitLines);
        const tCount = popcount32(threats);

        if (tCount >= 2) {
          return cell; // Unstoppable fork created!
        }
      }

      // Second pass: explore single-threat forcing moves recursively
      for (let i = 0; i < validCells.length; i++) {
        const cell = validCells[i];
        const bit = 1 << cell;
        if ((occupied & bit) !== 0) continue;

        const nextPMask = pMask | bit;
        const threats = this.getWinningMoveMask(nextPMask, oMask, bitLines);
        if (popcount32(threats) === 1) {
          const replyBit = threats;
          const nextOMask = oMask | replyBit;
          if (!this.hasWon(nextOMask, bitLines)) {
            const res = this.searchVCF(nextPMask, nextOMask, bitLines, validCells, depthLeft - 1);
            if (res !== -1) return cell;
          }
        }
      }

      return -1;
    }

    /**
     * Rich Spatial Evaluation Function for Bitboards
     */
    static evaluateBitboard(pMask, oMask, bitLines, powerTable, is3D) {
      let score = 0;
      let pTwo = 0;
      let oTwo = 0;
      let pOne = 0;
      let oOne = 0;

      // Track potential fork intersections per empty cell
      let pThreatMask = 0;
      let pDoubleThreatMask = 0;
      let oThreatMask = 0;
      let oDoubleThreatMask = 0;

      for (let i = 0; i < bitLines.length; i++) {
        const ln = bitLines[i];
        const pm = pMask & ln.mask;
        const om = oMask & ln.mask;

        if (pm !== 0 && om !== 0) continue; // Dead blocked line

        if (pm !== 0) {
          if (pm === ln.mask) return 100000;
          const cnt = popcount32(pm);
          if (cnt === 2) {
            pTwo++;
            score += 240;
            const emptyBit = ln.mask ^ pm;
            if ((pThreatMask & emptyBit) !== 0) pDoubleThreatMask |= emptyBit;
            pThreatMask |= emptyBit;
          } else {
            pOne++;
            score += 22;
          }
        } else if (om !== 0) {
          if (om === ln.mask) return -100000;
          const cnt = popcount32(om);
          if (cnt === 2) {
            oTwo++;
            score -= 260;
            const emptyBit = ln.mask ^ om;
            if ((oThreatMask & emptyBit) !== 0) oDoubleThreatMask |= emptyBit;
            oThreatMask |= emptyBit;
          } else {
            oOne++;
            score -= 22;
          }
        }
      }

      // Unstoppable multi-cell fork bonus
      const pDistinctThreats = popcount32(pThreatMask);
      const oDistinctThreats = popcount32(oThreatMask);
      if (pDistinctThreats >= 2) score += 1600 * pDistinctThreats;
      if (oDistinctThreats >= 2) score -= 1800 * oDistinctThreats;

      // Plane Dominance (Triangle Trap formation in 3x3x3)
      if (is3D) {
        for (let i = 0; i < PLANE_MASKS_3D.length; i++) {
          const plMask = PLANE_MASKS_3D[i];
          const pInPlane = popcount32(pMask & plMask);
          const oInPlane = popcount32(oMask & plMask);
          if (pInPlane >= 2 && oInPlane === 0) {
            score += pInPlane === 3 ? 210 : 55;
          } else if (oInPlane >= 2 && pInPlane === 0) {
            score -= oInPlane === 3 ? 230 : 60;
          }
        }
      }

      // Positional cell weights (Center Nexus = 13, Corners = 7, etc.)
      for (let i = 0; i < 27; i++) {
        const bit = 1 << i;
        if ((pMask & bit) !== 0) score += powerTable[i] * 5;
        else if ((oMask & bit) !== 0) score -= powerTable[i] * 5;
      }

      return score;
    }

    /**
     * Order candidate moves for fastest Alpha-Beta cutoffs
     */
    static orderMoves(pMask, oMask, bitLines, powerTable, validCells) {
      const occupied = pMask | oMask;
      const myWins = this.getWinningMoveMask(pMask, oMask, bitLines);
      const oppWins = this.getWinningMoveMask(oMask, pMask, bitLines);

      const list = [];
      for (let i = 0; i < validCells.length; i++) {
        const cell = validCells[i];
        const bit = 1 << cell;
        if ((occupied & bit) !== 0) continue;

        let priority = powerTable[cell] * 10;
        if (cell === 13) priority += 200; // Center Nexus

        if ((myWins & bit) !== 0) {
          priority += 50000;
        } else if ((oppWins & bit) !== 0) {
          priority += 25000;
        } else {
          // Check how many threats placing here creates
          const nextP = pMask | bit;
          const created = popcount32(this.getWinningMoveMask(nextP, oMask, bitLines));
          if (created >= 2) priority += 12000;
          else if (created === 1) priority += 1400;

          // Also check if opponent wanted this square to create a fork
          const nextO = oMask | bit;
          const oppCreated = popcount32(this.getWinningMoveMask(nextO, pMask, bitLines));
          if (oppCreated >= 2) priority += 9000;
          else if (oppCreated === 1) priority += 600;
        }

        list.push({ cell, priority });
      }

      list.sort((a, b) => b.priority - a.priority);
      return list;
    }

    /**
     * Negamax with Alpha-Beta Pruning + Transposition Table + Forced-Move & VCF Quiescence Extensions
     */
    static negamax(pMask, oMask, depth, alpha, beta, bitLines, powerTable, validCells, is3D, fullMask, deadline, tt) {
      // Immediate win check for side to move
      const myWins = this.getWinningMoveMask(pMask, oMask, bitLines);
      if (myWins !== 0) {
        return 90000 + depth * 100;
      }

      const occupied = pMask | oMask;
      if ((occupied & fullMask) === fullMask) {
        return 0; // Draw
      }

      // Check opponent's immediate threats
      const oppWins = this.getWinningMoveMask(oMask, pMask, bitLines);
      const oppWinCount = popcount32(oppWins);
      if (oppWinCount >= 2) {
        // Opponent has 2+ simultaneous winning moves; unstoppable loss next turn
        return -(88000 + depth * 100);
      }

      // Forced block extension: if opponent has 1 threat, we MUST block it (branching factor = 1!)
      if (oppWinCount === 1) {
        const forcedBit = oppWins;
        return -this.negamax(
          oMask,
          pMask | forcedBit,
          depth, // Do not reduce depth on forced single-reply moves!
          -beta,
          -alpha,
          bitLines,
          powerTable,
          validCells,
          is3D,
          fullMask,
          deadline,
          tt
        );
      }

      // Transposition Table Lookup
      const ttKey = pMask * 134217728 + oMask;
      const cached = tt.get(ttKey);
      if (cached !== undefined && cached.depth >= depth) {
        if (cached.flag === 0) return cached.val;
        if (cached.flag === 1 && cached.val > alpha) alpha = cached.val;
        else if (cached.flag === 2 && cached.val < beta) beta = cached.val;
        if (alpha >= beta) return cached.val;
      }

      if (depth <= 0 || Date.now() > deadline) {
        // VCF Quiescence at leaf nodes: detect 2-step forced forks before static evaluation
        if (is3D && Date.now() <= deadline) {
          if (this.searchVCF(pMask, oMask, bitLines, validCells, 2) !== -1) {
            return 82000;
          }
          if (this.searchVCF(oMask, pMask, bitLines, validCells, 2) !== -1) {
            return -82000;
          }
        }
        return this.evaluateBitboard(pMask, oMask, bitLines, powerTable, is3D);
      }

      const alphaOrig = alpha;
      const ordered = this.orderMoves(pMask, oMask, bitLines, powerTable, validCells);
      const maxBranch = is3D ? (depth >= 4 ? 10 : 12) : 9;
      const limit = Math.min(ordered.length, maxBranch);

      let bestVal = -Infinity;
      for (let i = 0; i < limit; i++) {
        const bit = 1 << ordered[i].cell;
        const val = -this.negamax(
          oMask,
          pMask | bit,
          depth - 1,
          -beta,
          -alpha,
          bitLines,
          powerTable,
          validCells,
          is3D,
          fullMask,
          deadline,
          tt
        );
        if (val > bestVal) bestVal = val;
        if (val > alpha) alpha = val;
        if (alpha >= beta) break;
      }

      if (tt.size < 65000) {
        const flag = bestVal <= alphaOrig ? 2 : bestVal >= beta ? 1 : 0;
        tt.set(ttKey, { depth, val: bestVal, flag });
      }

      return bestVal;
    }

    static analyzeBestMove(board, player, difficulty = 'hard', gridMode = '3d', centerRule = 'standard', moveCount = 0) {
      const is3D = gridMode === '3d';
      const isVoid = is3D && centerRule === 'void';
      const isTurn1Locked = is3D && centerRule === 'turn1' && moveCount === 0;

      const lines = !is3D ? CLASSIC_LINES : isVoid ? VOID_3D_LINES : ALL_3D_LINES;
      const bitLines = !is3D ? BIT_LINES_CLASSIC : isVoid ? BIT_LINES_VOID_3D : BIT_LINES_3D;
      const powerTable = !is3D ? POWER_CLASSIC : isVoid ? POWER_VOID_3D : POWER_3D;
      const validMoves = this.getValidMoves(board, gridMode, centerRule, moveCount);

      if (validMoves.length === 0) return null;

      const opponent = player === 'X' ? 'O' : 'X';
      const { pMask, oMask } = this.boardToMasks(board, player);
      const allValidCells = !is3D
        ? [9, 10, 11, 12, 13, 14, 15, 16, 17]
        : isVoid
          ? Array.from({ length: 27 }, (_, i) => i).filter((i) => i !== 13)
          : Array.from({ length: 27 }, (_, i) => i);

      const fullMask = !is3D ? 0x3fe00 : isVoid ? (0x7ffffff ^ (1 << 13)) : 0x7ffffff;

      // 1. Immediate Winning Move (1-ply victory)
      const ownWins = this.findImmediateWins(board, player, lines);
      if (ownWins.length > 0) {
        return {
          cell: ownWins[0].cell,
          reason: `Completes ${ownWins[0].line.type} for immediate victory!`
        };
      }

      // 2. Immediate Mandatory Block (opponent has 2-in-a-row)
      const oppWins = this.findImmediateWins(board, opponent, lines);
      if (oppWins.length > 0 && (difficulty !== 'easy' || Math.random() < 0.72)) {
        return {
          cell: oppWins[0].cell,
          reason: `Mandatory block against opponent's ${oppWins[0].line.type}!`
        };
      }

      // Easy Mode: playful semi-random choice
      if (difficulty === 'easy') {
        const pick = validMoves[Math.floor(Math.random() * validMoves.length)];
        return {
          cell: pick,
          reason: `Open position intersecting ${powerTable[pick]} win lines.`
        };
      }

      // 3. Opening Book: Claim Center Nexus (1,1,1) if unlocked and available!
      const centerIdx = 13;
      if (!isVoid && !isTurn1Locked && board[centerIdx] === null && (difficulty === 'hard' || Math.random() < 0.75)) {
        return {
          cell: centerIdx,
          reason: is3D
            ? 'Claims the unlocked Center Nexus (L2·R2·C2), commanding 13 spatial winning lines!'
            : 'Claims the center square, commanding 4 winning lines!'
        };
      }

      // If Move 1 has Center Locked (or Void Core on Move 1), open on one of the 8 symmetric 3D corners
      if (is3D && moveCount === 0 && (isTurn1Locked || isVoid)) {
        const corners = [0, 2, 6, 8, 18, 20, 24, 26];
        const pick = corners[Math.floor(Math.random() * corners.length)];
        return {
          cell: pick,
          reason: `Opens on a 3D Corner Vertex (${powerTable[pick]} lines) while the Center Nexus is locked.`
        };
      }

      // 4. VCF (Victory by Continuous Forcing) Search for Attacker (up to 12 forcing half-plies!)
      const vcfDepth = difficulty === 'hard' ? 6 : 2;
      const vcfWinMove = this.searchVCF(pMask, oMask, bitLines, allValidCells, vcfDepth);
      if (vcfWinMove !== -1 && board[vcfWinMove] === null && !(isTurn1Locked && vcfWinMove === 13)) {
        const nextP = pMask | (1 << vcfWinMove);
        const immediateFork = popcount32(this.getWinningMoveMask(nextP, oMask, bitLines)) >= 2;
        return {
          cell: vcfWinMove,
          reason: immediateFork
            ? 'Executes an unstoppable double-threat spatial fork!'
            : 'Initiates a forced multi-turn winning threat sequence (VCF)!'
        };
      }

      // 5. Iterative Deepening Negamax with Alpha-Beta + Transposition Table + Root Anti-VCF Filter
      const deadline = Date.now() + (difficulty === 'hard' ? 220 : 50);
      const maxSearchDepth = is3D ? (difficulty === 'hard' ? 6 : 3) : 9;
      const rootAllowedCells = isTurn1Locked ? allValidCells.filter((i) => i !== 13) : allValidCells;
      const rootCandidates = this.orderMoves(pMask, oMask, bitLines, powerTable, rootAllowedCells);
      const tt = new Map();

      // Pre-evaluate which root moves allow opponent an immediate VCF forced win
      const vcfPenalty = new Map();
      if (difficulty === 'hard' && is3D) {
        for (let i = 0; i < rootCandidates.length; i++) {
          const m = rootCandidates[i].cell;
          const nextP = pMask | (1 << m);
          const ourThreat = this.getWinningMoveMask(nextP, oMask, bitLines);
          let allowsOppVCF = false;
          if (ourThreat !== 0) {
            const forcedReply = ourThreat & -ourThreat;
            const nextO = oMask | forcedReply;
            if (this.hasWon(nextO, bitLines) || this.searchVCF(nextO, nextP, bitLines, allValidCells, 5) !== -1) {
              allowsOppVCF = true;
            }
          } else {
            if (this.searchVCF(oMask, nextP, bitLines, allValidCells, 5) !== -1) {
              allowsOppVCF = true;
            }
          }
          vcfPenalty.set(m, allowsOppVCF ? -75000 : 0);
        }
      }

      let bestMove = rootCandidates[0].cell;
      let bestScore = -Infinity;

      for (let d = 2; d <= maxSearchDepth; d++) {
        let currentBestMove = rootCandidates[0].cell;
        let currentBestScore = -Infinity;
        let alpha = -Infinity;
        const beta = Infinity;

        for (let i = 0; i < rootCandidates.length; i++) {
          const cell = rootCandidates[i].cell;
          const bit = 1 << cell;
          const nextP = pMask | bit;

          let score = -this.negamax(
            oMask,
            nextP,
            d - 1,
            -beta,
            -alpha,
            bitLines,
            powerTable,
            allValidCells,
            is3D,
            fullMask,
            deadline,
            tt
          );

          score += (vcfPenalty.get(cell) || 0);

          if (score > currentBestScore) {
            currentBestScore = score;
            currentBestMove = cell;
          }
          if (score > alpha) alpha = score;
        }

        bestMove = currentBestMove;
        bestScore = currentBestScore;

        // Move PV (Principal Variation) best move to the front for next deeper iteration
        const idx = rootCandidates.findIndex((c) => c.cell === bestMove);
        if (idx > 0) {
          const [picked] = rootCandidates.splice(idx, 1);
          rootCandidates.unshift(picked);
        }

        if (Date.now() > deadline || bestScore >= 85000) break;
      }

      let reason = `Optimal minimax trajectory (${powerTable[bestMove]} intersecting lines).`;
      if (bestScore >= 80000) {
        reason = 'Calculates a forced multi-ply winning variation!';
      } else if (powerTable[bestMove] >= 6) {
        reason = `Secures a 3D Corner Vertex commanding ${powerTable[bestMove]} multi-planar lines.`;
      } else {
        const nextP = pMask | (1 << bestMove);
        const created = popcount32(this.getWinningMoveMask(nextP, oMask, bitLines));
        if (created === 1) {
          reason = `Builds forcing tempo while disrupting opponent planes (${powerTable[bestMove]} lines).`;
        }
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
      this.startingPlayer = 'X';  // 'X' | 'O'
      this.currentTurn = 'X';
      this.gameMode = 'ai';       // 'ai' | 'pvp'
      this.aiDifficulty = 'hard'; // 'easy' | 'medium' | 'hard'
      this.gridMode = '3d';       // '3d' | 'classic'
      this.centerRule = 'turn1';  // 'standard' | 'turn1' | 'void'
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
      this.resetGame();
      this.startAutoRotateLoop();
    }

    getActiveLines() {
      if (this.gridMode === 'classic') return CLASSIC_LINES;
      return this.centerRule === 'void' ? VOID_3D_LINES : ALL_3D_LINES;
    }

    getPowerTable() {
      if (this.gridMode === 'classic') return POWER_CLASSIC;
      return this.centerRule === 'void' ? POWER_VOID_3D : POWER_3D;
    }

    isCenterRestrictedNow(idx) {
      if (idx !== 13 || this.gridMode !== '3d') return false;
      if (this.centerRule === 'void') return true;
      if (this.centerRule === 'turn1' && this.moveHistory.length === 0) return true;
      return false;
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

      if (!this.gameOver && this.board[idx] === null && !this.isAITurn() && !this.isCenterRestrictedNow(idx)) {
        if (from3D) this.sound.playHover(l);
        this.showGhostPreview(idx, this.currentTurn);
      }

      if (this.xrayEnabled && !this.gameOver && !this.isCenterRestrictedNow(idx)) {
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
      if (this.board[idx] !== null || this.isCenterRestrictedNow(idx)) return;
      const anchor = this.cell3dEls[idx].querySelector('.piece-anchor');
      anchor.innerHTML = this.createPieceMarkup(player, true);
    }

    clearGhostPreview(idx) {
      if (this.board[idx] !== null || (idx === 13 && this.gridMode === '3d' && this.centerRule === 'void')) return;
      const anchor = this.cell3dEls[idx].querySelector('.piece-anchor');
      anchor.innerHTML = '';
    }

    highlightIntersectingLines(idx) {
      this.clearRadarHighlights();
      const lines = this.getActiveLines();

      for (const ln of lines) {
        if (!ln.cells.includes(idx)) continue;
        const vals = ln.cells.map((c) => this.board[c]);
        const hasX = vals.includes('X');
        const hasO = vals.includes('O');
        if (hasX && hasO) continue; // blocked line

        const filledCount = vals.filter((v) => v === 'X' || v === 'O').length;
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
      if (this.isCenterRestrictedNow(idx)) {
        this.sound.playDraw();
        this.statusTextEl.textContent = this.centerRule === 'turn1'
          ? 'Center Nexus (L2·R2·C2) is locked on Move 1 — Open on an outer cell!'
          : 'Void Core (L2·R2·C2) is permanently impassable in this mode!';
        return;
      }

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
      // If Turn-1 Lock was active and Move 1 just completed, unlock Center Nexus visual!
      if (this.gridMode === '3d' && this.centerRule === 'turn1' && this.moveHistory.length === 1) {
        this.renderCellState(13);
      }
      this.highlightLastMove(idx);
      this.updateMoveLogUI();

      // Check for Win or Draw
      const lines = this.getActiveLines();
      const winMatch = this.checkWin(lines);

      if (winMatch) {
        this.finishGameWithWin(winMatch, player);
        return;
      }

      const maxMoves = this.gridMode === 'classic' ? 9 : (this.centerRule === 'void' ? 26 : 27);
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
      const cellEl = this.cell3dEls[idx];
      const anchor = cellEl.querySelector('.piece-anchor');
      const padCoord = cellEl.querySelector('.pad-coord');
      const sliceBtn = this.sliceCellEls[idx];

      sliceBtn.classList.remove('x', 'o', 'locked-nexus', 'void-nexus');
      cellEl.classList.remove('locked-nexus', 'void-nexus');

      if (idx === 13 && this.gridMode === '3d' && val === null) {
        if (this.centerRule === 'void') {
          cellEl.classList.add('void-nexus');
          sliceBtn.classList.add('void-nexus');
          sliceBtn.textContent = '❖';
          if (padCoord) padCoord.textContent = 'VOID';
          anchor.innerHTML = `
            <div class="piece-base-halo void"></div>
            <div class="piece-billboard">
              <div class="holo-void"></div>
            </div>
          `;
          return;
        }
        if (this.centerRule === 'turn1' && this.moveHistory.length === 0) {
          cellEl.classList.add('locked-nexus');
          sliceBtn.classList.add('locked-nexus');
          sliceBtn.textContent = '🔒';
          if (padCoord) padCoord.textContent = 'LOCK';
          anchor.innerHTML = '';
          return;
        }
        if (padCoord) padCoord.textContent = '★';
      }

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
          this.gridMode,
          this.centerRule,
          this.moveHistory.length
        );
        if (decision && decision.cell !== undefined) {
          this.executeMove(decision.cell, 'O');
        }
      }, 360);
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

      // Refresh Center Nexus lock state if we undid back to Move 0
      this.renderCellState(13);

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
      if (this.moveHistory.length === 0) {
        this.currentTurn = this.gameMode === 'ai' ? this.startingPlayer : 'X';
      } else {
        this.currentTurn = prevMove.player === 'X' ? 'O' : 'X';
      }

      this.sound.playUndo();
      this.updateTurnUI();
      this.updateMoveLogUI();
      this.updateTelemetry(null);

      if (this.gameMode === 'ai' && this.currentTurn === 'O') {
        this.triggerAIMove();
      }
    }

    requestHint() {
      if (this.gameOver || this.isAITurn()) return;
      this.clearHintHighlight();

      const recommendation = SpatialAI.analyzeBestMove(
        this.board,
        this.currentTurn,
        'hard',
        this.gridMode,
        this.centerRule,
        this.moveHistory.length
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
      this.currentTurn = this.gameMode === 'ai' ? this.startingPlayer : 'X';
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

      if (this.gridMode === '3d') {
        if (this.centerRule === 'turn1') {
          this.tacticalNote.innerHTML = `Rule Active: <strong>Turn-1 Lock</strong> — Center Nexus <strong>(L2·R2·C2)</strong> is locked on Move 1, then unlocks on Move 2!`;
        } else if (this.centerRule === 'void') {
          this.tacticalNote.innerHTML = `Rule Active: <strong>Void Core</strong> — Center Nexus is permanently impassable (36 perimeter winning lines).`;
        } else {
          this.tacticalNote.innerHTML = `Pro Tip: The center cell <strong>(L2·R2·C2)</strong> intersects <strong>13 winning lines</strong>—more than any other position in the cube.`;
        }
      }

      if (this.gameMode === 'ai' && this.currentTurn === 'O') {
        this.triggerAIMove();
      }
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
      const maxMoves = this.gridMode === 'classic' ? 9 : (this.centerRule === 'void' ? 26 : 27);
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
      const lines = this.getActiveLines();
      const powerTable = this.getPowerTable();

      // Count open unblocked winning lines
      let activeLines = 0;
      for (const ln of lines) {
        const vals = ln.cells.map((c) => this.board[c]);
        if (!(vals.includes('X') && vals.includes('O'))) activeLines++;
      }
      this.telTotalLines.textContent = `${activeLines} / ${lines.length}`;

      if (hoveredIdx !== null) {
        if (this.isCenterRestrictedNow(hoveredIdx)) {
          this.telCellPower.textContent = this.centerRule === 'void' ? 'Void Core (Blocked)' : 'Locked on Move 1';
        } else {
          this.telCellPower.textContent = `${powerTable[hoveredIdx]} intersecting lines`;
        }
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
          document.getElementById('first-turn-group').classList.toggle('hidden', this.gameMode !== 'ai');
          this.resetGame();
        });
      });

      // 8. AI Difficulty & Opening Turn
      document.querySelectorAll('[data-diff]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.aiDifficulty = btn.dataset.diff;
          document.querySelectorAll('[data-diff]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
          this.resetGame();
        });
      });

      document.querySelectorAll('[data-first]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.startingPlayer = btn.dataset.first;
          document.querySelectorAll('[data-first]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
          this.resetGame();
        });
      });

      // 9. Grid Dimension (3x3x3 Cube vs 3x3 Classic) & Center Nexus Rule
      document.querySelectorAll('[data-grid]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.gridMode = btn.dataset.grid;
          document.querySelectorAll('[data-grid]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
          const isClassic = this.gridMode === 'classic';
          document.getElementById('center-rule-group').classList.toggle('hidden', isClassic);
          document.getElementById('explode-slider-group').classList.toggle('hidden', isClassic);
          document.getElementById('layer-filter-group').classList.toggle('hidden', isClassic);

          this.sliceCardEls[0].classList.toggle('hidden', isClassic);
          this.sliceCardEls[2].classList.toggle('hidden', isClassic);

          this.isolatedLayer = 'all';
          this.updateSpatialPositions();
          this.resetGame();
        });
      });

      document.querySelectorAll('[data-center]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.centerRule = btn.dataset.center;
          document.querySelectorAll('[data-center]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
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
