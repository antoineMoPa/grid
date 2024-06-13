import * as tf from '@tensorflow/tfjs';
import { renderGrid } from './renderGrid';

tf.setBackend('webgl').then(() => {
    console.log('WebGL backend initialized');
});

const DEFAULT_VIRUS_MOVE_RATE = 0.2;

export const difficultyToString = (difficulty: string) => {
    switch (difficulty) {
        case EASY:
            return 'Easy';
        case MEDIUM:
            return 'Medium';
        case HARD:
            return 'Hard';
        default:
            return 'Unknown';
    }
}


export const EASY = "level-0";
export const MEDIUM = "level-1";
export const HARD = "level-2";

export type Difficulty = typeof EASY | typeof MEDIUM | typeof HARD;

const difficultyMap = {
    [EASY]: {
        initialIslands: 5,
        initialSteps: 0,
        minInitialVirusArea: 0,
    },
    [MEDIUM]: {
        initialIslands: 4,
        initialSteps: 5,
        minInitialVirusArea: 0,
    },
    [HARD]: {
        initialIslands: 2,
        initialSteps: 12,
        minInitialVirusArea: 50,
    }
}

export type ReplayState = {
    grid: number[][],
    activeCells: number[][],
    virusCells: number[][],
    focusedCell: [number, number],
    generation: number,
    stats: {
        activeCellCount: number,
        virusCellCount: number,
        wasFocusedCellEaten: boolean,
    }
}

class MobileKeySource extends EventTarget {
}

// Mobile key event source
export const mobileKeySource = new MobileKeySource();

// Keyboard listener with standard repeat delay across devices
const keyListener = (keys: string[], callback: (event?: KeyboardEvent) => void, repeat_delay = 33, timeout_delay = 150) => {
    let interval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    let repeat = false;

    const keyDown = (key: string, e?: KeyboardEvent) => {
        if (keys.includes(key) && !repeat) {
            e?.preventDefault();
            callback(e);
            repeat = true;
            timeout = setTimeout(() => {
                interval = setInterval(callback.bind(this, e), repeat_delay);
            }, timeout_delay);
        }
    };

    const keyUp = (key: string) => {
        if (keys.includes(key)) {
            repeat = false;
            clearInterval(interval);
            clearTimeout(timeout);
        }
    }

    window.addEventListener('keydown', (e) => {
        keyDown(e.key, e);
    });

    window.addEventListener('keyup', (e) => {
        keyUp(e.key);
    });

    mobileKeySource.addEventListener('keydown', (e) => {
        keyDown((e as CustomEvent).detail);
    });

    mobileKeySource.addEventListener('keyup', (e) => {
        keyUp((e as CustomEvent).detail);
    });
}

const mobileUiHeight = 180;
const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight - mobileUiHeight;
const tileSize = 22;
const availableTilesWidth = screenWidth / tileSize;
const availableTilesHeight = screenHeight / tileSize;

export class GameEngine {
    difficulty: Difficulty = EASY;
    HEIGHT = Math.floor(Math.min(25, availableTilesHeight));
    WIDTH = Math.floor(Math.min(30, availableTilesWidth));
    grid = tf.zeros([this.HEIGHT, this.WIDTH]);
    activeCells = tf.zeros([this.HEIGHT, this.WIDTH]);
    virusCells = tf.zeros([this.HEIGHT, this.WIDTH]);
    focusedCell: [number, number] = [0, 0];
    actionQueue: Array<() => void> = [];
    generation = 0;
    hasWon = false;
    hasLost = false;
    virusMoveRate = DEFAULT_VIRUS_MOVE_RATE;
    leaveTrail = false;
    trailSize = 5;
    enableAutoSweep = window.innerWidth < 768;
    replay: ReplayState[] = [];
    onUpdateCallback = () => {};
    onGeneratedImageCallback = (_canvas: HTMLCanvasElement | null) => {};

    resultCanvas = document.createElement('canvas');

    setEnableAutoSweep(value: boolean) {
        this.enableAutoSweep = value;
        this.onUpdateCallback();
    }

    toggleAutoSweep() {
        this.setEnableAutoSweep(!this.enableAutoSweep);
    }

    setLeaveTrail(value: boolean) {
        this.leaveTrail = value;
        this.onUpdateCallback();
    }

    toggleLeaveTrail() {
        this.setLeaveTrail(!this.leaveTrail);
    }

    stats: {
        activeCellCount: number,
        virusCellCount: number,
        wasFocusedCellEaten: boolean,
    } = { activeCellCount: 0, virusCellCount: 0, wasFocusedCellEaten: false };

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
        this.replay = [];

        // initialize first activeCell
        const activeCells = this.activeCells.arraySync() as number[][];
        const grid = this.grid.arraySync() as number[][];

        // initialize a few virus cells
        const virusCells = this.virusCells.arraySync() as number[][];

        for (let i = 0; i < difficultyMap[this.difficulty].initialIslands; i++) {
            const virusCell = [Math.floor(Math.random() * this.HEIGHT), Math.floor(Math.random() * this.WIDTH)];
            virusCells[virusCell[0]][virusCell[1]] = 1;
            grid[virusCell[0]][virusCell[1]] = 1;
        }

        activeCells[this.focusedCell[0]][this.focusedCell[1]] = 1;
        grid[this.focusedCell[0]][this.focusedCell[1]] = 50;
        this.activeCells = tf.tensor(activeCells);
        this.grid = tf.tensor(grid);
        this.virusCells = tf.tensor(virusCells);

        // Step a few times to grow virus
        const level = difficultyMap[this.difficulty];
        for (let i = 0; i < level.initialSteps; i++) {
            this.step();
        }

        while (this.stats.virusCellCount < level.minInitialVirusArea) {
            this.step();
        }

        this.generation = 0;
    }

    bindEvents() {
        keyListener(['w', 'W', 'ArrowUp'], (e) => {
            if (e?.shiftKey) {
                this.autoSweep([-1, 0])
            } else {
                this.moveTo({
                    initialCellPosition: this.focusedCell,
                    destinationCellPosition: [this.focusedCell[0] - 1, this.focusedCell[1]]
                });
            }
        });

        keyListener(['s', 'S', 'ArrowDown'], (e) => {
            if (e?.shiftKey) {
                this.autoSweep([1, 0])
            } else {
                this.moveTo({
                    initialCellPosition: this.focusedCell,
                    destinationCellPosition: [this.focusedCell[0] + 1, this.focusedCell[1]]
                });
            }
        });

        keyListener(['a', 'A', 'ArrowLeft'], (e) => {
            if (e?.shiftKey) {
                this.autoSweep([0, -1])
            } else {
                this.moveTo({
                    initialCellPosition: this.focusedCell,
                    destinationCellPosition: [this.focusedCell[0], this.focusedCell[1] - 1]
                });
            }
        });

        keyListener(['d', 'D', 'ArrowRight'], (e) => {
            if (e?.shiftKey) {
                this.autoSweep([0, 1])
            } else {
                this.moveTo({
                    initialCellPosition: this.focusedCell,
                    destinationCellPosition: [this.focusedCell[0], this.focusedCell[1] + 1]
                });
            }
        });
    }

    queueAction(action: () => void) {
        this.actionQueue.push(action);
    }

    checkBounds([i, j]: [number, number]) {
        return i >= 0 && i < this.HEIGHT && j >= 0 && j < this.WIDTH;
    }

    async autoSweep(direction: [number, number], distance = Infinity) {
        let i = this.focusedCell[0];
        let j = this.focusedCell[1];
        let distanceCounter = 0;
        let delay = 0;
        let cancel = false;
        const promises = [];

        while (distanceCounter < distance && this.checkBounds([i, j])) {
            const localI = i;
            const localJ = j;

            promises.push(new Promise<void>((resolve) => {
                setTimeout(() => {
                    if (cancel) {
                        resolve();
                        return;
                    }

                    const result = this.moveTo({
                        initialCellPosition: [localI, localJ],
                        destinationCellPosition: [localI + direction[0], localJ + direction[1]]
                    });

                    if (!result) {
                        cancel = true;
                    }

                    resolve();
                }, delay);
            }));

            i += direction[0];
            j += direction[1];

            delay += 30;
            distanceCounter++;
        }

        await Promise.all(promises);
    }

    moveToMeta(
        {
            initialCellPosition,
            destinationCellPosition,
            grid,
            playerCells,
            enemyCells,
            trailSize,
        }:
        {
            initialCellPosition: [number, number],
            destinationCellPosition: [number, number],
            grid: number[][],
            playerCells: number[][],
            enemyCells: number[][],
            trailSize?: number,
        }
    ): boolean {
        trailSize = trailSize || 0;
        const d = destinationCellPosition;
        const s = initialCellPosition;

        if (!this.checkBounds(s) || !this.checkBounds(d)) {
            return false;
        }

        // Check if initial and final position are either left/right or up/down
        if (s[0] !== d[0] && s[1] !== d[1]) {
            return false;
        }
        if (Math.abs(s[0] - d[0]) > 1 || Math.abs(s[1] - d[1]) > 1) {
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

        // Leave Trail logic
        {
            // Check if there is an enemy cell around
            let enemyAround = false;
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    if (this.checkBounds([s[0] + i, s[1] + j]) && enemyCells[s[0] + i][s[1] + j] === 1) {
                        enemyAround = true;
                    }
                }
            }

            if (enemyAround) {
                const amountToAdd = this.leaveTrail ? trailSize - grid[s[0]][s[1]] : 0;
                if (trailSize > 0 && grid[d[0]][d[1]] > trailSize && amountToAdd > 0) {
                    grid[s[0]][s[1]] = amountToAdd;
                    grid[d[0]][d[1]] -= amountToAdd;
                }
            }
        }

        playerCells[d[0]][d[1]] = 1;
        enemyCells[d[0]][d[1]] = 0;

        this.onUpdateCallback();

        return true;
    }

    moveTo(
        {initialCellPosition, destinationCellPosition}:
        {initialCellPosition: [number, number], destinationCellPosition: [number, number]}
    ): boolean {
        const grid = this.grid.arraySync() as number[][];
        const playerCells = this.activeCells.arraySync() as number[][];
        const enemyCells = this.virusCells.arraySync() as number[][];

        const result = this.moveToMeta({
            initialCellPosition,
            destinationCellPosition,
            grid,
            playerCells,
            enemyCells,
            trailSize: this.trailSize
        });

        if (!result) {
            return result;
        }

        this.activeCells = tf.tensor(playerCells);
        this.grid = tf.tensor(grid);
        this.virusCells = tf.tensor(enemyCells);

        // Move focused cell to the new position
        this.focusedCell = structuredClone(destinationCellPosition);

        this.onUpdateCallback();

        return true;
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

    async onCellClick([i, j]: [number, number], {forceAutoSweep = false } = {}) {
        const activeCells = this.activeCells.arraySync() as number[][];
        const oldI = this.focusedCell[0];
        const oldJ = this.focusedCell[1];

        if (this.enableAutoSweep || forceAutoSweep) {
            // Auto Sweep up/down, then left right
            const distanceI = Math.abs(i - oldI);
            await this.autoSweep([Math.sign(i - oldI), 0], distanceI);
            const distanceJ = Math.abs(j - oldJ);
            await this.autoSweep([0, Math.sign(j - oldJ)], distanceJ);
        }

        if (activeCells[i][j] === 1) {
            this.focusedCell = [i, j];
        }

        this.onUpdateCallback();
    }

    step() {
        if (this.hasWon || this.hasLost) {
            return;
        }

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

        this.storeReplay();
    }

    saveState(): ReplayState {
        return {
            grid: this.grid.arraySync() as number[][],
            activeCells: this.activeCells.arraySync() as number[][],
            virusCells: this.virusCells.arraySync() as number[][],
            focusedCell: structuredClone(this.focusedCell),
            generation: this.generation,
            stats: structuredClone(this.stats)
        };
    }

    storeReplay() {
        this.replay.push(this.saveState());
    }

    restoreReplayState(state: ReplayState) {
        this.grid = tf.tensor(state.grid);
        this.activeCells = tf.tensor(state.activeCells);
        this.virusCells = tf.tensor(state.virusCells);
        this.focusedCell = structuredClone(state.focusedCell);
        this.generation = state.generation;
        this.stats = structuredClone(state.stats);
    }

    async generateShareImage() {
        // Disable on mobile
        if (window.innerWidth < 768) {
            return;
        }

        this.onGeneratedImageCallback(null);
        const headlessEngine = new GameEngine();
        const canvas = this.resultCanvas;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        const headerSize = 120;
        const margin = 10;

        const intermediateStepsCount = 4;
        const intermediateStepIndices = [];


        for (let i = 0; i < intermediateStepsCount; i++) {
            intermediateStepIndices.push(Math.floor(i / intermediateStepsCount * this.replay.length));
        }

        const replaysIndices = [
            0,
            ...intermediateStepIndices,
            this.replay.length - 1
        ];

        ctx.shadowColor="black";
        ctx.shadowBlur=7;

        for (let i = 0; i < replaysIndices.length; i++) {
            const replayIndex = replaysIndices[i];
            headlessEngine.restoreReplayState(this.replay[replayIndex]);

            const image = await renderGrid(headlessEngine);

            const columns = 3;

            if (i === 0) {
                canvas.width = image.width * columns + margin * (columns + 1);
                canvas.height = headerSize + margin + (image.height + margin) * Math.ceil(replaysIndices.length / columns) + margin;
                // White background
                ctx.fillStyle = '#242424';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }


            const x = margin + (image.width + margin) * (i % columns);
            const y = headerSize + (image.height + margin) * Math.floor(i / columns);

            ctx.drawImage(image, x, y);

            // Stats block
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            const stats1 = `Generation: ${this.generation}`;
            ctx.fillText(stats1, x + 10, y + 20);
            const stats2 = `You: ${this.stats.activeCellCount}`;
            ctx.fillText(stats2, x + 10, y + 30);
            const stats3 = `Virus: ${this.stats.virusCellCount}`;
            ctx.fillText(stats3, x + 10, y + 40);
        }

        // Draw header
        ctx.fillStyle = '#ffffff';
        const message = this.hasWon ? 'You won!' : 'Virus Won!'
        ctx.textAlign = 'center';
        ctx.font = 'bold 30px Arial';
        ctx.fillText(message, canvas.width / 2, headerSize / 2 - 15);

        // Write level
        ctx.font = 'bold 10px Arial';
        ctx.fillText('Level: ' + difficultyToString(this.difficulty), canvas.width / 2, headerSize / 2 + 15);

        ctx.font = 'bold 10px Arial';
        ctx.fillText('Play at https://antoinemopa.github.io/grid/', canvas.width / 2, headerSize - 20);

        this.onGeneratedImageCallback(canvas);
    }

    detectGameStatus(): boolean {
        if (this.hasWon || this.hasLost) {
            return true;
        }

        const activeCellsCount = this.activeCells.mul(this.grid).sum().arraySync() as number;
        const virusCellsCount = this.virusCells.mul(this.grid).sum().arraySync() as number;

        this.stats.activeCellCount = activeCellsCount;
        this.stats.virusCellCount = virusCellsCount;
        this.stats.wasFocusedCellEaten = (this.virusCells.arraySync() as number[][])[this.focusedCell[0]][this.focusedCell[1]] === 1;

        this.onUpdateCallback();

        if (virusCellsCount === 0) {
            this.hasWon = true;
            this.generateShareImage();
            return true;
        }

        if (activeCellsCount === 0) {
            this.hasLost = true;
            this.generateShareImage();
            return true;
        }

        return false;
    }
}
