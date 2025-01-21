import {
    ApplicationQuickAction,
    QuickAction,
    QuickActionData,
} from "@/lib/interfaces";
import { backendRequest } from "@/lib/request";

export const applicationQuickActions: ApplicationQuickAction[] = [
    {
        id: "a7g",
        name: "A7G",
        giveExtra: true,
        comment: "A7G",
    },
    {
        id: "judgeFault",
        name: "Judge fault",
        giveExtra: true,
        comment: "Judge fault",
    },
    {
        id: "distraction",
        name: "Distraction",
        giveExtra: true,
        comment: "Distraction",
    },
    {
        id: "timerMalfunction",
        name: "Timer malfunction",
        giveExtra: true,
        comment: "Timer malfunction",
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

export const createQuickAction = async (data: QuickActionData) => {
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
