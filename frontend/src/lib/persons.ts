import { AddPerson, Person } from "./interfaces";
import { queryFamily } from "./queryCache";
import { backendQuery, backendRequest, wcaApiRequest } from "./request";

export interface PersonsPageParams {
    page: number;
    pageSize: number;
    search?: string;
    registrantId?: number;
    withoutCardAssigned?: boolean;
    cardId?: string;
    onlyNewcomers?: boolean;
    onlyNotCheckedIn?: boolean;
}

const personsPagePath = (params: PersonsPageParams) => {
    const searchParams = new URLSearchParams();
    searchParams.append("page", params.page.toString());
    searchParams.append("pageSize", params.pageSize.toString());
    if (params.search) searchParams.append("search", params.search);
    if (params.registrantId)
        searchParams.append("registrantId", params.registrantId.toString());
    if (params.withoutCardAssigned)
        searchParams.append("withoutCardAssigned", "true");
    if (params.cardId) searchParams.append("cardId", params.cardId);
    if (params.onlyNewcomers) searchParams.append("onlyNewcomers", "true");
    if (params.onlyNotCheckedIn)
        searchParams.append("onlyNotCheckedIn", "true");
    return `person?${searchParams.toString()}`;
};

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
    const path = personsPagePath({
        page,
        pageSize,
        search,
        registrantId,
        withoutCardAssigned,
        cardId,
        onlyNewcomers,
        onlyNotCheckedIn,
    });
    const response = await backendRequest(path, "GET", true);
    return await response.json();
};

const personsPages = queryFamily((path) =>
    backendQuery<{ data: Person[]; count: number }>(path)
);

/** One page of the Persons list, one query per page and set of filters */
export const personsPageQuery = (params: PersonsPageParams) =>
    personsPages(personsPagePath(params));

/** The Persons tab as it first opens: page 1 of 10, no filters */
export const firstPersonsPageQuery = personsPageQuery({
    page: 1,
    pageSize: 10,
});

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

/** Everyone, for the station tester */
export const allPersonsQuery = backendQuery<Person[]>("person/all?");

/** Everyone without a card, as Assign cards lists them before a search */
export const personsWithoutCardQuery = backendQuery<Person[]>(
    "person/all?withoutCardAssigned=true"
);

/** People without a card matching a search; no search is the full list */
export const personsWithoutCardSearchQuery = queryFamily((search) =>
    search
        ? backendQuery<Person[]>(
              `person/all?search=${encodeURIComponent(search)}&withoutCardAssigned=true`
          )
        : personsWithoutCardQuery
);

/** One person, with their registration */
export const personQuery = queryFamily((id) =>
    backendQuery<Person>(`person/${id}`)
);

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

/** Reverts a check-in; removeCard also clears a card assigned with it */
export const undoCheckIn = async (id: string, removeCard: boolean) => {
    const response = await backendRequest(
        `person/check-in/${id}?removeCard=${removeCard}`,
        "DELETE",
        true
    );
    return response.status;
};

export const checkedInCount = async () => {
    const response = await backendRequest("person/check-in", "GET", true);
    return await response.json();
};

/** How many people are checked in, for the Check-in page */
export const checkInCountsQuery = backendQuery<{
    checkedInPersonsCount: number;
    totalPersonsCount: number;
}>("person/check-in");

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

export const changeCompetingGroup = async (
    personId: string,
    newGroupId: string
) => {
    const response = await backendRequest("person/change-group", "POST", true, {
        personId,
        newGroupId,
    });
    return {
        data: await response.json(),
        status: response.status,
    };
};
