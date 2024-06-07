import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import classNames from 'classnames'

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

tf.setBackend('webgl').then(() => {
    console.log('WebGL backend initialized');
});

class GameEngine {
    HEIGHT = 30;
    WIDTH = 30;
    grid = tf.ones([this.HEIGHT, this.WIDTH]).mul(-1);
    activeCells = tf.zeros([this.HEIGHT, this.WIDTH]);
    focusedCell = [0, 0];
    actionQueue: Array<Function> = [];
    generation = 0;
    hasWon = false;

    onUpdateCallback = () => {};

    constructor() {
        // initialize first activeCell
        const activeCells = this.activeCells.arraySync();
        const grid = this.grid.arraySync();
        activeCells[this.focusedCell[0]][this.focusedCell[1]] = 1;
        grid[this.focusedCell[0]][this.focusedCell[1]] = 25;
        this.activeCells = tf.tensor(activeCells);
        this.grid = tf.tensor(grid);
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp':
                    this.moveTo({
                        initialCellPositon: this.focusedCell,
                        destinationCellPosition: [this.focusedCell[0] - 1, this.focusedCell[1]]
                    });
                    break;
                case 'ArrowDown':
                    this.moveTo({
                        initialCellPositon: this.focusedCell,
                        destinationCellPosition: [this.focusedCell[0] + 1, this.focusedCell[1]]
                    });
                    break;
                case 'ArrowLeft':
                    this.moveTo({
                        initialCellPositon: this.focusedCell,
                        destinationCellPosition: [this.focusedCell[0], this.focusedCell[1] - 1]
                    });
                    break;
                case 'ArrowRight':
                    this.moveTo({
                        initialCellPositon: this.focusedCell,
                        destinationCellPosition: [this.focusedCell[0], this.focusedCell[1] + 1]
                    });
                    break;
            default:
                return;
            }
            e.preventDefault();
        });
    }

    addAction(action: () => void) {
        this.actionQueue.push(action);
    }

    checkBounds([i, j]) {
        return i >= 0 && i < this.WIDTH && j >= 0 && j < this.HEIGHT;
    }

    moveTo({initialCellPositon, destinationCellPosition}) {
        const activeCells = this.activeCells.arraySync();
        const grid = this.grid.arraySync();

        if (!this.checkBounds(initialCellPositon) || !this.checkBounds(destinationCellPosition)) {
            return;
        }

        const initialCellValue = grid[initialCellPositon[0]][initialCellPositon[1]];
        const destinationCellValue = grid[destinationCellPosition[0]][destinationCellPosition[1]];

        // Check if there are enough resources in the initial cell to move to the new position
        if (initialCellValue < -destinationCellValue) {
            return;
        }

        if (activeCells[initialCellPositon[0]][initialCellPositon[1]] !==  1) {
            return
        }

        // Move all content from the initial cell to the destination cell
        const initialContent = grid[initialCellPositon[0]][initialCellPositon[1]];
        grid[initialCellPositon[0]][initialCellPositon[1]] = 0;
        grid[destinationCellPosition[0]][destinationCellPosition[1]] += initialContent;
        activeCells[destinationCellPosition[0]][destinationCellPosition[1]] = 1;

        this.activeCells = tf.tensor(activeCells);
        this.grid = tf.tensor(grid);

        // Move focused cell to the new position
        this.focusedCell = structuredClone(destinationCellPosition);

        this.onUpdateCallback();
    }

    trySetFocusedCell([i, j]) {
        if (i < 0 || i >= this.WIDTH || j < 0 || j >= this.HEIGHT) {
            return;
        }

        const activeCells = this.activeCells.arraySync();

        let neighbors = 0;


        neighbors += activeCells[i-1]?.[j] || 0;
        neighbors += activeCells[i+1]?.[j] || 0;
        neighbors += activeCells[i]?.[j+1] || 0;
        neighbors += activeCells[i]?.[j-1] || 0;

        if (neighbors > 0) {
            this.focusedCell = [i, j];
            activeCells[i][j] = 1;
        }

        this.activeCells = tf.tensor(activeCells);

        this.onUpdateCallback();
    }

    step() {
        if (this.hasWon) {
            return;
        }

        const grid = structuredClone(this.grid.arraySync());
        const activeCells = this.activeCells.arraySync();

        // Process actions
        while (this.actionQueue.length > 0) {
            // Call action with this as context
            this.actionQueue.shift().call(this);
        }

        if (this.generation % 5 === 0) {
            // Each cell increases by 1 if it is active
            for (let i = 0; i < this.grid.shape[0]; i++) {
                for (let j = 0; j < this.grid.shape[1]; j++) {
                    if (activeCells[i][j] === 1) {
                        grid[i][j]++;
                    } else if (this.generation % 40 === 0 && this.generation > 0){
                        // Increase difficulty with time by
                        // increasing the value of inactive cells
                        grid[i][j]--;
                    }
                }
            }
        }

        this.detectWin();

        this.grid = tf.tensor(grid);
        this.generation++;
    }

    detectWin() {
        const activeCells = this.activeCells.arraySync();
        let win = true;
        for (let i = 0; i < this.grid.shape[0]; i++) {
            for (let j = 0; j < this.grid.shape[1]; j++) {
                if (activeCells[i][j] !== 1) {
                    win = false;
                    break;
                }
            }
        }

        if (win) {
            this.hasWon = true;
            alert('You win!');
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

    const currentGrid = gameEngine.grid.arraySync();
    const currentActiveCells = gameEngine.activeCells.arraySync();

    const onCellClick = (i, j) => {
        gameEngine.trySetFocusedCell([i, j]);
    };

    // Every second, increase active cells
    useEffect(() => {
        const interval = setInterval(() => {
            gameEngine.step();
            setGeneration(generation + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [gameEngine, generation]);

    for (let i = 0; i < gameEngine.grid.shape[0]; i++) {
        const cells = [];
        for (let j = 0; j < gameEngine.grid.shape[1]; j++) {

            cells.push(
                <td
                    key={j}
                    className={classNames({
                        active: currentActiveCells[i][j] === 1,
                        focused: gameEngine.focusedCell[0] === i && gameEngine.focusedCell[1] === j
                    })}
                    onClick={() => onCellClick(i, j)}
                >
                    {currentGrid[i][j]}
                </td>
            )
        }
        rows.push(<tr key={i}>{cells}</tr>)
    }

    return (
        <>
            <p className="generation">Generation {generation}</p>
            <table>
                <tbody>
                    {rows}
                </tbody>
            </table>
        </>
    )
}

export default App
