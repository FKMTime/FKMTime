import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { describeGrant, MyDelegateGrant } from "@/lib/delegateGrants";

/** How long "has ended" stays up once access ends */
const ENDED_NOTICE_MS = 8000;

interface DelegateAccessBannerProps {
    grants: MyDelegateGrant[];
}

/**
 * Tells a user with delegate access for a group what they hold, and when it
 * ended (SPEC-013). Delegates never see it.
 */
const DelegateAccessBanner = ({ grants }: DelegateAccessBannerProps) => {
    const previous = useRef<MyDelegateGrant[]>(grants);
    const [ended, setEnded] = useState<MyDelegateGrant[]>([]);

    useEffect(() => {
        const gone = previous.current.filter(
            (before) => !grants.some((grant) => grant.id === before.id)
        );
        previous.current = grants;
        if (gone.length === 0) return;
        setEnded(gone);
        const timer = setTimeout(() => setEnded([]), ENDED_NOTICE_MS);
        return () => clearTimeout(timer);
    }, [grants]);

    const lines = [
        ...grants.map(describeGrant),
        ...ended.map(
            (grant) => `Your delegate access for ${grant.groupName} has ended.`
        ),
    ];
    if (lines.length === 0) return null;

    return (
        <div
            role="status"
            aria-label="Delegate access"
            className="flex items-start gap-2 border-b border-primary/30 bg-primary/10 px-4 py-2 text-sm md:px-8"
        >
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex flex-col gap-0.5">
                {lines.map((line) => (
                    <p key={line}>{line}</p>
                ))}
            </div>
        </div>
    );
};

export default DelegateAccessBanner;
