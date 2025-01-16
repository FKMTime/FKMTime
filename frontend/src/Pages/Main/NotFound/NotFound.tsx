import { useNavigate } from "react-router-dom";

import ModeToggle from "@/Components/ModeToggle";
import { Button } from "@/Components/ui/button";

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col gap-5 mt-5 justify-center items-center h-screen">
            <h2>Error 404</h2>
            <h3 className="text-red-500">Page not found</h3>
            <Button onClick={() => navigate("/")}>Home</Button>
            <ModeToggle />
        </div>
    );
};

export default NotFound;
