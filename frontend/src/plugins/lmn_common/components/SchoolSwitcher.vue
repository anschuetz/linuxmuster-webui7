<script setup>
import { computed, inject, ref } from 'vue';
const aj = inject('aj');
const schools = ref();
const query = ref('');

// Angular filter:query searches all non-$ properties, with recursive ! negation.
function matches(value, term) {
    if (term.startsWith('!')) return !matches(value, term.slice(1));
    if (value == null) return false;
    if (typeof value === 'object') return Object.entries(value).some(([key, item]) => !key.startsWith('$') && matches(item, term));
    return String(value).toLowerCase().includes(term);
}
const shown = computed(() => schools.value?.filter(school => matches(school, query.value.toLowerCase())));
function load() {
    aj.http.get('/api/lmn/activeschool').then(({ data }) => {
        // Publish the shared school context through the shell digest.
        aj.identity.patch({ activeSchool: data });
        return aj.http.post('/api/lmn/get-schoolname', { school: data }).then(({ data }) => {
            aj.identity.patch({ schoolname: data });
        });
    }).catch(() => { /* HTTP error UI belongs to the adapter. */ });
    aj.http.get('/api/lmn/list-schools').then(({ data }) => { schools.value = data; })
        .catch(() => { /* Keep the original unset/previous list on rejection. */ });
}
function switchSchool(school) {
    aj.http.post('/api/lmn/change-school', { school }).then(({ data }) => {
        if (data) aj.notify.success('School changed successfully');
        else aj.notify.error('Failed to change school!');
        load();
    }).catch(() => { /* The adapter handles rejection; Angular did not reload here. */ });
}
// The original gettext service marks this title for extraction, without translating it.
aj.pageTitle.set('Schoolswitcher');
load();
</script>

<template>
    <component :is="'progress-spinner'" v-show="aj.identity.user == null" class="school-spinner">
        <div><div class="one"></div><div class="two"></div></div>
    </component>
    <div v-show="!aj.identity.profile.school_show" class="alert alert-info" style="margin-top:15px;">
        <i class="fa fa-info-circle"></i> <span>{{ aj.gettext('This is not a multi-school setup or you are not allowed to see another school!') }}</span>
    </div>
    <div v-show="aj.identity.user && aj.identity.profile.school_show" style="margin-top:10px;" class="flex-container info-cards">
        <div class="panel panel-info" style="width:100%">
            <div class="panel-heading" style="padding:10px;height:50px;">
                <span style="font-size:18px;line-height:28px;">{{ aj.gettext('Schoolswitcher') }}</span>
            </div>
            <div class="panel-body">
                <ul class="list-group">
                    <li class="list-group-item" style="background-color: lightgreen;"><span style="font-weight: bold;">{{ aj.gettext('Current') }}</span>: {{ aj.identity.profile.activeSchool }} - {{ aj.identity.profile.schoolname }}</li>
                </ul>
                <hr>
                <ul class="list-group">
                    <input v-model.trim="query" type="search" autofocus class="form-control" placeholder="Filter" typeahead-min-length="1">
                    <li v-for="school in shown" :key="school.school" class="list-group-item school-item" style="margin-top: 20px;" @click="switchSchool(school.school)">
                        {{ school.school }} - {{ school.schoolname }}
                        <span class="pull-right"><i class="fa-solid fa-right-left"></i></span>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>
