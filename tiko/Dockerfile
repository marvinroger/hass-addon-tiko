ARG BUILD_FROM=ghcr.io/hassio-addons/base/aarch64:15.0.1
# hadolint ignore=DL3006
FROM ${BUILD_FROM} as base

RUN apk add --no-cache nodejs=20.12.1-r0 tini=0.19.0-r2

FROM base as builder

WORKDIR /app

COPY package.json /app/
COPY package-lock.json /app/
COPY tsconfig.json /app/
COPY src/ /app/src/

RUN apk add --no-cache npm=10.2.5-r0 && \
    npm ci --no-audit --no-optional --no-update-notifier && \
    npm run build && \
    rm -rf node_modules && \
    npm ci --no-audit --no-optional --no-update-notifier --production

FROM base as release

WORKDIR /app

COPY rootfs/ /
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/dist /app/dist

ENV NODE_ENV production

ENTRYPOINT [ "/sbin/tini", "--", "/docker-entrypoint.sh"]

ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version=${BUILD_VERSION} \
    maintainer="Marvin ROGER <bonjour+dev@marvinroger.fr>" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="Marvin ROGER <bonjour+dev@marvinroger.fr>" \
    org.opencontainers.image.authors="Marvin ROGER <bonjour+dev@marvinroger.fr>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/main/README.md" \
    org.opencontainers.image.created=${BUILD_DATE} \
    org.opencontainers.image.revision=${BUILD_REF} \
    org.opencontainers.image.version=${BUILD_VERSION}
