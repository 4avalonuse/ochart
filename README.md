# OChart

Visualizador modular de gráficos financeiros, atualmente focado em BTC-USD.

## Estrutura ativa

- `index.html` — entrada do site.
- `src/app.js` — inicialização/orquestração.
- `src/core/` — motor, dados, sincronização e infraestrutura.
- `src/ui/` — controles, tema, tabela e ferramentas de desenho.
- `src/ui/drawing-tools/` — módulos internos das ferramentas de desenho.
- `src/utils/` — cálculos auxiliares/indicadores.
- `src/style/` — estilos do aplicativo.
- `libs/` — bibliotecas JavaScript locais.
- `api/` — PHP, cache e dados usados pelo modo local.
- `adoc/` — arquivos históricos/rascunhos; não fazem parte do runtime.

## Regra de desenvolvimento

Preservar a versão funcional antes de mudanças maiores. Fazer uma mudança por vez e testar no site antes de seguir.

## Backup

Backups importantes ficam em branches separadas, sem alterar a versão principal.
