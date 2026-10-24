// Browser integration stays local; all backend calls go through aj.http.
export const browser = {
    open(url) { window.open(url, '_blank'); },
    publicUrl(id) { return `${window.location.origin}/websession/${id}`; },
    copy(text) {
        const element = document.createElement('textarea');
        element.textContent = text;
        document.body.appendChild(element);
        element.select();
        document.execCommand('copy');
        document.body.removeChild(element);
    },
};
