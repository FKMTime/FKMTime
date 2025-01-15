import { AudioWaveform, Command, GalleryVerticalEnd } from "lucide-react";

export const sidebarData = {
    user: {
        name: "satnaing",
        email: "satnaingdev@gmail.com",
        avatar: "/avatars/shadcn.jpg",
    },
    navGroups: [
        {
            title: "General",
            items: [
                {
                    title: "Dashboard",
                    url: "/",
                    icon: AudioWaveform,
                },
                {
                    title: "Tasks",
                    url: "/tasks",
                    icon: Command,
                },
                {
                    title: "Apps",
                    url: "/apps",
                    icon: GalleryVerticalEnd,
                },
            ],
        },
    ],
};
