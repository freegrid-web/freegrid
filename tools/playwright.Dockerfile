# Official Playwright image + DejaVu fonts, so the generic `sans-serif` family resolves to DejaVu Sans
# as in the upstream baseline environment (the stock image falls back to a CJK font with taller lines).
# pnpm (the repository's version) is installed in the image, so a run does not download it again.
ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PNPM
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/* \
  && npm install -g --silent "${PNPM}"
