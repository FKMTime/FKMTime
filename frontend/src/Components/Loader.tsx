import React from "react";
import RotateLoader from "react-spinners/RotateLoader";

const Loader = () => {
    const style = {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
    } as React.CSSProperties;

    return (
        <div style={style}>
            <RotateLoader />
        </div>
    );
};

export default Loader;
