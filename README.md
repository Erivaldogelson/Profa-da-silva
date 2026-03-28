# 📚 Profª Da Silva – Aulas Particulares

## 📌 Descrição do Projeto

O **Profª Da Silva** é um site voltado para a divulgação e organização de **aulas particulares**, criado a partir da necessidade de oferecer um acompanhamento educacional mais próximo, acessível e personalizado para alunos que precisam de reforço escolar.

A plataforma tem como objetivo facilitar o contato entre alunos (ou responsáveis) e a professora, centralizando informações e tornando o processo de solicitação de aulas mais simples e eficiente.

---

## 🎯 Objetivo

- Disponibilizar informações claras sobre aulas particulares
- Facilitar o contato e a solicitação de aulas
- Oferecer uma solução digital simples para apoio educacional
- Atender alunos que necessitam de reforço ou acompanhamento individual

---

## 🚀 Funcionalidades

- Apresentação dos serviços educacionais
- Informações sobre a professora
- Formulário de contato
- Layout simples e intuitivo
- Interface responsiva para diferentes dispositivos

---

## Integrantes

* Erivaldo Gelson da Rocha João
* Mariane da Silva Souza

## 🛠️ Tecnologias Utilizadas

- **HTML5** – Estrutura do site  
- **CSS3** – Estilização e layout  
- **JavaScript** – Interatividade básica
- **React Native** – Desenvolvimento de aplicações móveis multiplataforma  
- **Bootstrap** – Framework CSS para criação de interfaces responsivas  
- **GitHub** – Versionamento e documentação  

---

## 📂 Estrutura do Projeto

```bash
ProfadaSilva/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── assets/
│   └── images/
└── README.md

## 🔐 Nova área de autenticação

Foi adicionada uma estrutura de login e cadastro com:

- tela moderna em `backend/public/login.html`
- backend em Node.js/Express em `backend/server.js`
- cadastro e login com e-mail e senha
- suporte preparado para login com Google e Apple

### Como executar

1. Instale as dependências com `npm install`
2. Copie `.env.example` para `.env`
3. Preencha as credenciais do Google e da Apple
4. Inicie com `npm start`
5. Acesse `http://localhost:3000`

Os usuários cadastrados localmente ficam em `backend/data/users.json`.
