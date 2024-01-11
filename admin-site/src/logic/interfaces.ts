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