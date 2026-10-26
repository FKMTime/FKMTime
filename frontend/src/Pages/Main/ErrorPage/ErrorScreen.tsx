import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    House,
    LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import WordmarkHeader from "@/Components/shared/WordmarkHeader";
import { Button } from "@/Components/ui/button";

interface ErrorScreenProps {
    icon: LucideIcon;
    title: string;
    message: string;
    /** Stack trace or response data, behind "Show details" */
    details?: string;
}

/** Full-page error layout shared by the route error page and 404 */
const ErrorScreen = ({
    icon: Icon,
    title,
    message,
    details,
}: ErrorScreenProps) => {
    const navigate = useNavigate();
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className="flex min-h-dvh flex-col px-4 py-5 sm:px-6">
            <WordmarkHeader />
            <main className="flex flex-1 items-center justify-center py-10">
                <div className="flex w-full max-w-[560px] flex-col items-center gap-5 text-center">
                    <span className="flex size-16 items-center justify-center rounded-full bg-destructive-soft text-destructive">
                        <Icon className="size-8" />
                    </span>
                    <div className="flex flex-col gap-2">
                        <h1 className="text-[28px] font-bold tracking-[-0.02em]">
                            {title}
                        </h1>
                        <p className="text-pretty text-[15px] leading-normal text-muted-foreground">
                            {message}
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="outline" onClick={() => navigate(-1)}>
                            <ArrowLeft />
                            Go back
                        </Button>
                        <Button onClick={() => navigate("/")}>
                            <House />
                            Home
                        </Button>
                    </div>
                    {details && (
                        <div className="flex w-full flex-col items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                aria-expanded={showDetails}
                                onClick={() => setShowDetails((v) => !v)}
                            >
                                {showDetails ? "Hide details" : "Show details"}
                                {showDetails ? <ChevronUp /> : <ChevronDown />}
                            </Button>
                            {showDetails && (
                                <pre className="max-h-[260px] w-full overflow-auto rounded-chip border bg-card px-4 py-3.5 text-left font-mono text-xs leading-relaxed text-muted-foreground">
                                    {details}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ErrorScreen;
