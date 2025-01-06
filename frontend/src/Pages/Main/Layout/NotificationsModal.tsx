import DeleteButton from "@/Components/DeleteButton";
import { Modal } from "@/Components/Modal";
import { INotification } from "@/lib/interfaces";
import { getNotificationColor } from "@/lib/notifications";

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
                <div
                    key={notification.id}
                    className={`p-2 bg-${getNotificationColor(
                        notification.type
                    )} text-white rounded-md mb-2`}
                >
                    {notification.message}
                    <div className="flex justify-end mt-2 gap-2">
                        <DeleteButton
                            onClick={() => onDelete(notification.id)}
                        />
                    </div>
                </div>
            ))}
        </Modal>
    );
};

export default NotificationsModal;
