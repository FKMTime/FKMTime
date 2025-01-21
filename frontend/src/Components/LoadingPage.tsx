import GridLoader from "react-spinners/GridLoader";

const LoadingPage = () => {
    return (
        <div className="flex justify-center items-center h-screen">
            <GridLoader color="lightBlue" />
        </div>
    );
};

export default LoadingPage;
