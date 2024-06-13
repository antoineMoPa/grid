import { GameEngine } from './GameEngine';
import { GameTable } from './GameTable';
import { createRoot } from 'react-dom/client';
import { useLayoutEffect } from 'react';
import { toPng } from 'html-to-image';

function RenderParent({ gameEngine, onRendered} : { gameEngine : GameEngine, onRendered : () => void }) {
    useLayoutEffect(() => {
        onRendered();
    }, []);

    return <GameTable gameEngine={gameEngine}/>
}

export async function renderGrid(gameEngine : GameEngine): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const rootElement = document.createElement('div');
        rootElement.style.position = 'absolute';
        rootElement.style.top = '-10000px';
        const root = createRoot(rootElement);

        document.body.appendChild(rootElement);

        const onRendered = () => {
            const table = rootElement.querySelector('table') as HTMLTableElement;
            table.style.position = 'absolute';
            table.style.top = '0';
            table.style.left = '0';
            table.style.marginTop = '0';

            toPng(table, {
                pixelRatio: 1.0,
            })
                .then((dataUrl) => {
                    rootElement.remove();
                    const img = new Image();
                    img.src = dataUrl;
                    resolve(img);
                })
                .catch(reject)
        }

        root.render(<RenderParent gameEngine={gameEngine} onRendered={onRendered}/>);
    });
}
