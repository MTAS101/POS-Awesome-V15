<template>
	<v-overlay
		:model-value="loading"
		class="d-flex flex-column align-center justify-center fancy-overlay"
		contained
	>
		<v-progress-linear
			:model-value="progress"
			height="8"
			color="primary"
			rounded
			class="elegant-progress"
		/>
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
	data() {
		return {
			progress: 0,
			intervalId: null,
		};
	},
	watch: {
		loading(val) {
			if (val) {
				this.startProgress();
			} else {
				this.finishProgress();
			}
		},
	},
	mounted() {
		if (this.loading) {
			this.startProgress();
		}
	},
	beforeUnmount() {
		this.clearTimer();
	},
	methods: {
		startProgress() {
			this.clearTimer();
			this.progress = 0;
			this.intervalId = setInterval(() => {
				if (this.progress < 90) {
					this.progress += 5;
				}
			}, 200);
		},
		finishProgress() {
			this.clearTimer();
			this.progress = 100;
			setTimeout(() => {
				this.progress = 0;
			}, 300);
		},
		clearTimer() {
			if (this.intervalId) {
				clearInterval(this.intervalId);
				this.intervalId = null;
			}
		},
	},
};
</script>

<style scoped>
.fancy-overlay {
	backdrop-filter: blur(2px);
}
.elegant-progress {
	width: 60%;
	max-width: 320px;
}
</style>
