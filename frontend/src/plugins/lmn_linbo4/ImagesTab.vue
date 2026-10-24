<script setup>
import { inject } from 'vue';
import { imageBytes } from './images.mjs';
const props = defineProps({ images: Array });
const emit = defineEmits(['edit-image', 'duplicate-image']);
const aj = inject('aj');
</script>

<template>
    <br>
    <div v-if="images?.length === 0" class="alert alert-info">{{ aj.gettext("There's no image on the server yet.") }}</div>
    <table v-if="images?.length" class="table">
        <thead><tr><th>{{ aj.gettext('Name') }}</th><th style="min-width:100px">{{ aj.gettext('Differential image') }}</th><th>{{ aj.gettext('Used in group ...') }}</th><th colspan="2">{{ aj.gettext('Actions') }}</th></tr></thead>
        <tbody><tr v-for="(image, index) in props.images" :key="index">
            <td><b data-name>{{ image.name }}</b><br><i>{{ imageBytes(image.size, aj.gettext) }}</i></td>
            <td><b>{{ image.diff_image?.name }} <button v-if="image.diff_image?.name" data-action="edit-diff" class="btn btn-default btn-xs" @click="emit('edit-image', image.diff_image)"><i class="fa fa-cog fa-xs"></i></button></b><br><i>{{ imageBytes(image.diff_image?.size, aj.gettext) }}</i></td>
            <td><span v-for="(group, groupIndex) in image.used_in" :key="groupIndex" class="label label-success" style="display:inline-block">{{ group }}</span></td>
            <td width="1"><button v-if="!image.error" data-action="edit" class="btn btn-default" @click="emit('edit-image', image)"><i class="fa fa-cog"></i></button></td>
            <td width="1"><button data-action="duplicate" class="btn btn-default" @click="emit('duplicate-image', image)"><i class="fa fa-copy"></i></button></td>
        </tr></tbody>
    </table>
    <br>
</template>
