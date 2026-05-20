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
- suporte preparado para login com Google

### Como executar

1. Instale as dependências com `npm install`
2. Copie `.env.example` para `.env`
3. Preencha as credenciais do Google, caso queira usar login social
4. Inicie com `npm start`
5. Acesse `http://localhost:3000`

Os usuários cadastrados ficam no banco SQL `backend/data/profa.sqlite3`. O arquivo `backend/data/users.json` antigo é migrado automaticamente quando o banco ainda não tem usuários.

### Ativar login com Google

O botão do Google fica desabilitado até existir um arquivo `.env` com credenciais reais do Google OAuth. Copie `.env.example` para `.env` e preencha:

```env
GOOGLE_CLIENT_ID=seu-client-id-real
GOOGLE_CLIENT_SECRET=seu-client-secret-real
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

No Google Cloud Console, cadastre a URL `http://localhost:3000/auth/google/callback` em **URIs de redirecionamento autorizados**. Depois reinicie o servidor com `npm start`.

Ao clicar em **Google**, o sistema usa a API OAuth do Google e solicita a seleção de conta. O botão só fica ativo quando `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` forem credenciais reais.

## Pagamentos e gestão

Foi adicionada uma integração de pagamentos com banco SQL local:

- banco SQLite em `backend/data/profa.sqlite3`
- schema documentado em `backend/data/schema.sql`
- banco de login gerenciado pelo Python em `backend/python/auth_db.py`
- módulo Python em `backend/python/payments_db.py`
- registro seguro de pedidos pela rota protegida `POST /api/payments`
- área protegida da gestão em `http://localhost:3000/gestao/`
- login separado do professor em `http://localhost:3000/professor-login.html`
- área do aluno liberada após pagamento em `http://localhost:3000/aluno/`

Para liberar a área de gestão, cadastre no `.env` os e-mails autorizados:

```env
GESTAO_EMAILS=gestao@exemplo.com,professora@exemplo.com
```

Somente usuários logados com um desses e-mails conseguem acessar `/gestao/` e as rotas `/api/gestao/*`.

Na gestão, a aba **Pagamentos** controla os pedidos e a aba **Logins** controla o acesso dos alunos. Quando um pedido é marcado como `pago`, o login do aluno é ativado automaticamente no banco SQL.

O painel da professora também possui um menu hambúrguer retrátil com três módulos:

- **Gestão de acesso**: pagamentos e logins dos alunos
- **Módulos PDF**: upload e listagem de PDFs
- **Vídeo aulas**: upload e listagem de vídeos

Os arquivos enviados ficam em `backend/uploads/pdfs` e `backend/uploads/videos`, e os registros ficam na tabela SQL `teaching_materials`.

Na aba **Logins**, a professora também pode marcar quais matérias cada aluno pode acessar: Português, História e Espanhol. A área do aluno só lista materiais dessas matérias, e o arquivo também é protegido no backend para impedir acesso direto a conteúdo não liberado.

A área do aluno em `/aluno/` possui menu hambúrguer com:

- **Dashboard**: cards e barras de acompanhamento
- **Eventos**: calendário simples para o aluno adicionar aulas e compromissos
- **Comunicados**: avisos publicados pela professora
- **Aulas**: PDFs e vídeo aulas liberados pela professora, organizados por módulo
