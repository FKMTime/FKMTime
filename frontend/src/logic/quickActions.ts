import { QuickAction } from "@/logic/interfaces.ts";
import { backendRequest } from "@/logic/request.ts";

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
