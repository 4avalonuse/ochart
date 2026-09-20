# OChart v0.5.0

Visualizador modular do Oraculum, consumindo a Cloudflare Data API como única fonte de dados de mercado.

## Arquitetura ativa

~~~text
Dataset Catalog
      ↓
Cloudflare Data API
      ↓
OChart Data Loader
      ↓
Sanitizer
      ↓
Sync
      ↓
Renderer → ChartEngine → Chart.js
~~~

A UI trabalha com datasets, não com providers. Yahoo Finance, Binance.US e outros providers pertencem à Data API e são escolhidos pelo catálogo do backend.

## Contrato da Data API

### Catálogo

GET /api/datasets

Retorna:

~~~js
{
  ok: true,
  data: [
    {
      id,
      name,
      provider,
      symbol,
      kind,
      interval,
      currency,
      description,
      updated_at
    }
  ]
}
~~~

### Dataset

GET /api/datasets/:id

Retorna:

~~~js
{
  ok: true,
  data: [{ t, o, h, l, c, v }],
  meta: {
    datasetId,
    name,
    provider,
    symbol,
    kind,
    interval,
    currency,
    sourceName,
    updatedAt
  }
}
~~~

### Refresh

POST /api/datasets/:id/refresh

Usado pelo botão Sync. Retorna o mesmo contrato do dataset, acrescido de refresh com o relatório de ingestão.

O OChart não monta URLs de Yahoo/Binance e não depende do formato interno desses providers.

## Fluxo operacional

1. OChart consulta o catálogo.
2. O usuário escolhe um dataset.
3. O Data Loader lê o dataset persistido pela Data API.
4. Sync usa refresh para solicitar uma nova ingestão.
5. O Sanitizer valida o payload canônico {t,o,h,l,c,v}.
6. O Renderer entrega os dados ao ChartEngine.
7. O último payload bem-sucedido fica em cache local.
8. Se a Data API falhar, o cache é usado explicitamente como stale fallback e o HUD registra o evento.

O cache nunca é a fonte primária.

## Logs

Os eventos do fluxo de dados usam nomes estáveis:

- data_api_health_ok / data_api_health_fail
- dataset_catalog_fail
- dataset_read_start / dataset_read_ok / dataset_read_fail
- dataset_refresh_start / dataset_refresh_ok / dataset_refresh_fail
- dataset_cache_fallback
- dataset_change
- dataset_interval_unavailable
- sanitize_report
- sync_start / sync_ok / sync_cache_fallback / sync_fail

O HUD mantém os últimos 500 eventos e permite copiar o log técnico.

## Timeframe

O seletor TF é uma visão da relação entre datasets. A troca de intervalo procura outro dataset usando os metadados provider + symbol + kind + currency + interval.

O ID não é usado para inferir essa relação.

A notação da UI usa 1mo; a Data API usa 1M.

## Testes

Teste local do relacionamento entre datasets:

~~~bash
node --test tests/dataset-utils.test.js
~~~

Teste de contrato contra a Data API real:

~~~bash
node --test tests/data-api-contract.test.js
~~~

O workflow Data API Contract executa os dois testes em Pull Requests e pode ser acionado manualmente.

## Estrutura ativa

- src/app.js — composição e boot.
- src/core/api-config.js — endpoint central.
- src/core/api-source.js — contrato HTTP da Data API.
- src/core/dataset-utils.js — regras de relacionamento do catálogo.
- src/core/data-loader.js — aquisição e fallback.
- src/core/sanitizer.js — validação/normalização.
- src/core/sync.js — coordenação do fluxo.
- src/core/renderer.js — ponte para visualização.
- src/core/chart-engine.js — estado do gráfico.
- src/ui/ — interface e componentes.
- tests/ — testes de contrato e regras puras.

## Legado

A pasta api/ antiga permanece no repositório para não misturar remoção de legado com a migração do fluxo de dados. Ela está fora do caminho ativo do OChart.

Os recursos de desenhos salvos em api/bundles.php são uma função separada do pipeline de dados de mercado.

## Regra de evolução

Antes de adicionar outro ativo, o fluxo BTC deve permanecer fechado e verificável: contrato, logs, fallback, testes, documentação e integração frontend/backend.

Novos ativos devem entrar pelo catálogo da Data API, sem recriar lógica de aquisição no OChart.
