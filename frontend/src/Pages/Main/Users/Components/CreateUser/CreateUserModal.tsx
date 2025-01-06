import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { useToast } from "@/hooks/useToast";
import { NewUserData } from "@/lib/interfaces";
import { createUser } from "@/lib/user";

import CreateFKMAccountForm from "./CreateFKMAccountForm";
import CreateWCAUserForm from "./CreateWCAUserForm";

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateUserModal = ({ isOpen, onClose }: CreateUserModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (userData: NewUserData) => {
        setIsLoading(true);
        const response = await createUser(userData);
        if (response.status === 201) {
            toast({
                title: "Success",
                description: "User has been created successfully.",
            });
            onClose();
        } else if (response.status === 409) {
            toast({
                title: "Error",
                description: "Username already taken!",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create user">
            <div className="flex flex-col gap-5">
                <Tabs defaultValue="fkm">
                    <TabsList>
                        <TabsTrigger value="fkm">FKM Account</TabsTrigger>
                        <TabsTrigger value="wca">WCA Login</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fkm">
                        <CreateFKMAccountForm
                            handleSubmit={handleSubmit}
                            isLoading={isLoading}
                        />
                    </TabsContent>
                    <TabsContent value="wca">
                        <CreateWCAUserForm
                            handleSubmit={handleSubmit}
                            isLoading={isLoading}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </Modal>
    );
};

export default CreateUserModal;
