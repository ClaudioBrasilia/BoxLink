# ADR 0001: Adoção de Markdown para Registros de Decisão Arquitetural (ADRs)

## Contexto
Precisamos manter um registro do porquê tomamos decisões sistêmicas e de arquitetura. É comum que novos desenvolvedores questionem tecnologias já estabelecidas por puro desconhecimento do contexto original onde a decisão foi tomada.

## Decisão
Vamos manter os Architectural Decision Records (ADRs) diretamente no repositório, em arquivos Markdown nativos, salvos dentro da pasta `/docs/adr/`.

## Consequências
- Fica mais fácil de rastrear junto aos commits do Git quem tomou a decisão e quando.
- Adiciona um leve atrito caso a decisão seja puramente trivial, portanto, limitaremos as ADRs a decisões que afetem segurança, stack, custos e organização estrutural do projeto.
- Não dependeremos de ferramentas de terceiros como Confluence ou Jira para manter o catálogo de engenharia.
