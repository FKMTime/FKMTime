import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { useDialogError } from "@/hooks/useDialogError";
import { NewUserData, Room } from "@/lib/interfaces";
import { createUser } from "@/lib/user";

import CreateFKMTimeAccountForm from "./CreateFKMTimeAccountForm";
import CreateWCAUserForm from "./CreateWCAUserForm";

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** The competition's rooms, in schedule order */
    rooms: Room[];
}

const CreateUserModal = ({ isOpen, onClose, rooms }: CreateUserModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (userData: NewUserData) => {
        setIsLoading(true);
        const response = await createUser(userData);
        if (response.status === 201) {
            onClose();
        } else if (response.status === 400) {
            setError(response.data.message);
        } else if (response.status == 403) {
            setError("You cannot assign roles higher than your own");
        } else if (response.status === 409) {
            setError("Username already taken!");
        } else {
            setError("Something went wrong");
        }
        setIsLoading(false);
    };

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="Create user"
        >
            <div className="flex flex-col gap-5">
                <Tabs defaultValue="fkmtime">
                    <TabsList>
                        <TabsTrigger value="fkmtime">
                            FKMTime Account
                        </TabsTrigger>
                        <TabsTrigger value="wca">WCA Login</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fkmtime">
                        <CreateFKMTimeAccountForm
                            handleSubmit={handleSubmit}
                            isLoading={isLoading}
                            rooms={rooms}
                        />
                    </TabsContent>
                    <TabsContent value="wca">
                        <CreateWCAUserForm
                            handleSubmit={handleSubmit}
                            isLoading={isLoading}
                            rooms={rooms}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </Modal>
    );
};

export default CreateUserModal;
