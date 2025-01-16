import logo from "@/assets/logo.svg";

import LoginForm from "./Components/LoginForm";

interface MobileLoginProps {
    handleSubmit: (username: string, password: string) => void;
    handleWcaLogin: () => void;
    isLoading?: boolean;
}

const MobileLogin = ({
    handleSubmit,
    handleWcaLogin,
    isLoading,
}: MobileLoginProps) => {
    return (
        <div className="flex justify-center items-center h-screen flex-col p-10 gap-10">
            <img src={logo} width="400" alt="logo" />
            <LoginForm
                handleLogin={handleSubmit}
                handleWcaLogin={handleWcaLogin}
                isLoading={isLoading}
            />
        </div>
    );
};

export default MobileLogin;
