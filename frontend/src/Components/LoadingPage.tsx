import GridLoader from "react-spinners/GridLoader";

const LoadingPage = () => {
    return (
        <div className="flex justify-center items-center h-dvh">
            <GridLoader color="lightBlue" />
        </div>
    );
};

export default LoadingPage;
