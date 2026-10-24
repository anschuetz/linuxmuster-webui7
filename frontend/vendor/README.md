# Pinned static shell assets

Copied without JavaScript wrappers from the P106 release archives:
- ajenti.plugin.core 0.116: Bootstrap 3.3.7/Ajenti compiled CSS, Toaster/loadingbar CSS, Glyphicons fonts.
- ajenti.plugin.ace 0.32: Ace 1.4.1 minified distribution and editor CSS.
- ajenti.plugin.dashboard 0.42: dashboard CSS.
- ajenti.plugin.filesystem 0.51: standalone Flow.js 2.14.1.

`SHA256.json` records these exact inputs. Upstream license notices are retained;
Ajenti source is MIT (AJENTI-LICENSE, https://github.com/ajenti/ajenti/blob/master/LICENSE). Bootstrap/Ace/Flow and CSS licenses accompany
the assets. npm builds copy Ace/Flow/fonts and concatenate CSS, relocating only
Bootstrap's font URLs. No Angular JavaScript is included. Stock packages stay
installed and unchanged; Fontawesome/PT Sans remain direct stock resources.
