import { Box, FormControl, FormLabel, Input } from "@chakra-ui/react";

import Autocomplete from "@/Components/Autocomplete";
import Select from "@/Components/Select";
import { AddPerson, Region } from "@/logic/interfaces";
import regions from "@/logic/regions";

interface PersonFormProps {
    canCompete?: boolean;
    isLoading: boolean;
    newPersonData: AddPerson;
    setNewPersonData: (data: AddPerson) => void;
}

const PersonForm = ({
    canCompete = false,
    isLoading,
    newPersonData,
    setNewPersonData,
}: PersonFormProps) => {
    const countries: Region[] = regions.filter(
        (region) =>
            !["_Multiple Continents", "Continent"].includes(region.continentId)
    );

    const handleSelectCountry = (option: Region) => {
        setNewPersonData({
            ...newPersonData,
            countryIso2: option.iso2,
        });
    };

    return (
        <Box display="flex" gap="5" flexDirection="column">
            <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input
                    placeholder="Name"
                    disabled={isLoading}
                    value={newPersonData.name}
                    _placeholder={{ color: "white" }}
                    onChange={(event) =>
                        setNewPersonData({
                            ...newPersonData,
                            name: event.target.value,
                        })
                    }
                />
            </FormControl>
            <FormControl isRequired>
                <FormLabel>Gender</FormLabel>
                <Select
                    value={newPersonData.gender}
                    onChange={(e) =>
                        setNewPersonData({
                            ...newPersonData,
                            gender: e.target.value,
                        })
                    }
                    placeholder="Select gender"
                    disabled={isLoading}
                >
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                    <option value="o">Other</option>
                </Select>
            </FormControl>
            {canCompete && (
                <>
                    <FormControl>
                        <FormLabel>WCA ID</FormLabel>
                        <Input
                            placeholder="WCA ID"
                            disabled={isLoading}
                            value={newPersonData.wcaId}
                            _placeholder={{ color: "white" }}
                            onChange={(event) =>
                                setNewPersonData({
                                    ...newPersonData,
                                    wcaId: event.target.value,
                                })
                            }
                        />
                    </FormControl>
                    <FormControl isRequired>
                        <FormLabel>Country</FormLabel>
                        <Autocomplete
                            options={countries}
                            onOptionSelect={(option) =>
                                handleSelectCountry(option as Region)
                            }
                            selectedValue={countries.find(
                                (region) =>
                                    region.iso2 === newPersonData.countryIso2
                            )}
                            placeholder="Search for a country"
                            disabled={isLoading}
                            getOptionLabel={(option) => option.name}
                        />
                    </FormControl>
                </>
            )}
            <FormControl>
                <FormLabel>Card</FormLabel>
                <Input
                    placeholder="Scan card"
                    disabled={isLoading}
                    value={newPersonData.cardId}
                    _placeholder={{ color: "white" }}
                    onChange={(event) =>
                        setNewPersonData({
                            ...newPersonData,
                            cardId: event.target.value,
                        })
                    }
                />
            </FormControl>
        </Box>
    );
};

export default PersonForm;
