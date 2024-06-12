import './App.css'
import classNames from 'classnames'
import { GameEngine } from './GameEngine'

const formatNumber = (num: number) => {
    // Above 999, use K notation
    if (num > 999) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num;
}

export function GameTable({gameEngine} : { gameEngine: GameEngine }) {
    const rows = [];

    const grid = gameEngine.grid.arraySync() as number[][];
    const activeCells = gameEngine.activeCells.arraySync() as number[][];
    const virusCells = gameEngine.virusCells.arraySync() as number[][];

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
                    onClick={(e) => gameEngine.onCellClick([i, j], { forceAutoSweep: e.shiftKey })}
                >
                    {virusCells[i][j] === 1 && formatNumber(grid[i][j])}
                    {activeCells[i][j] === 1 && formatNumber(grid[i][j])}
                </td>
            )
        }
        rows.push(<tr key={i}>{cells}</tr>)
    }

    return (
        <table>
            <tbody>
                {rows}
            </tbody>
        </table>
    )
}
