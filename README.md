# Controle de EPI

Sistema web para controle de Equipamentos de Protecao Individual (EPI), com dados salvos na nuvem pelo Supabase.

O frontend chama uma API local (`/api/epis`). O `server.js` usa `SUPABASE_SERVICE_ROLE_KEY` no lado do servidor para falar com o Supabase. A chave `service_role` nao e enviada ao navegador.

## Funcionalidades

- Cadastro, edicao e exclusao de EPIs.
- Controle de CA, categoria, lote, validade, estoque, setor e fornecedor.
- Indicadores de equipamentos, itens em uso, EPIs a vencer e estoque critico.
- Alertas de validade.
- Busca e filtro por status.
- Tema claro e escuro.
- Exportacao CSV.
- Persistencia em nuvem via Supabase.

## Estrutura

```text
SAGA SENAI/
  frontend/
    index.html
    script.js
    styles.css

  supabase/
    schema.sql

  .env.example
  .gitignore
  package.json
  server.js
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

## Configurar .env

Copie o exemplo:

```powershell
Copy-Item .env.example .env
```

Edite o `.env`:

```env
PORT=5500
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE
```

## Rodar

```powershell
npm start
```

Acesse:

```text
http://localhost:5500
```

## API Local

O frontend usa estes endpoints locais:

```http
GET /api/epis
POST /api/epis
PUT /api/epis/:id
DELETE /api/epis/:id
```

O servidor local repassa as operacoes para a REST API do Supabase usando a `service_role`.

## Modelo de Dados

Tabela: `public.epis`

- `id`
- `name`
- `ca`
- `category`
- `lot`
- `valid_until`
- `total_stock`
- `in_use`
- `min_stock`
- `department`
- `supplier`
- `notes`
- `created_at`
- `updated_at`

## Seguranca

O arquivo `.env` fica fora do Git e guarda a `service_role`.

Nao coloque `SUPABASE_SERVICE_ROLE_KEY` em arquivos do frontend. Ela deve existir apenas no servidor local ou no ambiente de deploy.
