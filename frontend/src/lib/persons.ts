import { AddPerson, Person } from "./interfaces";
import { backendRequest, wcaApiRequest } from "./request";

export const getPersons = async (
    page = 1,
    pageSize = 10,
    search?: string,
    registrantId?: number,
    withoutCardAssigned?: boolean,
    cardId?: string,
    onlyNewcomers?: boolean,
    onlyNotCheckedIn?: boolean
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
    if (onlyNotCheckedIn) searchParams.append("onlyNotCheckedIn", "true");
    const query = `person?${searchParams.toString()}`;
    const response = await backendRequest(query, "GET", true);
    return await response.json();
};

export const getAllPersons = async (
    withoutCardAssigned = false,
    searchValue?: string
) => {
    const searchParams = new URLSearchParams();
    if (searchValue) searchParams.append("search", searchValue);
    if (withoutCardAssigned) searchParams.append("withoutCardAssigned", "true");
    const path = `person/all?${searchParams.toString()}`;
    const response = await backendRequest(path, "GET", true);
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

export const addPerson = async (data: AddPerson) => {
    const response = await backendRequest("person", "POST", true, data);
    return response.status;
};
export const checkIn = async (id: string, cardId: string) => {
    const response = await backendRequest(
        `person/check-in/${id}`,
        "POST",
        true,
        { cardId }
    );
    return {
        data: await response.json(),
        status: response.status,
    };
};

export const checkedInCount = async () => {
    const response = await backendRequest("person/check-in", "GET", true);
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

export const getPersonsFromWCA = async (search: string) => {
    const response = await wcaApiRequest(`persons?q=${search}`);
    const data = await response.json();
    return data.map((p: { person: { wca_id: string; name: string } }) => {
        return {
            wcaId: p.person.wca_id,
            name: p.person.name,
            combinedName: `${p.person.name} (${p.person.wca_id})`,
        };
    });
};

export const getPersonFromWCAByWcaId = async (wcaId: string) => {
    const response = await wcaApiRequest(`persons/${wcaId}`);
    return await response.json();
};
