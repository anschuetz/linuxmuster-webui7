<script setup>
import { inject, onBeforeUnmount, ref } from 'vue';

const aj = inject('aj');
const ready = ref(false);
const installed = ref(false);
const containers = ref();
const images = ref();
const details = ref();
const active = ref('Container');
let refresh;
let disposed = false;
const base = '/api/lmn/docker';
const notices = { start: 'Start command successfully sent.', stop: 'Stop command successfully sent.', rm: 'Remove command successfully sent.' };
aj.pageTitle.set('Docker');

async function resources() {
    try {
        const { data } = await aj.http.get(`${base}/containers`, { ignoreLoadingBar: true });
        containers.value = data;
        ready.value = true;
    } catch { /* As in the original, keep the previous/loading state; adapter handles HTTP errors. */ }
}
function startRefresh() {
    if (refresh === undefined && !disposed) refresh = setInterval(resources, 5000);
}
function stopRefresh() {
    clearInterval(refresh);
    refresh = undefined;
}
async function initialize() {
    try {
        await aj.http.get(`${base}/which`);
        if (disposed) return;
        resources();
        startRefresh();
        installed.value = true;
    } catch {
        ready.value = true;
        installed.value = false;
    }
}
async function showDetails(id) {
    try { details.value = (await aj.http.get(`${base}/container/${id}`)).data; }
    catch { /* The original leaves the details dialog unchanged on HTTP failure. */ }
}
async function command(id, control) {
    try {
        await aj.http.post(`${base}/container_command`, { container_id: id, control });
        aj.notify.success(aj.gettext(notices[control]));
    } catch { /* HTTP errors are presented by the adapter, as in the original. */ }
}
async function select(tab) {
    active.value = tab;
    if (tab === 'Container') return startRefresh();
    stopRefresh();
    try { images.value = (await aj.http.get(`${base}/images`)).data; }
    catch { /* Keep the previous/loading images state. */ }
}
async function remove(id, image = false) {
    try {
        await aj.messagebox.show({ text: aj.gettext(image ? 'Really remove this image?' : 'Really remove this container?'), positive: aj.gettext('Remove'), negative: aj.gettext('Cancel') });
    } catch { return; /* Confirmation cancelled. */ }
    if (!image) return command(id, 'rm');
    try {
        await aj.http.delete(`${base}/image/${id}`);
        aj.notify.success(aj.gettext(notices.rm));
        // Preserve the old splice loop's skip of the next adjacent duplicate,
        // while replacing arrays instead of mutating backend response objects.
        let remaining = images.value;
        for (let i = 0; i < remaining.length; i++) {
            if (remaining[i].hash == id) remaining = remaining.filter((_, index) => index !== i);
        }
        images.value = remaining;
    } catch (error) { aj.notify.error(error.data.message); }
}
onBeforeUnmount(() => { disposed = true; stopRefresh(); });
initialize();
</script>

<template>
    <br>
    <component :is="'progress-spinner'" v-if="!ready" role="progressbar"><div><div class="one"></div><div class="two"></div></div></component>
    <div v-if="ready && !installed" class="alert alert-info">{{ aj.gettext('Docker is not installed on this host.') }}</div>
    <div v-if="installed">
        <ul class="nav nav-tabs c7-tabs" role="tablist">
            <li v-for="tab in ['Container', 'Images']" :key="tab" class="nav-item" role="presentation"><a class="nav-link" :class="{ active: active === tab }" href="" role="tab" :aria-selected="active === tab" @click.prevent="select(tab)">{{ tab }}</a></li>
        </ul>
        <div v-if="active === 'Container'" class="tab-pane active" role="tabpanel">
            <div v-if="ready && containers?.length === 0" class="alert alert-info">{{ aj.gettext('No container on this host.') }}</div>
            <table v-if="containers?.length > 0" class="table">
                <thead><tr><th v-for="label in ['Name (Hash)', 'Memory usage', 'Cpu usage', 'Network used']" :key="label">{{ aj.gettext(label) }}</th><th></th><th></th></tr></thead>
                <tbody><tr v-for="(container, index) in containers" :key="index">
                    <td @click="showDetails(container.Container)">{{ container.Name }}<br><span class="badge">{{ container.Container }}</span></td>
                    <td><span v-if="container.PIDs != 0">{{ container.MemUsage }}</span></td>
                    <td><span v-if="container.PIDs != 0">{{ container.CPUPerc }}</span></td>
                    <td><span v-if="container.PIDs != 0">{{ container.NetIO }}</span></td>
                    <td><button v-if="container.PIDs != 0" class="btn btn-flat" @click="command(container.Container, 'stop')"><i class="fas fa-stop"></i></button><button v-else class="btn btn-flat" @click="command(container.Container, 'start')"><i class="fas fa-play"></i></button></td>
                    <td><button class="btn btn-flat" @click="remove(container.Container)"><i class="fas fa-trash"></i></button></td>
                </tr></tbody>
            </table>
            <div v-if="details" class="modal show" role="dialog" aria-modal="true" style="display:block">
                <div class="modal-dialog"><div class="modal-content">
                    <div class="modal-header"><h4>{{ details.Name }}<span class="badge float-end">{{ details.Config?.Hostname }}</span></h4></div>
                    <div class="modal-body"><table class="table"><tbody>
                        <tr><td>{{ aj.gettext('Full id') }}</td><td>{{ details.Id }}</td></tr>
                        <tr><td>{{ aj.gettext('Created at') }}</td><td>{{ details.Created }}</td></tr>
                        <tr v-for="(network, key) in details.NetworkSettings?.Networks" :key="key"><td>{{ aj.gettext('IP') }}</td><td>{{ network.IPAddress }}</td></tr>
                        <tr v-for="(bindings, port) in details.NetworkSettings?.Ports" :key="port"><td>{{ aj.gettext('Ports') }}</td><td>{{ port }} -> {{ bindings?.[0]?.HostPort }}</td></tr>
                        <tr v-for="(volume, index) in details.Mounts" :key="index"><td>{{ aj.gettext('Volumes') }}</td><td>{{ volume.Source }} ({{ volume.Type }}) -> {{ volume.Destination }}</td></tr>
                    </tbody></table></div>
                    <div class="modal-footer"><a class="btn c7-button btn-flat" @click="details = undefined">{{ aj.gettext('Close') }}</a></div>
                </div></div>
            </div>
        </div>
        <div v-else class="tab-pane active" role="tabpanel">
            <div v-if="images?.length === 0" class="alert alert-info">{{ aj.gettext('No docker images on this host.') }}</div>
            <table v-if="images?.length > 0" class="table">
                <thead><tr><th v-for="label in ['Repository', 'Created', 'Tag', 'Size']" :key="label">{{ aj.gettext(label) }}</th><th></th></tr></thead>
                <tbody><tr v-for="(image, index) in images" :key="index"><td>{{ image.Repository }}</td><td>{{ image.CreatedSince }}</td><td>{{ image.Tag }}</td><td>{{ image.Size }}</td><td><button class="btn btn-flat" @click="remove(image.hash, true)"><i class="fas fa-trash"></i></button></td></tr></tbody>
            </table>
        </div>
    </div>
</template>
