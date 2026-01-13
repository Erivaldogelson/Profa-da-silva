const toggleForm = document.getElementById("toggleForm");
const nomeGroup = document.getElementById("nomeGroup");
const formTitle = document.getElementById("formTitle");
const submitBtn = document.querySelector("button");

const toggleSenha = document.getElementById("toggleSenha");
const senhaInput = document.getElementById("senhaInput");
const iconeSenha = toggleSenha.querySelector("i");

let isLogin = true;

/* Alternar Login / Cadastro */
toggleForm.addEventListener("click", () => {
  isLogin = !isLogin;

  if (isLogin) {
    formTitle.innerText = "Login";
    submitBtn.innerText = "Entrar";
    toggleForm.innerText = "Cadastre-se";
    nomeGroup.classList.add("d-none");
  } else {
    formTitle.innerText = "Cadastro";
    submitBtn.innerText = "Cadastrar";
    toggleForm.innerText = "Faça login";
    nomeGroup.classList.remove("d-none");
  }
});

/* Mostrar / Ocultar senha */
toggleSenha.addEventListener("click", () => {
  const visivel = senhaInput.type === "text";
  senhaInput.type = visivel ? "password" : "text";

  iconeSenha.classList.toggle("bi-eye");
  iconeSenha.classList.toggle("bi-eye-slash");
});


