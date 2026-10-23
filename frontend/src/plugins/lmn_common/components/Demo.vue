<script setup>
import { inject } from 'vue';

/** @type {import('../../../adapter/aj.mjs').Aj} */
const aj = inject('aj');
</script>

<template>
    <section>
        <h1>{{ aj.gettext('Frontend ready') }}</h1>
        <p>{{ aj.identity.user }}</p>
        <small>{{ $gettext('Demo') }}</small>
    </section>
</template>
