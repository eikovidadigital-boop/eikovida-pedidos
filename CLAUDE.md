# CLAUDE.md — Ecossistema EIKO VIDA

Este arquivo é lido pelo Claude Code no início de toda sessão. Ele vale para TODOS os repositórios da conta `eikovidadigital-boop`. A mesma cópia fica na raiz de cada repositório.

---

## 1. Sobre o negócio

- **Empresa:** Eiko Vida, venda no **atacado** de cosméticos e óleos para a pele.
- **Clientes:** lojistas e revendedores (B2B), não o consumidor final.
- **Dono:** Paulo. Toca tudo sozinho.
- **Marca parceira presente no código:** Mel Raiz (logos e tabela de preços próprias).

## 2. Quem dá os comandos (leia com atenção)

- Paulo **não é programador**. Trabalha só pela interface web do GitHub.
- Responda **sempre em Português (Brasil)**, direto ao ponto, com bullets curtos.
- **Não mostre código na conversa.** Faça a alteração no repositório e explique o resultado em linguagem de negócio (o que muda para o lojista, o que muda para o Paulo).
- Se o pedido for ambíguo ou arriscado, pergunte antes de alterar.
- Avalie criticamente o pedido: se houver falha escondida ou solução melhor, aponte antes de executar.

## 3. Mapa dos repositórios

| Repositório | Visibilidade | Função | Hospedagem |
|---|---|---|---|
| `eikovida-pedidos` | Privado (após migração) | **App principal**: login de vendedor/usuário, catálogo, pedidos e gestão de clientes (PWA instalável) | Cloudflare Pages: `eikovida-pedidos.pages.dev` + domínio próprio |
| `pix` | Privado (após migração) | Página de pagamento via Pix (PWA) | Cloudflare Pages: `pix-37i.pages.dev` |
| `atendimento` | Privado (após migração) | Página de atendimento | Cloudflare Pages: `atendimento-2nq.pages.dev` |
| `imagens` | **Público** (de propósito) | Imagens usadas pelos apps e pelas redes sociais | Links diretos do GitHub |
| `meu-agente-social` | Privado (após migração) | Automação de Instagram/Facebook em Python, roda por GitHub Actions | GitHub Actions |

- O repositório `imagens` fica público porque os apps e o Instagram carregam as fotos por link direto. Se ficar privado, as imagens somem. Nunca colocar nada além de imagens de produto/marca nele.
- O arquivo `CNAME` é do GitHub Pages, que será desativado. Não usar para configuração de domínio (o domínio passa a ser gerido no Cloudflare).
- **Não mexer no Worker `eikovida-dm`** (conta Cloudflare). Ele já existia antes da migração e não faz parte dos sites.
- Cada sessão do Claude Code trabalha em um repositório. Se a tarefa exigir mudança em outro repositório, **avise o Paulo** e indique em qual repositório abrir a próxima sessão.

## 4. Regras de ouro (nunca quebrar)

1. **Nunca fazer push direto na `main`.** O Cloudflare Pages publica a `main` na hora para os clientes. Sempre criar branch, fazer commit e abrir Pull Request. O Cloudflare gera um **link de teste** para cada branch. Informe esse link ao Paulo para ele conferir antes do merge.
2. **Segredos:** nunca gravar senha, token, chave de API ou credencial em arquivo. Segredos ficam em GitHub Secrets (Actions) ou nas variáveis de ambiente do Cloudflare.
3. **Dados de clientes e pedidos:**
   - Hoje ficam em arquivos JSON (`clientes-seed.json`, `pedidos-seed.json`, `itens-pedidos.json`).
   - Esses arquivos **não podem ser baixáveis por qualquer pessoa pelo site**. Ver seção 7.
   - Não criar novos arquivos com dados de clientes fora dessa estrutura.
   - A migração para banco de dados será feita junto com o módulo de nota fiscal.
4. **Não apagar nem reescrever arquivos de dados** (`*.json`) sem ordem explícita.
5. **Preços e tabelas:** qualquer alteração em preço, pedido mínimo ou desconto precisa ser confirmada com o Paulo antes do commit, com o resumo "antes → depois".
6. **PWA / cache:** ao alterar arquivos do app, verificar se o service worker (`sw.js`, `pix-sw.js`) precisa de nova versão de cache. Sem isso, os clientes continuam vendo a versão antiga.
7. **Redes sociais (`meu-agente-social`):** respeitar as políticas da Meta (Instagram/Facebook). Achou violação, corrija e informe.
8. **GitHub Actions (`meu-agente-social`):** repositório privado no plano gratuito tem limite mensal de minutos de Actions. Não aumentar a frequência das rotinas sem avisar o Paulo.

## 5. Fluxo de trabalho padrão

1. Ler o pedido e, se preciso, perguntar.
2. Ler os arquivos envolvidos antes de alterar.
3. Criar branch com nome descritivo (ex.: `ajuste-desconto-quantidade`).
4. Fazer as alterações e testar o que for possível.
5. Abrir Pull Request com descrição em português: o que mudou, onde e o que o Paulo deve conferir.
6. Responder ao Paulo com:
   - O que foi feito (em linguagem de negócio)
   - Link do Pull Request
   - Link de teste do Cloudflare
   - O que conferir antes do merge
   - Riscos, se houver

## 6. Migração em andamento (PRIORIDADE 1)

Situação em 17/09/2026:

- Feito: os 3 sites já estão no Cloudflare Pages (endereços na seção 3). O GitHub Pages ainda está ligado e os repositórios ainda estão públicos.
- Falta, nesta ordem:
  1. **Trocar links antigos:** procurar em todos os arquivos qualquer endereço `github.io` ou `raw.githubusercontent.com` que aponte para `eikovida-pedidos`, `pix` ou `atendimento` e trocar pelo endereço novo do Cloudflare (ou pelo domínio próprio, quando estiver ativo). Links para o repositório `imagens` continuam como estão.
  2. Paulo aponta o domínio próprio no Cloudflare.
  3. Paulo desliga o GitHub Pages e torna os repositórios privados (exceto `imagens`). **Só depois dos passos 1 e 2**, senão os botões de Pix e atendimento quebram.

## 7. Proteção dos dados de clientes e do login

Contexto: repositório privado protege o **código**, mas tudo que o site publica continua acessível pelo endereço do site. O app tem login com código de vendedor/usuário e senha de 4 dígitos. Em site estático, esse tipo de login costuma conferir a senha dentro do próprio navegador, com os dados de acesso num arquivo que qualquer pessoa pode baixar.

Tarefa:

1. Descobrir como o login funciona e onde ficam os códigos e senhas.
2. Descobrir quais páginas usam `clientes-seed.json`, `pedidos-seed.json` e `itens-pedidos.json` e quem precisa deles (só o Paulo ou também o vendedor/lojista).
3. Verificar, pelo endereço publicado, se esses arquivos podem ser baixados sem login.
4. Propor ao Paulo a proteção gratuita adequada, usando **Cloudflare Access** (plano Zero Trust gratuito, até 50 usuários):
   - Área de gestão e arquivos de clientes/pedidos liberados só para o e-mail do Paulo (login por código enviado ao e-mail).
   - Vendedores e lojistas continuam usando o app normalmente.
   - Se o app do vendedor depender do arquivo de clientes inteiro, propor o ajuste mínimo, sem banco de dados.
5. Passar ao Paulo o passo a passo do que ele precisa clicar no painel do Cloudflare. Não executar mudanças que quebrem o pedido do vendedor/lojista.
6. Se encontrar **token, senha ou chave de API** gravados em qualquer arquivo, avisar o Paulo imediatamente.

## Tarefa inicial (primeira sessão)

1. Executar o passo 1 da seção 6 (troca de links), via branch e PR.
2. Executar o diagnóstico da seção 7 e relatar ao Paulo.
3. Analisar o repositório inteiro e preencher a seção 8 (mapa técnico).
4. Testar o fluxo completo: login → catálogo → pedido → gestão de clientes → pagamento (Pix) → atendimento.
5. Listar ao Paulo, em bullets, tudo que está quebrado ou funcionando errado, em ordem de gravidade.
6. Corrigir só depois que o Paulo aprovar a lista.

## 8. Mapa técnico (preenchido pelo Claude Code na primeira sessão)

- **Tecnologias usadas:** _a preencher_
- **Onde ficam os dados (produtos, clientes, pedidos):** _a preencher_
- **Como o pedido chega ao Paulo (WhatsApp, e-mail, planilha etc.):** _a preencher_
- **Serviços externos e integrações:** _a preencher_
- **Arquivos principais e o que cada um faz:** _a preencher_
- **Endereços no ar (domínio e links do Cloudflare Pages):** _a preencher_
- **Rotas protegidas pelo Cloudflare Access:** _a preencher_

## 9. Histórico de decisões

- 17/09/2026: sites publicados no Cloudflare Pages (eikovida-pedidos, pix, atendimento). Migração do GitHub Pages em andamento (seção 6).
- 17/09/2026: repositórios passam a privados após a migração, exceto `imagens`.
- 17/09/2026: dados de clientes permanecem em JSON até o módulo de nota fiscal; acesso a ser protegido por Cloudflare Access.
