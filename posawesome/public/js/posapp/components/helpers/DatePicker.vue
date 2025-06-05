<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    transition="scale-transition"
    offset-y
    min-width="auto"
  >
    <template v-slot:activator="{ props }">
      <v-text-field
        v-model="display"
        :label="label"
        readonly
        v-bind="props"
        clearable
        @click:clear="clearValue"
        hide-details
        density="compact"
        color="primary"
        outlined
      />
    </template>
    <v-date-picker
      v-model="inner"
      no-title
      scrollable
      color="primary"
      :min="min"
      :max="max"
      @update:model-value="onSelect"
    />
  </v-menu>
</template>

<script>
export default {
  name: 'DatePicker',
  props: {
    modelValue: [String, Date],
    label: String,
    min: String,
    max: String
  },
  emits: ['update:modelValue'],
  data() {
    return {
      menu: false,
      inner: this.modelValue,
      display: ''
    };
  },
  watch: {
    modelValue(val) {
      this.inner = val;
      this.formatDisplay();
    }
  },
  mounted() {
    this.formatDisplay();
  },
  methods: {
    onSelect(val) {
      this.menu = false;
      this.inner = val;
      this.$emit('update:modelValue', val);
      this.formatDisplay();
    },
    clearValue() {
      this.inner = null;
      this.display = '';
      this.$emit('update:modelValue', null);
    },
    formatDisplay() {
      if (!this.inner) {
        this.display = '';
        return;
      }
      const d = new Date(this.inner);
      if (isNaN(d)) {
        this.display = this.inner;
        return;
      }
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      this.display = `${day}-${month}-${year}`;
    }
  }
};
</script>
