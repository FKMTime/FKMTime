import { RotateCw, WifiOff } from "lucide-react";

import EmptyState from "@/Components/shared/EmptyState";
import { Button } from "@/Components/ui/button";

interface RequestErrorProps {
    onRetry: () => void;
    /**
     * Data from an earlier load is still on screen: show a small notice
     * above it instead of replacing it
     */
    hasData?: boolean;
}

/** Shown when loading a page's data failed */
const RequestError = ({ onRetry, hasData = false }: RequestErrorProps) => {
    if (hasData) {
        return (
            <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-2 text-sm text-muted-foreground"
            >
                <span>Couldn't refresh. Showing what was loaded before.</span>
                <Button variant="ghost" size="sm" onClick={onRetry}>
                    <RotateCw />
                    Try again
                </Button>
            </div>
        );
    }
    return (
        <EmptyState
            icon={<WifiOff />}
            action={
                <Button variant="outline" onClick={onRetry}>
                    <RotateCw />
                    Try again
                </Button>
            }
        >
            <span role="alert">
                Couldn't load this page. Check the connection and try again.
            </span>
        </EmptyState>
    );
};

export default RequestError;
