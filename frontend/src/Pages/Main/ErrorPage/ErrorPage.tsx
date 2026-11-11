import { CircleAlert, CloudOff, SearchX } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

import ErrorScreen from "./ErrorScreen";

const iconForStatus = (status?: number) => {
    if (status === 404) return SearchX;
    if (status && status >= 500) return CloudOff;
    return CircleAlert;
};

const ErrorPage = () => {
    const error = useRouteError();

    let title = "Something went wrong";
    let message = "An unexpected error occurred.";
    let status: number | undefined;
    let details: string | undefined;

    if (isRouteErrorResponse(error)) {
        status = error.status;
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
        <ErrorScreen
            icon={iconForStatus(status)}
            title={title}
            message={message}
            details={details}
        />
    );
};

export default ErrorPage;
