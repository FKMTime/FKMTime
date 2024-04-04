import { Modal } from "@/Components/Modal.tsx";

interface AvatarModalProps {
    isOpen: boolean;
    onClose: () => void;
    avatarUrl?: string;
}

const AvatarModal = ({ isOpen, onClose, avatarUrl }: AvatarModalProps) => {
    if (!avatarUrl) {
        return null;
    }
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="">
            <img src={avatarUrl} alt="User's avatar" />
        </Modal>
    );
};

export default AvatarModal;
