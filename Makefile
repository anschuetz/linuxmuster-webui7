## Flag for custom config file
CONFIGFILE := ''
AJENTI_PANEL ?= $(or $(wildcard /usr/local/bin/ajenti-panel),/opt/linuxmuster/bin/ajenti-panel)

all: build

deb:
	dpkg-buildpackage -rfakeroot -tc -sa -us -uc -I".github" -I".git" -I"buildpackage.sh" -I".crowdin.key" -I".deepsource.toml" -I"docs" -I"docs_src" 

build:
	node frontend/check-translations.mjs
	cd frontend && npm ci && npm run build

run:
	$(AJENTI_PANEL) -v --autologin --stock-plugins --plugins usr/lib/linuxmuster-webui/plugins $(CONFIGFILE)

rundev:
	$(AJENTI_PANEL) -v --autologin --stock-plugins --plugins usr/lib/linuxmuster-webui/plugins --dev $(CONFIGFILE)

rundevlogin:
	$(AJENTI_PANEL) -v --stock-plugins --plugins usr/lib/linuxmuster-webui/plugins --dev $(CONFIGFILE)

runprod:
	$(AJENTI_PANEL) --stock-plugins --plugins usr/lib/linuxmuster-webui/plugins $(CONFIGFILE)

push-crowdin:
	ajenti-dev-multitool --xgettext
	ajenti-dev-multitool --push-crowdin

pull-crowdin:
	ajenti-dev-multitool --pull-crowdin
	ajenti-dev-multitool --msgfmt

add-crowdin:
	ajenti-dev-multitool --xgettext
	ajenti-dev-multitool --add-crowdin

doc:
	/opt/linuxmuster/bin/python3 /usr/local/bin/sphinx-build -b html -d docs/doctrees  docs_src docs

##################################################
## Will be later activated
# test:
# 	cd e2e && ./run
#
# webdriver:
# 	cd e2e && node_modules/protractor/bin/webdriver-manager start
#
# webdriver-update:
# 	cd e2e && node_modules/protractor/bin/webdriver-manager update
#
# karma:
# 	cd tests-karma && node_modules/karma/bin/karma start karma.conf.coffee --no-single-run --auto-watch
#
# nose:
# 	cd tests-nose && nosetests tests/
