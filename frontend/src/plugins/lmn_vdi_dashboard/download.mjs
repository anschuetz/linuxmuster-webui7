// Browser download, deliberately retaining the original location.href navigation.
export function download(url) {
    window.location.href = url;
}
