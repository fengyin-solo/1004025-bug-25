.PHONY: install frontend build seed deploy test

install:
	cd frontend && npm install

frontend:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

# 只生成统一口径的样例快照（public/seed.json）
seed:
	cd frontend && npm run seed:generate

# 可恢复的部署流水线：prepare → typecheck → build → verify，状态见运营工作台
deploy:
	cd frontend && npm run deploy

test:
	cd frontend && npm test
