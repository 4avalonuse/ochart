# OChart v0.7.0

Visualizador modular do Oraculum, consumindo a Cloudflare Data API como fonte de dados de mercado.

## Arquitetura ativa

Dataset Catalog → Cloudflare Data API → Data Loader → Sanitizer → Sync → Renderer → ChartEngine → Chart.js

A UI trabalha com datasets. Yahoo Finance, Binance.US e outros providers pertencem à Data API.

## Experiência mobile

A interação principal permanece simples:

- **1 dedo no gráfico:** navega no tempo.
- **2 dedos:** zoom temporal.
- **1 dedo iniciado na região da escala de preços:** ajusta a escala vertical (Y).
- **Fit:** retorna ao enquadramento original.

A escala de preços é uma área de interação, não um conjunto extra de botões.

## Dados

O OChart lê dados persistidos pela Data API. Atualizações só acontecem quando o usuário solicita **Atualizar**. O cache local é usado apenas como stale fallback quando a API falha.

## Contrato

- GET /api/datasets
- GET /api/datasets/:id
- POST /api/datasets/:id/refresh

Payload canônico de candles: {t,o,h,l,c,v}.

## Testes

node --test tests/dataset-utils.test.js

node --test tests/data-api-contract.test.js

## Estrutura

- src/app.js — composição e boot.
- src/core/ — dados, sincronização, gráfico e interação.
- src/ui/ — interface e componentes.
- tests/ — testes de contrato e regras puras.

## Regra de evolução

Antes de ampliar o número de ativos, manter o fluxo BTC fechado e verificável: dados, logs, fallback, testes e integração frontend/backend. Novos recursos devem preservar a experiência simples do gráfico.
