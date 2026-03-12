/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Trophy, User, Cpu, Info, ChevronRight, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Constants ---
type Player = 'red' | 'white';

interface Piece {
  player: Player;
  isKing: boolean;
}

type Board = (Piece | null)[][];

interface Position {
  r: number;
  c: number;
}

const BOARD_SIZE = 8;

// --- Helper Functions ---
const createInitialBoard = (): Board => {
  const board: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 !== 0) {
        if (r < 3) {
          board[r][c] = { player: 'white', isKing: false };
        } else if (r > 4) {
          board[r][c] = { player: 'red', isKing: false };
        }
      }
    }
  }
  return board;
};

export default function App() {
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [turn, setTurn] = useState<Player>('red');
  const [selected, setSelected] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [score, setScore] = useState({ red: 12, white: 12 });
  const [gameMode, setGameMode] = useState<'pvp' | 'pvc'>('pvc');

  // --- Logic ---
  const getValidMoves = useCallback((r: number, c: number, currentBoard: Board, player: Player): Position[] => {
    const piece = currentBoard[r][c];
    if (!piece || piece.player !== player) return [];

    const moves: Position[] = [];
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

    if (piece.isKing) {
      // Long-range King movement
      directions.forEach(([dr, dc]) => {
        let nr = r + dr;
        let nc = c + dc;
        let foundOpponent = false;

        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          const target = currentBoard[nr][nc];
          
          if (!foundOpponent) {
            if (target === null) {
              moves.push({ r: nr, c: nc });
            } else if (target.player !== player) {
              // Potential jump
              const jr = nr + dr;
              const jc = nc + dc;
              if (jr >= 0 && jr < BOARD_SIZE && jc >= 0 && jc < BOARD_SIZE && currentBoard[jr][jc] === null) {
                // In long-range checkers, a king can land on any square behind the jumped piece
                let tr = jr;
                let tc = jc;
                while (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE && currentBoard[tr][tc] === null) {
                  moves.push({ r: tr, c: tc });
                  tr += dr;
                  tc += dc;
                }
                foundOpponent = true; // Stop after finding one jump path in this direction
              } else {
                break; // Blocked by opponent with no space behind
              }
            } else {
              break; // Blocked by own piece
            }
          } else {
            break; // Already handled jump in this direction
          }
          nr += dr;
          nc += dc;
        }
      });
    } else {
      // Standard piece movement
      const forwardDirs = piece.player === 'red' ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
      forwardDirs.forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          if (currentBoard[nr][nc] === null) {
            moves.push({ r: nr, c: nc });
          }
        }
      });

      // Standard jump moves (can jump backwards if needed in some rules, but usually forward)
      directions.forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          if (currentBoard[nr][nc] !== null && currentBoard[nr][nc]?.player !== player) {
            const jr = nr + dr;
            const jc = nc + dc;
            if (jr >= 0 && jr < BOARD_SIZE && jc >= 0 && jc < BOARD_SIZE && currentBoard[jr][jc] === null) {
              moves.push({ r: jr, c: jc });
            }
          }
        }
      });
    }

    return moves;
  }, []);

  const [points, setPoints] = useState({ red: 0, white: 0 });

  const handleSquareClick = (r: number, c: number) => {
    if (winner) return;
    if (gameMode === 'pvc' && turn === 'white') return;

    const piece = board[r][c];

    // Select piece
    if (piece && piece.player === turn) {
      setSelected({ r, c });
      setValidMoves(getValidMoves(r, c, board, turn));
      return;
    }

    // Move piece
    if (selected && validMoves.some(m => m.r === r && m.c === c)) {
      movePiece(selected.r, selected.c, r, c);
    } else {
      setSelected(null);
      setValidMoves([]);
    }
  };

  const movePiece = (fromR: number, fromC: number, toR: number, toC: number) => {
    const newBoard = board.map(row => [...row]);
    const piece = { ...newBoard[fromR][fromC]! };

    // Move
    newBoard[toR][toC] = piece;
    newBoard[fromR][fromC] = null;

    // Capture logic for long range
    const dr = Math.sign(toR - fromR);
    const dc = Math.sign(toC - fromC);
    let currR = fromR + dr;
    let currC = fromC + dc;
    let captured = false;

    while (currR !== toR && currC !== toC) {
      if (newBoard[currR][currC] !== null) {
        newBoard[currR][currC] = null;
        captured = true;
        setPoints(prev => ({
          ...prev,
          [turn]: prev[turn] + (piece.isKing ? 150 : 100)
        }));
        break;
      }
      currR += dr;
      currC += dc;
    }

    // Kinging
    if (!piece.isKing && ((piece.player === 'red' && toR === 0) || (piece.player === 'white' && toR === BOARD_SIZE - 1))) {
      piece.isKing = true;
      setPoints(prev => ({ ...prev, [turn]: prev[turn] + 250 }));
    }

    setBoard(newBoard);
    setSelected(null);
    setValidMoves([]);
    
    // Update Piece Count
    const redCount = newBoard.flat().filter(p => p?.player === 'red').length;
    const whiteCount = newBoard.flat().filter(p => p?.player === 'white').length;
    setScore({ red: redCount, white: whiteCount });

    if (redCount === 0) setWinner('white');
    else if (whiteCount === 0) setWinner('red');
    else setTurn(turn === 'red' ? 'white' : 'red');
  };

  // --- AI Logic (Simple) ---
  useEffect(() => {
    if (gameMode === 'pvc' && turn === 'white' && !winner) {
      const timer = setTimeout(() => {
        const allMoves: { from: Position; to: Position; isJump: boolean }[] = [];
        
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c]?.player === 'white') {
              const moves = getValidMoves(r, c, board, 'white');
              moves.forEach(m => {
                // Check if this move is a jump (capture)
                const dr = Math.sign(m.r - r);
                const dc = Math.sign(m.c - c);
                let currR = r + dr;
                let currC = c + dc;
                let isJump = false;
                while (currR !== m.r && currC !== m.c) {
                  if (board[currR][currC] !== null) {
                    isJump = true;
                    break;
                  }
                  currR += dr;
                  currC += dc;
                }

                allMoves.push({ 
                  from: { r, c }, 
                  to: m, 
                  isJump
                });
              });
            }
          }
        }

        if (allMoves.length > 0) {
          // Prioritize jumps
          const jumps = allMoves.filter(m => m.isJump);
          const move = jumps.length > 0 
            ? jumps[Math.floor(Math.random() * jumps.length)] 
            : allMoves[Math.floor(Math.random() * allMoves.length)];
          
          movePiece(move.from.r, move.from.c, move.to.r, move.to.c);
        } else {
          setWinner('red');
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [turn, gameMode, winner, board, getValidMoves]);

  const resetGame = () => {
    setBoard(createInitialBoard());
    setTurn('red');
    setSelected(null);
    setValidMoves([]);
    setWinner(null);
    setScore({ red: 12, white: 12 });
    setPoints({ red: 0, white: 0 });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 font-sans selection:bg-red-500/30 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-stone-100/5 blur-[120px] rounded-full animate-pulse delay-700" />
      
      {/* Header */}
      <div className="w-full max-w-2xl mb-8 flex justify-between items-end px-4 relative z-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            LOGICMOVE;<span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">CHECKERS</span>
          </h1>
          <div className="flex items-center gap-6 mt-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
                <span className="text-xl font-black text-white italic">{points.red}</span>
              </div>
              <span className="text-[8px] uppercase tracking-widest font-bold text-stone-500">Red (Siz)</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-stone-100 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                <span className="text-xl font-black text-white italic">{points.white}</span>
              </div>
              <span className="text-[8px] uppercase tracking-widest font-bold text-stone-500">White Points</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setGameMode(gameMode === 'pvc' ? 'pvp' : 'pvc')}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 rounded-xl border border-white/5 transition-all text-xs font-bold flex items-center gap-2"
          >
            {gameMode === 'pvc' ? <Cpu size={14} /> : <User size={14} />}
            {gameMode === 'pvc' ? 'VS AI' : 'VS PLAYER'}
          </button>
          <button 
            onClick={resetGame}
            className="p-2 bg-stone-900 hover:bg-stone-800 rounded-xl border border-white/5 transition-all"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Game Board */}
      <div className="relative group z-10">
        <div className="bg-stone-900/40 backdrop-blur-xl p-4 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10">
          <div className="grid grid-cols-8 grid-rows-8 w-[min(90vw,520px)] aspect-square rounded-2xl overflow-hidden border-8 border-stone-800 shadow-inner">
            {board.map((row, r) => 
              row.map((piece, c) => {
                const isDark = (r + c) % 2 !== 0;
                const isSelected = selected?.r === r && selected?.c === c;
                const isValid = validMoves.some(m => m.r === r && m.c === c);

                return (
                  <div 
                    key={`${r}-${c}`}
                    onClick={() => handleSquareClick(r, c)}
                    className={`
                      relative flex items-center justify-center cursor-pointer transition-all duration-300
                      ${isDark ? 'bg-stone-800/80' : 'bg-stone-200/90'}
                      ${isValid ? 'after:content-[""] after:absolute after:w-5 after:h-5 after:bg-emerald-500/60 after:rounded-full after:shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}
                      hover:brightness-110
                    `}
                  >
                    {piece && (
                      <motion.div
                        layoutId={`${r}-${c}-${piece.player}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`
                          w-[85%] h-[85%] rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.4)] flex items-center justify-center relative
                          ${piece.player === 'red' 
                            ? 'bg-gradient-to-br from-red-500 to-red-800 border-b-4 border-red-900' 
                            : 'bg-gradient-to-br from-stone-50 to-stone-300 border-b-4 border-stone-400'}
                          ${isSelected ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-stone-900 scale-110 z-20 shadow-[0_0_20px_rgba(52,211,153,0.6)]' : ''}
                        `}
                      >
                        {/* Decorative concentric circles for depth */}
                        <div className={`w-[85%] h-[85%] rounded-full border border-white/20 flex items-center justify-center shadow-inner`}>
                           <div className={`w-[70%] h-[70%] rounded-full border border-black/10`} />
                        </div>
                        
                        {piece.isKing && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Crown size={24} className={`${piece.player === 'red' ? 'text-white/80' : 'text-stone-600'} drop-shadow-md`} />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Turn Indicator */}
        <div className="absolute -right-24 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-6">
          <div className={`flex flex-col items-center gap-2 transition-opacity ${turn === 'white' ? 'opacity-100' : 'opacity-20'}`}>
            <div className="w-12 h-12 rounded-full bg-stone-100 shadow-xl" />
            <span className="text-[10px] font-black uppercase tracking-widest">White</span>
          </div>
          <div className="h-12 w-px bg-stone-800 mx-auto" />
          <div className={`flex flex-col items-center gap-2 transition-opacity ${turn === 'red' ? 'opacity-100' : 'opacity-20'}`}>
            <div className="w-12 h-12 rounded-full bg-red-600 shadow-xl" />
            <span className="text-[10px] font-black uppercase tracking-widest">Red</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-12 flex flex-col items-center gap-4">
        <div className="px-6 py-3 bg-stone-900/50 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${turn === 'red' ? 'bg-red-600 animate-pulse' : 'bg-stone-700'}`} />
            <span className={`text-sm font-bold ${turn === 'red' ? 'text-white' : 'text-stone-500'}`}>RED'S TURN</span>
          </div>
          <div className="w-px h-4 bg-stone-800" />
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${turn === 'white' ? 'bg-stone-100 animate-pulse' : 'bg-stone-700'}`} />
            <span className={`text-sm font-bold ${turn === 'white' ? 'text-white' : 'text-stone-500'}`}>WHITE'S TURN</span>
          </div>
        </div>
        
        <p className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-bold">
          Classic Rules • King Pieces • AI Opponent
        </p>
      </div>

      {/* Winner Modal */}
      <AnimatePresence>
        {winner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-stone-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-sm w-full bg-stone-900 p-12 rounded-[3rem] border border-white/10 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20">
                <Trophy className="text-emerald-500" size={40} />
              </div>
              <h2 className="text-5xl font-black italic tracking-tighter text-white mb-4">
                {winner === 'red' ? 'SIZ YUTDINGIZ!' : 'SIZ YUTQAZDINGIZ'}
              </h2>
              <p className="text-stone-400 mb-10 text-lg">
                {winner === 'red' 
                  ? 'Ajoyib g\'alaba! Siz barcha oqlarni mag\'lub etdingiz.' 
                  : 'Afsus, oqlar bu safar kuchliroq chiqdi. Yana urinib ko\'ring!'}
              </p>
              
              <button
                onClick={resetGame}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xl italic tracking-tight transition-all flex items-center justify-center gap-3"
              >
                <RotateCcw size={20} />
                PLAY AGAIN
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
