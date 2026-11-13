import { Plus } from "lucide-react";

interface EnterAttemptFabProps {
    onClick: () => void;
}

const EnterAttemptFab = ({ onClick }: EnterAttemptFabProps) => (
    <button
        onClick={onClick}
        aria-label="Enter attempt"
        title="Enter attempt"
        className="fixed bottom-[calc(max(env(safe-area-inset-bottom),0.375rem)+5rem)] right-4 z-20 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(20,40,120,0.3)] active:bg-primary/90 md:hidden"
    >
        <Plus className="size-6" />
    </button>
);

export default EnterAttemptFab;
