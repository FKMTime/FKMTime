import { useState } from "react";

import AvatarModal from "./AvatarModal";
import DefaultAvatar from "./DefaultAvatar";

interface AvatarProps {
    avatarUrl?: string;
    fullAvatarUrl?: string;
    avatarSize: number;
    username?: string;
}

const Avatar = ({
    avatarUrl,
    fullAvatarUrl,
    avatarSize,
    username,
}: AvatarProps) => {
    const [isOpenAvatarModal, setIsOpenAvatarModal] = useState<boolean>(false);

    return (
        <>
            {avatarUrl ? (
                <img
                    style={{
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: "100%",
                        cursor: "pointer",
                    }}
                    src={avatarUrl}
                    onClick={() => setIsOpenAvatarModal(true)}
                    alt="User's avatar"
                />
            ) : (
                <DefaultAvatar size={avatarSize} username={username} />
            )}
            <AvatarModal
                isOpen={isOpenAvatarModal}
                onClose={() => setIsOpenAvatarModal(false)}
                avatarUrl={fullAvatarUrl}
            />
        </>
    );
};

export default Avatar;
