import { useState } from "react";
import {
    isRouteErrorResponse,
    useNavigate,
    useRouteError,
} from "react-router-dom";

import ModeToggle from "@/Components/ModeToggle";
import { Button } from "@/Components/ui/button";
import PageTransition from "@/Pages/PageTransition";

const ErrorPage = () => {
    const error = useRouteError();
    const navigate = useNavigate();
    const [showDetails, setShowDetails] = useState(false);

    let title = "Something went wrong";
    let message = "An unexpected error occurred.";
    let details: string | undefined;

    if (isRouteErrorResponse(error)) {
        title = `Error ${error.status}`;
        message = error.statusText || message;
        if (error.data) {
            details =
                typeof error.data === "string"
                    ? error.data
                    : JSON.stringify(error.data, null, 2);
        }
    } else if (error instanceof Error) {
        message = error.message;
        details = error.stack;
    } else if (typeof error === "string") {
        message = error;
    }

    return (
        <PageTransition>
            <div className="flex flex-col gap-6 justify-center items-center h-screen px-4">
                <div className="flex flex-col items-center gap-2 text-center">
                    <span className="text-6xl">💥</span>
                    <h2 className="text-2xl font-bold">{title}</h2>
                    <p className="text-red-500 text-lg max-w-md">{message}</p>
                </div>

                {details && (
                    <div className="flex flex-col items-center gap-2 w-full max-w-2xl">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDetails((v) => !v)}
                        >
                            {showDetails ? "Hide" : "Show"} details
                        </Button>
                        {showDetails && (
                            <pre className="w-full overflow-auto rounded-md bg-muted p-4 text-xs text-left max-h-64">
                                {details}
                            </pre>
                        )}
                    </div>
                )}

                <div className="flex gap-3">
                    <Button onClick={() => navigate(-1)} variant="outline">
                        Go back
                    </Button>
                    <Button onClick={() => navigate("/")}>Home</Button>
                </div>

                <ModeToggle />
            </div>
        </PageTransition>
    );
};

export default ErrorPage;
