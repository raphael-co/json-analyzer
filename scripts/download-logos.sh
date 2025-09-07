#!/usr/bin/env bash
set -euo pipefail

mkdir -p public/logos
dl() { curl -fsSL "$1" -o "public/logos/$2"; echo "✓ $2"; }
dl2(){ p="$1"; a="${2:-}"; out="$3"; if curl -fsSL "$p" -o "public/logos/$out"; then echo "✓ $out"; elif [ -n "$a" ] && curl -fsSL "$a" -o "public/logos/$out"; then echo "✓ $out (fallback)"; else echo "✗ $out" >&2; exit 1; fi; }

dl "https://www.vectorlogo.zone/logos/reactjs/reactjs-icon.svg" "react-native.svg"
dl "https://www.vectorlogo.zone/logos/expoio/expoio-icon.svg" "expo.svg"
dl "https://www.vectorlogo.zone/logos/axios/axios-icon.svg" "axios.svg"
dl "https://cdn.simpleicons.org/reactquery/FF4154" "react-query.svg"
dl "https://cdn.simpleicons.org/reacthookform/EC5990" "react-hook-form.svg"
dl "https://cdn.simpleicons.org/zod" "zod.svg"
dl "https://cdn.simpleicons.org/prisma/2D3748" "prisma.svg"
dl "https://www.vectorlogo.zone/logos/graphql/graphql-icon.svg" "graphql.svg"
dl "https://www.vectorlogo.zone/logos/apollographql/apollographql-icon.svg" "apollo-graphql.svg"
dl "https://cdn.simpleicons.org/chartdotjs/FF6384" "chartjs.svg"
dl "https://www.vectorlogo.zone/logos/mui/mui-icon.svg" "mui.svg"
dl "https://www.vectorlogo.zone/logos/getbootstrap/getbootstrap-icon.svg" "bootstrap.svg"
dl "https://cdn.simpleicons.org/radixui" "radix-ui.svg"
dl "https://cdn.simpleicons.org/vite/646CFF" "vite.svg"
dl "https://cdn.simpleicons.org/webpack/8DD6F9" "webpack.svg"
dl "https://cdn.simpleicons.org/swc" "swc.svg"
dl "https://cdn.simpleicons.org/turborepo" "turborepo.svg"
dl "https://cdn.simpleicons.org/eslint" "eslint.svg"
dl "https://cdn.simpleicons.org/prettier" "prettier.svg"
dl "https://cdn.simpleicons.org/pnpm" "pnpm.svg"
dl "https://cdn.simpleicons.org/npm" "npm.svg"
dl "https://cdn.simpleicons.org/yarn" "yarn.svg"
dl "https://cdn.simpleicons.org/githubactions" "github-actions.svg"
dl "https://cdn.simpleicons.org/sentry" "sentry.svg"
dl "https://cdn.simpleicons.org/grafana" "grafana.svg"
dl "https://cdn.simpleicons.org/prometheus" "prometheus.svg"
dl "https://cdn.simpleicons.org/proxmox" "proxmox.svg"
dl "https://cdn.simpleicons.org/vmware" "vmware.svg"
dl "https://cdn.simpleicons.org/virtualbox" "virtualbox.svg"
dl "https://cdn.simpleicons.org/apple" "apple.svg"
dl2 "https://cdn.simpleicons.org/windows/0078D4" "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/windows8/windows8-original.svg" "windows.svg"
dl2 "https://cdn.simpleicons.org/leaflet/199900" "https://www.vectorlogo.zone/logos/leafletjs/leafletjs-icon.svg" "leaflet.svg"
dl "https://cdn.simpleicons.org/stripe/635BFF" "stripe.svg"


echo "Tous les nouveaux logos ont été placés dans public/logos/"
