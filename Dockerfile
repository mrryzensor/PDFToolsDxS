# Stage 1: Build React/Vite Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build Go WhatsApp + API + Static Server
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app/server-go
RUN apk add --no-cache git
COPY server-go/go.mod server-go/go.sum ./
RUN go mod download
COPY server-go/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o whatsapp-service .

# Stage 3: Final Lightweight Runtime Image
FROM alpine:latest
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=backend-builder /app/server-go/whatsapp-service ./whatsapp-service
COPY --from=frontend-builder /app/dist ./dist

ENV DATA_DIR=/app/data
ENV STATIC_DIR=/app/dist
ENV PORT=8089

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 8089

CMD ["./whatsapp-service"]
