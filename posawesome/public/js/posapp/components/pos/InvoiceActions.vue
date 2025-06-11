<template>
  <v-row dense>
    <v-col cols="6">
      <v-btn block color="accent" theme="dark" prepend-icon="mdi-content-save" @click="$emit('save-and-clear')">
        {{ __('Save & Clear') }}
      </v-btn>
    </v-col>
    <v-col cols="6">
      <v-btn block color="warning" theme="dark" prepend-icon="mdi-file-document" @click="$emit('load-drafts')">
        {{ __('Load Drafts') }}
      </v-btn>
    </v-col>
    <v-col cols="6" v-if="pos_profile.custom_allow_select_sales_order == 1">
      <v-btn block color="info" theme="dark" prepend-icon="mdi-book-search" @click="$emit('select-order')">
        {{ __('Select S.O') }}
      </v-btn>
    </v-col>
    <v-col cols="6">
      <v-btn block color="error" theme="dark" prepend-icon="mdi-close-circle" @click="$emit('cancel-sale')">
        {{ __('Cancel Sale') }}
      </v-btn>
    </v-col>
    <v-col cols="6" v-if="pos_profile.posa_allow_return == 1">
      <v-btn block color="secondary" theme="dark" prepend-icon="mdi-backup-restore" @click="$emit('open-returns')">
        {{ __('Sales Return') }}
      </v-btn>
    </v-col>
    <v-col cols="6" v-if="pos_profile.posa_allow_print_draft_invoices">
      <v-btn block color="primary" theme="dark" prepend-icon="mdi-printer" @click="$emit('print-draft')">
        {{ __('Print Draft') }}
      </v-btn>
    </v-col>
    <v-col cols="12">
      <v-btn block color="success" theme="dark" size="large" prepend-icon="mdi-credit-card" @click="$emit('show-payment')">
        {{ __('PAY') }}
      </v-btn>
    </v-col>
  </v-row>
</template>

<script>
export default {
  props: {
    pos_profile: Object,
  },
  emits: [
    'save-and-clear',
    'load-drafts',
    'select-order',
    'cancel-sale',
    'open-returns',
    'print-draft',
    'show-payment'
  ]
};
</script>
