import { useState } from "react";

import {
    Avatar as ShadcnAvatar,
    AvatarFallback,
    AvatarImage,
} from "@/Components/ui/avatar";

import AvatarModal from "./AvatarModal";

interface AvatarProps {
    avatarUrl?: string;
    fullAvatarUrl?: string;
    username?: string;
}

const Avatar = ({ avatarUrl, fullAvatarUrl, username }: AvatarProps) => {
    const [isOpenAvatarModal, setIsOpenAvatarModal] = useState<boolean>(false);

    return (
        <>
            <ShadcnAvatar>
                <AvatarImage
                    src={avatarUrl}
                    onClick={() => setIsOpenAvatarModal(true)}
                    className="cursor-pointer"
                />
                <AvatarFallback>
                    {username ? username[0].toUpperCase() : "U"}
                </AvatarFallback>
            </ShadcnAvatar>
            <AvatarModal
                isOpen={isOpenAvatarModal}
                onClose={() => setIsOpenAvatarModal(false)}
                avatarUrl={fullAvatarUrl}
            />
        </>
    );
};

export default Avatar;
