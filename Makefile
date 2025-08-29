.PHONY: install start server client

install:
	@echo "Installing dependencies for server and client..."
	cd server && npm install
	cd client && npm install

server:
	cd server && npm run server

client:
	cd client && npm start

start:
	@echo "Starting server and client concurrently..."
	npx concurrently "cd server && npm run start" "cd client && npm run dev"