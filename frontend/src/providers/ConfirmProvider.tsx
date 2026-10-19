import { createContext, FC, ReactNode, useCallback, useState } from "react";

import { ConfirmDialog } from "@/Components/ConfirmDialog";

export interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<void>;
}

interface ConfirmOptions {
    title: string;
    description?: string;
    confirmLabel?: string;
    variant?: "destructive" | "default";
    onConfirm?: () => void;
}

interface ConfirmState extends ConfirmOptions {
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmContext = createContext<ConfirmContextType | undefined>(
    undefined
);

export const ConfirmProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

    const confirm = useCallback(({ onConfirm, ...options }: ConfirmOptions) => {
        return new Promise<void>((resolve: () => void, reject: () => void) => {
            setConfirmState({
                ...options,
                onConfirm: () => {
                    if (onConfirm) onConfirm();
                    resolve();
                    setConfirmState(null);
                },
                onCancel: () => {
                    reject();
                    setConfirmState(null);
                },
            });
        });
    }, []);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {confirmState && (
                <ConfirmDialog
                    title={confirmState.title}
                    description={confirmState.description}
                    confirmLabel={confirmState.confirmLabel}
                    variant={confirmState.variant}
                    onConfirm={confirmState.onConfirm}
                    onCancel={confirmState.onCancel}
                />
            )}
        </ConfirmContext.Provider>
    );
};
