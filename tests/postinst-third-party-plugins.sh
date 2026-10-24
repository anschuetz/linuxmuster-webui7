#!/bin/sh
set -eu

repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

# Load the real functions without running package installation. Redirect only
# the fixed venv pip path to our fixture executable.
sed '/^case "\$1" in/,$d' "$repo/debian/postinst" \
    | sed "s|/opt/linuxmuster/bin/pip|$tmp/pip|g" > "$tmp/functions.sh"
cat > "$tmp/run.sh" <<'RUN'
set -e
. "$1/functions.sh"
warn_third_party_plugins
printf 'continued\n' > "$1/continued"
RUN
cat > "$tmp/pip" <<'PIP'
#!/bin/sh
[ "$*" = 'list --format=freeze' ] || exit 2
cat "$PIP_FIXTURE"
exit "${PIP_EXIT:-0}"
PIP
chmod +x "$tmp/pip"
export PIP_FIXTURE="$tmp/packages"
cat > "$PIP_FIXTURE" <<'PACKAGES'
ajenti.plugin.core==1
ajenti.plugin.ace==1
ajenti.plugin.dashboard==1
ajenti.plugin.filesystem==1
ajenti.plugin.plugins==1
ajenti.plugin.settings==1
ajenti.plugin.session-list==1
ajenti.plugin.session_list==1
ajenti.plugin.passwd==1
ajenti.plugin.lmn_users==1
ajenti.plugin.lmn-devices==1
ajenti.plugin.linuxmuster==1
ajenti.plugin.linuxmuster-tools==1
linuxmuster-tools==1
ajenti-panel==1
PACKAGES
sh "$tmp/run.sh" "$tmp" > "$tmp/output"
[ ! -s "$tmp/output" ]
printf '%s\n' 'ajenti.plugin.third-party==1' 'Ajenti.Plugin.Custom_Tool==2' >> "$PIP_FIXTURE"
sh "$tmp/run.sh" "$tmp" > "$tmp/output"
grep -Fq 'The web interface no longer uses AngularJS.' "$tmp/output"
grep -Fq 'ajenti.plugin.third-party' "$tmp/output"
grep -Fq 'Ajenti.Plugin.Custom_Tool' "$tmp/output"
grep -Fq 'window.LmnVue_<plugin>.mount(element, aj)' "$tmp/output"

# Even a failing pip that wrote partial output must not emit a warning or abort.
PIP_EXIT=1 sh "$tmp/run.sh" "$tmp" > "$tmp/output"
[ ! -s "$tmp/output" ]
rm "$tmp/pip" "$tmp/continued"
sh "$tmp/run.sh" "$tmp" > "$tmp/output"
[ ! -s "$tmp/output" ]
[ -s "$tmp/continued" ]
printf 'postinst third-party plugin tests: OK\n'
