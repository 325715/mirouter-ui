ARG VERSION

FROM golang:1.24.3-alpine AS builder

WORKDIR /app

COPY . .

RUN echo "Building version: $VERSION"

RUN go build -mod=vendor -ldflags "-X 'main.Version=$VERSION'"  -o main .

FROM alpine:3.18

WORKDIR /app

COPY --from=builder /app/main /app/main

EXPOSE 6789

CMD ["./main","--config=/app/data/config.yaml","--workdirectory=/app/data/","--databasepath=/app/data/database.db","--autocheckupdate=false"]