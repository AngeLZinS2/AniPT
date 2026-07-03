# AniPT Makefile
# Build, test, and cross-compile targets for the AniPT project.

BINARY_NAME := anipt
MODULE      := github.com/angeloneri/anipt
CMD_PATH    := ./cmd/anipt
VERSION     := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS     := -ldflags="-s -w -X '$(MODULE)/internal/version.Version=$(VERSION)'"

.PHONY: all build run test lint clean cross-compile install help

all: build

## build: Compile the binary for the current OS/arch
build:
	@echo ">> Building $(BINARY_NAME) ($(VERSION))..."
	go build $(LDFLAGS) -o bin/$(BINARY_NAME) $(CMD_PATH)
	@echo ">> Binary: bin/$(BINARY_NAME)"

## run: Run the application directly
run:
	go run $(CMD_PATH)

## test: Run all unit tests
test:
	@echo ">> Running tests..."
	go test ./... -v -race -count=1

## test-short: Run tests without race detector (faster)
test-short:
	go test ./... -short

## lint: Run golangci-lint
lint:
	@which golangci-lint > /dev/null || (echo "Install golangci-lint: https://golangci-lint.run/usage/install/" && exit 1)
	golangci-lint run ./...

## vet: Run go vet
vet:
	go vet ./...

## tidy: Tidy go modules
tidy:
	go mod tidy

## cross-compile: Build binaries for all platforms
cross-compile: cross-linux cross-windows cross-darwin
	@echo ">> All binaries built in bin/"

cross-linux:
	@echo ">> Building for Linux amd64..."
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o bin/$(BINARY_NAME)-linux-amd64 $(CMD_PATH)
	@echo ">> Building for Linux arm64..."
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o bin/$(BINARY_NAME)-linux-arm64 $(CMD_PATH)

cross-windows:
	@echo ">> Building for Windows amd64..."
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o bin/$(BINARY_NAME)-windows-amd64.exe $(CMD_PATH)

cross-darwin:
	@echo ">> Building for macOS amd64..."
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o bin/$(BINARY_NAME)-darwin-amd64 $(CMD_PATH)
	@echo ">> Building for macOS arm64 (Apple Silicon)..."
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o bin/$(BINARY_NAME)-darwin-arm64 $(CMD_PATH)

## install: Install to GOPATH/bin
install:
	go install $(LDFLAGS) $(CMD_PATH)

## clean: Remove build artifacts
clean:
	@echo ">> Cleaning..."
	rm -rf bin/
	go clean ./...

## help: Show this help message
help:
	@echo "AniPT — Comandos disponíveis:"
	@sed -n 's/^##//p' $(MAKEFILE_LIST) | column -t -s ':' | sed -e 's/^/ /'
