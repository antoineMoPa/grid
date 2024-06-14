import './App.css'
import classNames from 'classnames'
import { GameEngine } from './GameEngine'
import { useCallback, useRef, useState } from 'react';

const formatNumber = (num: number) => {
    // Above 999, use K notation
    if (num > 999) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num;
}

export function GameTable({gameEngine} : { gameEngine: GameEngine }) {
    const tableRef = useRef<HTMLTableElement>(null);
    const [autoSweepStart, setAutoSweepStart] = useState<null|[number, number]>(null);

    const rows = [];

    const grid = gameEngine.grid.arraySync() as number[][];
    const activeCells = gameEngine.activeCells.arraySync() as number[][];
    const virusCells = gameEngine.virusCells.arraySync() as number[][];

    const onTableMouseDown = useCallback((e: React.MouseEvent) => {
        const eventCoordsRelativeToTable: [number, number] = [
            e.clientX - tableRef.current!.getBoundingClientRect().left,
            e.clientY - tableRef.current!.getBoundingClientRect().top
        ];
        setAutoSweepStart(gameEngine.screenCoordsToTableCoords(eventCoordsRelativeToTable));
    }, [gameEngine]);

    const onTableMouseUp = useCallback((e: React.MouseEvent) => {
        const eventCoordsRelativeToTable: [number, number] = [
            e.clientX - tableRef.current!.getBoundingClientRect().left,
            e.clientY - tableRef.current!.getBoundingClientRect().top
        ];
        const autoSweepEnd = gameEngine.screenCoordsToTableCoords(eventCoordsRelativeToTable);
        gameEngine.focusCell(autoSweepStart);
        gameEngine.autoSweepTo(autoSweepEnd);
    }, [gameEngine, autoSweepStart]);

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
                    onClick={(e) => gameEngine.autoSweepTo([i, j], { forceAutoSweep: e.shiftKey })}
                >
                    {virusCells[i][j] === 1 && formatNumber(grid[i][j])}
                    {activeCells[i][j] === 1 && formatNumber(grid[i][j])}
                </td>
            )
        }
        rows.push(<tr key={i}>{cells}</tr>)
    }

    return (
        <table ref={tableRef}
            onMouseDown={onTableMouseDown}
            onMouseUp={onTableMouseUp}
        >
            <tbody>
                {rows}
            </tbody>
        </table>
    )
}
