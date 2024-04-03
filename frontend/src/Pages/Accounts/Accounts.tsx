import { Box } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import PlusButton from "@/Components/PlusButton.tsx";
import { getAllAccounts } from "@/logic/accounts";
import { Account } from "@/logic/interfaces";

import AccountsTable from "./Components/AccountsTable";
import CreateAccountModal from "./Components/CreateAccountModal";

const Accounts = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isOpenCreateAccountModal, setIsOpenCreateAccountModal] =
        useState<boolean>(false);

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
            <PlusButton
                aria-label="Add"
                onClick={() => setIsOpenCreateAccountModal(true)}
            />
            <AccountsTable accounts={accounts} fetchData={fetchData} />
            <CreateAccountModal
                isOpen={isOpenCreateAccountModal}
                onClose={handleCloseCreateAccountModal}
            />
        </Box>
    );
};

export default Accounts;
