// Core 0.116's file endpoint accepts \w+ plugin segments. The legacy Device
// Manager has a dotted metadata ID and a hyphenated directory; serve its IIFE
// through our existing common package without patching the stock resource server.
export function pluginResource(directory) {
    return {
        id: directory === 'lmn_device-manager' ? 'lmn.device-manager' : directory,
        resource: `${directory === 'lmn_device-manager' ? 'lmn_common' : directory}/resources/vue/${directory}.js`,
    };
}
