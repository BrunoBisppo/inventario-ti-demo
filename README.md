# Inventário de T.I. — Demonstração

Aplicação para acompanhar equipamentos de TI por categoria, setor e situação. A demonstração abre com 12 equipamentos e 4 setores fictícios.

## O que dá para experimentar

- Consultar o painel de alertas e atividades recentes.
- Buscar e filtrar equipamentos e abrir os detalhes de cada registro.
- Cadastrar, editar e excluir equipamentos e setores.
- Ver o histórico de alterações e gerar relatórios em PDF.

## Rodar no computador

Com Node.js 24 ou superior, execute na pasta do projeto:

```sh
npm ci
npm run dev
```

Abra o endereço local exibido no terminal. A aplicação usa React, TypeScript e Vite. O navegador guarda as alterações no armazenamento local. Use **Reiniciar** no menu para recuperar os exemplos originais.

O acesso abre direto no painel. Login, administração de usuários e backup de produção ficam fora da demonstração. Os exemplos estão em `src/demonstracao.ts`.

Para verificar o código e gerar a versão estática:

```sh
npm run lint
npm run build
npm run preview
```

## Capturas de tela

### Painel

![Painel com resumo, alertas e atividades recentes](docs/prints/painel.png)

### Inventário

![Lista de equipamentos fictícios com filtros e status](docs/prints/inventario.png)

### Cadastro

![Formulário de cadastro de equipamento](docs/prints/cadastro.png)

### Histórico e setores

[Abrir captura do histórico](docs/prints/historico.png) · [Abrir captura dos setores](docs/prints/setores.png)
