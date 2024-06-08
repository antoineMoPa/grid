import { useState, useEffect, useRef } from 'react'
import './App.css'
import classNames from 'classnames'

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

tf.setBackend('webgl').then(() => {
    console.log('WebGL backend initialized');
});

class GameEngine {
    HEIGHT = 25;
    WIDTH = 30;
    grid = tf.ones([this.HEIGHT, this.WIDTH]).mul(-1);
    activeCells = tf.zeros([this.HEIGHT, this.WIDTH]);
    virusCells = tf.zeros([this.HEIGHT, this.WIDTH]);
    focusedCell: [number, number] = [0, 0];
    actionQueue: Array<Function> = [];
    generation = 0;
    hasWon = false;

    onUpdateCallback = () => {};

    constructor() {
        // initialize first activeCell
        const activeCells = this.activeCells.arraySync() as number[][];
        const grid = this.grid.arraySync() as number[][];
        const virusCells = this.virusCells.arraySync() as number[][];
        activeCells[this.focusedCell[0]][this.focusedCell[1]] = 1;
        virusCells[this.HEIGHT -1][this.WIDTH - 1] = 1;
        grid[this.focusedCell[0]][this.focusedCell[1]] = 25;
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
        else if (playerCells[d[0]][d[1]] === 1) {
            moveCost = 0;
        }
        else {
            moveCost = -grid[d[0]][d[1]];
        }

        // Check if there are enough resources in the initial cell to move to the new position
        if (initialCellValue < moveCost) {
            return false;
        }

        if (playerCells[s[0]][s[1]] !==  1) {
            return false;
        }

        // Move all content from the initial cell to the destination cell
        const initialContent = grid[s[0]][s[1]];
        grid[s[0]][s[1]] = 0;
        grid[d[0]][d[1]] += initialContent - moveCost;
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
        if (!this.checkBounds([i, j])) {
            return;
        }

        const activeCells = this.activeCells.arraySync() as number[][];

        // Check if any neighbor cell is active
        let hasActiveNeighbor = false;
        if (i > 0 && activeCells[i - 1][j] === 1) {
            hasActiveNeighbor = true;
        }
        if (i < (this.grid.shape[0] as number) - 1 && activeCells[i + 1][j] === 1) {
            hasActiveNeighbor = true;
        }
        if (j > 0 && activeCells[i][j - 1] === 1) {
            hasActiveNeighbor = true;
        }
        if (j < (this.grid.shape[1] as number) - 1 && activeCells[i][j + 1] === 1) {
            hasActiveNeighbor = true;
        }

        if (!hasActiveNeighbor) {
            return;
        }

        this.moveTo({
            initialCellPosition: this.focusedCell,
            destinationCellPosition: [i, j]
        });
    }

    step() {
        if (this.hasWon) {
            return;
        }

        // Process actions
        while (this.actionQueue.length > 0) {
            // Call action with this as context
            (this.actionQueue.shift() as () => void).call(this);
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

                    if (this.generation % 5 === 0) {
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

        if (!this.detectWin()) {
            this.generation++;
        }
    }

    detectWin() {
        const virusCellsCount = this.virusCells.sum().arraySync();

        if (virusCellsCount === 0) {
            this.hasWon = true;
            return true;
        }
    }
}

function App() {
    const gameEngineRef = useRef<null | GameEngine>(null);
    if (!gameEngineRef.current) {
        gameEngineRef.current = new GameEngine();
        gameEngineRef.current.bindEvents();
    }
    (window as any).gameEngine = gameEngineRef.current;
    const [sceneUpdateCounter, setSceneUpdateCounter] = useState(0);

    gameEngineRef.current.onUpdateCallback = () => {
        setSceneUpdateCounter(sceneUpdateCounter + 1);
    }

    const gameEngine = gameEngineRef.current;
    const [generation, setGeneration] = useState(0);

    // Loop through the grid show a table cell for each cell
    const rows = [];

    const grid = gameEngine.grid.arraySync() as number[][];
    const activeCells = gameEngine.activeCells.arraySync() as number[][];
    const virusCells = gameEngine.virusCells.arraySync() as number[][];

    const onCellClick = ([i, j]: [number, number]) => {
        gameEngine.onCellClick([i, j]);
    };

    // Every second, increase active cells
    useEffect(() => {
        const interval = setInterval(() => {
            gameEngine.step();
            setGeneration(generation + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [gameEngine, generation]);

    for (let i = 0; i < (gameEngine.grid.shape[0] as number); i++) {
        const cells = [];
        for (let j = 0; j < (gameEngine.grid.shape[1] as number); j++) {

            cells.push(
                <td
                    key={j}
                    className={classNames({
                        active: activeCells[i][j] === 1,
                        focused: gameEngine.focusedCell[0] === i && gameEngine.focusedCell[1] === j,
                        virus: virusCells[i][j] === 1,
                    })}
                    onClick={() => onCellClick([i, j])}
                >
                    {grid[i][j]}
                </td>
            )
        }
        rows.push(<tr key={i}>{cells}</tr>)
    }

    return (
        <>
            <p className="generation">Generation {gameEngine.generation}</p>
            <table>
                <tbody>
                    {rows}
                </tbody>
            </table>
        </>
    )
}

export default App
