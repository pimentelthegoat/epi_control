# Controle de EPI

Sistema web para controle de Equipamentos de Protecao Individual (EPI), com dados salvos na nuvem pelo Supabase.

O frontend chama `/api/epis`. Localmente, quem responde e `backend/server.js`. Na Vercel, quem responde sao as funcoes serverless da pasta `api/`. Nos dois casos, `SUPABASE_SERVICE_ROLE_KEY` fica apenas no servidor e nao vai para o navegador.

## Estrutura

```text
SAGA SENAI/
  api/
    _episService.js
    epis.js
    epis/
      [id].js

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
  .gitignore
  README.md
```

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Va em `Project Settings > API`.
3. Copie:
   - `Project URL`
   - `service_role key` ou `secret key`
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
PORT=3000
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE_OU_SECRET
```

Rode:

```powershell
cd backend
npm start
```

Acesse:

```text
http://localhost:3000
```

## Deploy na Vercel

Na Vercel, configure estas variaveis em `Project Settings > Environment Variables`:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE_OU_SECRET
```

Adicione as variaveis no ambiente que voce usa no deploy: Production, Preview e/ou Development.

Nao precisa configurar `PORT` na Vercel.

O deploy deve usar a raiz do repositorio como Root Directory. Nao configure a Vercel para usar apenas `backend/`, porque ela precisa encontrar tambem `api/` e `public/`.

Depois faca um novo deploy/redeploy do repositorio. A Vercel vai servir os arquivos da pasta `public/` e as funcoes serverless:

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
