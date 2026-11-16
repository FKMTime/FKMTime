interface PreviewBannerProps {
    prNumber?: string;
    prUrl?: string;
}

// Shown only in builds made for a pull request's preview environment, so
// nobody mistakes a preview for a real competition instance
const PreviewBanner = ({
    prNumber = import.meta.env.VITE_PREVIEW_PR_NUMBER,
    prUrl = import.meta.env.VITE_PREVIEW_PR_URL,
}: PreviewBannerProps) => {
    if (!prNumber || !prUrl) return null;

    return (
        <div
            role="status"
            className="bg-amber-400 px-4 py-1.5 text-center text-sm font-medium text-amber-950"
        >
            This is a preview of{" "}
            <a
                href={prUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
            >
                pull request #{prNumber}
            </a>
            . Data here is for testing only.
        </div>
    );
};

export default PreviewBanner;
