import { Plus } from "lucide-react";

interface EnterAttemptFabProps {
    onClick: () => void;
}

const EnterAttemptFab = ({ onClick }: EnterAttemptFabProps) => (
    <button
        onClick={onClick}
        className="fixed bottom-[calc(max(env(safe-area-inset-bottom),0.375rem)+5rem)] right-4 z-20 flex h-[52px] items-center gap-2 rounded-2xl bg-primary pl-4 pr-5 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(20,40,120,0.3)] active:bg-primary/90 md:hidden"
    >
        <Plus className="size-[22px]" />
        Enter attempt
    </button>
);

export default EnterAttemptFab;
