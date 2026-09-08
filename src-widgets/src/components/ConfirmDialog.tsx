import React from 'react';

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export interface ConfirmRequest {
    title: string;
    text: string;
    onConfirm: () => void;
}

/**
 * Themed confirmation dialog, used before a consumable counter is reset (no blocking browser prompt).
 */
export const ConfirmDialog = React.memo(function ConfirmDialog({
    request,
    confirmLabel,
    cancelLabel,
    onClose,
}: {
    request: ConfirmRequest | null;
    confirmLabel: string;
    cancelLabel: string;
    onClose: () => void;
}): React.JSX.Element {
    return (
        <Dialog
            open={Boolean(request)}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
        >
            <DialogTitle>{request?.title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{request?.text}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{cancelLabel}</Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={() => {
                        request?.onConfirm();
                        onClose();
                    }}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
});
