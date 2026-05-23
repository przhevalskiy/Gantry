#!/usr/bin/env bash
# Monolift — Hetzner CX22 bootstrap script
# Run as root on a fresh Ubuntu 22.04 server:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/monolift/main/deploy/setup.sh | bash
# Or: scp deploy/setup.sh root@<ip>:~ && ssh root@<ip> bash setup.sh
set -euo pipefail

MONOLIFT_USER=monolift
MONOLIFT_HOME=/opt/monolift
REPO_URL="${REPO_URL:-https://github.com/YOUR_ORG/monolift.git}"
DOMAIN_API="${DOMAIN_API:-api.monolift.dev}"
DOMAIN_PLATFORM="${DOMAIN_PLATFORM:-platform.monolift.dev}"
EMAIL_CERTBOT="${EMAIL_CERTBOT:-ops@monolift.dev}"

log() { echo -e "\n\033[1;34m==>\033[0m $*"; }

# ── System packages ────────────────────────────────────────────────────────────
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

# ── monolift system user ───────────────────────────────────────────────────────
log "Creating system user: $MONOLIFT_USER"
if ! id "$MONOLIFT_USER" &>/dev/null; then
    useradd --system --shell /bin/bash --home "$MONOLIFT_HOME" \
        --create-home "$MONOLIFT_USER"
fi
usermod -aG docker "$MONOLIFT_USER"

# ── Clone repo ────────────────────────────────────────────────────────────────
log "Cloning repository to $MONOLIFT_HOME"
if [ ! -d "$MONOLIFT_HOME/.git" ]; then
    git clone "$REPO_URL" "$MONOLIFT_HOME"
    chown -R "$MONOLIFT_USER:$MONOLIFT_USER" "$MONOLIFT_HOME"
else
    log "Repo already present — pulling latest"
    sudo -u "$MONOLIFT_USER" git -C "$MONOLIFT_HOME" pull
fi

# ── Clone Agentex (Scale AI middleware) ───────────────────────────────────────
log "Cloning Agentex platform"
AGENTEX_DIR="$MONOLIFT_HOME/scale-agentex/agentex"
if [ ! -d "$AGENTEX_DIR" ]; then
    sudo -u "$MONOLIFT_USER" mkdir -p "$MONOLIFT_HOME/scale-agentex"
    sudo -u "$MONOLIFT_USER" git clone \
        https://github.com/scaleapi/agentex.git "$AGENTEX_DIR"
fi

# ── Python virtualenv ─────────────────────────────────────────────────────────
log "Creating Python virtualenv at $MONOLIFT_HOME/.venv"
sudo -u "$MONOLIFT_USER" bash -c "
    cd $MONOLIFT_HOME
    uv venv .venv --python python3.12
    source .venv/bin/activate
    uv pip install -e '.[api]' --quiet
    uv pip install -e '$AGENTEX_DIR' --quiet
"

# ── Gantry directories ────────────────────────────────────────────────────────
log "Creating Gantry data directories"
sudo -u "$MONOLIFT_USER" mkdir -p "$MONOLIFT_HOME/.gantry"

# ── .env file check ───────────────────────────────────────────────────────────
if [ ! -f "$MONOLIFT_HOME/.env" ]; then
    log "WARNING: No .env found — copying example template"
    cp "$MONOLIFT_HOME/.env.production.example" "$MONOLIFT_HOME/.env"
    chown "$MONOLIFT_USER:$MONOLIFT_USER" "$MONOLIFT_HOME/.env"
    chmod 600 "$MONOLIFT_HOME/.env"
    echo ""
    echo "  !!! ACTION REQUIRED !!!"
    echo "  Edit $MONOLIFT_HOME/.env and fill in all required values"
    echo "  Then run: systemctl restart gantry-api gantry-worker"
    echo ""
fi

# ── Systemd services ──────────────────────────────────────────────────────────
log "Installing systemd services"
cp "$MONOLIFT_HOME/deploy/gantry-api.service" /etc/systemd/system/
cp "$MONOLIFT_HOME/deploy/gantry-worker.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable gantry-api gantry-worker

# ── Temporal dynamic config ───────────────────────────────────────────────────
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
chown -R "$MONOLIFT_USER:$MONOLIFT_USER" "$AGENTEX_DIR/temporal"

# ── Docker Compose (Agentex stack) ────────────────────────────────────────────
log "Starting Agentex Docker stack"
sudo -u "$MONOLIFT_USER" docker compose \
    -f "$MONOLIFT_HOME/deploy/docker-compose.prod.yml" \
    up -d --build

log "Waiting for Agentex to be healthy (up to 120s)..."
for i in $(seq 1 24); do
    if curl -sf http://localhost:5003/health &>/dev/null; then
        log "Agentex is up"
        break
    fi
    sleep 5
done

# ── Nginx ─────────────────────────────────────────────────────────────────────
log "Configuring Nginx"
cp "$MONOLIFT_HOME/deploy/nginx.conf" /etc/nginx/sites-available/monolift
ln -sf /etc/nginx/sites-available/monolift /etc/nginx/sites-enabled/monolift
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
log "Done. Remember to fill in /opt/monolift/.env if not already done."
