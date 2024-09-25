import { Box } from "@chakra-ui/react";

import DeleteButton from "@/Components/DeleteButton";
import { Modal } from "@/Components/Modal";
import { INotification } from "@/logic/interfaces";
import { getNotificationColor } from "@/logic/notifications";

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDelete: (id: string) => void;
    notifications: INotification[];
}

const NotificationsModal = ({
    isOpen,
    onClose,
    onDelete,
    notifications,
}: NotificationsModalProps) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Notifications">
            {notifications.map((notification) => (
                <Box
                    key={notification.id}
                    padding={2}
                    backgroundColor={getNotificationColor(notification.type)}
                    color="white"
                    rounded="md"
                    marginBottom={2}
                >
                    {notification.message}
                    <Box
                        display="flex"
                        justifyContent="flex-end"
                        marginTop={2}
                        gap={2}
                    >
                        <DeleteButton
                            onClick={() => onDelete(notification.id)}
                        />
                    </Box>
                </Box>
            ))}
        </Modal>
    );
};

export default NotificationsModal;
