import { Person } from "./interfaces";
import { backendRequest } from "./request";

export const getPersons = async (
    page = 1,
    pageSize = 10,
    search?: string,
    registrantId?: number,
    withoutCardAssigned?: boolean,
    cardId?: string,
    onlyNewcomers?: boolean
) => {
    const searchParams = new URLSearchParams();
    searchParams.append("page", page.toString());
    searchParams.append("pageSize", pageSize.toString());
    if (search) searchParams.append("search", search);
    if (registrantId)
        searchParams.append("registrantId", registrantId.toString());
    if (withoutCardAssigned) searchParams.append("withoutCardAssigned", "true");
    if (cardId) searchParams.append("cardId", cardId);
    if (onlyNewcomers) searchParams.append("onlyNewcomers", "true");
    const query = `person?${searchParams.toString()}`;
    const response = await backendRequest(query, "GET", true);
    return await response.json();
};

export const getPersonById = async (id: string) => {
    const response = await backendRequest(`person/${id}`, "GET", true);
    return await response.json();
};

export const getPersonInfoByCardIdWithSensitiveData = async (
    cardId: string
) => {
    const response = await backendRequest(
        `person/card/${cardId}/sensitive`,
        "GET",
        true
    );
    return {
        data: await response.json(),
        status: response.status,
    };
};

export const addStaffMember = async (name: string, gender: string) => {
    const response = await backendRequest("person/staff", "POST", true, {
        name,
        gender,
    });
    return response.status;
};
export const collectGfitpack = async (id: string) => {
    const response = await backendRequest(`person/giftpack/${id}`, "GET", true);
    return {
        data: await response.json(),
        status: response.status,
    };
};

export const giftpackCount = async () => {
    const response = await backendRequest("person/giftpack", "GET", true);
    return await response.json();
};

export const getAllPersons = async () => {
    const response = await backendRequest("person/all", "GET", true);
    return await response.json();
};

export const getPersonsWithoutCardAssigned = async () => {
    const response = await backendRequest("person/without-card", "GET", true);
    return await response.json();
};

export const updatePerson = async (data: Person) => {
    const response = await backendRequest(
        `person/${data.id}`,
        "PUT",
        true,
        data
    );
    return response.status;
};

export const assignCard = async (personId: string, cardId: string) => {
    const response = await backendRequest(`person/${personId}`, "PUT", true, {
        cardId,
    });
    return response.status;
};

export const getPersonNameAndRegistrantId = (person: Person) => {
    return `${person.name} ${person.registrantId ? `(${person.registrantId})` : ""}`;
};
