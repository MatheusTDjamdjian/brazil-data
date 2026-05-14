.DEFAULT_GOAL := help

.PHONY: help up down logs reset seed test metrics check build lint format start

help: ## Lista comandos disponíveis
	@node scripts/help.mjs

up: ## Sobe tudo (Docker + API + Web)
	@pnpm start

down: ## Derruba containers Docker
	@docker compose down

logs: ## Mostra logs dos containers
	@docker compose logs -f

reset: ## Apaga banco e refaz do zero (com seed)
	@pnpm run reset

seed: ## Popula dados de exemplo
	@pnpm run seed

test: ## Roda todos os testes
	@pnpm test

metrics: ## Resumo de métricas LLM-free (latência, % cache hit, intents)
	@pnpm run metrics

check: ## Verifica pré-requisitos e .env
	@pnpm run check

build: ## Builda todos os pacotes
	@pnpm build

lint: ## Lint em todo o monorepo
	@pnpm lint

format: ## Formata com Prettier
	@pnpm format

start: up ## Alias para 'up'
