# Build context la THU MUC GOC du an (khong phai server/) — vi seed.js doc 2 file .ttf
# goc nam NGANG HANG voi server/ (xem PROJECT_ROOT trong src/seed.js). Dockerfile nay
# duoc tham chieu tu docker-compose.yml o repo root voi context: .

FROM node:20-alpine

WORKDIR /app
COPY CherryBombOne-Regular.ttf NotoEmoji-VariableFont_wght.ttf ./

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./

ENV NODE_ENV=production
EXPOSE 7788

CMD ["node", "src/index.js"]
