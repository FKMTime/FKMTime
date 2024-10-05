import { ApplicationQuickAction, QuickAction } from "@/logic/interfaces.ts";
import { backendRequest } from "@/logic/request.ts";

export const applicationQuickActions: ApplicationQuickAction[] = [
    {
        id: "a7g",
        name: "A7G",
        color: "purple",
        giveExtra: true,
        comment: "A7G",
    },
    {
        id: "judgeFault",
        name: "Judge fault",
        color: "blue",
        giveExtra: true,
        comment: "Judge fault",
    },
    {
        id: "distraction",
        name: "Distraction",
        color: "pink",
        giveExtra: true,
        comment: "Distraction",
    },
];

export const getQuickActions = async () => {
    const response = await backendRequest(
        "settings/quick-actions",
        "GET",
        true
    );
    return await response.json();
};

export const createQuickAction = async (data: QuickAction) => {
    const response = await backendRequest(
        "settings/quick-actions",
        "POST",
        true,
        data
    );
    return response.status;
};

export const updateQuickAction = async (data: QuickAction) => {
    const response = await backendRequest(
        `settings/quick-actions/${data.id}`,
        "PUT",
        true,
        data
    );
    return response.status;
};

export const deleteQuickAction = async (id: string) => {
    const response = await backendRequest(
        `settings/quick-actions/${id}`,
        "DELETE",
        true
    );
    return response.status;
};
