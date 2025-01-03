import { useState } from "react";

import { Tooltip } from "@/Components/ui/tooltip";
import { WCA_ORIGIN } from "@/logic/request.ts";

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
            {avatarUrl && !avatarUrl.includes(WCA_ORIGIN) ? (
                <Tooltip content={username} aria-label="A tooltip">
                    <img
                        style={{
                            width: avatarSize,
                            height: avatarSize,
                            borderRadius: "100%",
                            cursor: "pointer",
                        }}
                        src={avatarUrl}
                        onClick={() => setIsOpenAvatarModal(true)}
                        alt=" "
                    />
                </Tooltip>
            ) : (
                <Tooltip content={username} aria-label="A tooltip">
                    <DefaultAvatar size={avatarSize} username={username} />
                </Tooltip>
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
