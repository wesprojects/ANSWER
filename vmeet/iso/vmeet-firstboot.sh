#!/bin/bash
# First boot of a server installed from the VMEET ISO: install VMEET from the copy the
# installer left in /opt/vmeet-media (no internet needed), then hand tty1 to the setup
# walk-through (vmeet-welcome.service). Runs on tty1 under vmeet-firstboot.service until it
# succeeds; the log is /var/log/vmeet-first-boot.log.
set -uo pipefail
LOG=/var/log/vmeet-first-boot.log
MEDIA=/opt/vmeet-media
exec > >(tee -a "$LOG") 2>&1

clear 2>/dev/null || true
echo "============================================================"
echo "  VMEET - finishing the installation ($(date '+%Y-%m-%d %H:%M'))"
echo "============================================================"

echo "== waiting for cloud-init to finish (up to 5 minutes)"
timeout 300 cloud-init status --wait >/dev/null 2>&1 || echo "   cloud-init still busy; going on"

echo "== waiting for a network address (up to 60 seconds)"
for _ in $(seq 1 60); do
  hostname -I 2>/dev/null | grep -qE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' && break
  sleep 1
done
echo "   addresses: $(hostname -I 2>/dev/null || echo none)"

if [ ! -f /var/lib/vmeet/.installed-from-media ]; then
  [ -f "$MEDIA/app/install.sh" ] || { echo "!! $MEDIA/app/install.sh is missing"; exit 1; }
  echo "== installing VMEET"
  if ! bash "$MEDIA/app/install.sh"; then
    echo "!! install.sh failed; trying again in 30 seconds (log: $LOG)"
    exit 1
  fi
  if [ -d "$MEDIA/pkgs" ]; then
    install -d -m 755 /opt/vmeet/pkgs
    cp -a "$MEDIA/pkgs/." /opt/vmeet/pkgs/
  fi
  touch /var/lib/vmeet/.installed-from-media
fi

systemctl disable vmeet-firstboot.service >/dev/null 2>&1 || true
echo "== done. The setup menu starts on this screen; it can be run again any time with:"
echo "      sudo vmeet-setup"
touch /run/vmeet-welcome-pending
systemctl --no-block start vmeet-welcome.service
exit 0
