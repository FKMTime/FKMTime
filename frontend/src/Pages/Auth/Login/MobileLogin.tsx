import { Link } from "react-router-dom";

import logo from "@/assets/logo.svg";
import { Button } from "@/Components/ui/button";
import { CompetitionDataForLoginPage } from "@/lib/interfaces";

import LoginForm from "./Components/LoginForm";

interface MobileLoginProps {
    handleSubmit: (username: string, password: string) => void;
    handleWcaLogin: () => void;
    isLoading?: boolean;
    competition?: CompetitionDataForLoginPage;
}

const MobileLogin = ({
    handleSubmit,
    handleWcaLogin,
    isLoading,
    competition,
}: MobileLoginProps) => {
    return (
        <div className="flex justify-center items-center h-screen flex-col p-10 gap-5">
            <img src={logo} width="400" alt="logo" />
            <h2 className="text-2xl font-bold text-center">
                {competition?.name}
            </h2>
            <LoginForm
                handleLogin={handleSubmit}
                handleWcaLogin={handleWcaLogin}
                isLoading={isLoading}
                competition={competition}
            />
            <Button variant="outline" className="w-full" asChild>
                <Link to="/public">Public display</Link>
            </Button>
        </div>
    );
};

export default MobileLogin;
