import React from 'react';

import type { ContainerSize } from '../lib/types';

/**
 * Observes the rendered width of an element. The widget lays itself out by its own width, not by
 * the browser viewport, so a narrow widget on a wide screen still gets the compact layout.
 *
 * @param ref - element to observe
 */
export function useContainerWidth(ref: React.RefObject<HTMLElement | null>): number {
    const [width, setWidth] = React.useState(0);

    React.useEffect(() => {
        const element = ref.current;
        if (!element) {
            return undefined;
        }
        setWidth(element.getBoundingClientRect().width);
        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry) {
                setWidth(Math.round(entry.contentRect.width));
            }
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);

    return width;
}

/**
 * Maps a container width to the three layout sizes used by the widget.
 *
 * @param width - container width in pixels; 0 while unknown
 */
export function containerSize(width: number): ContainerSize {
    if (width && width < 560) {
        return 'narrow';
    }
    if (width && width < 900) {
        return 'medium';
    }
    return 'wide';
}
