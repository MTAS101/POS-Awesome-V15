<template>
	<v-overlay
		:model-value="loading"
		class="d-flex flex-column align-center justify-center fancy-overlay"
		contained
	>
		<v-progress-circular indeterminate size="64" width="6" color="primary" />
		<div class="mt-4 text-subtitle-1">{{ message }}</div>
	</v-overlay>
</template>

<script>
export default {
	name: "LoadingOverlay",
	props: {
		loading: {
			type: Boolean,
			default: false,
		},
		message: {
			type: String,
			default: "",
		},
	},
};
</script>

<style scoped>
.fancy-overlay {
	backdrop-filter: blur(2px);
}
</style>
