import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

async function loadIoBrokerSocket(): Promise<void> {
    if (window.io) {
        return;
    }
    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('../../socket.io/socket.io.js', window.location.href).href;
        script.async = true;
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error('Could not load ioBroker socket client')), {
            once: true,
        });
        document.head.appendChild(script);
    });
}

async function start(): Promise<void> {
    await loadIoBrokerSocket();
    createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App adapterName="mihome-vacuum" />
        </React.StrictMode>,
    );
}

void start();
