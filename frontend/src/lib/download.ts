const fileNameFrom = (disposition: string | null) =>
    disposition?.match(/filename="([^"]+)"/)?.[1] ?? null;

/**
 * Saves a file the backend sent as an attachment, under the name its
 * Content-Disposition gives, or the fallback
 */
export const saveAttachment = async (
    response: Response,
    fallbackName: string
) => {
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download =
        fileNameFrom(response.headers.get("Content-Disposition")) ??
        fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
