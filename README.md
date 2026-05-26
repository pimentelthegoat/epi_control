# Controle de EPI

Sistema web para controle de Equipamentos de Protecao Individual (EPI), com dados salvos na nuvem pelo Supabase.

O frontend chama uma API local (`/api/epis`). O backend usa `SUPABASE_SERVICE_ROLE_KEY` no lado do servidor para falar com o Supabase. A chave `service_role` nao e enviada ao navegador.

## Estrutura

```text
SAGA SENAI/
  backend/
    .env.example
    package.json
    server.js

  frontend/
    index.html
    script.js
    styles.css

  supabase/
    schema.sql

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

## Configurar Backend

Copie o exemplo:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edite `backend/.env`:

```env
PORT=5500
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE
```

## Rodar

```powershell
cd backend
npm start
```

Acesse:

```text
http://localhost:5500
```

## API Local

```http
GET /api/epis
POST /api/epis
PUT /api/epis/:id
DELETE /api/epis/:id
```

## Seguranca

O arquivo `backend/.env` fica fora do Git e guarda a `service_role`.

Nao coloque `SUPABASE_SERVICE_ROLE_KEY` em arquivos do frontend. Ela deve existir apenas no backend ou no ambiente de deploy.
