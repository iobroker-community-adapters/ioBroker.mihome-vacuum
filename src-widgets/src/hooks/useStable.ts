import React from 'react';

/**
 * Returns the previously returned value as long as `signature` does not change.
 * Used to hand memoized child components a stable array reference although the array is rebuilt
 * on every render of the parent.
 *
 * @param value - freshly built value
 * @param signature - string that changes whenever the value changes in a relevant way
 */
export function useStable<T>(value: T, signature: string): T {
    const ref = React.useRef<{ value: T; signature: string }>({ value, signature });
    if (ref.current.signature !== signature) {
        ref.current = { value, signature };
    }
    return ref.current.value;
}
