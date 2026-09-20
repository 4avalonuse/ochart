# OChart v0.5.0

Visualizador modular do Oraculum, consumindo a Cloudflare Data API como única fonte de dados.

## Arquitetura

```text
Dataset Catalog
      ↓
Cloudflare Data API
      ↓
OChart Data Loader
      ↓
Sanitizer → Sync → Renderer → ChartEngine → Chart.js
```

O OChart não conversa diretamente com Yahoo, Binance ou outros providers. Providers são responsabilidade da Data API.

## Fluxo de dados

- `GET /api/datasets` fornece o catálogo.
- `GET /api/datasets/:id` carrega o dataset persistido.
- `POST /api/datasets/:id/refresh` é usado pelo botão **Atualizar**.
- O OChart mantém apenas um cache local do último sucesso como fallback.
- O estado do gráfico é separado do catálogo e da aquisição de dados.

## Interface

O seletor **Dataset** usa diretamente o catálogo do backend. O seletor **TF** altera o intervalo dentro do mesmo ativo/provider quando essa combinação existe.

O formato canônico consumido pelo gráfico continua:

```js
{ t, o, h, l, c, v }
```

## Estrutura ativa

- `src/app.js` — composição e boot.
- `src/core/api-config.js` — endpoint central da Data API.
- `src/core/api-source.js` — catálogo, leitura e refresh de datasets.
- `src/core/data-loader.js` — aquisição + cache local.
- `src/core/sanitizer.js` — normalização/validação.
- `src/core/sync.js` — coordenação do fluxo.
- `src/core/chart-engine.js` — estado e ciclo de vida do gráfico.
- `src/ui/` — interface e componentes visuais.
- `api/` — legado mantido no repositório, mas fora do fluxo ativo de dados.

## Regra arquitetural

A UI conhece **datasets**. A Data API conhece **providers**. O OChart não deve duplicar lógica de provider nem montar URLs de Yahoo/Binance.

Próxima evolução: ampliar o catálogo com novos ativos, como ETH, sem recriar o fluxo de dados do frontend.
