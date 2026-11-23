export type BlockMatrix = number[][];

export interface BlockPiece {
  id: string;
  name: string;
  shape: BlockMatrix;
  color: string;
}

export const PIECE_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#ef4444", // Red
];

export const RAW_SHAPES: { name: string; shape: BlockMatrix }[] = [
  { name: "dot", shape: [[1]] },
  { name: "h2", shape: [[1, 1]] },
  { name: "v2", shape: [[1], [1]] },
  { name: "h3", shape: [[1, 1, 1]] },
  { name: "v3", shape: [[1], [1], [1]] },
  { name: "h4", shape: [[1, 1, 1, 1]] },
  { name: "v4", shape: [[1], [1], [1], [1]] },
  {
    name: "square2",
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  {
    name: "cornerTL",
    shape: [
      [1, 1],
      [1, 0],
    ],
  },
  {
    name: "cornerTR",
    shape: [
      [1, 1],
      [0, 1],
    ],
  },
  {
    name: "cornerBL",
    shape: [
      [1, 0],
      [1, 1],
    ],
  },
  {
    name: "cornerBR",
    shape: [
      [0, 1],
      [1, 1],
    ],
  },
  {
    name: "tUp",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
  },
  {
    name: "tDown",
    shape: [
      [1, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    name: "lShape",
    shape: [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
  },
];

export const GRID_SIZE = 8;

export function createEmptyBoard(): (string | null)[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null),
  );
}

export function getRandomPiece(): BlockPiece {
  const chosen = RAW_SHAPES[Math.floor(Math.random() * RAW_SHAPES.length)]!;
  const color = PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)]!;
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: chosen.name,
    shape: chosen.shape,
    color,
  };
}

export function rotatePieceMatrix(matrix: BlockMatrix): BlockMatrix {
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  if (rows === 0 || cols === 0) return matrix;
  const rotated: BlockMatrix = Array.from({ length: cols }, () =>
    Array.from({ length: rows }, () => 0),
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c]![rows - 1 - r] = matrix[r]![c]!;
    }
  }
  return rotated;
}

export function canPlacePiece(
  board: (string | null)[][],
  piece: BlockPiece,
  startRow: number,
  startCol: number,
): boolean {
  const shape = piece.shape;
  const numRows = shape.length;
  const numCols = shape[0]?.length || 0;

  if (
    startRow < 0 ||
    startCol < 0 ||
    startRow + numRows > GRID_SIZE ||
    startCol + numCols > GRID_SIZE
  ) {
    return false;
  }

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (shape[r]![c] === 1) {
        if (board[startRow + r]![startCol + c] !== null) {
          return false;
        }
      }
    }
  }

  return true;
}

export function canPieceFitAnywhere(
  board: (string | null)[][],
  piece: BlockPiece,
): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (canPlacePiece(board, piece, r, c)) {
        return true;
      }
    }
  }
  return false;
}

export function checkAndClearLines(board: (string | null)[][]): {
  newBoard: (string | null)[][];
  linesCleared: number;
} {
  const fullRows: number[] = [];
  const fullCols: number[] = [];

  // Check rows
  for (let r = 0; r < GRID_SIZE; r++) {
    let full = true;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r]![c] === null) {
        full = false;
        break;
      }
    }
    if (full) fullRows.push(r);
  }

  // Check columns
  for (let c = 0; c < GRID_SIZE; c++) {
    let full = true;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (board[r]![c] === null) {
        full = false;
        break;
      }
    }
    if (full) fullCols.push(c);
  }

  const linesCleared = fullRows.length + fullCols.length;
  if (linesCleared === 0) {
    return { newBoard: board, linesCleared: 0 };
  }

  // Create deep copy
  const newBoard = board.map((row) => [...row]);

  // Clear rows
  for (const r of fullRows) {
    for (let c = 0; c < GRID_SIZE; c++) {
      newBoard[r]![c] = null;
    }
  }

  // Clear cols
  for (const c of fullCols) {
    for (let r = 0; r < GRID_SIZE; r++) {
      newBoard[r]![c] = null;
    }
  }

  return { newBoard, linesCleared };
}
