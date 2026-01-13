const toggleForm = document.getElementById("toggleForm");
const nomeGroup = document.getElementById("nomeGroup");
const formTitle = document.getElementById("formTitle");
const submitBtn = document.querySelector("button");

let isLogin = true;

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

