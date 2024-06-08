import * as tf from '@tensorflow/tfjs';

tf.setBackend('webgl').then(() => {
    console.log('WebGL backend initialized');
});

const DEFAULT_VIRUS_MOVE_RATE = 0.2;

export class GameEngine {
    HEIGHT = 25;
    WIDTH = 30;
    grid = tf.ones([this.HEIGHT, this.WIDTH]);
    activeCells = tf.zeros([this.HEIGHT, this.WIDTH]);
    virusCells = tf.zeros([this.HEIGHT, this.WIDTH]);
    focusedCell: [number, number] = [0, 0];
    actionQueue: Array<() => void> = [];
    generation = 0;
    hasWon = false;
    hasLost = false;
    virusMoveRate = DEFAULT_VIRUS_MOVE_RATE;
    stats: {
        activeCellCount: number,
        virusCellCount: number,
    } = { activeCellCount: 0, virusCellCount: 0 };

    onUpdateCallback = () => {};

    constructor() {
        this.resetGame();
    }

    resetGame() {
        this.grid = tf.ones([this.HEIGHT, this.WIDTH]).mul(-1);
        this.activeCells = tf.zeros([this.HEIGHT, this.WIDTH]);
        this.virusCells = tf.zeros([this.HEIGHT, this.WIDTH]);
        const initialFocussedCell: [number, number] = [Math.floor(Math.random() * this.HEIGHT), Math.floor(Math.random() * this.WIDTH)];
        this.focusedCell = initialFocussedCell;
        this.actionQueue = [];
        this.generation = 0;
        this.hasWon = false;
        this.hasLost = false;
        this.virusMoveRate = DEFAULT_VIRUS_MOVE_RATE;

        // initialize first activeCell
        const activeCells = this.activeCells.arraySync() as number[][];
        const grid = this.grid.arraySync() as number[][];

        // initialize a few virus cells
        const virusCells = this.virusCells.arraySync() as number[][];
        for (let i = 0; i < 5; i++) {
            const virusCell = [Math.floor(Math.random() * this.HEIGHT), Math.floor(Math.random() * this.WIDTH)];
            virusCells[virusCell[0]][virusCell[1]] = 1;
            grid[virusCell[0]][virusCell[1]] = 1;
        }

        activeCells[this.focusedCell[0]][this.focusedCell[1]] = 1;
        grid[this.focusedCell[0]][this.focusedCell[1]] = 50;
        this.activeCells = tf.tensor(activeCells);
        this.grid = tf.tensor(grid);
        this.virusCells = tf.tensor(virusCells);
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp':
                    this.moveTo({
                        initialCellPosition: this.focusedCell,
                        destinationCellPosition: [this.focusedCell[0] - 1, this.focusedCell[1]]
                    });
                    break;
                case 'ArrowDown':
                    this.moveTo({
                        initialCellPosition: this.focusedCell,
                        destinationCellPosition: [this.focusedCell[0] + 1, this.focusedCell[1]]
                    });
                    break;
                case 'ArrowLeft':
                    this.moveTo({
                        initialCellPosition: this.focusedCell,
                        destinationCellPosition: [this.focusedCell[0], this.focusedCell[1] - 1]
                    });
                    break;
                case 'ArrowRight':
                    this.moveTo({
                        initialCellPosition: this.focusedCell,
                        destinationCellPosition: [this.focusedCell[0], this.focusedCell[1] + 1]
                    });
                    break;
            default:
                return;
            }
            e.preventDefault();
        });
    }

    queueAction(action: () => void) {
        this.actionQueue.push(action);
    }

    checkBounds([i, j]: [number, number]) {
        return i >= 0 && i < this.HEIGHT && j >= 0 && j < this.WIDTH;
    }


    moveToMeta(
        {
            initialCellPosition,
            destinationCellPosition,
            grid,
            playerCells,
            enemyCells
        }:
        {
            initialCellPosition: [number, number],
            destinationCellPosition: [number, number],
            grid: number[][],
            playerCells: number[][],
            enemyCells: number[][]
        }
    ): boolean {
        const d = destinationCellPosition;
        const s = initialCellPosition;

        if (!this.checkBounds(s) || !this.checkBounds(d)) {
            return false;
        }

        const initialCellValue = grid[s[0]][s[1]];
        let moveCost = 0;

        // Check if the destination cell is a virus cell
        if (enemyCells[d[0]][d[1]] === 1) {
            moveCost = grid[d[0]][d[1]];
        }
        // Check if the destination cell is an active cell
        else if (playerCells[d[0]][d[1]] > 0 && playerCells[s[0]][s[1]] > 0) {
            moveCost = -grid[d[0]][d[1]];
        }
        else {
            moveCost = -grid[d[0]][d[1]];
        }

        // Check if there are enough resources in the initial cell to move to the new position
        if (initialCellValue <= moveCost) {
            return false;
        }

        if (playerCells[s[0]][s[1]] !==  1) {
            return false;
        }

        // Move all content from the initial cell to the destination cell
        grid[s[0]][s[1]] = 0;
        grid[d[0]][d[1]] = initialCellValue - moveCost;

        playerCells[d[0]][d[1]] = 1;
        enemyCells[d[0]][d[1]] = 0;

        this.onUpdateCallback();

        return true;
    }

    moveTo(
        {initialCellPosition, destinationCellPosition}:
        {initialCellPosition: [number, number], destinationCellPosition: [number, number]}
    ) {
        const grid = this.grid.arraySync() as number[][];
        const playerCells = this.activeCells.arraySync() as number[][];
        const enemyCells = this.virusCells.arraySync() as number[][];

        const result = this.moveToMeta({
            initialCellPosition,
            destinationCellPosition,
            grid,
            playerCells,
            enemyCells
        });

        if (!result) {
            return;
        }

        this.activeCells = tf.tensor(playerCells);
        this.grid = tf.tensor(grid);
        this.virusCells = tf.tensor(enemyCells);

        // Move focused cell to the new position
        this.focusedCell = structuredClone(destinationCellPosition);

        this.onUpdateCallback();
    }

    moveVirusTo(
        {initialCellPosition, destinationCellPosition}:
        {initialCellPosition: [number, number], destinationCellPosition: [number, number]}
    ) {
        const grid = this.grid.arraySync() as number[][];
        const enemyCells = this.activeCells.arraySync() as number[][];
        const playerCells = this.virusCells.arraySync() as number[][];

        const result = this.moveToMeta({
            initialCellPosition,
            destinationCellPosition,
            grid,
            enemyCells,
            playerCells
        });

        if (!result) {
            return;
        }

        this.activeCells = tf.tensor(enemyCells);
        this.grid = tf.tensor(grid);
        this.virusCells = tf.tensor(playerCells);

        this.onUpdateCallback();
    }

    onCellClick([i, j]: [number, number]) {
        const activeCells = this.activeCells.arraySync() as number[][];

        if (activeCells[i][j] === 1) {
            this.focusedCell = [i, j];
        }

        this.onUpdateCallback();
    }

    step() {
        // Process actions
        while (this.actionQueue.length > 0) {
            // Call action with this as context
            (this.actionQueue.shift() as () => void).call(this);
        }

        this.queueAction(() => {
            if (this.hasWon) {
                return;
            }


            const grid = structuredClone(this.grid.arraySync()) as number[][];
            const activeCells = this.activeCells.arraySync() as number[][];
            const virusCells = this.virusCells.arraySync() as number[][];


            for (let i = 0; i < (this.grid.shape[0] as number); i++) {
                for (let j = 0; j < (this.grid.shape[1] as number); j++) {
                    if (activeCells[i][j] === 1 && this.generation % 5 === 0) {
                        // Each cell increases by 1 if it is active
                        grid[i][j]++;
                    } else if (virusCells[i][j] === 1) {
                        grid[i][j]++;

                        if (Math.random() < this.virusMoveRate) {
                            // Move virus in random direction
                            const directions: [number, number][] = [
                                [i - 1, j],
                                [i + 1, j],
                                [i, j - 1],
                                [i, j + 1],
                            ];

                            const direction = directions[Math.floor(Math.random() * directions.length)];
                            this.queueAction(() => {
                                this.moveVirusTo({
                                    initialCellPosition: [i, j],
                                    destinationCellPosition: direction
                                });
                            });
                        }
                    }
                }
            }

            this.grid = tf.tensor(grid);

            if (!this.detectGameStatus()) {
                this.generation++;
            }
        });
    }

    detectGameStatus(): boolean {
        const activeCellsCount = this.activeCells.mul(this.grid).sum().arraySync() as number;
        const virusCellsCount = this.virusCells.mul(this.grid).sum().arraySync() as number;

        this.stats.activeCellCount = activeCellsCount;
        this.stats.virusCellCount = virusCellsCount;

        this.onUpdateCallback();

        if (virusCellsCount === 0) {
            this.hasWon = true;
            return true;
        }

        if (activeCellsCount === 0) {
            this.hasLost = true;
            return true;
        }

        return false;
    }
}
