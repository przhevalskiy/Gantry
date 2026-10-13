#!/usr/bin/env bash
# Gantry — Hetzner CX22 bootstrap script
# Run as root on a fresh Ubuntu 22.04 server:
#   curl -fsSL https://raw.githubusercontent.com/przhevalskiy/Gantry/main/deploy/setup.sh | bash
# Or: scp deploy/setup.sh root@<ip>:~ && ssh root@<ip> bash setup.sh
set -euo pipefail

GANTRY_USER=gantry
GANTRY_HOME=/opt/gantry
REPO_URL="${REPO_URL:-https://github.com/przhevalskiy/Gantry.git}"
DOMAIN_API="${DOMAIN_API:-api.gantry.dev}"
DOMAIN_PLATFORM="${DOMAIN_PLATFORM:-platform.gantry.dev}"
EMAIL_CERTBOT="${EMAIL_CERTBOT:-ops@gantry.dev}"
# bundle = start deploy/agentex compose on this host (default CX22 path)
# external = attach to an existing Agentex cluster (set AGENTEX_BASE_URL + TEMPORAL_ADDRESS)
AGENTEX_MODE="${AGENTEX_MODE:-bundle}"

log() { echo -e "\n\033[1;34m==>\033[0m $*"; }

# ── System packages ────────────────────────────────────��───────────────────────
log "Updating system packages"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    curl git nginx certbot python3-certbot-nginx \
    ca-certificates gnupg lsb-release ufw jq

# ── Docker ─────────────────────────────────────────────────────────────────────
log "Installing Docker"
if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker

# ── Python 3.12 + uv ──────────────────────────────────────────────────────────
log "Installing Python 3.12 and uv"
if ! python3.12 --version &>/dev/null; then
    apt-get install -y -qq software-properties-common
    add-apt-repository -y ppa:deadsnakes/ppa
    apt-get update -qq
    apt-get install -y -qq python3.12 python3.12-venv python3.12-dev
fi
if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    ln -sf "$HOME/.local/bin/uv" /usr/local/bin/uv
fi

# ── GitHub CLI (gh) ────────────────────────────────────────────────────────────
log "Installing GitHub CLI"
if ! command -v gh &>/dev/null; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
        https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list
    apt-get update -qq
    apt-get install -y -qq gh
fi

# ── Gantry system user ─────────────────────────────────────────────────────────
log "Creating system user: $GANTRY_USER"
if ! id "$GANTRY_USER" &>/dev/null; then
    useradd --system --shell /bin/bash --home "$GANTRY_HOME" \
        --create-home "$GANTRY_USER"
fi
usermod -aG docker "$GANTRY_USER"

# ── Clone repo ────────────────────────────────────────────────────────────────
log "Cloning repository to $GANTRY_HOME"
if [ ! -d "$GANTRY_HOME/.git" ]; then
    git clone "$REPO_URL" "$GANTRY_HOME"
    chown -R "$GANTRY_USER:$GANTRY_USER" "$GANTRY_HOME"
else
    log "Repo already present — pulling latest"
    sudo -u "$GANTRY_USER" git -C "$GANTRY_HOME" pull
fi

# ── Agentex source (needed for bundled compose image build) ───────────────────
AGENTEX_DIR="$GANTRY_HOME/scale-agentex/agentex"
if [ "$AGENTEX_MODE" = "bundle" ]; then
    log "Cloning Agentex platform (dependency stack — AGENTEX_MODE=bundle)"
    if [ ! -d "$AGENTEX_DIR" ]; then
        sudo -u "$GANTRY_USER" mkdir -p "$GANTRY_HOME/scale-agentex"
        sudo -u "$GANTRY_USER" git clone \
            https://github.com/scaleapi/agentex.git "$AGENTEX_DIR"
    fi
else
    log "AGENTEX_MODE=external — skipping Agentex clone; will attach to existing cluster"
fi

# ── Python virtualenv ─────────────────────────────────────────────────────────
log "Creating Python virtualenv at $GANTRY_HOME/.venv"
sudo -u "$GANTRY_USER" bash -c "
    cd $GANTRY_HOME
    uv venv .venv --python python3.12
    source .venv/bin/activate
    uv sync --extra dev --quiet
"

# ── Gantry data directories ───────────────────────────────────────────────────
log "Creating Gantry data directories"
sudo -u "$GANTRY_USER" mkdir -p "$GANTRY_HOME/.gantry"

# ── .env file check ───────────────────────────────────────────────────────────
if [ ! -f "$GANTRY_HOME/.env" ]; then
    log "WARNING: No .env found — copying example template"
    cp "$GANTRY_HOME/.env.production.example" "$GANTRY_HOME/.env"
    chown "$GANTRY_USER:$GANTRY_USER" "$GANTRY_HOME/.env"
    chmod 600 "$GANTRY_HOME/.env"
    echo ""
    echo "  !!! ACTION REQUIRED !!!"
    echo "  Edit $GANTRY_HOME/.env and fill in all required values"
    echo "  Then run: systemctl restart gantry-api gantry-worker"
    echo ""
fi

# ── Systemd services ──────────────────────────────────────────────────────────
log "Installing systemd services"
cp "$GANTRY_HOME/deploy/gantry-api.service" /etc/systemd/system/
cp "$GANTRY_HOME/deploy/gantry-worker.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable gantry-api gantry-worker

# ── Agentex runtime ───────────────────────────────────────────────────────────
if [ "$AGENTEX_MODE" = "bundle" ]; then
    log "Ensuring Temporal dynamic config exists"
    DYNCONF_DIR="$AGENTEX_DIR/temporal/dynamicconfig"
    mkdir -p "$DYNCONF_DIR"
    if [ ! -f "$DYNCONF_DIR/development-sql.yaml" ]; then
        cat > "$DYNCONF_DIR/development-sql.yaml" <<'EOF'
limit.maxIDLength:
  - value: 255
    constraints: {}
system.forceSearchAttributesCacheRefreshOnRead:
  - value: true
    constraints: {}
EOF
    fi
    chown -R "$GANTRY_USER:$GANTRY_USER" "$AGENTEX_DIR/temporal"

    log "Starting Agentex dependency stack (deploy/agentex — not Gantry services)"
    echo "GANTRY_HOME=$GANTRY_HOME" > "$GANTRY_HOME/deploy/.env"
    sudo -u "$GANTRY_USER" docker compose \
        --env-file "$GANTRY_HOME/deploy/.env" \
        -f "$GANTRY_HOME/deploy/agentex/docker-compose.yml" \
        up -d --build

    log "Waiting for Agentex to be healthy (up to 120s)..."
    for i in $(seq 1 24); do
        if curl -sf http://localhost:5003/health &>/dev/null; then
            log "Agentex is up"
            break
        fi
        sleep 5
    done
else
    log "External Agentex — require AGENTEX_BASE_URL and TEMPORAL_ADDRESS in $GANTRY_HOME/.env"
    if [ -f "$GANTRY_HOME/.env" ]; then
        # shellcheck disable=SC1090
        set -a; source "$GANTRY_HOME/.env"; set +a
    fi
    if [ -z "${AGENTEX_BASE_URL:-}" ] || [ -z "${TEMPORAL_ADDRESS:-}" ]; then
        echo "ERROR: AGENTEX_MODE=external requires AGENTEX_BASE_URL and TEMPORAL_ADDRESS"
        exit 1
    fi
    log "Will attach gantry-api/worker to $AGENTEX_BASE_URL / $TEMPORAL_ADDRESS"
fi

# ── Nginx ─────────────────────────────────────────────────────────────────────
log "Configuring Nginx"
# Substitute domain names into nginx config
sed \
    -e "s/api\.gantry\.dev/$DOMAIN_API/g" \
    -e "s/platform\.gantry\.dev/$DOMAIN_PLATFORM/g" \
    "$GANTRY_HOME/deploy/nginx.conf" > /etc/nginx/sites-available/gantry
ln -sf /etc/nginx/sites-available/gantry /etc/nginx/sites-enabled/gantry
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx

# ── Certbot / Let's Encrypt ───────────────────────────────────────────────────
log "Obtaining SSL certificates"
certbot --nginx \
    -d "$DOMAIN_API" -d "$DOMAIN_PLATFORM" \
    --non-interactive --agree-tos \
    -m "$EMAIL_CERTBOT" \
    --redirect

# ── Firewall ──────────────────────────────────────────────────────────────────
log "Configuring UFW firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── Start Gantry services ─────────────────────────────────────────────────────
log "Starting Gantry API and Worker"
systemctl start gantry-api
systemctl start gantry-worker

# ── Final status ──────────────────────────────────────────────────────────────
log "Setup complete. Service status:"
systemctl is-active gantry-api    && echo "  gantry-api    : running" || echo "  gantry-api    : STOPPED (check .env)"
systemctl is-active gantry-worker && echo "  gantry-worker : running" || echo "  gantry-worker : STOPPED (check .env)"
systemctl is-active nginx         && echo "  nginx         : running"

echo ""
echo "  https://$DOMAIN_API/health"
echo "  https://$DOMAIN_API/docs"
echo ""
echo "  After Vercel deploy, run on this server:"
echo "    bash $GANTRY_HOME/deploy/configure-ui-origin.sh https://<your-vercel-url>"
echo ""
log "Done. Remember to fill in $GANTRY_HOME/.env if not already done."
