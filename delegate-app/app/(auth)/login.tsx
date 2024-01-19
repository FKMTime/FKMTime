import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { useAuth } from "../../context/AuthProvider";
import { login } from "../../lib/auth";
import { useState } from "react";
import { placeholderTextColor, cursorColor } from "../../constants/Colors";
import { inputClasses, successButtonClasses } from "../../constants/classes";
import Toast from "react-native-toast-message";

export default function Login() {
    const { setUser } = useAuth();
    const [formData, setFormData] = useState<{ username: string, password: string }>({ username: '', password: '' });

    const handleLogin = async () => {
        const response = await login(formData.username, formData.password);
        if (response.status === 403) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Invalid username or password',
                visibilityTime: 4000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40,
            });
        }
        setUser({
            username: response.data.userInfo.username,
            token: response.data.token,
        })
    };


    return (
        <View style={styles.container}>
            <Text className="text-2xl font-bold text-white">Login</Text>
            <TextInput placeholderTextColor={placeholderTextColor} selectionColor={cursorColor} style={styles.input} placeholder="Username" value={formData.username} onChangeText={(value: string) => setFormData({ ...formData, username: value })} />
            <TextInput placeholderTextColor={placeholderTextColor} selectionColor={cursorColor} style={styles.input} secureTextEntry={true} placeholder="Password" value={formData.password} onChangeText={(value: string) => setFormData({ ...formData, password: value })} />
            <Pressable style={styles.button} onPress={handleLogin}>
                <Text className="text-white">Login</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1f2937',
    },
    input: {
        apperance: 'none',
        borderWidth: 2,
        borderColor: 'white',
        width: '100%',
        padding: 10,
        marginTop: 10,
        borderRadius: 5,
        color: 'white',
        focus: {
            borderColor: '#60a5fa',
        }
    },
    button: {
        backgroundColor: '#16a34a',
        padding: 10,
        borderRadius: 5,
        width: '100%',
        marginTop: 10,
        color: 'white',
        textAlign: 'center',
        alignItems: 'center',
    },
});

