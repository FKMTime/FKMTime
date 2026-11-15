import { createContext } from "react";

export interface ConfirmOptions {
    title: string;
    description?: string;
    confirmLabel?: string;
    variant?: "destructive" | "default";
    onConfirm?: () => void;
}

export interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<void>;
}

export const ConfirmContext = createContext<ConfirmContextType | undefined>(
    undefined
);
