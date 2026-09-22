import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>StudyQuest</Text>
      <Text style={styles.subtitle}>Estude para certificações como o CCNA respondendo perguntas por nível.</Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </Pressable>

      <Pressable onPress={() => navigation.navigate("Signup")}>
        <Text style={styles.link}>Não tem conta? Criar conta</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0f172a", gap: 12 },
  title: { fontSize: 32, fontWeight: "700", color: "#fff", marginBottom: 8, textAlign: "center" },
  subtitle: { color: "#94a3b8", textAlign: "center", marginBottom: 24 },
  input: { backgroundColor: "#1e293b", color: "#fff", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  button: { backgroundColor: "#10b981", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#0f172a", fontWeight: "700" },
  error: { color: "#fb7185", textAlign: "center" },
  link: { color: "#818cf8", textAlign: "center", marginTop: 20 },
});
