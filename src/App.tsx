import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import classNames from 'classnames'
import { GameEngine } from './GameEngine'

import '@tensorflow/tfjs-backend-webgl';
import {Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure} from "@nextui-org/react";

const GAME_INTERVAL = 1000;

const gameWinMessage = () => {
    return (
        <>
            <ModalHeader className="flex flex-col gap-1">You Won!</ModalHeader>
            <ModalBody>
                <p>Congratulations!</p>
                <p>You have successfully eradicated the virus from the grid.</p>
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


function App() {
    const gameEngineRef = useRef<null | GameEngine>(null);
    const {isOpen, onOpen, onOpenChange} = useDisclosure();

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

            if (gameEngine.hasWon || gameEngine.hasLost) {
                onOpen();
            }
        }, GAME_INTERVAL);

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
                    {virusCells[i][j] === 1 && grid[i][j]}
                    {activeCells[i][j] === 1 && grid[i][j]}
                </td>
            )
        }
        rows.push(<tr key={i}>{cells}</tr>)
    }

    const onClose = useCallback(() => {
        gameEngineRef.current.resetGame();
    }, []);

    const surrender = useCallback(() => {
        gameEngineRef.current?.resetGame();
    }, []);

    return (
        <>
            <p className="generation">Generation {gameEngine.generation}</p>
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
                <Button className="surrender" onClick={surrender}>Start Over</Button>
            </div>
            <table>
                <tbody>
                    {rows}
                </tbody>
            </table>
            <>
                <Modal isOpen={isOpen} onOpenChange={onOpenChange} onClose={onClose}>
                    <ModalContent>
                        {(onClose) => (
                            <>
                                { gameEngine.hasWon && gameWinMessage() }
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
