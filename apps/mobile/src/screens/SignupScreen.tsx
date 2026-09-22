import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

export default function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim(), password, username.trim());
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Quase lá!</Text>
        <Text style={styles.subtitle}>Confirme seu e-mail para poder entrar no StudyQuest.</Text>
        <Pressable style={styles.button} onPress={() => navigation.replace("Login")}>
          <Text style={styles.buttonText}>Voltar para o login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Criar conta</Text>

      <TextInput
        style={styles.input}
        placeholder="Nome de usuário"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={styles.input} placeholder="Senha" secureTextEntry value={password} onChangeText={setPassword} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Criar conta</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff", gap: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a", marginBottom: 8, textAlign: "center" },
  subtitle: { color: "#475569", textAlign: "center", marginBottom: 24 },
  input: { backgroundColor: "#f1f5f9", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  button: { backgroundColor: "#4f46e5", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "700" },
  error: { color: "#e11d48", textAlign: "center" },
});
