import { Server } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { isAdmin } from "@/lib/permissions";

/** Opens the server logs, for admins only (SPEC-011) */
const ServerLogsButton = () =>
    isAdmin() ? (
        <Button variant="outline" size="sm" asChild>
            <Link to="/logs">
                <Server />
                Server logs
            </Link>
        </Button>
    ) : null;

export default ServerLogsButton;
