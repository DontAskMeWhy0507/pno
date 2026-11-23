import {
  type BlockPiece,
  GRID_SIZE,
  canPieceFitAnywhere,
  canPlacePiece,
  checkAndClearLines,
  createEmptyBoard,
} from "../apps/next/src/modules/blocks/blocks-shapes";

describe("Blocks Puzzle Shapes Logic", () => {
  const dotPiece: BlockPiece = {
    id: "dot-1",
    name: "dot",
    shape: [[1]],
    color: "#3b82f6",
  };

  const h2Piece: BlockPiece = {
    id: "h2-1",
    name: "h2",
    shape: [[1, 1]],
    color: "#10b981",
  };

  test("canPlacePiece rejects negative row/col bounds and grid overflows", () => {
    const board = createEmptyBoard();

    expect(canPlacePiece(board, dotPiece, -1, 0)).toBe(false);
    expect(canPlacePiece(board, dotPiece, 0, -1)).toBe(false);
    expect(canPlacePiece(board, dotPiece, GRID_SIZE, 0)).toBe(false);
    expect(canPlacePiece(board, h2Piece, 0, GRID_SIZE - 1)).toBe(false);
    expect(canPlacePiece(board, h2Piece, 0, GRID_SIZE - 2)).toBe(true);
  });

  test("canPieceFitAnywhere accurately detects full vs open boards", () => {
    const board = createEmptyBoard();
    expect(canPieceFitAnywhere(board, h2Piece)).toBe(true);

    // Fill every cell except (0, 0) - isolated single cell cannot fit 1x2 piece
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (r !== 0 || c !== 0) {
          board[r]![c] = "#3b82f6";
        }
      }
    }

    expect(canPieceFitAnywhere(board, dotPiece)).toBe(true);
    expect(canPieceFitAnywhere(board, h2Piece)).toBe(false);
  });

  test("checkAndClearLines clears completed rows and columns simultaneously", () => {
    const board = createEmptyBoard();

    // Fill row 2 and column 5 completely
    for (let c = 0; c < GRID_SIZE; c++) {
      board[2]![c] = "#3b82f6";
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      board[r]![5] = "#ef4444";
    }
    // Also place one unrelated cell that should remain intact
    board[0]![0] = "#10b981";

    const { newBoard, linesCleared } = checkAndClearLines(board);

    expect(linesCleared).toBe(2);
    for (let c = 0; c < GRID_SIZE; c++) {
      expect(newBoard[2]![c]).toBeNull();
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      expect(newBoard[r]![5]).toBeNull();
    }
    expect(newBoard[0]![0]).toBe("#10b981");
  });
});
