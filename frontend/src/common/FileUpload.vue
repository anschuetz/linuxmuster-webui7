<script>
import FlowUpload from './FlowUpload.vue';
// The same setup/render/cleanup, with filesystem endpoints instead of SMB.
export default {
    ...FlowUpload,
    props: {
        ...FlowUpload.props,
        filesystem: { type: Boolean, default: true },
        target: { type: String, default: '/api/filesystem/upload' },
    },
};
</script>
