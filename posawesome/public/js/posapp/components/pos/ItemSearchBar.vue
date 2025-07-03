<template>
  <v-row class="items">
    <v-col class="pb-0">
      <v-text-field density="compact" clearable autofocus variant="solo" color="primary"
        :label="frappe._('Search Items')" hint="Search by item code, serial number, batch no or barcode"
        hide-details
        :model-value="searchValue"
        @update:model-value="$emit('update:searchValue', $event)"
        @keydown.esc="$emit('esc')"
        @keydown.enter="$emit('enter')"
        @click:clear="$emit('clear')"
        prepend-inner-icon="mdi-magnify"
        @focus="$emit('focus')"
        ref="searchInput">
        <template v-slot:append-inner v-if="pos_profile.posa_enable_camera_scanning">
          <v-btn icon="mdi-camera" size="small" color="primary" variant="text" @click="$emit('camera')"
            :title="__('Scan with Camera')">
          </v-btn>
        </template>
      </v-text-field>
    </v-col>
    <v-col cols="3" class="pb-0" v-if="pos_profile.posa_input_qty">
      <v-text-field density="compact" variant="solo" color="primary" :label="frappe._('QTY')" hide-details
        :model-value="qtyValue"
        @update:model-value="$emit('update:qtyValue', $event)"
        type="text" @keydown.enter="$emit('enter')" @keydown.esc="$emit('esc')" @focus="$emit('clear-qty')">
      </v-text-field>
    </v-col>
    <v-col cols="2" class="pb-0" v-if="pos_profile.posa_new_line">
      <v-checkbox :model-value="newLineValue" @update:model-value="$emit('update:newLineValue', $event)" color="accent" value="true" label="NLine" density="default" hide-details></v-checkbox>
    </v-col>
    <v-col cols="12" class="dynamic-margin-xs">
      <div class="settings-container">
        <v-btn density="compact" variant="text" color="primary" prepend-icon="mdi-cog-outline"
          @click="$emit('toggle-settings')" class="settings-btn">
          {{ __('Settings') }}
        </v-btn>
      </div>
    </v-col>
  </v-row>
</template>

<script>
export default {
  name: 'ItemSearchBar',
  props: {
    pos_profile: { type: Object, required: true },
    searchValue: String,
    qtyValue: [Number, String],
    newLineValue: Boolean
  },
  emits: ['update:searchValue','update:qtyValue','update:newLineValue','enter','esc','clear','clear-qty','focus','camera','toggle-settings']
}
</script>
