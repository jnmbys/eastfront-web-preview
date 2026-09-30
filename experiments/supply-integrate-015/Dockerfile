# Candidate only. Repository-root build context; not built/deployed in 015.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json index.html styles.css multiplayer.css ./
COPY src ./src
COPY server ./server
COPY scripts ./scripts
COPY vendor ./vendor
COPY public ./public
COPY experiments/supply-exp-005 ./experiments/supply-exp-005
COPY experiments/supply-integrate-015 ./experiments/supply-integrate-015
RUN node experiments/supply-integrate-015/build.mjs
FROM python:3.12-slim-bookworm
COPY --from=build /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY experiments/supply-exp-005/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=build /app/dist ./dist
COPY --from=build /app/.integrate-dist ./.integrate-dist
COPY --from=build /app/experiments/supply-exp-005 ./experiments/supply-exp-005
COPY --from=build /app/experiments/supply-integrate-015 ./experiments/supply-integrate-015
RUN cd experiments/supply-exp-005 && python restore-fixtures.py && useradd --uid 10001 --create-home sandboxuser && chown -R sandboxuser:sandboxuser /app
USER sandboxuser
ENV BIND_HOST=0.0.0.0 PORT=10000 COOKIE_SECURE=1 OPENBLAS_NUM_THREADS=1
EXPOSE 10000
CMD ["python", "experiments/supply-integrate-015/service.py"]
