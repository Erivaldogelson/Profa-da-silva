const botoes = document.querySelectorAll(".btn-plan");

botoes.forEach(botao => {
  botao.addEventListener("click", () => {
    const materia = botao.dataset.materia;
    const plano = botao.dataset.plano;

    const mensagem = `Olá Professora Mariane 🤗!
Tudo bem?
Tenho interesse em aulas de *${materia}*.
Plano escolhido: *${plano}*.`;

    const telefone = "5534999702517";

    window.open(
      `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`,
      "_blank"
    );
  });
});



