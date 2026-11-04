FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node dist ./dist
COPY --chown=node:node host ./host
RUN chmod -R a=rX dist host
USER node
ENV WEB_PORT=8080 BIND=0.0.0.0
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "host/start.mjs"]
