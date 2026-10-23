import { startTransition } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "@/hooks/useToast";
import { logout } from "@/lib/auth";

export const useLogout = () => {
    const { toast } = useToast();
    const navigate = useNavigate();

    return () => {
        startTransition(() => {
            logout();
            toast({
                title: "Logged out",
                description: "You have been logged out.",
                variant: "success",
            });
            navigate("/auth/login");
        });
    };
};
