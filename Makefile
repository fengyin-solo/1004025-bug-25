.PHONY: install frontend build deploy deploy-resume up

install:
	cd frontend && npm install

frontend:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

# 部署流水线：失败后按环节定位，修复后用 deploy-resume 断点续跑
deploy:
	cd frontend && npm run deploy

deploy-resume:
	cd frontend && npm run deploy:resume

up:
	docker compose up --build -d
