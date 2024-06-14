import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import classNames from 'classnames'
import { GameEngine, EASY, MEDIUM, HARD, difficultyToString, Difficulty, mobileKeySource } from './GameEngine'

import '@tensorflow/tfjs-backend-webgl';
import { ButtonGroup, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure } from "@nextui-org/react";

import { GameTable } from './GameTable';

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

function InstructionsModal({ gameEngine } : { gameEngine: GameEngine }) {
    const [cookies, setCookie] = useCookies(['shown-instructions']);
    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const [shownInstructions, setShownInstructions] = useState(cookies['shown-instructions']);

    const onClose = useCallback(() => {
        setCookie('shown-instructions', true);
        setShownInstructions(true);
        gameEngine.resetGame();
    }, []);

    if (!shownInstructions && !isOpen) {
        onOpen();
    }

    return (
        <>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} onClose={onClose}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Instructions</ModalHeader>
                            <ModalBody>
                                <p>Use mouse to change active cell.</p>
                                <p>Use arrows to move around.</p>
                                <p>Collect numbers and use these to fight the virus.</p>
                                <p>Eradicate the virus to win!</p>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="primary" onPress={onClose}>
                                    Close
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    )
}

function App() {
    const gameEngineRef = useRef<null | GameEngine>(null);
    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const gameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [cookies, setCookie] = useCookies(['difficulty']);
    const [difficulty, setDifficulty] = useState<Difficulty>(cookies.difficulty || EASY);
    const [canvasResult, setCanvasResult] = useState<HTMLCanvasElement | null>(null);

    if (!gameEngineRef.current) {
        gameEngineRef.current = new GameEngine();
        gameEngineRef.current.bindEvents();
    }
    (window as any).gameEngine = gameEngineRef.current;
    const [sceneUpdateCounter, setSceneUpdateCounter] = useState(0);

    gameEngineRef.current.onUpdateCallback = () => {
        setSceneUpdateCounter(sceneUpdateCounter + 1);
    }

    gameEngineRef.current.onGeneratedImageCallback = (canvas) => {
        setCanvasResult(canvas);
    }

    const [bigShareImage, setBigShareImage] = useState(false);

    const toggleBigShareImage = useCallback(() => {
        setBigShareImage(!bigShareImage);
    }, [bigShareImage]);

    const gameEngine = gameEngineRef.current;
    const [generation, setGeneration] = useState(0);

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

    const onClose = useCallback(() => {
        replaceGameInterval(GAME_INTERVAL);
        setBigShareImage(false);
        gameEngineRef.current?.resetGame();
    }, []);

    const surrender = useCallback(() => {
        if (gameEngineRef.current) {
            gameEngineRef.current.virusMoveRate = 1.0;
        }
        replaceGameInterval(10);
    }, []);

    useEffect(() => {
        document.querySelectorAll('table')[0].focus();
        if (gameEngine.difficulty === difficulty) {
            return;
        }
        gameEngine.difficulty = difficulty;
        gameEngine.resetGame();
        setCookie('difficulty', difficulty);
    }, [difficulty, gameEngine]);

    const leaveTrailOptions = [0, 10, 20, 50, 100, 200];

    const handleTrailSizeChange = useCallback((value: number) => {
        gameEngine.setTrailSize(value);
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
            <GameTable gameEngine={gameEngine}/>
            <div className="mobile-ui">
                <div className="arrow-keys mt-2">
                    <Button size="md"
                        onTouchStart={upStart}
                        onTouchEnd={upEnd}
                        className="up mt-3 m-1 mr-10">↑</Button>
                    <div className="break"></div>
                    <Button size="md"
                        onTouchStart={leftStart}
                        onTouchEnd={leftEnd}
                        className="left mr-1">←</Button>
                    <Button size="md"
                        onTouchStart={rightStart}
                        onTouchEnd={rightEnd}
                        className="right">→</Button>
                    <div className="break"></div>
                    <Button size="md"
                        onTouchStart={downStart}
                        onTouchEnd={downEnd}
                        className="down mr-10 mt-1">↓</Button>
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
                    <p>Use <span className="keyboard-shortcut">Shift + Arrows</span> to auto sweep.</p>
                    <p>Trail Wall Size <span className="keyboard-shortcut">T</span></p>
                    <div>
                        <ButtonGroup size="sm">
                            { leaveTrailOptions.map((value) => (
                                <Button size="sm"
                                    key={value}
                                    className={classNames('p-0', { selected: trailSize == value })}
                                    onClick={() => handleTrailSizeChange(value)}>{value}</Button>
                            ))}
                        </ButtonGroup>
                    </div>
                    <p className="text-xs text-slate-500">Leave trail when around virus to help slow growth.</p>
                </div>
            </div>
            <div className="top-right-bar">
                <div className="stats">
                    <p>You: {gameEngine.stats.activeCellCount}</p>
                    <p>Virus: {gameEngine.stats.virusCellCount}</p>
                </div>
            </div>
            <InstructionsModal gameEngine={gameEngine}/>
            <div className="bottom-left-bar">
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
                <Modal isOpen={isOpen} onOpenChange={onOpenChange} onClose={onClose} isDismissable={false}>
                    <ModalContent className="win-modal">
                        {(onClose) => (
                            <>
                                    <div>
                                        { gameEngine.hasWon && gameWinMessage(
                                            gameEngine.generation,
                                            difficultyToString(difficulty)
                                        ) }
                                        { gameEngine.hasLost && gameLostMessage() }
                                    </div>
                                { canvasResult &&
                                    <div>
                                        <p className="text-right m-4">
                                            <a onClick={toggleBigShareImage}>
                                                <img src={canvasResult.toDataURL()} alt="game result" className='mt-4 image-result cursor-pointer'/>
                                            </a>
                                        </p>
                                        <p className="text-sm text-slate-500 text-center">
                                            Click on the image to enlarge
                                        </p>
                                    </div>
                                }
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
            { canvasResult &&
                <div
                    className={classNames(
                        {
                            'hidden': !bigShareImage,
                            'big-share-image': bigShareImage
                        }
                    )
                    }
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleBigShareImage();
                    }}
                >
                    <div className="close-button"
                        onClick={toggleBigShareImage}
                    >
                        <svg aria-hidden="true" fill="none" focusable="false" height="1em" role="presentation" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="1em"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                    </div>
                    <img src={canvasResult.toDataURL()}

                        alt="game result"
                    />
                </div>
            }
        </>
    )
}

export default App
