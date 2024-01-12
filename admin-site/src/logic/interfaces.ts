export interface UserInfo {
    username: string;
    role: string;
}

export interface Account {
    id: number;
    username: string;
    role: string;
    email: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Competition {
    id: number;
    wcaId: string;
    name: string;
    shortName: string;
    countryIso2: string;
    currentGroupId?: string;
    scoretakingToken?: string;
    //eslint-disable-next-line
    wcif: any;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Person {
    id: number;
    registrantId: number;
    name: string;
    wcaId?: string;
    countryIso2?: string;
    gender: string;
    cardId?: string;
}