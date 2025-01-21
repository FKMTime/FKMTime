interface ModalActionsProps {
    children: React.ReactNode;
}

const ModalActions = ({ children }: ModalActionsProps) => {
    return <div className="flex gap-3 w-full justify-end">{children}</div>;
};

export default ModalActions;
