import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import classNames from 'classnames'
import { GameEngine, EASY, MEDIUM, HARD } from './GameEngine'

import '@tensorflow/tfjs-backend-webgl';
import {Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure} from "@nextui-org/react";


const GAME_INTERVAL = 1000;

const gameWinMessage = (generations: number, level) => {
    return (
        <>
            <ModalHeader className="flex flex-col gap-1">You Won!</ModalHeader>
            <ModalBody>
                <p>Congratulations!</p>
                <p>You have successfully eradicated the virus from the grid
                    in {generations} generations.</p>
                <p>level: {level}</p>
            </ModalBody>
        </>
    );
}

const gameLostMessage = () => {
    return (
        <>
            <ModalHeader className="flex flex-col gap-1">You Lost!</ModalHeader>
            <ModalBody>
                <p>Ouch!</p>
                <p>The virus has destroyed you...</p>
            </ModalBody>
        </>
    );
}

const difficultyToString = (difficulty: string) => {
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


function App() {
    const tableRef = useRef<HTMLTableElement | null>(null);
    const gameEngineRef = useRef<null | GameEngine>(null);
    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const gameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [difficulty, setDifficulty] = useState(EASY);

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

    const replaceGameInterval = (delay: number) => {
        if (gameIntervalRef.current) {
            clearInterval(gameIntervalRef.current);
        }
        gameIntervalRef.current = setInterval(() => {
            gameEngine.step();
            setGeneration(generation + 1);

            if (gameEngine.hasWon || gameEngine.hasLost) {
                onOpen();
            }
        }, delay);
    }

    // Every second, increase active cells
    useEffect(() => {
        replaceGameInterval(GAME_INTERVAL);

        return () => {
            if (gameIntervalRef.current) {
                clearInterval(gameIntervalRef.current)
            }
        };
    }, [gameEngineRef.current]);

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
                    {virusCells[i][j] === 1 && grid[i][j]}
                    {activeCells[i][j] === 1 && grid[i][j]}
                </td>
            )
        }
        rows.push(<tr key={i}>{cells}</tr>)
    }

    const onClose = useCallback(() => {
        replaceGameInterval(GAME_INTERVAL);
        gameEngineRef.current?.resetGame();
    }, []);

    const surrender = useCallback(() => {
        if (gameEngineRef.current) {
            gameEngineRef.current.virusMoveRate = 1.0;
        }
        replaceGameInterval(10);
    }, []);

    useEffect(() => {
        gameEngine.difficulty = difficulty;
        gameEngine.resetGame();
        document.querySelectorAll('table')[0].focus();
    }, [difficulty, gameEngine, tableRef]);

    return (
        <>
            <div className="top-left-bar">
                <p className="generation">Generation {gameEngine.generation}</p>
                {
                    gameEngine.stats.wasFocusedCellEaten &&
                        <p>
                            Your active cell was eaten!<br/>
                            Click one of your other cells to continue.
                        </p>
                }
                <div className="difficulty mt-4">
                    <p className="mb-2">Difficulty:</p>
                    <Button onClick={() => setDifficulty(EASY)}
                        className={classNames("mr-1", { selected: difficulty == EASY })}>
                        {difficultyToString(EASY)}
                    </Button>
                    <Button onClick={() => setDifficulty(MEDIUM)}
                        className={classNames("mr-1", { selected: difficulty == MEDIUM })}>
                        {difficultyToString(MEDIUM)}
                    </Button>
                    <Button onClick={() => setDifficulty(HARD)}
                        className={classNames({ selected: difficulty == HARD })}>
                        {difficultyToString(HARD)}
                    </Button>
                </div>
            </div>
            <div className="top-right-bar">
                <div className="stats">
                    <p>You: {gameEngine.stats.activeCellCount}</p>
                    <p>Virus: {gameEngine.stats.virusCellCount}</p>
                </div>
            </div>
            <div className="bottom-left-bar">
                <h2>Instructions:</h2>
                <p>Use mouse to change active cell.</p>
                <p>Use arrows to move around.</p>
                <p>Collect numbers and use these to fight the virus.</p>
                <br/>
                <p>Eradicate the virus to win!</p>
            </div>
            <div className="bottom-right-bar">
                <Button className="surrender" onClick={surrender}>Surrender</Button>
            </div>
            <table ref={tableRef}>
                <tbody>
                    {rows}
                </tbody>
            </table>
            <>
                <Modal isOpen={isOpen} onOpenChange={onOpenChange} onClose={onClose}>
                    <ModalContent>
                        {(onClose) => (
                            <>
                                { gameEngine.hasWon && gameWinMessage(
                                    gameEngine.generation,
                                    difficultyToString(difficulty)
                                ) }
                                { gameEngine.hasLost && gameLostMessage() }
                                <ModalFooter>
                                    <Button color="primary" onPress={onClose}>
                                        Play Again
                                    </Button>
                                </ModalFooter>
                            </>
                        )}
                    </ModalContent>
                </Modal>
            </>
        </>
    )
}

export default App
