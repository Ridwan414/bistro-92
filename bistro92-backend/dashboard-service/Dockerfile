FROM golang:1.23.6
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
RUN go build -o dashboard-service .
CMD ["./dashboard-service"]