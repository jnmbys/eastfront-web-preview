FROM node:22-bookworm-slim AS node
FROM python:3.12-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && npm install --global typescript@5.7.3
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python restore-fixtures.py && tsc -p core/tsconfig.json && useradd --uid 10001 --create-home sandboxuser && chown -R sandboxuser:sandboxuser /app
USER sandboxuser
ENV BIND_HOST=0.0.0.0 PORT=10000 COOKIE_SECURE=1 OPENBLAS_NUM_THREADS=1
EXPOSE 10000
CMD ["python", "online.py"]
