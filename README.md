# OChart v0.2.0

Visualizador modular de gráficos financeiros, atualmente focado em BTC-USD.

## Objetivo da v0.2.0

A v0.2.0 organiza o código sem alterar o propósito funcional do OChart. A prioridade é estabelecer fronteiras claras entre dados, estado, renderização, interface e infraestrutura antes da evolução para indicadores, OAlgo e backtest.

## Arquitetura

```text
index.html
    ↓
src/app.js
    ↓
┌─────────────────────────────────────────┐
│ UI                                      │
│ controls / HUD / theme / drawings       │
└──────────────────┬──────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│ CORE                                    │
│ sync → data-loader → sanitizer          │
│ renderer → chart-engine                 │
└─────────────────────────────────────────┘
                   ↓
             Chart.js / plugins
```

## Estrutura ativa

- `src/app.js` — composição e boot; não contém lógica de domínio.
- `src/core/chart-engine.js` — estado e ciclo de vida do gráfico.
- `src/core/chart-config.js` — configuração do Chart.js e interações.
- `src/core/chart-datasets.js` — transformação dos dados em datasets.
- `src/core/renderer.js` — ponte entre dados prontos e visualização.
- `src/core/data-loader.js` — aquisição de dados e fallback.
- `src/core/api-source.js` — fonte de API.
- `src/core/sanitizer.js` — normalização e validação de dados.
- `src/core/sync.js` — coordenação do fluxo de atualização.
- `src/core/logger.js` — infraestrutura de logs.
- `src/ui/` — interface e componentes visuais.
- `src/ui/drawing-tools/` — ferramentas de desenho separadas por responsabilidade.
- `src/utils/` — cálculos auxiliares/indicadores.
- `src/style/` — estilos.
- `libs/` — bibliotecas JavaScript locais.
- `api/` — PHP, cache e dados auxiliares.
- `adoc/` — histórico/rascunhos; não fazem parte do runtime.

## Fluxo de dados

```text
Fonte externa/cache
      ↓
Data Loader
      ↓
Sanitizer
      ↓
Sync
      ↓
Renderer
      ↓
ChartEngine
      ↓
Chart.js
```

O princípio é simples: dados externos não devem entrar diretamente no motor visual sem passar pela fronteira de normalização.

## Diagnóstico no celular

O OChart possui um console de logs visível na própria página. Ele mantém eventos recentes, permite filtrar níveis e copiar o log técnico completo. O console é parte da infraestrutura de desenvolvimento e deve permanecer disponível enquanto a arquitetura estiver em evolução.

## Regra de desenvolvimento

1. Preservar uma versão funcional antes de mudanças maiores.
2. Fazer mudanças pequenas e verificáveis.
3. Não reescrever arquivos complexos sem mapear dependências.
4. Cada módulo deve possuir uma responsabilidade principal.
5. Evitar abstrações que ainda não tenham necessidade real.
6. Testar no site depois de cada etapa relevante.

## Próximas etapas

- concluir a separação das responsabilidades restantes;
- revisar o fluxo de dados e sanitização;
- revisar ferramentas de desenho;
- consolidar indicadores como módulo de domínio;
- preparar a interface de dados que será consumida pelo OAlgo;
- somente depois iniciar OAlgo e OBacktest.
