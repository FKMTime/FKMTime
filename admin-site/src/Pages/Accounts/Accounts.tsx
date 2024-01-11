import { useEffect, useState } from "react";
import { Account } from "../../logic/interfaces";
import AccountsTable from "../../Components/Table/AccountsTable";
import { getAllAccounts } from "../../logic/accounts";
import { Box, IconButton } from "@chakra-ui/react";
import { MdAdd } from "react-icons/md";
import CreateAccountModal from "../../Components/Modal/CreateAccountModal";

const Accounts = (): JSX.Element => {

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isOpenCreateAccountModal, setIsOpenCreateAccountModal] = useState<boolean>(false);

    const fetchData = async () => {
        const data = await getAllAccounts();
        setAccounts(data);
    };

    const handleCloseCreateAccountModal = async () => {
        await fetchData();
        setIsOpenCreateAccountModal(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <IconButton icon={<MdAdd />} aria-label="Add" bg="white" color="black" rounded="20" width="5" height="10"  _hover={{
                background: "white",
                color: "gray.700"
            }}
            onClick={() => setIsOpenCreateAccountModal(true)}
            />
            <AccountsTable accounts={accounts} fetchData={fetchData} />
            <CreateAccountModal isOpen={isOpenCreateAccountModal} onClose={handleCloseCreateAccountModal} />
        </Box>
    )
};

export default Accounts;
