import GridLoader from "react-spinners/GridLoader";

const ModalLoading = () => {
    return (
        <div className="flex justify-center items-center p-10">
            <GridLoader color="lightBlue" />
        </div>
    );
};

export default ModalLoading;
