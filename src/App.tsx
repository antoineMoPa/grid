import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import classNames from 'classnames'
import { GameEngine, EASY, MEDIUM, HARD, Difficulty, mobileKeySource } from './GameEngine'

import '@tensorflow/tfjs-backend-webgl';
import {ButtonGroup, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure, Switch} from "@nextui-org/react";

import { useCookies } from 'react-cookie';

const GAME_INTERVAL = 1000;

const gameWinMessage = (generations: number, level: string) => {
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
    const [cookies, setCookie] = useCookies(['difficulty']);
    const [difficulty, setDifficulty] = useState<Difficulty>(cookies.difficulty || EASY);
    // Game engine has the source of truth for leave trail, this var is just for faster ui update
    const [leaveTrail, setLeaveTrail] = useState(false);

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

    const formatNumber = (num: number) => {
        // Above 999, use K notation
        if (num > 999) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num;
    }

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
                    {virusCells[i][j] === 1 && formatNumber(grid[i][j])}
                    {activeCells[i][j] === 1 && formatNumber(grid[i][j])}
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
        setCookie('difficulty', difficulty);
    }, [difficulty, gameEngine, tableRef]);

    const handleLeaveTrailChange = useCallback((value: boolean) => {
        gameEngine.leaveTrail = value;
        setLeaveTrail(value);
    }, [gameEngine]);

    // Listen to 't' key to toggle trail mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 't') {
                handleLeaveTrailChange(!leaveTrail);
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        }
    }, [leaveTrail, handleLeaveTrailChange]);

    const handleTrailSizeChange = useCallback((value: number) => {
        gameEngine.trailSize = value;
    }, [gameEngine]);

    const trailSize = gameEngine.trailSize;

    // Callbacks for mobile arrow keys
    const leftStart = useCallback(() => {
        const event = new CustomEvent('keydown', { detail: 'ArrowLeft' });
        mobileKeySource.dispatchEvent(event);
    }, []);

    const leftEnd = useCallback(() => {
        const event = new CustomEvent('keyup', { detail: 'ArrowLeft' });
        mobileKeySource.dispatchEvent(event);
    }, []);

    const rightStart = useCallback(() => {
        const event = new CustomEvent('keydown', { detail: 'ArrowRight' });
        mobileKeySource.dispatchEvent(event);
    }, []);

    const rightEnd = useCallback(() => {
        const event = new CustomEvent('keyup', { detail: 'ArrowRight' });
        mobileKeySource.dispatchEvent(event);
    }, []);

    const upStart = useCallback(() => {
        const event = new CustomEvent('keydown', { detail: 'ArrowUp' });
        mobileKeySource.dispatchEvent(event);
    }, []);

    const upEnd = useCallback(() => {
        const event = new CustomEvent('keyup', { detail: 'ArrowUp' });
        mobileKeySource.dispatchEvent(event);
    }, []);

    const downStart = useCallback(() => {
        const event = new CustomEvent('keydown', { detail: 'ArrowDown' });
        mobileKeySource.dispatchEvent(event);
    }, []);

    const downEnd = useCallback(() => {
        const event = new CustomEvent('keyup', { detail: 'ArrowDown' });
        mobileKeySource.dispatchEvent(event);
    }, []);

    return (
        <>
            <table ref={tableRef}>
                <tbody>
                    {rows}
                </tbody>
            </table>
            <div className="mobile-ui">
                <div className="arrow-keys">
                    <Button size="sm"
                        onTouchStart={upStart}
                        onTouchEnd={upEnd}
                        className="up mt-3 m-1 mr-8">↑</Button>
                    <div className="break"></div>
                    <Button size="sm"
                        onTouchStart={leftStart}
                        onTouchEnd={leftEnd}
                        className="left mr-1">←</Button>
                    <Button size="sm"
                        onTouchStart={rightStart}
                        onTouchEnd={rightEnd}
                        className="right">→</Button>
                    <div className="break"></div>
                    <Button size="sm"
                        onTouchStart={downStart}
                        onTouchEnd={downEnd}
                        className="down mr-8 mt-1">↓</Button>
                </div>
            </div>
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
                    <ButtonGroup>
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
                    </ButtonGroup>
                </div>
                <div className="leave-trail mt-4">
                    <Switch isSelected={leaveTrail} onValueChange={handleLeaveTrailChange}>
                        Trail Wall Mode <span className="keyboard-shortcut">t</span>
                        <br/>
                    </Switch>
                    { (leaveTrail) &&
                        <div>
                            <p>Tail size:</p>
                            <ButtonGroup>
                                <Button size="sm"
                                    className={classNames({ selected: trailSize == 5 })}
                                    onClick={() => handleTrailSizeChange(5)}>5</Button>
                                <Button size="sm"
                                    className={classNames({ selected: trailSize == 10 })}
                                    onClick={() => handleTrailSizeChange(10)}>10</Button>
                                <Button size="sm"
                                    className={classNames({ selected: trailSize == 50 })}
                                    onClick={() => handleTrailSizeChange(50)}>50</Button>
                                <Button size="sm"
                                    className={classNames({ selected: trailSize == 100 })}
                                    onClick={() => handleTrailSizeChange(100)}>100</Button>
                                <Button size="sm"
                                    className={classNames({ selected: trailSize == 200 })}
                                    onClick={() => handleTrailSizeChange(200)}>200</Button>
                            </ButtonGroup>
                        </div>
                    }
                    <p className="text-xs text-slate-500">Leave trail when around virus to help slow growth.</p>
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
                <br/>
                <p className="text-xs">Like the repo on Github:<br/>
                    <a href="https://github.com/antoineMoPa/grid" target="_blank">
                        https://github.com/antoineMoPa/grid
                    </a>
                </p>
            </div>
            <div className="bottom-right-bar">
                <Button className="surrender" onClick={surrender}>Surrender</Button>
            </div>
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
