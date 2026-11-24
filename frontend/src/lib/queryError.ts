/** A query's request got an HTTP error status back */
export class QueryError extends Error {
    constructor(public status: number) {
        super(`Request failed with status ${status}`);
    }
}
