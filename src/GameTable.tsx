import './App.css'
import { GameEngine } from './GameEngine'
import { useCallback, useRef, useState } from 'react';

// TODO: Hover cell state

export function GameTable({gameEngine} : { gameEngine: GameEngine }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [autoSweepStart, setAutoSweepStart] = useState<null|[number, number]>(null);

    const onTableMouseDown = useCallback((e: React.MouseEvent) => {
        const eventCoordsRelativeToTable: [number, number] = [
            e.clientX - canvasRef.current!.getBoundingClientRect().left,
            e.clientY - canvasRef.current!.getBoundingClientRect().top
        ];
        setAutoSweepStart(gameEngine.screenCoordsToTableCoords(eventCoordsRelativeToTable));
    }, [gameEngine]);

    const onTableMouseUp = useCallback((e: React.MouseEvent) => {
        const eventCoordsRelativeToTable: [number, number] = [
            e.clientX - canvasRef.current!.getBoundingClientRect().left,
            e.clientY - canvasRef.current!.getBoundingClientRect().top
        ];
        const autoSweepEnd = gameEngine.screenCoordsToTableCoords(eventCoordsRelativeToTable);
        if (autoSweepStart) {
            gameEngine.focusCell(autoSweepStart);
        }
        gameEngine.autoSweepTo(autoSweepEnd);
    }, [gameEngine, autoSweepStart]);

    const onClick = useCallback((e: React.MouseEvent) => {
        const eventCoordsRelativeToTable: [number, number] = [
            e.clientX - canvasRef.current!.getBoundingClientRect().left,
            e.clientY - canvasRef.current!.getBoundingClientRect().top
        ];
        const coords = gameEngine.screenCoordsToTableCoords(eventCoordsRelativeToTable);
        gameEngine.autoSweepTo(coords);
    }, [gameEngine]);


    if (canvasRef.current) {
        gameEngine.drawCanvas(canvasRef.current);
    }

    return (
        <div>
            <canvas
                className="game-table"
                ref={canvasRef}
                onMouseDown={onTableMouseDown}
                onMouseUp={onTableMouseUp}
                onClick={onClick}/>
        </div>
    )
}
