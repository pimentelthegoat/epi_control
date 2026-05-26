# Controle de EPI

Sistema web para controle de Equipamentos de Protecao Individual (EPI), com dados salvos na nuvem pelo Supabase.

O frontend chama `/api/epis`. Localmente, quem responde e `backend/server.js`. Na Vercel, quem responde e a funcao serverless `api/epis.js`. Nos dois casos, `SUPABASE_SERVICE_ROLE_KEY` fica apenas no servidor e nao vai para o navegador.

## Estrutura

```text
SAGA SENAI/
  api/
    epis.js

  backend/
    .env.example
    package.json
    server.js

  frontend/
    index.html
    script.js
    styles.css

  public/
    index.html
    script.js
    styles.css

  supabase/
    schema.sql

  package.json
  vercel.json
  .gitignore
  README.md
```

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Va em `Project Settings > API`.
3. Copie:
   - `Project URL`
   - `service_role key`
4. Abra o `SQL Editor`.
5. Execute o SQL do arquivo:

```text
supabase/schema.sql
```

## Rodar Local

Configure o backend local:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edite `backend/.env`:

```env
PORT=5500
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE
```

Rode:

```powershell
cd backend
npm start
```

Acesse:

```text
http://localhost:5500
```

## Deploy na Vercel

Na Vercel, configure estas variaveis em `Project Settings > Environment Variables`:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE
```

Adicione as variaveis no ambiente que voce usa no deploy: Production, Preview e/ou Development.

Nao precisa configurar `PORT` na Vercel.

Depois faca o deploy do repositorio. A Vercel vai servir os arquivos da pasta `public/` e a funcao serverless:

```http
GET /api/epis
POST /api/epis
PUT /api/epis/:id
DELETE /api/epis/:id
```

## Seguranca

O arquivo `backend/.env` fica fora do Git e guarda a `service_role` localmente.

Na Vercel, a `SUPABASE_SERVICE_ROLE_KEY` deve ficar somente em Environment Variables.

Nao coloque `SUPABASE_SERVICE_ROLE_KEY` em arquivos do frontend. Ela deve existir apenas no backend local, na funcao serverless ou no ambiente de deploy.
