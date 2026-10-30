#!/usr/bin/env bash
# Run once on the Pi from inside this folder:  bash install-kiosk.sh
# Sets up a local web server (systemd) + Chromium kiosk autostart (labwc / Pi OS Bookworm+).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8080
BROWSER="$(command -v chromium-browser || command -v chromium || true)"
[ -z "$BROWSER" ] && { echo "Chromium not found. sudo apt install chromium-browser"; exit 1; }

# 1) local web server
sudo tee /etc/systemd/system/hestia-web.service >/dev/null <<UNIT
[Unit]
Description=Seas of Hestia local web server
After=network.target

[Service]
User=$USER
WorkingDirectory=$DIR
SupplementaryGroups=dialout
ExecStart=/usr/bin/python3 $DIR/server.py
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable hestia-web
sudo systemctl restart hestia-web

# 2) Chromium kiosk on login
mkdir -p "$HOME/.config/labwc"
AUTOSTART="$HOME/.config/labwc/autostart"
touch "$AUTOSTART"
sed -i '/# hestia-kiosk/,/# end-hestia-kiosk/d' "$AUTOSTART"
cat >> "$AUTOSTART" <<AUTO
# hestia-kiosk
until curl -s http://127.0.0.1:$PORT >/dev/null; do sleep 1; done
$BROWSER --kiosk --password-store=basic --noerrdialogs --disable-infobars --incognito \\
  --check-for-update-interval=31536000 --disable-pinch \\
  --overscroll-history-navigation=0 --disable-translate \\
  http://127.0.0.1:$PORT &
# end-hestia-kiosk
AUTO

echo "Done. Also set: sudo raspi-config -> System Options -> Boot/Auto Login -> Desktop Autologin,"
echo "and Display Options -> Screen Blanking -> Disable. Then: sudo reboot"
