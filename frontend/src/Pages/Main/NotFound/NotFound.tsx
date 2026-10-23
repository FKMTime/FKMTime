import { SearchX } from "lucide-react";

import ErrorScreen from "@/Pages/Main/ErrorPage/ErrorScreen";

const NotFound = () => (
    <ErrorScreen icon={SearchX} title="Error 404" message="Page not found" />
);

export default NotFound;
