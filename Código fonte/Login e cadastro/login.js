import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* Elementos */
const form = document.getElementById("formAuth");
const toggleForm = document.getElementById("toggleForm");
const nomeGroup = document.getElementById("nomeGroup");
const dataGroup = document.getElementById("dataGroup");
const telefoneGroup = document.getElementById("telefoneGroup");
const formTitle = document.getElementById("formTitle");
const submitBtn = form.querySelector("button");
const googleBtn = document.getElementById("googleLogin");

const emailInput = document.querySelector("input[type='email']");
const senhaInput = document.getElementById("senhaInput");

let isLogin = true;
const provider = new GoogleAuthProvider();

/* Função de erro amigável */
function tratarErro(e) {
  switch (e.code) {
    case "auth/wrong-password":
      alert("Senha incorreta.");
      break;
    case "auth/user-not-found":
      alert("Usuário não encontrado.");
      break;
    case "auth/email-already-in-use":
      alert("Este email já está cadastrado.");
      break;
    case "auth/weak-password":
      alert("A senha deve ter pelo menos 6 caracteres.");
      break;
    case "auth/invalid-email":
      alert("Email inválido.");
      break;
    case "auth/popup-closed-by-user":
      alert("Login com Google cancelado.");
      break;
    default:
      alert(e.message);
  }
}

/* Toggle Login/Cadastro */
toggleForm.onclick = () => {
  isLogin = !isLogin;

  nomeGroup.classList.toggle("d-none", isLogin);
  dataGroup.classList.toggle("d-none", isLogin);
  telefoneGroup.classList.toggle("d-none", isLogin);

  formTitle.innerText = isLogin ? "Login" : "Cadastro";
  submitBtn.innerText = isLogin ? "Entrar" : "Cadastrar";
  toggleForm.innerText = isLogin ? "Cadastre-se" : "Faça login";
};

/* Login / Cadastro Email */
form.onsubmit = async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const senha = senhaInput.value.trim();

  if (!email || !senha) {
    alert("Preencha email e senha.");
    return;
  }

  try {
    if (isLogin) {
      await signInWithEmailAndPassword(auth, email, senha);
      alert("Login realizado com sucesso!");
    } else {
      const nome = nomeGroup.querySelector("input").value.trim();
      const nascimento = dataGroup.querySelector("input").value;
      const telefone = telefoneGroup.querySelector("input").value.trim();

      if (!nome || !nascimento || !telefone) {
        alert("Preencha todos os campos do cadastro.");
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, senha);

      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nome,
        nascimento,
        telefone,
        email,
        provider: "email",
        criadoEm: serverTimestamp()
      });

      alert("Cadastro realizado com sucesso!");
    }
  } catch (e) {
    tratarErro(e);
  }
};

/* Login Google */
googleBtn.onclick = async () => {
  try {
    const res = await signInWithPopup(auth, provider);
    const ref = doc(db, "usuarios", res.user.uid);

    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        nome: res.user.displayName,
        email: res.user.email,
        provider: "google",
        criadoEm: serverTimestamp()
      });
    }

    alert("Login com Google realizado com sucesso!");
  } catch (e) {
    tratarErro(e);
  }
};

/* Mostrar senha */
document.getElementById("toggleSenha").onclick = () => {
  senhaInput.type =
    senhaInput.type === "password" ? "text" : "password";
};




