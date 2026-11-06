// Variation tree: the in-memory game representation. Each node is the position after a move;
// children[0] is the main continuation and further children are alternatives (variations).
import { Chess, type Move } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface NodeMeta {
  /** Extraction confidence for moves read from a book (0–1). */
  conf?: number;
  /** Why a move needs review (e.g. "figurine inferred", "OCR repair: 0-0 → O-O"). */
  flag?: string;
  /** Text originally printed in the book for this move. */
  raw?: string;
}

export interface MoveNode {
  id: number;
  parent: MoveNode | null;
  children: MoveNode[];
  san: string;
  uci: string;
  /** Position after this move (the root holds the starting position). */
  fen: string;
  /** Half-moves since the standard start: 0 at the initial position, 1 after White's first move. */
  ply: number;
  nags: number[];
  comment?: string;
  /** Comment printed before the move (mainly at the start of a variation). */
  startComment?: string;
  meta?: NodeMeta;
}

export function plyFromFen(fen: string): number {
  const parts = fen.split(/\s+/);
  const full = Number(parts[5] ?? 1) || 1;
  return (full - 1) * 2 + (parts[1] === 'b' ? 1 : 0);
}

/** "12." for a white move, "12…" for a black move at the start of a line. */
export function moveNumberLabel(node: MoveNode, forceBlack = false): string {
  const n = Math.floor((node.ply - 1) / 2) + 1;
  const white = node.ply % 2 === 1;
  if (white) return `${n}.`;
  return forceBlack ? `${n}…` : '';
}

export class GameTree {
  root: MoveNode;
  headers: Record<string, string> = {};
  private nextId = 1;
  private byId = new Map<number, MoveNode>();

  constructor(startFen: string = START_FEN) {
    const fen = new Chess(startFen).fen();
    this.root = { id: 0, parent: null, children: [], san: '', uci: '', fen, ply: plyFromFen(fen), nags: [] };
    this.byId.set(0, this.root);
    if (fen !== START_FEN) { this.headers.SetUp = '1'; this.headers.FEN = fen; }
  }

  get startFen(): string { return this.root.fen; }

  node(id: number): MoveNode | undefined { return this.byId.get(id); }

  /**
   * Play a move (SAN string or from/to object) from `parent`. Returns the existing child if the
   * move is already there. Throws if the move is illegal: callers decide how to report that.
   */
  addMove(parent: MoveNode, move: string | { from: string; to: string; promotion?: string }, meta?: NodeMeta): MoveNode {
    const chess = new Chess(parent.fen);
    let played: Move;
    try {
      played = chess.move(move as never);
    } catch {
      throw new Error(`Illegal move ${typeof move === 'string' ? move : move.from + move.to} in ${parent.fen}`);
    }
    const uci = played.from + played.to + (played.promotion ?? '');
    const existing = parent.children.find((c) => c.uci === uci);
    if (existing) return existing;
    const node: MoveNode = {
      id: this.nextId++, parent, children: [], san: played.san, uci, fen: chess.fen(), ply: parent.ply + 1, nags: [],
      ...(meta ? { meta } : {}),
    };
    parent.children.push(node);
    this.byId.set(node.id, node);
    return node;
  }

  /** Nodes from the root (exclusive) to `node` (inclusive). */
  pathTo(node: MoveNode): MoveNode[] {
    const out: MoveNode[] = [];
    for (let n: MoveNode | null = node; n && n.parent; n = n.parent) out.push(n);
    return out.reverse();
  }

  /** Stable address of a node: its SAN moves from the root, e.g. "e4 e5 Nf3". */
  pathKey(node: MoveNode): string { return this.pathTo(node).map((n) => n.san).join(' '); }

  findByPathKey(key: string): MoveNode | undefined {
    let n = this.root;
    if (!key) return n;
    for (const san of key.split(' ')) {
      const next = n.children.find((c) => c.san === san);
      if (!next) return undefined;
      n = next;
    }
    return n;
  }

  mainline(from: MoveNode = this.root): MoveNode[] {
    const out: MoveNode[] = [];
    for (let n = from.children[0]; n; n = n.children[0]) out.push(n);
    return out;
  }

  /** The node at the end of the line that continues `node` by first children. */
  lineEnd(node: MoveNode): MoveNode { let n = node; while (n.children[0]) n = n.children[0]; return n; }

  isMainline(node: MoveNode): boolean {
    for (let n = node; n.parent; n = n.parent) if (n.parent.children[0] !== n) return false;
    return true;
  }

  /** Make `node`'s line the main continuation at its branch point. */
  promote(node: MoveNode): void {
    let n = node;
    while (n.parent && n.parent.children[0] === n) n = n.parent;
    const p = n.parent;
    if (!p) return;
    p.children.splice(p.children.indexOf(n), 1);
    p.children.unshift(n);
  }

  /** Delete a node and everything after it. */
  remove(node: MoveNode): void {
    const p = node.parent;
    if (!p) return;
    p.children.splice(p.children.indexOf(node), 1);
    const drop = (n: MoveNode) => { this.byId.delete(n.id); n.children.forEach(drop); };
    drop(node);
  }

  all(): MoveNode[] { return [...this.byId.values()]; }

  /** Count of moves in the whole tree (all variations). */
  size(): number { return this.byId.size - 1; }

  /**
   * Threefold repetition along the path to `node`. Positions are compared on placement, side to
   * move, castling rights and en-passant square, as the FIDE rule requires.
   */
  isThreefold(node: MoveNode): boolean {
    const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
    const target = key(node.fen);
    let count = 0;
    for (let n: MoveNode | null = node; n; n = n.parent) {
      if (key(n.fen) === target) count++;
      if (count >= 3) return true;
      // An irreversible move (capture or pawn move) resets the halfmove clock; nothing before it can repeat.
      if (n.fen.split(' ')[4] === '0') break;
    }
    return false;
  }
}

export interface PositionStatus {
  check: boolean;
  checkmate: boolean;
  stalemate: boolean;
  insufficient: boolean;
  fiftyMove: boolean;
  threefold: boolean;
  turn: 'w' | 'b';
}

export function positionStatus(tree: GameTree, node: MoveNode): PositionStatus {
  const c = new Chess(node.fen);
  return {
    check: c.inCheck(), checkmate: c.isCheckmate(), stalemate: c.isStalemate(),
    insufficient: c.isInsufficientMaterial(), fiftyMove: Number(node.fen.split(' ')[4]) >= 100,
    threefold: tree.isThreefold(node), turn: c.turn(),
  };
}
