import { Link } from "expo-router";
import { View, Text, Pressable, TextInput } from "react-native";
import { useAuth } from "../../context/AuthProvider";
import { TouchableOpacity } from "react-native-gesture-handler";
import { login } from "../../lib/auth";
import { useState } from "react";
import { placeholderTextColor, cursorColor } from "../../constants/Colors";
import { inputClasses, successButtonClasses } from "../../constants/classes";

export default function Login() {
    const { setUser } = useAuth();
    const [formData, setFormData] = useState<{ username: string, password: string }>({ username: '', password: '' });

    const handleLogin = async () => {
        const data = await login(formData.username, formData.password);
        console.log(data);
        setUser({
            username: data.userInfo.username,
            token: data.token,
        })
    };


    return (
        <View className="flex flex-col items-center justify-center h-full p-5">
            <Text className="text-2xl font-bold text-white">Login</Text>
            <TextInput placeholderTextColor={placeholderTextColor} selectionColor={cursorColor} className={inputClasses} placeholder="Username" value={formData.username} onChangeText={(value: string) => setFormData({ ...formData, username: value })} />
            <TextInput placeholderTextColor={placeholderTextColor} selectionColor={cursorColor} className={inputClasses} secureTextEntry={true} placeholder="Password" value={formData.password} onChangeText={(value: string) => setFormData({ ...formData, password: value })} />
            <Pressable className={`${successButtonClasses} mt-3`} onPress={handleLogin}>
                <Text className="text-white">Login</Text>
            </Pressable>
        </View>
    );
}