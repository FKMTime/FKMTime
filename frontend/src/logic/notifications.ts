export const getNotificationColor = (type: string) => {
    switch (type) {
        case "error":
            return "red.500";
        case "info":
            return "blue.500";
        default:
            return "blue.500";
    }
};
