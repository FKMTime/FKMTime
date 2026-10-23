import GridLoader from "react-spinners/GridLoader";

interface SectionLoadingProps {
    /** What is loading, for screen readers, e.g. "Loading persons" */
    label: string;
}

/**
 * Spinner for the part of a page that is still loading, so its tabs and
 * filters can stay on screen instead of a full-page LoadingPage.
 */
const SectionLoading = ({ label }: SectionLoadingProps) => (
    <div aria-busy aria-label={label} className="flex justify-center py-16">
        <GridLoader color="lightBlue" />
    </div>
);

export default SectionLoading;
